import { NextFunction, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db, rlsStorage } from '../db/index.js';
import { idempotencyRecords } from '../db/schema.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { AuthenticatedRequest } from './auth.js';

interface CapturedResponse {
  body: unknown;
  statusCode: number;
}

class RollbackResponse extends Error {
  constructor(readonly response: CapturedResponse) {
    super('HTTP_RESPONSE_ROLLBACK');
  }
}

function serializedBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return JSON.stringify(body) ?? '';
}

/**
 * Makes clientMutationId-backed mutations exactly-once within PostgreSQL.
 *
 * The route executes inside the same transaction that acquires the advisory
 * lock and saves the encrypted response. A failed HTTP response rolls the
 * transaction back. The durable key is scoped by user and concrete endpoint,
 * preventing both cross-user and cross-operation response reuse.
 */
export async function durableIdempotencyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const clientMutationId = req.body?.clientMutationId;
  const userId = req.user?.userId;

  if (!userId || typeof clientMutationId !== 'string' || clientMutationId.length === 0) {
    next();
    return;
  }

  if (clientMutationId.length > 200) {
    res.status(400).json({ error: 'ValidationError', message: 'clientMutationId must be 200 characters or fewer' });
    return;
  }

  const operation = `${req.method}:${req.baseUrl}${req.path}`;
  // PostgreSQL text values cannot contain NUL bytes. JSON provides an
  // unambiguous, UTF-8-safe advisory-lock scope for the three components.
  const lockScope = JSON.stringify([userId, operation, clientMutationId]);
  const originalSend = res.send.bind(res);
  let responseToSend: CapturedResponse | null = null;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`);

      const [stored] = await tx
        .select()
        .from(idempotencyRecords)
        .where(and(
          eq(idempotencyRecords.userId, userId),
          eq(idempotencyRecords.operation, operation),
          eq(idempotencyRecords.clientMutationId, clientMutationId),
        ))
        .limit(1);

      if (stored && stored.expiresAt > new Date()) {
        responseToSend = {
          statusCode: stored.statusCode,
          body: decrypt(stored.responseBodyCiphertext),
        };
        return;
      }
      if (stored) {
        await tx.delete(idempotencyRecords).where(eq(idempotencyRecords.id, stored.id));
      }

      const captured = await new Promise<CapturedResponse>((resolve, reject) => {
        let settled = false;
        const priorSend = res.send;

        res.send = ((body: unknown): Response => {
          if (!settled) {
            settled = true;
            resolve({ body, statusCode: res.statusCode });
          }
          return res;
        }) as typeof res.send;

        res.once('close', () => {
          if (!settled) {
            settled = true;
            reject(new Error('Connection closed before mutation response completed'));
          }
        });

        rlsStorage.run(tx, () => {
          try {
            next();
          } catch (error) {
            res.send = priorSend;
            reject(error);
          }
        });
      });

      if (captured.statusCode < 200 || captured.statusCode >= 300) {
        throw new RollbackResponse(captured);
      }

      const body = serializedBody(captured.body);
      await tx.insert(idempotencyRecords).values({
        userId,
        operation,
        clientMutationId,
        statusCode: captured.statusCode,
        responseBodyCiphertext: encrypt(body),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      responseToSend = { ...captured, body };
    });
  } catch (error) {
    if (error instanceof RollbackResponse) {
      responseToSend = error.response;
    } else {
      res.send = originalSend as typeof res.send;
      next(error);
      return;
    }
  }

  if (!responseToSend) {
    res.send = originalSend as typeof res.send;
    next(new Error('Idempotent mutation completed without a response'));
    return;
  }

  res.status(responseToSend.statusCode);
  res.setHeader('Cache-Control', 'private, no-store');
  if (!res.getHeader('Content-Type')) {
    res.type('json');
  }
  originalSend(serializedBody(responseToSend.body));
}
