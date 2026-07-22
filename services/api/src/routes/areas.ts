import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { categories } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logInfo, logError } from '../utils/logger.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { durableIdempotencyMiddleware } from '../middleware/idempotency.js';

const router = Router();

// Apply auth middleware to all routes in this group
router.use(authMiddleware);
router.use(eligibilityMiddleware);
router.use(durableIdempotencyMiddleware);

/**
 * GET /v1/categories
 * Fetch all areas for the current authenticated user.
 * If no areas exist, seeds the default areas (Personal, Work, Family, Other) dynamically.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    let userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    if (userCategories.length === 0) {
      logInfo(`[Categories] Seeding default categories for user ${userId}...`);
      const defaultNames = ['Personal', 'Work', 'Family', 'Other'];
      const seedData = defaultNames.map((name) => ({
        userId,
        name,
      }));

      userCategories = await db.insert(categories).values(seedData).returning();
    }

    res.json(userCategories);
  } catch (error) {
    logError('Error fetching areas', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve areas' });
  }
});

/**
 * POST /v1/categories
 * Create a new custom Area
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'ValidationError', message: 'Area name is required' });
    return;
  }

  try {
    const userId = req.user!.userId;
    const [newCategory] = await db
      .insert(categories)
      .values({
        userId,
        name: name.trim(),
      })
      .returning();

    res.status(201).json(newCategory);
  } catch (error) {
    logError('Error creating area', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create area' });
  }
});

/**
 * PATCH /v1/categories/:id
 * Rename an Area
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'ValidationError', message: 'Area name is required' });
    return;
  }

  try {
    const userId = req.user!.userId;
    const [existingArea] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);

    if (!existingArea) {
      res.status(404).json({ error: 'NotFoundError', message: 'Area not found' });
      return;
    }

    const [updatedCategory] = await db
      .update(categories)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    res.json(updatedCategory);
  } catch (error) {
    logError('Error updating area', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update area' });
  }
});

/**
 * DELETE /v1/categories/:id
 * Delete an Area (boxes inside it will automatically set their areaId to null)
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const userId = req.user!.userId;
    const [existingArea] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);

    if (!existingArea) {
      res.status(404).json({ error: 'NotFoundError', message: 'Area not found' });
      return;
    }

    await db.delete(categories).where(eq(categories.id, id));

    res.json({ success: true, message: 'Area deleted successfully' });
  } catch (error) {
    logError('Error deleting area', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete area' });
  }
});

export default router;
