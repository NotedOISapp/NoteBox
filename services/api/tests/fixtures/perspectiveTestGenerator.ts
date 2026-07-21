import type { PerspectiveTestGeneratorInput } from '../../src/routes/perspectives.js';

const sharedQualityChecks = {
  specificToNote: true,
  avoidedCornyLanguage: true,
  avoidedDiagnosis: true,
  avoidedEscalation: true,
  avoidedTherapyLanguage: true,
  groundedInProvidedContext: true,
  perspectiveBucketDistinct: true,
};

export function generateTestPerspectives({ metadata }: PerspectiveTestGeneratorInput) {
  const missingDecisiveFact = metadata.recordConfidence === 'thin'
    || metadata.contextStatus === 'missing_decisive_fact';

  return {
    aligned: {
      title: 'Aligned',
      subheadline: 'Feel understood, right now.',
      responseText: 'That would feel frustrating because you were asking for clarity, not drama. Saving this detail makes sense because the plan was left unclear and then your follow-up was framed as excessive. You are keeping a record of what actually happened, which is a grounding move.',
      safetyFlags: ['clean'],
      qualityChecks: { ...sharedQualityChecks, alignedHasEmotionalAccuracy: true },
    },
    objective: {
      title: 'Objective',
      subheadline: 'Outside perspective.',
      responseText: 'The sequence is that the plan remained unclear, then the request for consideration became the issue. An outside reading is that communication broke down and the effort of managing it landed unevenly. The remaining question is whether this was isolated or repeated.',
      safetyFlags: ['clean'],
      qualityChecks: { ...sharedQualityChecks, objectiveHasClarity: true },
    },
    unfiltered: {
      title: 'Unfiltered',
      subheadline: 'No holding back.',
      responseText: missingDecisiveFact
        ? 'There is not enough here for a hard read yet. The missing piece is whether explicit expectations were set beforehand. Add that fact before treating this as a repeated pattern or assigning responsibility.'
        : 'He disappeared from the plan, then tried to make your follow-up look like the drama. That is a convenient little move: create the uncertainty upfront, then act exhausted by the person trying to clarify it. You are carrying the cost of his disorganization while he avoids responsibility.',
      safetyFlags: ['clean'],
      recordConfidence: metadata.recordConfidence,
      accountabilityRead: metadata.accountabilityRead,
      contextStatus: metadata.contextStatus,
      hardRead: metadata.recordConfidence === 'strong'
        && ['user_primary_cause', 'user_contributed'].includes(metadata.accountabilityRead),
      missingDecisiveFact: missingDecisiveFact ? 'whether explicit expectations were set beforehand' : undefined,
      qualityChecks: { ...sharedQualityChecks, unfilteredHasBite: true },
    },
  };
}
