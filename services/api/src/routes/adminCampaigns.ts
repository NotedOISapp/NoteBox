import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth.js';
import { recentAuthMiddleware } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { CampaignAdminService } from '../services/campaignAdminService.js';

const router = Router();
router.use(requireAdminAuth);
router.use(recentAuthMiddleware);

const userActionSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});
const creatorActionSchema = userActionSchema.extend({
  deliverableUrl: z.string().url(),
  platform: z.string().trim().min(1).max(64).optional(),
});
const codeIssuedSchema = z.object({
  approvalId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});

function sendAdminError(res: Response, error: unknown): void {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const statusByCode: Record<string, number> = {
    AUDIT_REASON_REQUIRED: 400,
    DELIVERABLE_URL_REQUIRED: 400,
    USER_NOT_FOUND: 404,
    CREATOR_APPROVAL_NOT_FOUND: 404,
    FOUNDING_CAMPAIGN_NOT_ELIGIBLE: 409,
    CREATOR_REWARD_LIMIT_REACHED: 409,
    CREATOR_APPROVAL_INVALID_TRANSITION: 409,
    CREATOR_APPROVAL_INVALID_DURATION: 409,
  };
  res.status(statusByCode[code] ?? 500).json({
    error: code,
    message: statusByCode[code] ? code : 'Administrative campaign operation failed.',
  });
}

router.post('/founding/enroll', validateRequest({ body: userActionSchema }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.enrollFoundingUser(
      req.body.userId, req.adminId!, req.body.reason, req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

router.post('/founding/revoke', validateRequest({ body: userActionSchema }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.revokeFoundingEligibility(
      req.body.userId, req.adminId!, req.body.reason, req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

router.post('/founding/extension-invite', validateRequest({ body: userActionSchema }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.issueExtensionInvitation(
      req.body.userId, req.adminId!, req.body.reason, req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

router.post('/creator-rewards/approve', validateRequest({ body: creatorActionSchema }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.approveCreatorReward(
      req.body.userId,
      req.body.deliverableUrl,
      req.body.platform ?? 'tiktok',
      req.adminId!,
      req.body.reason,
      req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

router.post('/creator-rewards/reject', validateRequest({ body: creatorActionSchema.omit({ platform: true }) }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.rejectCreatorReward(
      req.body.userId,
      req.body.deliverableUrl,
      req.adminId!,
      req.body.reason,
      req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

router.post('/creator-rewards/code-issued', validateRequest({ body: codeIssuedSchema }), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    res.json(await CampaignAdminService.markCreatorCodeIssued(
      req.body.approvalId,
      req.adminId!,
      req.body.reason,
      req.requestId,
    ));
  } catch (error) { sendAdminError(res, error); }
});

export default router;
