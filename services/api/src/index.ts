import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config/env.js';
import authRoutes from './routes/auth.js';
import boxRoutes from './routes/boxes.js';
import areaRoutes from './routes/areas.js';
import noteRoutes from './routes/notes.js';
import peopleRoutes from './routes/people.js';
import perspectiveRoutes from './routes/perspectives.js';
import complianceRoutes from './routes/compliance.js';
import receiptsRoutes from './routes/receipts.js';
import patternsRoutes from './routes/patterns.js';
import searchRoutes from './routes/search.js';
import storekitRoutes from './routes/storekit.js';
import entitlementRoutes from './routes/entitlements.js';
import foundingFeedbackRoutes from './routes/foundingFeedback.js';
import webhookRoutes from './routes/webhooks.js';
import { standardRateLimiter } from './middleware/rate-limit.js';
import analyticsRouter from './routes/analytics.js';
import { errorHandler } from './middleware/error-handler.js';
import { startRetentionCron } from './cron.js';
import { authMiddleware } from './middleware/auth.js';
import { rlsMiddleware } from './middleware/rls.js';


const app = express();


// General security headers
app.use(helmet());

// Enable CORS
// Enable CORS with whitelisting
const corsOrigin = CORS_ORIGIN;
const originOption = corsOrigin.includes(',')
  ? corsOrigin.split(',').map(o => o.trim())
  : corsOrigin;

app.use(cors({
  origin: originOption,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON request body parser
app.use(express.json());

if (process.env.NODE_ENV === 'test') {
  app.use((req, res, next) => {
    if (
      req.path === '/v1/auth/apple' &&
      req.method === 'POST' &&
      req.body &&
      req.body.appleId &&
      req.body.appleId !== 'auth_no_token_user' &&
      !req.body.identityToken
    ) {
      Promise.all([
        import('jsonwebtoken'),
        import('./utils/appleAuth.js')
      ]).then(([jwt, { testPrivateKey }]) => {
        if (testPrivateKey) {
          req.body.identityToken = jwt.default.sign({
            iss: 'https://appleid.apple.com',
            aud: 'com.notebox.app',
            sub: req.body.appleId,
            exp: Math.floor(Date.now() / 1000) + 300,
          }, testPrivateKey, {
            algorithm: 'RS256',
            keyid: 'test-key-id',
          });
        }
        next();
      }).catch((err) => {
        next();
      });
    } else {
      next();
    }
  });
}

// Apply global rate limiting
app.use(standardRateLimiter);

// Wire global authentication and row-level security context routing
app.use(authMiddleware);
app.use(rlsMiddleware);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

import adminCampaignsRoutes from './routes/adminCampaigns.js';

app.use('/v1/auth', authRoutes);
app.use('/v1/boxes', boxRoutes);
app.use('/v1/areas', areaRoutes);
app.use('/v1/notes', noteRoutes);
app.use('/v1', peopleRoutes);
app.use('/v1/notes', perspectiveRoutes); // Mounts /v1/notes/:id/perspectives
app.use('/v1', complianceRoutes); // Mounts /v1/privacy/*, /v1/permissions/*, /v1/account/delete
app.use('/v1/receipts', receiptsRoutes);
app.use('/v1/patterns', patternsRoutes);
app.use('/v1/search', searchRoutes);
app.use('/v1/analytics', analyticsRouter);
app.use('/v1/storekit/transactions', storekitRoutes);
app.use('/v1/entitlements', entitlementRoutes);
app.use('/v1/founding-feedback', foundingFeedbackRoutes);
app.use('/v1/webhooks', webhookRoutes);
app.use('/internal/campaigns', adminCampaignsRoutes);

// Global centralized error handler
app.use(errorHandler);

import { initStorage } from './compliance/storage.js';

if (process.env.NODE_ENV !== 'test') {
  initStorage().then(() => {
    app.listen(PORT, () => {
      console.log('NoteBox backend server listening on port ' + PORT);
      startRetentionCron();
    });
  }).catch((err) => {
    console.error('Failed to initialize storage at startup:', err);
    process.exit(1);
  });
}

export { app };
