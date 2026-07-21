import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { db } from '../db/index.js';
import { privacyAuditLogs } from '../db/schema.js';
import { logError } from '../utils/logger.js';

interface AuditParams {
  actor: 'user' | 'admin' | 'system';
  actorId: string | null;
  subjectUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  ip?: string | null;
  requestId?: string | null;
  beforeHash?: string | null;
  afterHash?: string | null;
}

export async function logPrivacyAction(params: AuditParams): Promise<void> {
  try {
    await db.insert(privacyAuditLogs).values({
      actorId: params.actorId,
      actorType: params.actor,
      subjectUserId: params.subjectUserId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      ip: params.ip ?? null,
      reason: params.reason ?? null,
      requestId: params.requestId ?? null,
      beforeHash: params.beforeHash ?? null,
      afterHash: params.afterHash ?? null,
      timestamp: new Date(),
    });
  } catch (error) {
    logError('Failed to write privacy audit log', error);
  }
}

export function auditRoute(action: string, targetType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;

    res.send = function (body): Response {
      res.send = originalSend;
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      if (isSuccess && req.user) {
        let targetId: string | null = null;
        if (typeof req.params.id === 'string') {
          targetId = req.params.id;
        } else if (typeof req.body?.id === 'string') {
          targetId = req.body.id;
        } else if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed?.id === 'string') targetId = parsed.id;
          } catch {
            // Non-JSON response.
          }
        }

        void logPrivacyAction({
          actor: req.user.role === 'admin' ? 'admin' : 'user',
          actorId: req.user.userId,
          subjectUserId: req.user.userId,
          action,
          targetType,
          targetId,
          ip: req.ip ?? null,
          requestId: req.requestId ?? null,
        });
      }
      return originalSend.call(this, body);
    };

    next();
  };
}
