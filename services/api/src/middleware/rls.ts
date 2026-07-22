import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { pool, rlsStorage } from '../db';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { logError } from '../utils/logger.js';


export async function rlsMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // If request is not authenticated, bypass
  if (!req.user || !req.user.userId) {
    next();
    return;
  }

  const userId = req.user.userId;

  try {
    // Checkout a dedicated connection client from the database pool
    const client = await pool.connect();

    // Set the user context setting for Row-Level Security
    await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId]);

    // Create a connection-specific drizzle instance
    const clientDb = drizzle(client, { schema });

    // Run the rest of the request inside the AsyncLocalStorage connection context
    rlsStorage.run(clientDb, () => {
      let released = false;
      const releaseClient = async () => {
        if (released) return;
        released = true;
        try {
          await client.query('RESET app.current_user_id');
        } catch (err) {
          logError('Error resetting RLS session context', err);
        } finally {
          client.release();
        }
      };

      // Ensure client is returned to pool when request finishes or closes
      res.on('finish', releaseClient);
      res.on('close', releaseClient);

      next();
    });
  } catch (error) {
    logError('Failed to initialize RLS session', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Database connection failed' });
  }
}
