import { logError } from '../utils/logger.js';
import { Router, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { boxes, users } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { auditRoute } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { durableIdempotencyMiddleware } from '../middleware/idempotency.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid()
});

const createBoxSchema = z.object({
  name: z.string().min(1).max(255),
  areaId: z.string().uuid().optional().nullable(),
  clientMutationId: z.string().min(1).max(200).optional(),
});

const updateBoxSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isArchived: z.boolean().optional(),
  areaId: z.string().uuid().optional().nullable(),
  clientMutationId: z.string().min(1).max(200).optional(),
});

// Apply auth middleware to all routes in this group
router.use(authMiddleware);
router.use(eligibilityMiddleware);
router.use(durableIdempotencyMiddleware);

/**
 * GET /v1/boxes
 * Fetch all boxes for the current authenticated user (excluding deleted ones).
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userBoxes = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.userId, userId), isNull(boxes.deletedAt)));

    res.json(userBoxes);
  } catch (error) {
    logError('Error fetching boxes:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve boxes' });
  }
});

/**
 * POST /v1/boxes
 * Create a new box with canonical entitlement limit checks.
 */
router.post('/', auditRoute('create_box', 'box'), validateRequest({ body: createBoxSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const { name, areaId } = req.body;

  if (!name) {
    res.status(400).json({ error: 'ValidationError', message: 'Box name is required' });
    return;
  }

  try {
    const userId = req.user!.userId;

    let newBox: any;
    let limitExceeded = false;

    await db.transaction(async (tx) => {
      // Lock user row to serialize Box creation
      await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');

      const entitlement = await getEffectiveEntitlement(userId, new Date(), tx);
      if (!entitlement.capabilities.unlimitedBoxes) {
        const activeUserBoxes = await tx
          .select()
          .from(boxes)
          .where(
            and(
              eq(boxes.userId, userId),
              eq(boxes.isArchived, false),
              eq(boxes.isSample, false),
              isNull(boxes.deletedAt)
            )
          );

        if (activeUserBoxes.length >= 5) {
          limitExceeded = true;
          return;
        }
      }

      const [created] = await tx
        .insert(boxes)
        .values({
          userId,
          name,
          isArchived: false,
          categoryId: areaId || null,
        })
        .returning();

      newBox = created;
    });

    if (limitExceeded) {
      res.status(402).json({
        error: 'BOX_LIMIT_REACHED',
        message: 'Free account limit reached (maximum 5 active Boxes allowed). Upgrade to Pro for unlimited Boxes.',
      });
      return;
    }

    await trackEvent(userId, 'box_created', { boxId: newBox.id });

    res.status(201).json(newBox);
  } catch (error) {
    logError('Error creating box:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create box' });
  }
});

/**
 * PATCH /v1/boxes/:id
 * Update box name or archived status
 */
router.patch('/:id', auditRoute('update_box', 'box'), validateRequest({ params: idParamSchema, body: updateBoxSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, isArchived, areaId } = req.body;

  try {
    const userId = req.user!.userId;
    let updatedBox: any;
    let limitExceeded = false;

    await db.transaction(async (tx) => {
      await tx.select().from(users).where(eq(users.id, userId)).for('update');
      const [existingBox] = await tx
        .select()
        .from(boxes)
        .where(and(eq(boxes.id, id), eq(boxes.userId, userId), isNull(boxes.deletedAt)))
        .for('update');

      if (!existingBox) return;

      const activatesBox = existingBox.isArchived && isArchived === false && !existingBox.isSample;
      if (activatesBox) {
        const entitlement = await getEffectiveEntitlement(userId, new Date(), tx);
        if (!entitlement.capabilities.unlimitedBoxes) {
          const active = await tx.select({ id: boxes.id }).from(boxes).where(and(
            eq(boxes.userId, userId),
            eq(boxes.isArchived, false),
            eq(boxes.isSample, false),
            isNull(boxes.deletedAt),
          ));
          if (active.length >= 5) {
            limitExceeded = true;
            return;
          }
        }
      }

      [updatedBox] = await tx.update(boxes).set({
        ...(name !== undefined && { name }),
        ...(isArchived !== undefined && { isArchived }),
        ...(areaId !== undefined && { categoryId: areaId }),
        updatedAt: new Date(),
      }).where(eq(boxes.id, id)).returning();
    });

    if (limitExceeded) {
      res.status(402).json({ error: 'BOX_LIMIT_REACHED', message: 'Free account limit reached.' });
      return;
    }
    if (!updatedBox) {
      res.status(404).json({ error: 'NotFoundError', message: 'Box not found' });
      return;
    }
    res.json(updatedBox);
  } catch (error) {
    logError('Error updating box:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update box' });
  }
});

/**
 * DELETE /v1/boxes/:id
 * Soft delete a box
 */
router.delete('/:id', auditRoute('delete_box', 'box'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const userId = req.user!.userId;
    const [existingBox] = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.id, id), eq(boxes.userId, userId), isNull(boxes.deletedAt)))
      .limit(1);

    if (!existingBox) {
      res.status(404).json({ error: 'NotFoundError', message: 'Box not found' });
      return;
    }

    const [deletedBox] = await db
      .update(boxes)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boxes.id, id))
      .returning();

    await trackEvent(userId, 'box_deleted', { boxId: id });

    res.json({ success: true, message: 'Box soft-deleted successfully', box: deletedBox });
  } catch (error) {
    logError('Error deleting box:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete box' });
  }
});

export default router;
