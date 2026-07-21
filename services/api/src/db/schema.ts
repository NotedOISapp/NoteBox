import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum, primaryKey, bigint, jsonb, doublePrecision, uniqueIndex, index } from 'drizzle-orm/pg-core';

// ── Enums ───────────────────────────────────────────────────────────────────
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deletion_pending', 'deleted']);
export const platformEnum = pgEnum('platform', ['apple', 'google', 'stripe']);
export const subStatusEnum = pgEnum('sub_status', ['trial', 'active', 'grace', 'on_hold', 'canceled', 'expired', 'refunded']);
export const entitlementPlanEnum = pgEnum('entitlement_plan', ['free', 'trial', 'paid']);
export const perspectiveTypeEnum = pgEnum('perspective_type', ['aligned', 'objective', 'unfiltered']);
export const scanStatusEnum = pgEnum('scan_status', ['pending', 'clean', 'rejected']);
export const consentPurposeEnum = pgEnum('consent_purpose', ['ai_processing', 'third_party_ai', 'targeted_ads', 'sale_share', 'analytics']);
export const actorEnum = pgEnum('actor_type', ['user', 'admin', 'system']);
export const deletionModeEnum = pgEnum('deletion_mode', ['soft', 'hard']);
export const deletionStatusEnum = pgEnum('deletion_status', ['pending', 'processing', 'completed', 'failed']);
export const dsarTypeEnum = pgEnum('dsar_type', ['access', 'delete', 'correct', 'portability', 'opt_out_sale', 'opt_out_share']);
export const dsarStatusEnum = pgEnum('dsar_status', ['pending', 'processing', 'completed', 'denied']);
export const exportFormatEnum = pgEnum('export_format', ['json', 'zip']);
export const exportStatusEnum = pgEnum('export_status', ['pending', 'generating', 'ready', 'expired', 'failed']);
export const aiModeEnum = pgEnum('ai_mode', ['server_side', 'third_party_api']);
export const aiJobStatusEnum = pgEnum('ai_job_status', ['pending', 'processing', 'completed', 'failed', 'purged']);
export const aiExclusionScopeEnum = pgEnum('ai_exclusion_scope', ['all']);
export const aiExclusionReasonEnum = pgEnum('ai_exclusion_reason', ['opt_out', 'sensitive']);

export const personStatusEnum = pgEnum('person_status', ['active', 'archived', 'deleted']);
export const aliasTypeEnum = pgEnum('alias_type', ['name', 'nickname', 'relationship', 'abbreviation', 'dictation_variant', 'misspelling', 'role_phrase', 'custom']);
export const matchModeEnum = pgEnum('match_mode', ['exact', 'phrase', 'phonetic', 'fuzzy']);
export const scopeTypeEnum = pgEnum('scope_type', ['mention', 'box', 'category', 'time_range', 'global']);
export const confirmationStatusEnum = pgEnum('confirmation_status', ['user_confirmed', 'system_suggested', 'rejected']);
export const mentionSourceTypeEnum = pgEnum('mention_source_type', ['note', 'add_more', 'ocr', 'dictation']);
export const mentionOriginEnum = pgEnum('mention_origin', ['explicit_at_tag', 'manual_person_tag', 'plain_text_detection', 'ocr_detection', 'dictation_detection', 'user_created']);
export const mentionStatusEnum = pgEnum('mention_status', ['unresolved', 'likely', 'confirmed', 'ignored', 'rejected', 'stale']);
export const confidenceBandEnum = pgEnum('confidence_band', ['high', 'medium', 'low']);
export const resolutionSourceEnum = pgEnum('resolution_source', ['explicit_tag', 'manual_confirmation', 'clarification_answer', 'approved_rule', 'historical_review']);
export const candidateStateEnum = pgEnum('candidate_state', ['active', 'accepted', 'rejected', 'expired']);
export const resolutionActionEventEnum = pgEnum('resolution_action', ['confirm_existing_person', 'create_and_confirm_person', 'reassign_person', 'remove_person_link', 'mark_not_person', 'leave_unresolved', 'defer', 'restore', 'conflict_detected']);
export const resolutionEventSourceEnum = pgEnum('resolution_event_source', ['inline_tag', 'save_clarification', 'review_queue', 'person_detail', 'note_detail', 'historical_review', 'sync_resolution']);
export const questionTypeEnum = pgEnum('question_type', ['same_name_identity', 'alias_match', 'new_person', 'role_reference', 'pronoun_reference', 'spelling_or_dictation', 'rule_scope', 'rule_conflict']);
export const questionStatusEnum = pgEnum('question_status', ['pending', 'answered', 'deferred', 'dismissed', 'expired', 'invalidated']);
export const optionTypeEnum = pgEnum('option_type', ['existing_person', 'create_new_person', 'not_a_person', 'leave_unresolved', 'approve_alias', 'reject_alias', 'scope_mention', 'scope_box', 'scope_category', 'scope_global']);
export const mergeStatusEnum = pgEnum('merge_status', ['pending', 'completed', 'reversed']);

export const storekitVerificationStatusEnum = pgEnum('storekit_verification_status', ['verified', 'rejected', 'revoked']);
export const promotionalGrantTypeEnum = pgEnum('promotional_grant_type', ['founding_launch', 'founding_extension', 'creator_bonus']);
export const promotionalGrantStatusEnum = pgEnum('promotional_grant_status', ['active', 'scheduled', 'expired', 'revoked']);
export const creatorRewardApprovalStatusEnum = pgEnum('creator_reward_approval_status', ['submitted', 'approved', 'rejected', 'code_issued', 'redeemed']);

// ── Core Tables ─────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  appAccountToken: uuid('app_account_token').defaultRandom().unique().notNull(),
  email: text('email'), // encrypted
  emailHash: text('email_hash'), // for index lookup
  status: userStatusEnum('status').default('active').notNull(),
  role: text('role').default('user').notNull(),
  appleId: text('apple_id').unique(),
  appleRefreshToken: text('apple_refresh_token'), // encrypted
  appleAccessToken: text('apple_access_token'),   // encrypted
  ageAttested: boolean('age_attested').default(false).notNull(),
  ageAttestedAt: timestamp('age_attested_at'),
  ageAttestationVersion: text('age_attestation_version'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  username: text('username').unique(),
  avatarRef: text('avatar_ref'),
  locale: text('locale').default('en-US').notNull(),
});

export const idempotencyRecords = pgTable('idempotency_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  operation: text('operation').notNull(),
  clientMutationId: text('client_mutation_id').notNull(),
  statusCode: integer('status_code').notNull(),
  responseBodyCiphertext: text('response_body_ciphertext').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => ({
  userOperationMutationUnique: uniqueIndex('idempotency_records_user_operation_mutation_unique')
    .on(t.userId, t.operation, t.clientMutationId),
  expiresAtIdx: index('idempotency_records_expires_at_idx').on(t.expiresAt),
}));

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const boxes = pgTable('boxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  isSample: boolean('is_sample').default(false).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  displayPhotoKey: text('display_photo_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  displayName: text('display_name').notNull(),
  fullName: text('full_name'),
  contextLabel: text('context_label'),
  avatarReceiptId: uuid('avatar_receipt_id'),
  avatarKey: text('avatar_key'),
  status: personStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const boxPeople = pgTable('box_people', {
  boxId: uuid('box_id').references(() => boxes.id, { onDelete: 'cascade' }).notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.boxId, t.personId] }),
}));

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  boxId: uuid('box_id').references(() => boxes.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(), // encrypted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const noteVersions = pgTable('note_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(), // encrypted
  versionNum: integer('version_num').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const addMores = pgTable('add_mores', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(), // encrypted
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notePeople = pgTable('note_people', {
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.noteId, t.personId] }),
}));

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  storageKey: text('storage_key').unique().notNull(),
  contentType: text('content_type').notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  scanStatus: scanStatusEnum('scan_status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ocrTexts = pgTable('ocr_texts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptId: uuid('receipt_id').references(() => receipts.id, { onDelete: 'cascade' }).notNull(),
  extractedText: text('extracted_text').notNull(), // encrypted
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiResponses = pgTable('ai_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  perspectiveType: perspectiveTypeEnum('perspective_type').notNull(),
  responseText: text('response_text').notNull(), // encrypted
  modelProvider: text('model_provider').notNull(),
  modelVersion: text('model_version').notNull(),
  lineageId: uuid('lineage_id').notNull(),
  versionNum: integer('version_num').default(1).notNull(),
  isCurrent: boolean('is_current').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  currentPerspectiveUnique: uniqueIndex('ai_responses_current_perspective_unique')
    .on(t.userId, t.noteId, t.perspectiveType)
    .where(sql`is_current = true`),
  noteTypeVersionUnique: uniqueIndex('ai_responses_note_type_version_unique')
    .on(t.userId, t.noteId, t.perspectiveType, t.versionNum),
}));

export const regenUsage = pgTable('regen_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  perspectiveType: perspectiveTypeEnum('perspective_type').notNull(),
  count: integer('count').default(0).notNull(),
  pendingCount: integer('pending_count').default(0).notNull(),
}, (t) => ({
  userNoteTypeUnique: uniqueIndex('regen_usage_user_note_type_unique').on(t.userId, t.noteId, t.perspectiveType),
}));

export const uploadReservations = pgTable('upload_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  storageKey: text('storage_key').unique().notNull(),
  maxSizeBytes: bigint('max_size_bytes', { mode: 'bigint' }).notNull(),
  expectedContentType: text('expected_content_type').notNull(),
  expectedSha256: text('expected_sha256'),
  providerObjectVersion: text('provider_object_version'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  confirmedReceiptId: uuid('confirmed_receipt_id').references(() => receipts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('upload_reservations_user_id_idx').on(t.userId),
  noteIdIdx: index('upload_reservations_note_id_idx').on(t.noteId),
  expiresAtIdx: index('upload_reservations_expires_at_idx').on(t.expiresAt),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  platform: platformEnum('platform').notNull(),
  productId: text('product_id').notNull(),
  status: subStatusEnum('status').notNull(),
  originalTxnId: text('original_txn_id').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  platformOriginalTxnUnique: uniqueIndex('subscriptions_platform_original_txn_unique')
    .on(t.platform, t.originalTxnId),
}));

export const entitlements = pgTable('entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  plan: entitlementPlanEnum('plan').default('free').notNull(),
  validUntil: timestamp('valid_until'),
  features: jsonb('features').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Compliance Tables ───────────────────────────────────────────────────────
export const consentEvents = pgTable('consent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  purpose: consentPurposeEnum('purpose').notNull(),
  granted: boolean('granted').notNull(),
  method: text('method').notNull(),
  ip: text('ip').notNull(),
  device: text('device').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  policyVersion: text('policy_version').notNull(),
  withdrawnAt: timestamp('withdrawn_at'),
});

export const privacyPreferences = pgTable('privacy_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  targetedAdsAllowed: boolean('targeted_ads_allowed').default(false).notNull(),
  saleOrShareAllowed: boolean('sale_or_share_allowed').default(false).notNull(),
  aiProcessingAllowed: boolean('ai_processing_allowed').default(false).notNull(),
  thirdPartyAiAllowed: boolean('third_party_ai_allowed').default(false).notNull(),
  gpcDetected: boolean('gpc_detected').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const privacyAuditLogs = pgTable('privacy_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: actorEnum('actor_type').notNull(),
  actorId: uuid('actor_id'),
  subjectUserId: uuid('subject_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  ip: text('ip'),
  reason: text('reason'),
  requestId: uuid('request_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  beforeHash: text('before_hash'),
  afterHash: text('after_hash'),
});

export const deletionRequests = pgTable('deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  scope: jsonb('scope').notNull(),
  mode: deletionModeEnum('mode').notNull(),
  status: deletionStatusEnum('status').default('pending').notNull(),
  queuedAt: timestamp('queued_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  receiptId: uuid('receipt_id'),
});

export const dsarRequests = pgTable('dsar_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  requestType: dsarTypeEnum('request_type').notNull(),
  identityVerified: boolean('identity_verified').default(false).notNull(),
  status: dsarStatusEnum('status').default('pending').notNull(),
  dueDate: timestamp('due_date').notNull(),
  fulfilledAt: timestamp('fulfilled_at'),
});

export const dataExports = pgTable('data_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  format: exportFormatEnum('format').notNull(),
  status: exportStatusEnum('status').default('pending').notNull(),
  downloadUrlSigned: text('download_url_signed'),
  expiresAt: timestamp('expires_at'),
  generatedAt: timestamp('generated_at'),
  claimedBy: text('claimed_by'),
  claimedAt: timestamp('claimed_at'),
  leaseExpiresAt: timestamp('lease_expires_at'),
  claimToken: uuid('claim_token'),
  failureCode: text('failure_code'),
  artifactStorageKey: text('artifact_storage_key'),
  artifactSizeBytes: bigint('artifact_size_bytes', { mode: 'bigint' }),
  artifactSha256: text('artifact_sha256'),
  exportSchemaVersion: text('export_schema_version'),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastDownloadedAt: timestamp('last_downloaded_at'),
  downloadCount: integer('download_count').default(0).notNull(),
  snapshotAt: timestamp('snapshot_at'),
  startedAt: timestamp('started_at'),
  failedAt: timestamp('failed_at'),
  expiredAt: timestamp('expired_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiProcessingJobs = pgTable('ai_processing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  mode: aiModeEnum('mode').notNull(),
  modelProvider: text('model_provider').notNull(),
  modelVersion: text('model_version').notNull(),
  lineageId: uuid('lineage_id').notNull(),
  status: aiJobStatusEnum('status').default('pending').notNull(),
  redactionApplied: boolean('redaction_applied').default(false).notNull(),
  consentId: uuid('consent_id').references(() => consentEvents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  purgeAt: timestamp('purge_at'),
});

export const aiTrainingExclusions = pgTable('ai_training_exclusions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  scope: aiExclusionScopeEnum('scope').default('all').notNull(),
  reason: aiExclusionReasonEnum('reason').default('opt_out').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const retentionPolicies = pgTable('retention_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  dataCategory: text('data_category').notNull(),
  retentionDays: integer('retention_days').notNull(),
  deletionMode: deletionModeEnum('deletion_mode').notNull(),
  legalBasis: text('legal_basis').notNull(),
});

export const dismissedPatterns = pgTable('dismissed_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  patternKey: text('pattern_key').notNull(),
  snoozedUntil: timestamp('snoozed_until'),
  dismissedAt: timestamp('dismissed_at').defaultNow().notNull(),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  properties: jsonb('properties').default({}).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const personRoles = pgTable('person_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
  label: text('label').notNull(),
  boxId: uuid('box_id').references(() => boxes.id, { onDelete: 'set null' }),
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const personAliases = pgTable('person_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
  rawValue: text('raw_value').notNull(),
  normalizedValue: text('normalized_value').notNull(),
  aliasType: aliasTypeEnum('alias_type').notNull(),
  matchMode: matchModeEnum('match_mode').notNull(),
  scopeType: scopeTypeEnum('scope_type').notNull(),
  scopeId: uuid('scope_id'),
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  confirmationStatus: confirmationStatusEnum('confirmation_status').notNull(),
  autoConfirmAllowed: boolean('auto_confirm_allowed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const personMentions = pgTable('person_mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sourceType: mentionSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  sourceVersionId: uuid('source_version_id').notNull(),
  rawText: text('raw_text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  contextBefore: text('context_before'),
  contextAfter: text('context_after'),
  origin: mentionOriginEnum('origin').notNull(),
  status: mentionStatusEnum('status').notNull(),
  linkedPersonId: uuid('linked_person_id').references(() => people.id, { onDelete: 'set null' }),
  candidateConfidence: doublePrecision('candidate_confidence'),
  confidenceBand: confidenceBandEnum('confidence_band'),
  resolutionSource: resolutionSourceEnum('resolution_source'),
  resolutionVersion: integer('resolution_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mentionCandidates = pgTable('mention_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  mentionId: uuid('mention_id').references(() => personMentions.id, { onDelete: 'cascade' }).notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
  score: doublePrecision('score').notNull(),
  rank: integer('rank').notNull(),
  supportingReasons: text('supporting_reasons').array().notNull(),
  contradictoryReasons: text('contradictory_reasons').array().notNull(),
  state: candidateStateEnum('state').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const mentionResolutionEvents = pgTable('mention_resolution_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mentionId: uuid('mention_id').references(() => personMentions.id, { onDelete: 'cascade' }).notNull(),
  action: resolutionActionEventEnum('action').notNull(),
  previousPersonId: uuid('previous_person_id').references(() => people.id, { onDelete: 'set null' }),
  nextPersonId: uuid('next_person_id').references(() => people.id, { onDelete: 'set null' }),
  source: resolutionEventSourceEnum('source').notNull(),
  clientMutationId: text('client_mutation_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clarificationQuestions = pgTable('clarification_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  sourceVersionId: uuid('source_version_id').notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  status: questionStatusEnum('status').notNull(),
  promptTemplateKey: text('prompt_template_key').notNull(),
  mentionIds: uuid('mention_ids').array().notNull(),
  ambiguityScore: doublePrecision('ambiguity_score').notNull(),
  impactScore: doublePrecision('impact_score').notNull(),
  answerabilityScore: doublePrecision('answerability_score').notNull(),
  noveltyFactor: doublePrecision('novelty_factor').notNull(),
  userToleranceFactor: doublePrecision('user_tolerance_factor').notNull(),
  priorityScore: doublePrecision('priority_score').notNull(),
  version: integer('version').default(1).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  answeredAt: timestamp('answered_at'),
});

export const clarificationOptions = pgTable('clarification_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').references(() => clarificationQuestions.id, { onDelete: 'cascade' }).notNull(),
  optionType: optionTypeEnum('option_type').notNull(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  displayLabel: text('display_label').notNull(),
  supportingLabel: text('supporting_label'),
  sortOrder: integer('sort_order').notNull(),
});

export const personMerges = pgTable('person_merges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  survivingPersonId: uuid('surviving_person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
  mergedPersonId: uuid('merged_person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
  status: mergeStatusEnum('status').notNull(),
  snapshotVersion: integer('snapshot_version'),
  movedMentionIds: uuid('moved_mention_ids').array().default(sql`'{}'::uuid[]`).notNull(),
  movedAliasIds: uuid('moved_alias_ids').array().default(sql`'{}'::uuid[]`).notNull(),
  movedRoleIds: uuid('moved_role_ids').array().default(sql`'{}'::uuid[]`).notNull(),
  reversibleUntil: timestamp('reversible_until').notNull(),
  initiatedAt: timestamp('initiated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  reversedAt: timestamp('reversed_at'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  authenticatedAt: timestamp('authenticated_at').defaultNow().notNull(),
  reauthenticatedAt: timestamp('reauthenticated_at'),
  revokedAt: timestamp('revoked_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  tokenFamilyId: uuid('token_family_id').notNull(),
  parentTokenId: uuid('parent_token_id').references((): any => refreshTokens.id), // Self-reference
  replacedByTokenId: uuid('replaced_by_token_id').references((): any => refreshTokens.id), // Self-reference
  tokenHash: text('token_hash').unique().notNull(), // SHA-256
  idempotencyKeyHash: text('idempotency_key_hash'),
  retryResponseCiphertext: text('retry_response_ciphertext'),
  retryResponseExpiresAt: timestamp('retry_response_expires_at'),
  retryResponseKeyVersion: text('retry_response_key_version'),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  revokedAt: timestamp('revoked_at'),
  reuseDetectedAt: timestamp('reuse_detected_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    parentIdx: uniqueIndex('refresh_tokens_parent_idx').on(table.parentTokenId).where(sql`parent_token_id IS NOT NULL`),
  };
});

export const reauthenticationChallenges = pgTable('reauthentication_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  purpose: text('purpose').notNull(), // 'privacy_export', 'account_deletion'
  challengeHash: text('challenge_hash').notNull(), // SHA-256
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accountDeletionJobs = pgTable('account_deletion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }).unique(),
  statusTokenHash: text('status_token_hash').notNull(), // SHA-256 of opaque token
  status: text('status').notNull().default('pending'),
  rateLimitHits: integer('rate_limit_hits').default(0).notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  tokenRevokedAt: timestamp('token_revoked_at'),
  tokenFailedAttempts: integer('token_failed_attempts').default(0).notNull(),
  appleRevocationStatus: text('apple_revocation_status').default('not_applicable').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dataProcessingLogs = pgTable('data_processing_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  activity: text('activity').notNull(),
  legalBasis: text('legal_basis').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const retentionDeletionAudits = pgTable('retention_deletion_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  deletionMode: text('deletion_mode').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ── StoreKit & Promotional Tables ────────────────────────────────────────────
export const storekitTransactionTombstones = pgTable('storekit_transaction_tombstones', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: text('transaction_id').unique().notNull(),
  originalTransactionId: text('original_transaction_id'),
  productId: text('product_id').notNull(),
  environment: text('environment').notNull(),
  transactionStatus: text('transaction_status').notNull(),
  effectiveAt: timestamp('effective_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appStoreNotifications = pgTable('app_store_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationUuid: text('notification_uuid').unique().notNull(),
  notificationType: text('notification_type').notNull(),
  subtype: text('subtype'),
  environment: text('environment').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  processingStatus: text('processing_status').notNull(), // 'received' | 'processing' | 'processed' | 'failed' | 'ignored'
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  failureCode: text('failure_code'),
  signedDate: timestamp('signed_date'),
  processingStartedAt: timestamp('processing_started_at'),
  processingLeaseExpiresAt: timestamp('processing_lease_expires_at'),
});

export const storekitTransactions = pgTable('storekit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: text('transaction_id').unique().notNull(),
  originalTransactionId: text('original_transaction_id'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  productId: text('product_id').notNull(),
  appAccountToken: uuid('app_account_token'),
  purchaseDate: timestamp('purchase_date').notNull(),
  originalPurchaseDate: timestamp('original_purchase_date'),
  environment: text('environment').notNull(), // 'Sandbox' | 'Production'
  signedTransactionHash: text('signed_transaction_hash').unique().notNull(),
  verificationStatus: storekitVerificationStatusEnum('verification_status').notNull(),
  revokedAt: timestamp('revoked_at'),
  revocationReason: text('revocation_reason'),
  claimedAt: timestamp('claimed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('storekit_transactions_user_id_idx').on(t.userId),
  productIdIdx: index('storekit_transactions_product_id_idx').on(t.productId),
  origTxnIdIdx: index('storekit_transactions_orig_txn_id_idx').on(t.originalTransactionId),
}));

export const promotionalGrants = pgTable('promotional_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  campaignId: text('campaign_id').notNull(), // 'founding_launch_2026' | 'founding_extension_2026' | 'creator_bonus_2026'
  grantType: promotionalGrantTypeEnum('grant_type').notNull(),
  transactionId: text('transaction_id').unique().notNull(),
  approvalId: uuid('approval_id').references(() => creatorRewardApprovals.id, { onDelete: 'set null' }),
  durationMonths: integer('duration_months').notNull(),
  status: promotionalGrantStatusEnum('status').notNull(),
  redeemedAt: timestamp('redeemed_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('promotional_grants_user_id_idx').on(t.userId),
  grantTypeIdx: index('promotional_grants_grant_type_idx').on(t.grantType),
  oneLaunchPerCampaign: uniqueIndex('promotional_one_launch_per_campaign').on(t.userId, t.campaignId, t.grantType).where(sql`grant_type = 'founding_launch' AND status <> 'revoked'`),
  oneExtensionPerCampaign: uniqueIndex('promotional_one_extension_per_campaign').on(t.userId, t.campaignId, t.grantType).where(sql`grant_type = 'founding_extension' AND status <> 'revoked'`),
  approvalIdUnique: uniqueIndex('promotional_grant_approval_id_unique').on(t.approvalId).where(sql`approval_id IS NOT NULL`),
}));

export const userCampaignStates = pgTable('user_campaign_states', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  foundingCampaignEligible: boolean('founding_campaign_eligible').default(false).notNull(),
  foundingCampaignAnchorAt: timestamp('founding_campaign_anchor_at'),
  extensionInviteIssuedAt: timestamp('extension_invite_issued_at'),
  extensionFeedbackCompletedAt: timestamp('extension_feedback_completed_at'),
  creatorRewardMonthsApproved: integer('creator_reward_months_approved').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const foundingCampaignConfigs = pgTable('founding_campaign_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: text('campaign_id').unique().notNull(),
  productId: text('product_id').unique().notNull(),
  campaignType: text('campaign_type').notNull(),
  signupStartsAt: timestamp('signup_starts_at').notNull(),
  signupEndsAt: timestamp('signup_ends_at').notNull(),
  redemptionStartsAt: timestamp('redemption_starts_at'),
  redemptionEndsAt: timestamp('redemption_ends_at').notNull(),
  requiresExplicitEligibility: boolean('requires_explicit_eligibility').default(true).notNull(),
  requiresExtensionInvite: boolean('requires_extension_invite').default(false).notNull(),
  requiresFoundingFeedback: boolean('requires_founding_feedback').default(false).notNull(),
  requiresCreatorApproval: boolean('requires_creator_approval').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const creatorRewardApprovals = pgTable('creator_reward_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  platform: text('platform').default('tiktok').notNull(),
  deliverableUrl: text('deliverable_url').notNull(),
  status: creatorRewardApprovalStatusEnum('status').default('submitted').notNull(),
  approvedMonths: integer('approved_months').default(1).notNull(),
  approvedAt: timestamp('approved_at'),
  codeIssuedAt: timestamp('code_issued_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const foundingFeedback = pgTable('founding_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  whatWorked: text('what_worked').notNull(),
  whatWasConfusing: text('what_was_confusing').notNull(),
  bugsEncountered: text('bugs_encountered').notNull(),
  mostValuableFeature: text('most_valuable_feature').notNull(),
  whatAlmostMadeYouStop: text('what_almost_made_you_stop').notNull(),
  mayContactForFollowUp: boolean('may_contact_for_follow_up').default(false).notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const reviewOutreachStates = pgTable('review_outreach_states', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  reviewEmailSentAt: timestamp('review_email_sent_at'),
  reviewReminderSentAt: timestamp('review_reminder_sent_at'),
  marketingUnsubscribedAt: timestamp('marketing_unsubscribed_at'),
});
