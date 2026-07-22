import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { JWT_ACCESS_SECRET } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role: string;
    ageAttested?: boolean;
    sessionId?: string;
    authTime?: number;
  };
  requestId?: string;
}

import { logWarn } from '../utils/logger.js';

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  req.requestId = req.requestId || uuidv4();

  if (req.user) {
    next();
    return;
  }

  const normalizePath = (value: string): string => {
    const withoutQuery = value.split('?')[0];
    const normalized = withoutQuery.replace(/\/+$/, '');
    return normalized || '/';
  };
  // Express can expose a mount-relative `path`; `originalUrl` retains the
  // app-level route. Compare both, exactly, so public credentials never widen
  // access through prefix matching.
  const requestPaths = new Set([
    normalizePath(req.path || ''),
    normalizePath(req.originalUrl || req.url || ''),
  ]);
  const PUBLIC_PATHS = [
    '/health',
    '/v1/auth/apple',
    '/v1/auth/age-gate',
    '/v1/auth/refresh',
    '/v1/privacy/delete/status',
    '/privacy/delete/status',
    '/delete/status',
    '/v1/privacy/delete/cancel',
    '/privacy/delete/cancel',
    '/delete/cancel',
    '/v1/webhooks/apple/app-store',
    '/webhooks/apple/app-store',
  ];
  if (PUBLIC_PATHS.some((path) => requestPaths.has(path))) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = JWT_ACCESS_SECRET;
    const decoded = jwt.verify(token, secret) as { userId: string; role: string; email?: string; sessionId?: string };

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Forbidden', message: 'Account is suspended' });
      return;
    }

    if (user.status === 'deleted') {
      res.status(403).json({ error: 'Forbidden', message: 'Account has been deleted' });
      return;
    }

    if (user.status === 'deletion_pending') {
      if (
        requestPaths.has('/v1/privacy/delete/cancel')
        || requestPaths.has('/privacy/delete/cancel')
        || requestPaths.has('/delete/cancel')
      ) {
        // Allow cancellation requests to proceed
      } else {
        res.status(403).json({ error: 'Forbidden', message: 'Account is pending deletion and access is blocked.' });
        return;
      }
    }

    // Verify database session if present in token
    if (decoded.sessionId) {
      const [session] = await db.select().from(sessions).where(eq(sessions.id, decoded.sessionId)).limit(1);
      if (!session) {
        res.status(401).json({ error: 'Unauthorized', message: 'Session not found' });
        return;
      }
      if (session.revokedAt) {
        res.status(401).json({ error: 'Unauthorized', message: 'Session has been revoked' });
        return;
      }
      if (new Date() > new Date(session.expiresAt)) {
        res.status(401).json({ error: 'Unauthorized', message: 'Session has expired' });
        return;
      }
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      ageAttested: user.ageAttested ?? false,
      sessionId: decoded.sessionId,
      authTime: (decoded as any).authTime,
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token expired or invalid' });
  }
}

/**
 * Middleware ensuring sensitive actions require re-authentication within the past 5 minutes.
 */
export async function recentAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authTime = req.user?.authTime;
  if (authTime) {
    if (Math.floor(Date.now() / 1000) - authTime <= 300) {
      next();
      return;
    } else {
      res.status(401).json({ error: 'ReauthenticationRequired', message: 'Reauthentication expired. Please reauthenticate.' });
      return;
    }
  }

  const sessionId = req.user?.sessionId;
  if (sessionId) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!session || !session.reauthenticatedAt) {
      res.status(401).json({ error: 'ReauthenticationRequired', message: 'Sensitive action requires fresh reauthentication.' });
      return;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(session.reauthenticatedAt) < fiveMinutesAgo) {
      res.status(401).json({ error: 'ReauthenticationRequired', message: 'Reauthentication expired. Please reauthenticate.' });
      return;
    }

    next();
    return;
  }


  res.status(401).json({ error: 'Unauthorized', message: 'Reauthentication required (no session).' });
}
