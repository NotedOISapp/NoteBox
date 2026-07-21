import { describe, it, expect } from 'vitest';
import {
  assertPerspectiveCompliance,
  assertUnfilteredHasBite,
  containsBannedLanguage,
  PerspectiveComplianceError,
  type PerspectivesPayload,
} from './perspectiveCompliance.js';

function makePayload(overrides?: Partial<PerspectivesPayload>): PerspectivesPayload {
  const defaultPayload: PerspectivesPayload = {
    aligned: {
      title: 'Aligned',
      subheadline: 'Feel understood, right now.',
      responseText:
        'That would feel frustrating because you were not asking for a dramatic explanation. You were simply asking whether the plan still existed. Keeping this detail together makes sense because the sequence matters and saving the record keeps the timeline clear when memory gets minimized.',
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        alignedHasEmotionalAccuracy: true,
      },
    },
    objective: {
      title: 'Objective',
      subheadline: 'Outside perspective.',
      responseText:
        'The sequence is simple: he left the plan unclear, then framed your request for clarity as the problem. A fair outside lens is that he may have been distracted, but the uncertainty was created on his side while the cost landed on yours. Is this a one-off lapse, or does clarity repeatedly become your responsibility?',
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        objectiveHasClarity: true,
      },
    },
    unfiltered: {
      title: 'Unfiltered',
      subheadline: 'No holding back.',
      responseText:
        'He disappeared from the plan, then tried to make your follow-up look like the drama. That is a convenient little magic trick: create the uncertainty, then act exhausted by the person trying to clean it up. It shifts the entire burden of clarity onto you while keeping his own schedule fully flexible.',
      recordConfidence: 'strong',
      accountabilityRead: 'mixed',
      contextStatus: 'complete_enough',
      hardRead: false,
      qualityChecks: {
        specificToNote: true,
        avoidedCornyLanguage: true,
        avoidedDiagnosis: true,
        avoidedEscalation: true,
        avoidedTherapyLanguage: true,
        groundedInProvidedContext: true,
        perspectiveBucketDistinct: true,
        unfilteredHasBite: true,
      },
    },
  };

  if (overrides) {
    return {
      aligned: { ...defaultPayload.aligned, ...overrides.aligned },
      objective: { ...defaultPayload.objective, ...overrides.objective },
      unfiltered: { ...defaultPayload.unfiltered, ...overrides.unfiltered },
    };
  }

  return defaultPayload;
}

describe('Strict Compliance Unit Tests', () => {
  it('allows strong NoteBox-safe output', () => {
    const payload = makePayload();
    assertPerspectiveCompliance(payload, {
      priorNotesCount: 2,
      requireQualityChecks: true,
    });
  });

  it('blocks clinical and therapy-coded labels', () => {
    const payload = makePayload({
      unfiltered: {
        title: 'Unfiltered',
        subheadline: 'No holding back.',
        responseText:
          'He is a narcissist and this is clearly gaslighting and trauma.',
        recordConfidence: 'strong',
        accountabilityRead: 'mixed',
        contextStatus: 'complete_enough',
        hardRead: false,
        qualityChecks: {
          specificToNote: true,
          avoidedCornyLanguage: true,
          avoidedDiagnosis: false,
          avoidedEscalation: true,
          avoidedTherapyLanguage: false,
          groundedInProvidedContext: true,
          perspectiveBucketDistinct: true,
          unfilteredHasBite: true,
        },
      },
    });

    let threw = false;
    try {
      assertPerspectiveCompliance(payload, {
        priorNotesCount: 1,
        requireQualityChecks: false,
      });
    } catch (e) {
      threw = e instanceof PerspectiveComplianceError;
    }
    if (!threw) throw new Error('Failed to block clinical labels');
  });

  it('blocks corny internet-best-friend language', () => {
    const text =
      'Girl, the audacity. He is toxic and giving red flag energy. Protect your peace, queen. Period.';
    if (!containsBannedLanguage(text)) {
      throw new Error('Failed to detect banned language');
    }
  });

  it('blocks revenge, stalking, harassment, doxxing, threats, blackmail, and violence', () => {
    const unsafeSamples = [
      'You should get revenge.',
      'Make them pay.',
      'Expose them.',
      'You should stalk them.',
      'Leak their private information.',
      'Harass them until they answer.',
      'Threaten them.',
      'Blackmail them.',
      'Hit them.',
      'Hurt them.',
    ];

    for (const sample of unsafeSamples) {
      const payload = makePayload({
        unfiltered: {
          title: 'Unfiltered',
          subheadline: 'No holding back.',
          responseText: sample,
          recordConfidence: 'strong',
          accountabilityRead: 'mixed',
          contextStatus: 'complete_enough',
          hardRead: false,
          qualityChecks: {
            specificToNote: true,
            avoidedCornyLanguage: true,
            avoidedDiagnosis: true,
            avoidedEscalation: false,
            avoidedTherapyLanguage: true,
            groundedInProvidedContext: true,
            perspectiveBucketDistinct: true,
            unfilteredHasBite: false,
          },
        },
      });

      let threw = false;
      try {
        assertPerspectiveCompliance(payload, {
          priorNotesCount: 1,
          requireQualityChecks: false,
        });
      } catch (e) {
        threw = e instanceof PerspectiveComplianceError;
      }
      if (!threw) throw new Error(`Failed to block unsafe sample: "${sample}"`);
    }
  });

  it('does not allow Objective to claim recurrence from a single Note', () => {
    const payload = makePayload({
      objective: {
        title: 'Objective',
        subheadline: 'Outside perspective.',
        responseText:
          'The pattern is that he always creates uncertainty and repeatedly makes clarity your responsibility.',
        qualityChecks: {
          specificToNote: true,
          avoidedCornyLanguage: true,
          avoidedDiagnosis: true,
          avoidedEscalation: true,
          avoidedTherapyLanguage: true,
          groundedInProvidedContext: true,
          perspectiveBucketDistinct: true,
          objectiveHasClarity: true,
        },
      },
    });

    let threw = false;
    try {
      assertPerspectiveCompliance(payload, {
        priorNotesCount: 0,
        requireQualityChecks: false,
      });
    } catch (e) {
      threw = e instanceof PerspectiveComplianceError;
    }
    if (!threw) throw new Error('Allowed Objective to claim recurrence without history');
  });

  it('allows Objective to use measured recurrence language when history exists', () => {
    const payload = makePayload({
      objective: {
        title: 'Objective',
        subheadline: 'Outside perspective.',
        responseText:
          'Across the available Notes, the clearest connection is the same sequence: last-minute uncertainty, then criticism when you ask for basic clarity. Work may be a real factor, but the cost keeps landing on you. Is the issue the cancellation itself, or the way your need for notice gets recast as too much?',
        qualityChecks: {
          specificToNote: true,
          avoidedCornyLanguage: true,
          avoidedDiagnosis: true,
          avoidedEscalation: true,
          avoidedTherapyLanguage: true,
          groundedInProvidedContext: true,
          perspectiveBucketDistinct: true,
          objectiveHasClarity: true,
        },
      },
    });

    assertPerspectiveCompliance(payload, {
      priorNotesCount: 2,
      requireQualityChecks: true,
    });
  });

  it('blocks Unfiltered that is too tame or generic', () => {
    let threw = false;
    try {
      assertUnfilteredHasBite('That is unacceptable. You deserve better and should set boundaries.');
    } catch (e) {
      threw = e instanceof PerspectiveComplianceError;
    }
    if (!threw) throw new Error('Allowed generic Unfiltered text');
  });

  it('allows Unfiltered with specific bite', () => {
    assertUnfilteredHasBite(
      'He disappeared from the plan, then tried to make your follow-up look like the drama. That is a convenient little magic trick: create the uncertainty, then act exhausted by the person trying to clean it up. It shifts the entire burden of clarity onto you while keeping his own schedule fully flexible.'
    );
  });

  it('does not block record-first language like worth saving or worth keeping', () => {
    const payload = makePayload({
      aligned: {
        title: 'Aligned',
        subheadline: 'Feel understood, right now.',
        responseText:
          'That would feel frustrating because you were not asking for a dramatic explanation. You were asking whether the plan still existed. This was worth saving because the detail matters and keeping the record prevents the reality from getting rewritten by excuses.',
        qualityChecks: {
          specificToNote: true,
          avoidedCornyLanguage: true,
          avoidedDiagnosis: true,
          avoidedEscalation: true,
          avoidedTherapyLanguage: true,
          groundedInProvidedContext: true,
          perspectiveBucketDistinct: true,
          alignedHasEmotionalAccuracy: true,
        },
      },
    });

    assertPerspectiveCompliance(payload, {
      priorNotesCount: 2,
      requireQualityChecks: true,
    });
  });

  it('fails when quality checks are missing in strict mode', () => {
    const payload = makePayload();
    // Delete quality checks from aligned
    payload.aligned.qualityChecks = undefined;

    let threw = false;
    try {
      assertPerspectiveCompliance(payload, {
        priorNotesCount: 2,
        requireQualityChecks: true,
      });
    } catch (e) {
      threw = e instanceof PerspectiveComplianceError;
    }
    if (!threw) throw new Error('Allowed missing quality checks in strict mode');
  });

  it('fails when specific required quality checks are false', () => {
    const payload1 = makePayload();
    if (payload1.aligned.qualityChecks) payload1.aligned.qualityChecks.specificToNote = false as any;
    expect(() => assertPerspectiveCompliance(payload1, { priorNotesCount: 1, requireQualityChecks: true })).toThrow(PerspectiveComplianceError);

    const payload2 = makePayload();
    if (payload2.aligned.qualityChecks) payload2.aligned.qualityChecks.alignedHasEmotionalAccuracy = false as any;
    expect(() => assertPerspectiveCompliance(payload2, { priorNotesCount: 1, requireQualityChecks: true })).toThrow(PerspectiveComplianceError);

    const payload3 = makePayload();
    if (payload3.objective.qualityChecks) payload3.objective.qualityChecks.objectiveHasClarity = false as any;
    expect(() => assertPerspectiveCompliance(payload3, { priorNotesCount: 1, requireQualityChecks: true })).toThrow(PerspectiveComplianceError);

    const payload4 = makePayload();
    if (payload4.unfiltered.qualityChecks) payload4.unfiltered.qualityChecks.unfilteredHasBite = false as any;
    expect(() => assertPerspectiveCompliance(payload4, { priorNotesCount: 1, requireQualityChecks: true })).toThrow(PerspectiveComplianceError);
  });

  it('fails when overlap ratio exceeds threshold between buckets', () => {
    const payload = makePayload();
    // Make aligned and objective share almost exact same words
    payload.objective.responseText = payload.aligned.responseText + ' extra word here';
    expect(() => assertPerspectiveCompliance(payload, { priorNotesCount: 1 })).toThrow('Aligned and Objective are too similar.');

    const payload2 = makePayload();
    payload2.unfiltered.responseText = payload2.objective.responseText + ' created then convenient cost';
    expect(() => assertPerspectiveCompliance(payload2, { priorNotesCount: 1 })).toThrow('Objective and Unfiltered are too similar.');
  });

  it('tests normalizePunctuation utility', async () => {
    const { normalizePunctuation } = await import('./perspectiveCompliance.js');
    expect(normalizePunctuation('')).toBe('');
    expect(normalizePunctuation('Hello \u2014 world \u2013 test -- double')).toBe('Hello - world - test - double');
  });
});
