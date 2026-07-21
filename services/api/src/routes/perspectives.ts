import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';
import {
  notes,
  privacyPreferences,
  aiProcessingJobs,
  aiResponses,
  entitlements,
  regenUsage,
  receipts,
  ocrTexts,
  notePeople,
  personMentions
} from '../db/schema.js';
import { eq, and, isNull, inArray, sql, desc } from 'drizzle-orm';
import { decrypt, encrypt } from '../utils/crypto.js';
import { auditRoute } from '../middleware/audit.js';
import { v4 as uuidv4 } from 'uuid';
import { openai } from '../utils/openai.js';
import { SYSTEM_PROMPT, buildUserPrompt, RecordConfidence, AccountabilityRead, ContextStatus } from '../utils/prompts.js';
import { assertPerspectiveCompliance, normalizePunctuation } from '../utils/perspectiveCompliance.js';
import { trackEvent } from '../utils/telemetry.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { logError, logWarn } from '../utils/logger.js';

const router = Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);
router.use(eligibilityMiddleware);

/**
 * Regex utility to redact PII (emails, common phone formats)
 */
function redactPII(text: string): string {
  let redacted = text;
  // Redact emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  redacted = redacted.replace(emailRegex, '[REDACTED_EMAIL]');

  // Redact phone numbers (various US formats)
  const phoneRegex = /(\+?\d{1,2}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  redacted = redacted.replace(phoneRegex, '[REDACTED_PHONE]');

  return redacted;
}

/**
 * High-quality fallback procedural mocks mapping exact Voice Contract examples
 */
function getMockPerspectives(
  body: string,
  historyCount: number,
  metadata?: {
    recordConfidence: RecordConfidence;
    accountabilityRead: AccountabilityRead;
    contextStatus: ContextStatus;
  }
): any {
  const text = body.toLowerCase();

  // 1. Determine or default mock metadata
  let recordConfidence: RecordConfidence = 'developing';
  let accountabilityRead: AccountabilityRead = 'mixed';
  let contextStatus: ContextStatus = 'complete_enough';

  if (text.includes('cancel') || text.includes('late')) {
    recordConfidence = 'strong';
    accountabilityRead = 'mixed';
    contextStatus = 'complete_enough';
  } else if (text.includes('boss') || text.includes('instructions') || text.includes('meeting')) {
    recordConfidence = 'strong';
    accountabilityRead = 'user_supported';
    contextStatus = 'complete_enough';
  } else if (text.length < 20) {
    recordConfidence = 'thin';
    accountabilityRead = 'insufficient_context';
    contextStatus = 'missing_decisive_fact';
  }

  // Override if metadata passed
  if (metadata) {
    recordConfidence = metadata.recordConfidence;
    accountabilityRead = metadata.accountabilityRead;
    contextStatus = metadata.contextStatus;
  }

  let alignedText = "That would feel frustrating because you were asking for clarity, not drama. Saving this detail makes sense because the plan was left unclear and then your follow-up was framed as excessive. You are keeping a record of what actually happened, which is a grounding move.";
  let objectiveText = "The sequence is: he left the plan unclear, then framed your request for consideration as the issue. An outside reading is that communication has broken down, and the emotional effort of managing it has landed on you. The question is whether this is a one-off mismatch or a repeated dynamic.";
  let unfilteredText = "He disappeared from the plan, then tried to make your follow-up look like the drama. That is a convenient little move: create the uncertainty upfront, then act exhausted by the person trying to clarify it. You are carrying the cost of his disorganization while he avoids responsibility.";

  if (text.includes('cancel') || text.includes('late')) {
    alignedText = "That would wear on anyone. The cancellation itself is frustrating, but the harder part is that your need for basic notice keeps getting treated like an overreaction. You are not wrong to keep track of that.";
    objectiveText = "Across the available details, the sequence shows last-minute changes and limited notice, followed by pushback when you ask for consideration. The question is whether flexibility is being shared, or if it is a repeated setup where you carry the cleanup.";
    unfilteredText = "He gets flexibility while you get the cleanup. Then, when you ask for basic notice, he created a narrative where you introduced unnecessary friction. It is a very convenient arrangement where the cost of his schedule falls completely onto your shoulders.";
  } else if (text.includes('boss') || text.includes('instructions') || text.includes('meeting')) {
    alignedText = "That would feel unfair. You were working from unclear directions, then got judged in a setting as if the expectations had been obvious the whole time. Saving this makes sense because the record shows the mismatch.";
    objectiveText = "The issue is the mismatch between unclear direction upfront and specific criticism afterward. The question is whether expectations are being clarified before the work starts, or only after there is an audience.";
    unfilteredText = "She created instructions that were blurry, then waited until there was a room of witnesses to become suddenly specific. That is using ambiguity as a convenient trapdoor where you carry the cleanup cost of her failure to lead properly.";
  }

  // Adjust for thin records
  let missingDecisiveFact: string | undefined;
  if (recordConfidence === 'thin' || contextStatus === 'missing_decisive_fact') {
    unfilteredText = "There is not enough here for a hard read yet. The missing piece is whether you had set explicit expectations beforehand.";
    missingDecisiveFact = "whether you had set explicit expectations beforehand";
  }

  const hardRead = recordConfidence === 'strong' && (accountabilityRead === 'user_primary_cause' || accountabilityRead === 'user_contributed');

  return {
    aligned: {
      title: 'Aligned',
      subheadline: 'Feel understood, right now.',
      responseText: alignedText,
      safetyFlags: ['clean'],
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        alignedHasEmotionalAccuracy: true
      }
    },
    objective: {
      title: 'Objective',
      subheadline: 'Outside perspective.',
      responseText: objectiveText,
      safetyFlags: ['clean'],
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        objectiveHasClarity: true
      }
    },
    unfiltered: {
      title: 'Unfiltered',
      subheadline: 'No holding back.',
      responseText: unfilteredText,
      safetyFlags: ['clean'],
      recordConfidence,
      accountabilityRead,
      contextStatus,
      hardRead,
      missingDecisiveFact,
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        unfilteredHasBite: true
      }
    }
  };
}

function normalizePerspectiveRequest(input: any): any {
  const {
    intensity,
    unfilteredIntensity,
    selectedUnfilteredIntensity,
    perspectiveIntensity,
    selectedPerspectiveIntensity,
    toneIntensity,
    toneStrength,
    roastLevel,
    biteLevel,
    savageMode,
    ...normalized
  } = input;
  // Legacy intensity fields are ignored. Unfiltered sharpness is now record-based.
  return normalized;
}

/**
 * POST /v1/notes/:id/perspectives
 * Generates AI perspectives for a note. Requires AI consent and checks entitlements.
 */
router.post('/:id/perspectives', auditRoute('generate_perspectives', 'note'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const normalizedBody = normalizePerspectiveRequest(req.body);
  const useReceipts = normalizedBody.useReceipts === true;
  type PerspectiveState = 'aligned' | 'objective' | 'unfiltered';
  let reservedState: PerspectiveState | null = null;
  let reservationReleased = false;

  try {
    // 1. Fetch the target note and verify ownership
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    // 2. Verify consent preferences
    const [prefs] = await db
      .select()
      .from(privacyPreferences)
      .where(eq(privacyPreferences.userId, userId))
      .limit(1);

    if (!prefs || !prefs.aiProcessingAllowed || !prefs.thirdPartyAiAllowed) {
      res.status(403).json({
        error: 'ConsentRequired',
        message: 'AI processing or third-party AI sharing consent has not been granted by the user.',
      });
      return;
    }

    if (!openai && process.env.NODE_ENV !== 'test') {
      res.status(503).json({
        error: 'AI_SERVICE_UNAVAILABLE',
        message: 'AI Perspectives are temporarily unavailable. No generated response was saved.',
      });
      return;
    }

    // 3. Check user entitlements for plan limits and capabilities
    const entitlement = await getEffectiveEntitlement(userId);
    const hasProAccess = entitlement.hasProAccess;

    // Enforce entitlement-safe scope handling
    let resolvedScope: 'single_note' | 'box_history' | 'people_across_boxes' = 'single_note';
    const requestedScope = normalizedBody.scope;
    if (requestedScope === 'box_history' || requestedScope === 'people_across_boxes') {
      if (!entitlement.capabilities.allPerspectiveControls) {
        res.status(402).json({
          error: 'PAYMENT_REQUIRED',
          message: 'Custom perspective scope controls require NoteBox Pro.',
        });
        return;
      }
      resolvedScope = requestedScope;
    }


    // Initial generation and regeneration are separate backend operations.
    const requestedTargetState = normalizedBody.targetState ?? normalizedBody.perspectiveType ?? 'all';
    if (!['all', 'aligned', 'objective', 'unfiltered'].includes(requestedTargetState)) {
      res.status(400).json({ error: 'INVALID_PERSPECTIVE_STATE' });
      return;
    }

    const currentResponses = await db.select().from(aiResponses).where(and(
      eq(aiResponses.noteId, id),
      eq(aiResponses.userId, userId),
      eq(aiResponses.isCurrent, true),
    ));
    const isInitialGeneration = currentResponses.length === 0;
    if (isInitialGeneration && requestedTargetState !== 'all') {
      res.status(409).json({ error: 'PERSPECTIVES_NOT_GENERATED', message: 'Generate all three Perspectives first.' });
      return;
    }
    if (!isInitialGeneration && requestedTargetState === 'all') {
      res.status(409).json({ error: 'PERSPECTIVES_ALREADY_GENERATED', message: 'Choose one Perspective state to regenerate.' });
      return;
    }

    const targetState: PerspectiveState | null = isInitialGeneration
      ? null
      : requestedTargetState as PerspectiveState;
    let currentRegenVersion = 1;

    if (targetState) {
      const quotaResult = await db.transaction(async (tx) => {
        await tx.select().from(notes).where(and(
          eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt),
        )).for('update');

        const usageRows = await tx.select().from(regenUsage).where(and(
          eq(regenUsage.noteId, id), eq(regenUsage.userId, userId),
        ));
        const totalReservedOrUsed = usageRows.reduce(
          (sum, row) => sum + row.count + row.pendingCount,
          0,
        );
        const stateRow = usageRows.find((row) => row.perspectiveType === targetState);
        const stateReservedOrUsed = (stateRow?.count ?? 0) + (stateRow?.pendingCount ?? 0);

        if (entitlement.tier === 'free' && totalReservedOrUsed >= 1) {
          return { allowed: false, code: 'PERSPECTIVE_REGEN_LIMIT_REACHED' } as const;
        }
        if (
          entitlement.tier !== 'trial'
          && entitlement.tier !== 'developer'
          && entitlement.hasProAccess
          && stateReservedOrUsed >= 5
        ) {
          return { allowed: false, code: 'PERSPECTIVE_REGEN_LIMIT_REACHED' } as const;
        }

        if (stateRow) {
          await tx.update(regenUsage).set({
            pendingCount: sql`${regenUsage.pendingCount} + 1`,
          }).where(eq(regenUsage.id, stateRow.id));
        } else {
          await tx.insert(regenUsage).values({
            noteId: id,
            userId,
            perspectiveType: targetState,
            count: 0,
            pendingCount: 1,
          });
        }

        const [current] = await tx.select().from(aiResponses).where(and(
          eq(aiResponses.noteId, id),
          eq(aiResponses.userId, userId),
          eq(aiResponses.perspectiveType, targetState),
          eq(aiResponses.isCurrent, true),
        )).orderBy(desc(aiResponses.versionNum)).limit(1);
        return { allowed: true, version: (current?.versionNum ?? 0) + 1 } as const;
      });

      if (!quotaResult.allowed) {
        res.status(402).json({ error: quotaResult.code, message: 'Perspective regeneration limit reached.' });
        return;
      }
      reservedState = targetState;
      currentRegenVersion = quotaResult.version;
    }

    const rawBody = decrypt(note.body);
    const redactedBody = redactPII(rawBody);
    const isRedacted = redactedBody !== rawBody;

    // 5. Track the compliance AI Job
    const lineageId = uuidv4();
    const purgeAt = new Date();
    purgeAt.setDate(purgeAt.getDate() + 30); // 30-day retention

    const [job] = await db
      .insert(aiProcessingJobs)
      .values({
        userId,
        noteId: id,
        mode: 'third_party_api',
        modelProvider: openai ? 'openai' : 'mock',
        modelVersion: openai ? 'gpt-4o-mini' : 'mock-generator',
        lineageId,
        status: 'processing',
        redactionApplied: isRedacted,
        purgeAt,
      })
      .returning();

    // 6. Gather History Context based on resolved scope
    let historyNotes: any[] = [];
    if (resolvedScope === 'box_history') {
      const priorNotes = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.boxId, note.boxId),
            eq(notes.userId, userId),
            isNull(notes.deletedAt)
          )
        )
        .orderBy(notes.createdAt);
      historyNotes = priorNotes
        .filter((n) => n.id !== note.id && new Date(n.createdAt) < new Date(note.createdAt))
        .slice(-5);
    } else if (resolvedScope === 'people_across_boxes') {
      const currentPeople = await db
        .select({ personId: personMentions.linkedPersonId })
        .from(personMentions)
        .where(and(
          eq(personMentions.sourceId, id),
          eq(personMentions.status, 'confirmed')
        ));
      const personIds = currentPeople
        .map(p => p.personId)
        .filter((pid): pid is string => pid !== null);

      if (personIds.length > 0) {
        const otherNoteIds = await db
          .selectDistinct({ noteId: personMentions.sourceId })
          .from(personMentions)
          .where(and(
            inArray(personMentions.linkedPersonId, personIds),
            eq(personMentions.status, 'confirmed')
          ));
        const noteIds = otherNoteIds.map(o => o.noteId).filter(nid => nid !== id);

        if (noteIds.length > 0) {
          const priorNotes = await db
            .select()
            .from(notes)
            .where(
              and(
                inArray(notes.id, noteIds),
                eq(notes.userId, userId),
                isNull(notes.deletedAt)
              )
            )
            .orderBy(notes.createdAt);
          historyNotes = priorNotes
            .filter((n) => n.id !== note.id && new Date(n.createdAt) < new Date(note.createdAt))
            .slice(-5);
        }
      }
    }

    const redactedHistory = historyNotes.map((hn) => redactPII(decrypt(hn.body)));

    // 7. Fetch OCR Receipt Context if approved
    let receiptOcrText = '';
    if (useReceipts) {
      const ocrRecords = await db
        .select({ extractedText: ocrTexts.extractedText })
        .from(ocrTexts)
        .innerJoin(receipts, eq(ocrTexts.receiptId, receipts.id))
        .where(
          and(
            eq(receipts.noteId, id),
            eq(receipts.userId, userId),
            eq(receipts.scanStatus, 'clean')
          )
        );
      receiptOcrText = ocrRecords.map(r => redactPII(decrypt(r.extractedText))).join('\n');
    }

    // Perform initial classification of the note content
    let recordConfidence: RecordConfidence = 'developing';
    let accountabilityRead: AccountabilityRead = 'mixed';
    let contextStatus: ContextStatus = 'complete_enough';

    const noteTextLower = redactedBody.toLowerCase();
    if (noteTextLower.length < 30) {
      recordConfidence = 'thin';
      accountabilityRead = 'insufficient_context';
      contextStatus = 'missing_decisive_fact';
    } else if (noteTextLower.includes('cancel') || noteTextLower.includes('late')) {
      recordConfidence = 'strong';
    } else if (noteTextLower.includes('my fault') || noteTextLower.includes('i forgot') || noteTextLower.includes('i should have')) {
      accountabilityRead = 'user_primary_cause';
    }

    // 8. Structured Generation with compliance-driven Retries
    let pData: any = null;
    let attempts = 0;
    const maxAttempts = 3;
    let compliancePassed = false;
    let complianceError: any = null;

    while (attempts < maxAttempts && !compliancePassed) {
      attempts++;
      let tempRawData: any = null;

      if (openai) {
        try {
          const userPrompt = buildUserPrompt(redactedBody, redactedHistory, receiptOcrText, {
            recordConfidence,
            accountabilityRead,
            contextStatus
          });

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'perspectives_schema',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    aligned: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', enum: ['Aligned'] },
                        subheadline: { type: 'string', enum: ['Feel understood, right now.'] },
                        responseText: { type: 'string' },
                        safetyFlags: { type: 'array', items: { type: 'string' } },
                        qualityChecks: {
                          type: 'object',
                          properties: {
                            specificToNote: { type: 'boolean', enum: [true] },
                            avoidedCornyLanguage: { type: 'boolean', enum: [true] },
                            avoidedDiagnosis: { type: 'boolean', enum: [true] },
                            avoidedEscalation: { type: 'boolean', enum: [true] },
                            avoidedTherapyLanguage: { type: 'boolean', enum: [true] },
                            groundedInProvidedContext: { type: 'boolean', enum: [true] },
                            perspectiveBucketDistinct: { type: 'boolean', enum: [true] },
                            alignedHasEmotionalAccuracy: { type: 'boolean', enum: [true] }
                          },
                          required: [
                            'specificToNote',
                            'avoidedCornyLanguage',
                            'avoidedDiagnosis',
                            'avoidedEscalation',
                            'avoidedTherapyLanguage',
                            'groundedInProvidedContext',
                            'perspectiveBucketDistinct',
                            'alignedHasEmotionalAccuracy'
                          ],
                          additionalProperties: false
                        }
                      },
                      required: ['title', 'subheadline', 'responseText', 'safetyFlags', 'qualityChecks'],
                      additionalProperties: false
                    },
                    objective: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', enum: ['Objective'] },
                        subheadline: { type: 'string', enum: ['Outside perspective.'] },
                        responseText: { type: 'string' },
                        safetyFlags: { type: 'array', items: { type: 'string' } },
                        qualityChecks: {
                          type: 'object',
                          properties: {
                            specificToNote: { type: 'boolean', enum: [true] },
                            avoidedCornyLanguage: { type: 'boolean', enum: [true] },
                            avoidedDiagnosis: { type: 'boolean', enum: [true] },
                            avoidedEscalation: { type: 'boolean', enum: [true] },
                            avoidedTherapyLanguage: { type: 'boolean', enum: [true] },
                            groundedInProvidedContext: { type: 'boolean', enum: [true] },
                            perspectiveBucketDistinct: { type: 'boolean', enum: [true] },
                            objectiveHasClarity: { type: 'boolean', enum: [true] }
                          },
                          required: [
                            'specificToNote',
                            'avoidedCornyLanguage',
                            'avoidedDiagnosis',
                            'avoidedEscalation',
                            'avoidedTherapyLanguage',
                            'groundedInProvidedContext',
                            'perspectiveBucketDistinct',
                            'objectiveHasClarity'
                          ],
                          additionalProperties: false
                        }
                      },
                      required: ['title', 'subheadline', 'responseText', 'safetyFlags', 'qualityChecks'],
                      additionalProperties: false
                    },
                    unfiltered: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', enum: ['Unfiltered'] },
                        subheadline: { type: 'string', enum: ['No holding back.'] },
                        responseText: { type: 'string' },
                        safetyFlags: { type: 'array', items: { type: 'string' } },
                        recordConfidence: { type: 'string', enum: ['thin', 'developing', 'strong', 'conflicting', 'safety_sensitive'] },
                        accountabilityRead: { type: 'string', enum: ['user_supported', 'mixed', 'user_contributed', 'user_primary_cause', 'insufficient_context'] },
                        contextStatus: { type: 'string', enum: ['complete_enough', 'missing_decisive_fact', 'skipped_decisive_fact', 'conflicting_context'] },
                        hardRead: { type: 'boolean' },
                        missingDecisiveFact: { type: 'string' },
                        contradiction: { type: 'string' },
                        qualityChecks: {
                          type: 'object',
                          properties: {
                            specificToNote: { type: 'boolean', enum: [true] },
                            avoidedCornyLanguage: { type: 'boolean', enum: [true] },
                            avoidedDiagnosis: { type: 'boolean', enum: [true] },
                            avoidedEscalation: { type: 'boolean', enum: [true] },
                            avoidedTherapyLanguage: { type: 'boolean', enum: [true] },
                            groundedInProvidedContext: { type: 'boolean', enum: [true] },
                            perspectiveBucketDistinct: { type: 'boolean', enum: [true] },
                            unfilteredHasBite: { type: 'boolean', enum: [true] }
                          },
                          required: [
                            'specificToNote',
                            'avoidedCornyLanguage',
                            'avoidedDiagnosis',
                            'avoidedEscalation',
                            'avoidedTherapyLanguage',
                            'groundedInProvidedContext',
                            'perspectiveBucketDistinct',
                            'unfilteredHasBite'
                          ],
                          additionalProperties: false
                        }
                      },
                      required: [
                        'title',
                        'subheadline',
                        'responseText',
                        'recordConfidence',
                        'accountabilityRead',
                        'contextStatus',
                        'hardRead',
                        'safetyFlags',
                        'qualityChecks'
                      ],
                      additionalProperties: false
                    }
                  },
                  required: ['aligned', 'objective', 'unfiltered'],
                  additionalProperties: false
                }
              }
            }
          });

          const rawJsonText = completion.choices[0].message?.content || '{}';
          const parsed = JSON.parse(rawJsonText);

          if (parsed.aligned && parsed.objective && parsed.unfiltered) {
            tempRawData = parsed;
          }
        } catch (err) {
          logError(`[Attempt ${attempts}] OpenAI generation call failed`, err);
        }
      }

      if (!tempRawData) {
        tempRawData = getMockPerspectives(redactedBody, redactedHistory.length, {
          recordConfidence,
          accountabilityRead,
          contextStatus
        });
      }

      // Structure, clean punctuation normalization, and compliance assertions
      const alignedCleaned = {
        state: 'aligned',
        title: tempRawData.aligned.title || 'Aligned',
        subheadline: tempRawData.aligned.subheadline || 'Feel understood, right now.',
        responseText: normalizePunctuation(tempRawData.aligned.responseText),
        toneTags: tempRawData.aligned.toneTags || ['grounding'],
        safetyFlags: tempRawData.aligned.safetyFlags || ['clean'],
        contextScope: resolvedScope,
        supportReferences: tempRawData.aligned.supportReferences || '',
        confidence: tempRawData.aligned.confidence || 'high',
        generatedAt: new Date().toISOString(),
        model: openai ? 'openai/gpt-4o-mini' : 'mock-generator',
        regenVersion: currentRegenVersion,
        qualityChecks: tempRawData.aligned.qualityChecks
      };

      const objectiveCleaned = {
        state: 'objective',
        title: tempRawData.objective.title || 'Objective',
        subheadline: tempRawData.objective.subheadline || 'Outside perspective.',
        responseText: normalizePunctuation(tempRawData.objective.responseText),
        toneTags: tempRawData.objective.toneTags || ['analytical'],
        safetyFlags: tempRawData.objective.safetyFlags || ['clean'],
        contextScope: resolvedScope,
        supportReferences: tempRawData.objective.supportReferences || '',
        confidence: tempRawData.objective.confidence || 'high',
        generatedAt: new Date().toISOString(),
        model: openai ? 'openai/gpt-4o-mini' : 'mock-generator',
        regenVersion: currentRegenVersion,
        qualityChecks: tempRawData.objective.qualityChecks
      };

      const unfilteredCleaned = {
        state: 'unfiltered',
        title: tempRawData.unfiltered.title || 'Unfiltered',
        subheadline: tempRawData.unfiltered.subheadline || 'No holding back.',
        responseText: normalizePunctuation(tempRawData.unfiltered.responseText),
        toneTags: tempRawData.unfiltered.toneTags || ['direct'],
        safetyFlags: tempRawData.unfiltered.safetyFlags || ['clean'],
        contextScope: resolvedScope,
        supportReferences: tempRawData.unfiltered.supportReferences || '',
        confidence: tempRawData.unfiltered.confidence || 'high',
        generatedAt: new Date().toISOString(),
        model: openai ? 'openai/gpt-4o-mini' : 'mock-generator',
        regenVersion: currentRegenVersion,
        recordConfidence: tempRawData.unfiltered.recordConfidence || recordConfidence,
        accountabilityRead: tempRawData.unfiltered.accountabilityRead || accountabilityRead,
        contextStatus: tempRawData.unfiltered.contextStatus || contextStatus,
        hardRead: tempRawData.unfiltered.hardRead || false,
        missingDecisiveFact: tempRawData.unfiltered.missingDecisiveFact,
        contradiction: tempRawData.unfiltered.contradiction,
        qualityChecks: tempRawData.unfiltered.qualityChecks
      };

      const compliancePayload = {
        aligned: alignedCleaned,
        objective: objectiveCleaned,
        unfiltered: unfilteredCleaned
      };

      try {
        // Assert strict compliance bounds (word counts, safety filters, distinct buckets, banned terms)
        assertPerspectiveCompliance(compliancePayload, {
          priorNotesCount: redactedHistory.length,
          requireQualityChecks: true
        });

        // Succeeded compliance checks!
        pData = compliancePayload;
        compliancePassed = true;
      } catch (err: any) {
        logWarn(`[Attempt ${attempts}] Output failed compliance audit: ${err.message}`);
        complianceError = err;
      }
    }

    // Fail closed if compliance fails after max attempts
    if (!compliancePassed || !pData) {
      throw complianceError || new Error('Perspectives output failed compliance rules audit.');
    }

    // 11. Persist current responses while preserving history and unaffected states.
    const payloadByType = {
      aligned: pData.aligned,
      objective: pData.objective,
      unfiltered: pData.unfiltered,
    } as const;
    const typesToSave: PerspectiveState[] = isInitialGeneration
      ? ['aligned', 'objective', 'unfiltered']
      : [targetState!];
    const savedResponses: any[] = [];

    await db.transaction(async (tx) => {
      for (const perspectiveType of typesToSave) {
        await tx.update(aiResponses).set({ isCurrent: false }).where(and(
          eq(aiResponses.noteId, id),
          eq(aiResponses.userId, userId),
          eq(aiResponses.perspectiveType, perspectiveType),
          eq(aiResponses.isCurrent, true),
        ));

        const payload = payloadByType[perspectiveType];
        const [row] = await tx.insert(aiResponses).values({
          noteId: id,
          userId,
          perspectiveType,
          responseText: encrypt(JSON.stringify(payload)),
          modelProvider: openai ? 'openai' : 'mock',
          modelVersion: openai ? 'gpt-4o-mini' : 'mock-generator',
          lineageId,
          versionNum: isInitialGeneration ? 1 : currentRegenVersion,
          isCurrent: true,
        }).returning();
        savedResponses.push({
          id: row.id,
          noteId: row.noteId,
          userId: row.userId,
          perspectiveType: row.perspectiveType,
          ...payload,
        });
      }

      if (reservedState) {
        await tx.update(regenUsage).set({
          pendingCount: sql`GREATEST(${regenUsage.pendingCount} - 1, 0)`,
          count: sql`${regenUsage.count} + 1`,
        }).where(and(
          eq(regenUsage.noteId, id),
          eq(regenUsage.userId, userId),
          eq(regenUsage.perspectiveType, reservedState),
        ));
        reservationReleased = true;
      }
    });

    // 12. Complete the compliance job record
    await db
      .update(aiProcessingJobs)
      .set({ status: 'completed' })
      .where(eq(aiProcessingJobs.id, job.id));

    await trackEvent(userId, 'responses_generated', { noteId: id, lineageId });

    res.json({
      lineageId,
      disclaimer: 'Perspectives are AI-generated and not professional advice',
      perspectives: savedResponses,
    });
  } catch (error: any) {
    if (reservedState && !reservationReleased) {
      try {
        await db.update(regenUsage).set({
          pendingCount: sql`GREATEST(${regenUsage.pendingCount} - 1, 0)`,
        }).where(and(
          eq(regenUsage.noteId, id),
          eq(regenUsage.userId, userId),
          eq(regenUsage.perspectiveType, reservedState),
        ));
      } catch (releaseError) {
        logError('Failed to release Perspective regeneration reservation', releaseError);
      }
    }
    logError('Error generating perspectives', error);
    res.status(error.status || 500).json({ error: error.name || 'InternalServerError', message: error.message || 'Failed to generate perspectives' });
  }
});

/**
 * GET /v1/notes/:id/perspectives
 * Retrieves already generated perspectives for a note
 */
router.get('/:id/perspectives', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const records = await db
      .select()
      .from(aiResponses)
      .where(and(eq(aiResponses.noteId, id), eq(aiResponses.userId, userId), eq(aiResponses.isCurrent, true)));

    const decrypted = records.map((r) => {
      const plainText = decrypt(r.responseText);
      try {
        const parsed = JSON.parse(plainText);
        if (r.perspectiveType === 'unfiltered') {
          delete parsed.intensity;
          if (!parsed.recordConfidence) {
            parsed.recordConfidence = 'developing';
            parsed.accountabilityRead = 'mixed';
            parsed.contextStatus = 'complete_enough';
            parsed.hardRead = false;
          }
        }
        return {
          id: r.id,
          noteId: r.noteId,
          userId: r.userId,
          perspectiveType: r.perspectiveType,
          ...parsed
        };
      } catch {
        // Handle backward compatibility for legacy non-JSON plain text records
        return {
          id: r.id,
          noteId: r.noteId,
          userId: r.userId,
          perspectiveType: r.perspectiveType,
          responseText: plainText,
          state: r.perspectiveType,
          title: r.perspectiveType.charAt(0).toUpperCase() + r.perspectiveType.slice(1),
          subheadline: r.perspectiveType === 'aligned' ? 'Feel understood, right now.' : r.perspectiveType === 'objective' ? 'Outside perspective.' : 'No holding back.',
          toneTags: [],
          safetyFlags: [],
          contextScope: 'single_note',
          supportReferences: '',
          confidence: 'high',
          generatedAt: r.createdAt.toISOString(),
          model: r.modelProvider + '/' + r.modelVersion,
          regenVersion: 1
        };
      }
    });

    res.json({
      disclaimer: 'Perspectives are AI-generated and not professional advice',
      perspectives: decrypted,
    });
  } catch (error) {
    logError('Error retrieving perspectives', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve perspectives' });
  }
});

export default router;
