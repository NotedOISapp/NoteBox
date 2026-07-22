import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { JWT_ACCESS_SECRET } from '../config/env.js';
import { AuthenticatedRequest } from './auth.js';

export interface AuthenticatedAdminRequest extends AuthenticatedRequest {
  adminId?: string;
  adminEmail?: string;
}

export async function requireAdminAuth(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator authorization required.' });
      return;
    }

    const payload = jwt.verify(authHeader.slice(7), JWT_ACCESS_SECRET) as {
      userId?: string;
      email?: string;
      role?: string;
      sessionId?: string;
      authTime?: number;
    };

    if (!payload.userId || !payload.sessionId) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Administrator session is required.' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user || user.status !== 'active' || user.role !== 'admin') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator access required.' });
      return;
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.userId, user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .limit(1);

    if (!session) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Administrator session is invalid or expired.' });
      return;
    }

    req.adminId = user.id;
    req.adminEmail = user.email ?? undefined;
    req.user = {
      userId: user.id,
      email: payload.email,
      role: user.role,
      ageAttested: user.ageAttested,
      sessionId: session.id,
      authTime: undefined,
    };
    next();
  } catch {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator authentication failure.' });
  }
}
