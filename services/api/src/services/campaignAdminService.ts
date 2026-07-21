import { db } from '../db/index.js';
import {
  users,
  userCampaignStates,
  creatorRewardApprovals,
  privacyAuditLogs,
} from '../db/schema.js';
import { and, eq, ne, sql } from 'drizzle-orm';
import { MAX_CREATOR_BONUS_MONTHS_PER_USER } from './storekitClaimService.js';

export interface AdminActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

function requireReason(reason?: string): string {
  if (!reason?.trim()) throw new Error('AUDIT_REASON_REQUIRED');
  return reason.trim();
}

async function writeAudit(
  tx: any,
  input: {
    adminId: string;
    subjectUserId: string;
    action: string;
    reason: string;
    requestId?: string;
    targetId?: string;
  },
): Promise<void> {
  await tx.insert(privacyAuditLogs).values({
    actorType: 'admin',
    actorId: input.adminId,
    subjectUserId: input.subjectUserId,
    action: input.action,
    targetType: input.targetId ? 'creator_reward_approval' : 'user',
    targetId: input.targetId ?? input.subjectUserId,
    reason: input.reason,
    requestId: input.requestId ?? null,
    timestamp: new Date(),
  });
}

export class CampaignAdminService {
  static async enrollFoundingUser(
    userId: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    await db.transaction(async (tx) => {
      const [targetUser] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!targetUser) throw new Error('USER_NOT_FOUND');

      await tx.insert(userCampaignStates).values({
        userId,
        foundingCampaignEligible: true,
        foundingCampaignAnchorAt: targetUser.createdAt,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: userCampaignStates.userId,
        set: {
          foundingCampaignEligible: true,
          foundingCampaignAnchorAt: targetUser.createdAt,
          updatedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        adminId,
        subjectUserId: userId,
        action: 'founding_user_enrolled',
        reason: auditReason,
        requestId,
      });
    });
    return { success: true, message: 'Founding campaign eligibility enabled.' };
  }

  static async revokeFoundingEligibility(
    userId: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    await db.transaction(async (tx) => {
      const [targetUser] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!targetUser) throw new Error('USER_NOT_FOUND');

      await tx.insert(userCampaignStates).values({
        userId,
        foundingCampaignEligible: false,
        foundingCampaignAnchorAt: targetUser.createdAt,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: userCampaignStates.userId,
        set: { foundingCampaignEligible: false, updatedAt: new Date() },
      });

      await writeAudit(tx, {
        adminId,
        subjectUserId: userId,
        action: 'founding_user_revoked',
        reason: auditReason,
        requestId,
      });
    });
    return { success: true, message: 'Founding campaign eligibility revoked.' };
  }

  static async issueExtensionInvitation(
    userId: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    await db.transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(userCampaignStates)
        .where(eq(userCampaignStates.userId, userId))
        .for('update');
      if (!state?.foundingCampaignEligible) throw new Error('FOUNDING_CAMPAIGN_NOT_ELIGIBLE');

      await tx.update(userCampaignStates).set({
        extensionInviteIssuedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(userCampaignStates.userId, userId));

      await writeAudit(tx, {
        adminId,
        subjectUserId: userId,
        action: 'extension_invite_issued',
        reason: auditReason,
        requestId,
      });
    });
    return { success: true, message: 'Extension invitation issued.' };
  }

  static async approveCreatorReward(
    userId: string,
    deliverableUrl: string,
    platform: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    if (!deliverableUrl?.trim()) throw new Error('DELIVERABLE_URL_REQUIRED');
    let approvalId = '';

    await db.transaction(async (tx) => {
      const [targetUser] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!targetUser) throw new Error('USER_NOT_FOUND');

      const activeApprovals = await tx.select({ id: creatorRewardApprovals.id })
        .from(creatorRewardApprovals)
        .where(and(
          eq(creatorRewardApprovals.userId, userId),
          ne(creatorRewardApprovals.status, 'rejected'),
        ));
      if (activeApprovals.length >= MAX_CREATOR_BONUS_MONTHS_PER_USER) {
        throw new Error('CREATOR_REWARD_LIMIT_REACHED');
      }

      const [approval] = await tx.insert(creatorRewardApprovals).values({
        userId,
        deliverableUrl: deliverableUrl.trim(),
        platform: platform?.trim() || 'tiktok',
        status: 'approved',
        approvedMonths: 1,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      approvalId = approval.id;

      await tx.insert(userCampaignStates).values({
        userId,
        creatorRewardMonthsApproved: 1,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: userCampaignStates.userId,
        set: {
          creatorRewardMonthsApproved: sql`${userCampaignStates.creatorRewardMonthsApproved} + 1`,
          updatedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        adminId,
        subjectUserId: userId,
        targetId: approval.id,
        action: 'creator_reward_approved',
        reason: auditReason,
        requestId,
      });
    });

    return { success: true, message: 'Creator reward approved.', data: { id: approvalId, status: 'approved' } };
  }

  static async rejectCreatorReward(
    userId: string,
    deliverableUrl: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    let approvalId = '';
    await db.transaction(async (tx) => {
      const [targetUser] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!targetUser) throw new Error('USER_NOT_FOUND');

      const [approval] = await tx.insert(creatorRewardApprovals).values({
        userId,
        deliverableUrl: deliverableUrl.trim(),
        status: 'rejected',
        approvedMonths: 0,
        updatedAt: new Date(),
      }).returning();
      approvalId = approval.id;

      await writeAudit(tx, {
        adminId,
        subjectUserId: userId,
        targetId: approval.id,
        action: 'creator_reward_rejected',
        reason: auditReason,
        requestId,
      });
    });
    return { success: true, message: 'Creator reward rejected.', data: { id: approvalId, status: 'rejected' } };
  }

  static async markCreatorCodeIssued(
    approvalId: string,
    adminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<AdminActionResult> {
    const auditReason = requireReason(reason);
    let userId = '';
    await db.transaction(async (tx) => {
      const [approval] = await tx.select().from(creatorRewardApprovals)
        .where(eq(creatorRewardApprovals.id, approvalId)).for('update');
      if (!approval) throw new Error('CREATOR_APPROVAL_NOT_FOUND');
      if (approval.status !== 'approved') throw new Error('CREATOR_APPROVAL_INVALID_TRANSITION');
      if (approval.approvedMonths !== 1) throw new Error('CREATOR_APPROVAL_INVALID_DURATION');
      userId = approval.userId;

      await tx.update(creatorRewardApprovals).set({
        status: 'code_issued',
        codeIssuedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(creatorRewardApprovals.id, approvalId));

      await writeAudit(tx, {
        adminId,
        subjectUserId: approval.userId,
        targetId: approval.id,
        action: 'creator_code_issued',
        reason: auditReason,
        requestId,
      });
    });
    return { success: true, message: 'Creator reward code issued.', data: { id: approvalId, userId, status: 'code_issued' } };
  }
}
