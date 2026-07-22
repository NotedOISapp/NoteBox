import { z } from 'zod';

export type PerspectiveName = 'aligned' | 'objective' | 'unfiltered';

export type PerspectiveBlock = {
  title: 'Aligned' | 'Objective' | 'Unfiltered';
  subheadline: string;
  responseText: string;
  recordConfidence?: 'thin' | 'developing' | 'strong' | 'conflicting' | 'safety_sensitive';
  accountabilityRead?: 'user_supported' | 'mixed' | 'user_contributed' | 'user_primary_cause' | 'insufficient_context';
  contextStatus?: 'complete_enough' | 'missing_decisive_fact' | 'skipped_decisive_fact' | 'conflicting_context';
  hardRead?: boolean;
  missingDecisiveFact?: string;
  contradiction?: string;
  safetyFlags?: string[];
  qualityChecks?: {
    specificToNote?: boolean;
    avoidedCornyLanguage?: boolean;
    avoidedDiagnosis?: boolean;
    avoidedEscalation?: boolean;
    avoidedTherapyLanguage?: boolean;
    groundedInProvidedContext?: boolean;
    perspectiveBucketDistinct?: boolean;
    alignedHasEmotionalAccuracy?: boolean;
    objectiveHasClarity?: boolean;
    unfilteredHasBite?: boolean;
  };
};

export type PerspectivesPayload = {
  aligned: PerspectiveBlock;
  objective: PerspectiveBlock;
  unfiltered: PerspectiveBlock;
};

export class PerspectiveComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PerspectiveComplianceError';
  }
}

// Strict Zod Schemas for OpenAI Structured Outputs
export const QualityChecksSchema = z.object({
  specificToNote: z.literal(true),
  avoidedCornyLanguage: z.literal(true),
  avoidedDiagnosis: z.literal(true),
  avoidedEscalation: z.literal(true),
  avoidedTherapyLanguage: z.literal(true),
  groundedInProvidedContext: z.literal(true),
  perspectiveBucketDistinct: z.literal(true),
  alignedHasEmotionalAccuracy: z.boolean().optional(),
  objectiveHasClarity: z.boolean().optional(),
  unfilteredHasBite: z.boolean().optional(),
});

export const PerspectiveBlockSchema = z.object({
  title: z.enum(['Aligned', 'Objective', 'Unfiltered']),
  subheadline: z.string(),
  responseText: z.string().min(40).max(1200),
  safetyFlags: z.array(z.string()).default([]),
  qualityChecks: QualityChecksSchema,
});

export const PerspectivesOutputSchema = z.object({
  aligned: PerspectiveBlockSchema.extend({
    title: z.literal('Aligned'),
    subheadline: z.literal('Feel understood, right now.'),
    qualityChecks: QualityChecksSchema.extend({
      alignedHasEmotionalAccuracy: z.literal(true),
    }),
  }),
  objective: PerspectiveBlockSchema.extend({
    title: z.literal('Objective'),
    subheadline: z.literal('Outside perspective.'),
    qualityChecks: QualityChecksSchema.extend({
      objectiveHasClarity: z.literal(true),
    }),
  }),
  unfiltered: PerspectiveBlockSchema.extend({
    title: z.literal('Unfiltered'),
    subheadline: z.literal('No holding back.'),
    qualityChecks: QualityChecksSchema.extend({
      unfilteredHasBite: z.literal(true),
    }),
    recordConfidence: z.enum(['thin', 'developing', 'strong', 'conflicting', 'safety_sensitive']),
    accountabilityRead: z.enum(['user_supported', 'mixed', 'user_contributed', 'user_primary_cause', 'insufficient_context']),
    contextStatus: z.enum(['complete_enough', 'missing_decisive_fact', 'skipped_decisive_fact', 'conflicting_context']),
    hardRead: z.boolean(),
    missingDecisiveFact: z.string().optional(),
    contradiction: z.string().optional(),
  }),
});

// Compliance Regex Patterns
const BANNED_SINGLE_WORDS: RegExp[] = [
  /\bgaslighting\b/i,
  /\bgaslights\b/i,
  /\bgaslit\b/i,
  /\btrauma\b/i,
  /\btraumatic\b/i,
  /\babuse\b/i,
  /\babusive\b/i,
  /\babuser\b/i,
  /\bnarcissist\b/i,
  /\bnarcissistic\b/i,
  /\bsociopath\b/i,
  /\bsociopathic\b/i,
  /\bpsychopath\b/i,
  /\bpsychopathic\b/i,
  /\bdiagnosis\b/i,
  /\bdiagnose\b/i,
  /\bdiagnosed\b/i,
  /\btoxic\b/i,
  /\bbestie\b/i,
  /\bqueen\b/i,
  /\bgirl\b/i,
  /\bsis\b/i,
  /\bvibes\b/i,
  /\benergy\b/i,
  /\bperiod\b/i,
];

const BANNED_PHRASES: RegExp[] = [
  /\bred flag\b/i,
  /\bprotect your peace\b/i,
  /\bmain character\b/i,
  /\bhealing journey\b/i,
  /\binner child\b/i,
  /\bclown behavior\b/i,
  /\btrash took itself out\b/i,
  /\bwhen someone shows you who they are\b/i,
  /\bthe audacity\b/i,
];

const HARMFUL_ESCALATION: RegExp[] = [
  /\bget revenge\b/i,
  /\btake revenge\b/i,
  /\bmake them pay\b/i,
  /\bteach them a lesson\b/i,
  /\bexpose them\b/i,
  /\bexpose him\b/i,
  /\bexpose her\b/i,
  /\bleak\b/i,
  /\bdoxx\b/i,
  /\bdox\b/i,
  /\bharass\b/i,
  /\bstalk\b/i,
  /\bfollow them\b/i,
  /\btrack them\b/i,
  /\bthreaten\b/i,
  /\bblackmail\b/i,
  /\bhit them\b/i,
  /\bhurt them\b/i,
  /\battack them\b/i,
  /\bslash\b/i,
  /\bdestroy their\b/i,
];

const DEHUMANIZING_OR_SLUR_LIKE: RegExp[] = [
  /\bsubhuman\b/i,
  /\bvermin\b/i,
  /\banimal\b/i,
  /\bmonster\b/i,
  /\bpsycho\b/i,
  /\bcrazy\b/i,
  /\binsane\b/i,
];

const GENERIC_UNFILTERED_FAILS: RegExp[] = [
  /\byou deserve better\b/i,
  /\bthat is unacceptable\b/i,
  /\bset boundaries\b/i,
  /\bwalk away\b/i,
  /\bknow your worth\b/i,
  /\bdon't let anyone\b/i,
  /\byour feelings are valid\b/i,
];

const SHARP_UNFILTERED_MARKERS: RegExp[] = [
  /\bcreated\b/i,
  /\bthen\b/i,
  /\bmade your\b/i,
  /\bcleanup\b/i,
  /\bconvenient\b/i,
  /\bcarrying\b/i,
  /\bcost\b/i,
  /\bperformance\b/i,
  /\bexcuse\b/i,
  /\buncertainty\b/i,
  /\bclarity\b/i,
  /\bacted\b/i,
  /\bpretend\b/i,
  /\bbare minimum\b/i,
  /\bresponsibility\b/i,
  /\btrapdoor\b/i,
  /\bmagic trick\b/i,
  /\bfee\b/i,
];

function allText(payload: PerspectivesPayload): string {
  return [
    payload.aligned.responseText,
    payload.objective.responseText,
    payload.unfiltered.responseText,
  ].join('\n');
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

export function containsBannedLanguage(text: string): boolean {
  return [
    ...BANNED_SINGLE_WORDS,
    ...BANNED_PHRASES,
    ...HARMFUL_ESCALATION,
    ...DEHUMANIZING_OR_SLUR_LIKE,
  ].some((pattern) => pattern.test(text));
}

export function assertNoBannedLanguage(payload: PerspectivesPayload): void {
  const combined = allText(payload);

  const allBanned = [
    ...BANNED_SINGLE_WORDS,
    ...BANNED_PHRASES,
    ...HARMFUL_ESCALATION,
    ...DEHUMANIZING_OR_SLUR_LIKE,
  ];

  for (const pattern of allBanned) {
    if (pattern.test(combined)) {
      throw new PerspectiveComplianceError(
        `Perspective output contains banned language or unsafe guidance: ${pattern}`
      );
    }
  }
}

export function assertAlignedQuality(alignedText: string): void {
  const lower = alignedText.toLowerCase();

  const bannedAlignedFluff = [
    /\byour feelings are valid\b/i,
    /\byou are valid\b/i,
    /\bprotect your peace\b/i,
    /\byou deserve better\b/i,
    /\bhealing\b/i,
    /\bjourney\b/i,
    /\bboundaries\b/i,
  ];

  for (const pattern of bannedAlignedFluff) {
    if (pattern.test(lower)) {
      throw new PerspectiveComplianceError(
        `Aligned sounds like therapy or generic wellness content: ${pattern}`
      );
    }
  }

  if (alignedText.trim().split(/\s+/).length < 35) {
    throw new PerspectiveComplianceError(
      'Aligned is too thin to provide emotional steadiness.'
    );
  }
}

export function assertObjectiveNoUnsupportedPattern(
  objectiveText: string,
  priorNotesCount: number
): void {
  const lower = objectiveText.toLowerCase();

  const strongPatternClaims = [
    /\bthis is a pattern\b/i,
    /\bthe pattern is\b/i,
    /\bthey always\b/i,
    /\bevery time\b/i,
    /\bkeeps happening\b/i,
    /\brepeatedly\b/i,
    /\bagain and again\b/i,
  ];

  if (priorNotesCount === 0) {
    for (const pattern of strongPatternClaims) {
      if (pattern.test(lower)) {
        throw new PerspectiveComplianceError(
          `Objective claimed recurrence without history: ${pattern}`
        );
      }
    }
  }
}

export function assertObjectiveQuestionCount(
  objectiveText: string,
  maxQuestions = 1
): void {
  const questionCount = (objectiveText.match(/\?/g) || []).length;

  if (questionCount > maxQuestions) {
    throw new PerspectiveComplianceError(
      `Objective asked too many questions. Found ${questionCount}, max ${maxQuestions}.`
    );
  }
}

export function assertUnfilteredHasBite(unfilteredText: string): void {
  const lower = unfilteredText.toLowerCase();

  for (const pattern of GENERIC_UNFILTERED_FAILS) {
    if (pattern.test(lower)) {
      throw new PerspectiveComplianceError(
        `Unfiltered is generic, tame, or wellness-coded: ${pattern}`
      );
    }
  }

  const markerCount = countMatches(lower, SHARP_UNFILTERED_MARKERS);

  if (markerCount < 2) {
    throw new PerspectiveComplianceError(
      'Unfiltered lacks bite. It must strip the excuse, name the transaction, or land a sharper read.'
    );
  }

  const wordCount = unfilteredText.trim().split(/\s+/).length;

  if (wordCount < 45) {
    throw new PerspectiveComplianceError(
      'Unfiltered is too short to deliver a satisfying sharp read.'
    );
  }
}

export function assertBucketDistinctness(payload: PerspectivesPayload): void {
  const aligned = payload.aligned.responseText.trim().toLowerCase();
  const objective = payload.objective.responseText.trim().toLowerCase();
  const unfiltered = payload.unfiltered.responseText.trim().toLowerCase();

  if (aligned === objective || objective === unfiltered || aligned === unfiltered) {
    throw new PerspectiveComplianceError(
      'Perspective buckets are identical.'
    );
  }

  const alignedWords = new Set(aligned.split(/\s+/));
  const objectiveWords = new Set(objective.split(/\s+/));
  const unfilteredWords = new Set(unfiltered.split(/\s+/));

  function overlapRatio(a: Set<string>, b: Set<string>): number {
    const intersection = [...a].filter((word) => b.has(word));
    const denominator = Math.max(a.size, b.size, 1);
    return intersection.length / denominator;
  }

  if (overlapRatio(alignedWords, objectiveWords) > 0.78) {
    throw new PerspectiveComplianceError(
      'Aligned and Objective are too similar.'
    );
  }

  if (overlapRatio(objectiveWords, unfilteredWords) > 0.78) {
    throw new PerspectiveComplianceError(
      'Objective and Unfiltered are too similar.'
    );
  }
}

export function assertQualityChecks(payload: PerspectivesPayload): void {
  const requiredChecks: Array<keyof NonNullable<PerspectiveBlock['qualityChecks']>> = [
    'specificToNote',
    'avoidedCornyLanguage',
    'avoidedDiagnosis',
    'avoidedEscalation',
    'avoidedTherapyLanguage',
    'groundedInProvidedContext',
    'perspectiveBucketDistinct',
  ];

  for (const [state, block] of Object.entries(payload)) {
    if (!block.qualityChecks) {
      throw new PerspectiveComplianceError(
        `${state} is missing qualityChecks.`
      );
    }

    for (const check of requiredChecks) {
      if (block.qualityChecks[check] !== true) {
        throw new PerspectiveComplianceError(
          `${state} failed quality check: ${check}`
        );
      }
    }
  }

  if (payload.aligned.qualityChecks?.alignedHasEmotionalAccuracy !== true) {
    throw new PerspectiveComplianceError(
      'Aligned failed alignedHasEmotionalAccuracy.'
    );
  }

  if (payload.objective.qualityChecks?.objectiveHasClarity !== true) {
    throw new PerspectiveComplianceError(
      'Objective failed objectiveHasClarity.'
    );
  }

  if (payload.unfiltered.qualityChecks?.unfilteredHasBite !== true) {
    throw new PerspectiveComplianceError(
      'Unfiltered failed unfilteredHasBite.'
    );
  }
}

export function assertPerspectiveCompliance(
  payload: PerspectivesPayload,
  options: {
    priorNotesCount: number;
    requireQualityChecks?: boolean;
  }
): void {
  assertNoBannedLanguage(payload);
  assertAlignedQuality(payload.aligned.responseText);
  assertObjectiveNoUnsupportedPattern(
    payload.objective.responseText,
    options.priorNotesCount
  );
  assertObjectiveQuestionCount(payload.objective.responseText, 1);
  assertUnfilteredHasBite(payload.unfiltered.responseText);
  assertBucketDistinctness(payload);

  if (options.requireQualityChecks) {
    assertQualityChecks(payload);
  }
}

/**
 * Punctuation and Dash Normalization (Em-dashes, En-dashes, and Double Hyphens)
 */
export function normalizePunctuation(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Replace em-dashes (—) and en-dashes (–) with standard hyphens
  cleaned = cleaned.replace(/[\u2014\u2013]/g, '-');
  // Replace double hyphens with single hyphens
  cleaned = cleaned.replace(/--/g, '-');
  return cleaned.replace(/\s+/g, ' ').trim();
}
