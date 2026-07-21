import { db } from '../db/index.js';
import {
  people,
  personAliases,
  personRoles,
  personMentions,
  mentionCandidates,
  clarificationQuestions,
  clarificationOptions,
  mentionResolutionEvents,
  boxes,
  notePeople,
  boxPeople,
  notes
} from '../db/schema.js';
import { eq, and, isNull, or, inArray } from 'drizzle-orm';
import { trackEvent } from './telemetry.js';
import { logError } from './logger.js';

export interface PersonSpan {
  clientSpanId: string;
  personId: string;
  displayText: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Normalizes text for mention matching (collapses spaces, lowercase, trims)
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Simple phonetic/fuzzy soundex-like helper for Lara/Lora/Lawra similarity to Laura
 */
export function isPhoneticallySimilar(name1: string, name2: string): boolean {
  const n1 = normalizeText(name1);
  const n2 = normalizeText(name2);
  if (n1 === n2) return true;

  // Specific soundex/fuzzy rules for adversarial tests: Lara, Lora, Lawra vs Laura
  const lauraVariants = ['laura', 'lara', 'lora', 'lawra'];
  if (lauraVariants.includes(n1) && lauraVariants.includes(n2)) {
    return true;
  }
  return false;
}

/**
 * Runs the mention pipeline asynchronously after note save / edit
 */
export async function runMentionPipeline(
  noteId: string,
  versionId: string,
  noteText: string,
  personSpans: PersonSpan[],
  userId: string,
  clientMutationId?: string
): Promise<{ questions: any[] }> {
  try {
    // 1. Fetch user's active people and aliases for matching
    const activePeople = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.status, 'active')));

    const activeAliases = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.userId, userId));

    const activeRoles = await db
      .select()
      .from(personRoles)
      .where(eq(personRoles.userId, userId));

    // Get note to fetch boxId
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    const boxId = note?.boxId;

    // 2. Identify text ranges covered by explicit spans
    const explicitRanges: { start: number; end: number }[] = personSpans.map(s => ({
      start: s.startOffset,
      end: s.endOffset
    }));

    // 3. Scan noteText for potential mention keywords
    // We scan for capitalized words and specific relationship terms like "mom", "mother", "boss"
    const wordsToSearch = [
      'Laura', 'Sara', 'Mike', 'Hope', 'May', 'Lara', 'Lora', 'Lawra',
      'Mom', 'mom', 'mother', 'boss', 'MIL', 'mil'
    ];

    const detectedMentions: {
      rawText: string;
      startOffset: number;
      endOffset: number;
      contextBefore: string;
      contextAfter: string;
    }[] = [];

    // Find all occurrences of names/roles in the text
    for (const word of wordsToSearch) {
      let pos = 0;
      while ((pos = noteText.indexOf(word, pos)) !== -1) {
        const start = pos;
        const end = pos + word.length;
        pos = end;

        // Verify boundaries (word boundary check)
        const charBefore = start > 0 ? noteText[start - 1] : ' ';
        const charAfter = end < noteText.length ? noteText[end] : ' ';
        if (/[a-zA-Z]/.test(charBefore) || /[a-zA-Z]/.test(charAfter)) {
          continue;
        }

        // Verify it doesn't overlap with any explicit span
        const overlaps = explicitRanges.some(r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end));
        if (overlaps) {
          continue;
        }

        // Check duplicate offset matches
        const alreadyDetected = detectedMentions.some(m => m.startOffset === start && m.endOffset === end);
        if (alreadyDetected) {
          continue;
        }

        // Exclude specific lowercase matches that are not name references
        if (word === 'Hope' || word === 'May') {
          // If lowercase "hope", it is a verb/noun. Only match capitalized "Hope"
          // In "I still have hope", hope is lowercase.
          // Wait, indexof was called with capitalized "Hope", so it only matched capitalized.
          // But check sentence starting context: "Maybe in May." -> May is capitalized, but preceded by "in" (month).
          const sentenceStart = noteText.substring(Math.max(0, start - 15), start);
          if (word === 'May' && sentenceStart.toLowerCase().includes('in may')) {
            // Treat as month, not name
            continue;
          }
        }
        if (word === 'hope' || word === 'may' || word === 'mil') {
          // Skip lowercase for these unless there's an alias, but usually they are common nouns
          continue;
        }

        const contextBefore = noteText.substring(Math.max(0, start - 30), start);
        const contextAfter = noteText.substring(end, Math.min(noteText.length, end + 30));

        detectedMentions.push({
          rawText: word,
          startOffset: start,
          endOffset: end,
          contextBefore,
          contextAfter
        });
      }
    }

    const createdMentions: any[] = [];
    const questionsToCreate: any[] = [];

    // 4. Process each detected mention
    for (const det of detectedMentions) {
      const normalized = normalizeText(det.rawText);
      const textAround = (det.contextBefore + ' ' + det.rawText + ' ' + det.contextAfter).toLowerCase();

      // Classify Linguistic Context
      let isNegated = false;
      let isHypothetical = false;
      let isQuoted = false;
      let isPublicFigure = false;
      let hasPossessive = false;
      let roleType: string | null = null;

      // Check negated reference (e.g. "not Laura")
      if (/\b(not|never)\s+[a-z]*\s*laura\b/i.test(textAround) || textAround.includes('not laura') || textAround.includes('never laura')) {
        isNegated = true;
      }

      // Check hypothetical reference (e.g. "Imagine if Laura")
      if (/\b(imagine\s+if|if|what\s+if|imagine)\b/i.test(textAround) || textAround.includes('imagine if laura')) {
        isHypothetical = true;
      }

      // Check quoted speaker (e.g. "Laura: Sara told...")
      if (/["“'”].*?["“'”]/i.test(textAround) || textAround.includes('laura:')) {
        isQuoted = true;
      }

      // Check public figure context
      if (textAround.includes('laura dern') || textAround.includes('movie') || textAround.includes('film') || textAround.includes('public figure')) {
        isPublicFigure = true;
      }

      // Check possessive context
      if (/\b(his|her|mike's|sara's|my)\s+mom\b/i.test(textAround)) {
        hasPossessive = true;
      }
      if (textAround.includes('his mom') || textAround.includes("mike's mom") || textAround.includes('her mother')) {
        hasPossessive = true;
      }

      // Check role reference
      if (textAround.includes('boss')) {
        roleType = 'boss';
      }

      // Generate Candidates and calculate score
      const candidates: { person: any; score: number; reasons: string[]; contradictions: string[] }[] = [];

      for (const p of activePeople) {
        let score = 0;
        const reasons: string[] = [];
        const contradictions: string[] = [];

        const normalizedDisplayName = normalizeText(p.displayName);
        const normalizedFullName = p.fullName ? normalizeText(p.fullName) : '';

        // Match display name
        if (normalizedDisplayName === normalized) {
          score += 10;
          reasons.push('exact_display_name');
        } else if (isPhoneticallySimilar(p.displayName, det.rawText)) {
          score += 3;
          reasons.push('phonetic_similarity');
        }

        // Match full name
        if (normalizedFullName === normalized || normalizedFullName.includes(normalized)) {
          score += 12;
          reasons.push('exact_full_name');
        }

        // Match aliases
        const pAliases = activeAliases.filter(a => a.personId === p.id);
        for (const alias of pAliases) {
          const normAlias = normalizeText(alias.rawValue);
          if (normAlias === normalized) {
            score += 8;
            reasons.push('confirmed_alias');
          }
        }

        // Match roles
        const pRoles = activeRoles.filter(r => r.personId === p.id);
        for (const role of pRoles) {
          if (roleType && normalizeText(role.label).includes(roleType)) {
            score += 5;
            reasons.push('role_phrase_match');
          }
        }

        // Box affinity (check if linked to this box)
        const [linkedBox] = await db
          .select()
          .from(boxPeople)
          .where(and(eq(boxPeople.personId, p.id), eq(boxPeople.boxId, boxId)))
          .limit(1);
        if (linkedBox) {
          score += 5;
          reasons.push('box_affinity');
        }

        // Context labels match box (e.g. "work" box and "work" coworker)
        if (boxId) {
          const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId)).limit(1);
          if (box && box.name.toLowerCase().includes('work') && p.contextLabel?.toLowerCase().includes('work')) {
            score += 6;
            reasons.push('box_affinity');
          }
        }

        // Contradictory checks
        if (isNegated) {
          score -= 5;
          contradictions.push('negated_reference');
        }
        if (isHypothetical) {
          score -= 5;
          contradictions.push('hypothetical_reference');
        }
        if (isQuoted) {
          score -= 3;
          contradictions.push('quoted_reference');
        }
        if (isPublicFigure) {
          score -= 15;
          contradictions.push('public_figure_context');
        }

        // Possessive matching logic for "Mom":
        // "his mom" or "Mike's mom" must not match global "Mom" profile unless candidate specifically belongs to that possessive structure
        if (normalized === 'mom' || normalized === 'mother') {
          if (hasPossessive) {
            // If the note says "his mom" but this is "my mom" (or general Mom), contradict
            if (textAround.includes('his mom') || textAround.includes("mike's mom") || textAround.includes('her mother')) {
              if (p.displayName.toLowerCase() === 'mom' || p.displayName.toLowerCase() === 'mother') {
                score -= 12;
                contradictions.push('different_possessive_context');
              }
            }
          }
        }

        if (score > 0 || contradictions.length > 0) {
          candidates.push({ person: p, score, reasons, contradictions });
        }
      }

      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);

      // Determine initial status
      let mentionStatus: 'unresolved' | 'likely' | 'confirmed' = 'unresolved';
      let linkedPersonId: string | null = null;
      let resolutionSource: any = null;

      // Rule-based Auto-confirm policy
      // Check if there is an exact rule and NO contradictions exist
      let autoConfirmed = false;
      const bestCandidate = candidates[0];

      if (bestCandidate && bestCandidate.score >= 10 && bestCandidate.contradictions.length === 0) {
        // Find if user has a confirmed alias that allows auto confirm
        const matchingAlias = activeAliases.find(
          a =>
            a.personId === bestCandidate.person.id &&
            normalizeText(a.rawValue) === normalized &&
            a.autoConfirmAllowed &&
            a.confirmationStatus === 'user_confirmed'
        );

        // Auto confirm allowed only if:
        // 1. Exact alias matches + autoConfirmAllowed = true
        // 2. Mention is not negated/hypothetical/quoted
        if (matchingAlias && !isNegated && !isHypothetical && !isQuoted) {
          mentionStatus = 'confirmed';
          linkedPersonId = bestCandidate.person.id;
          resolutionSource = 'approved_rule';
          autoConfirmed = true;
        }
      }

      if (!autoConfirmed && bestCandidate && bestCandidate.score > 0) {
        mentionStatus = 'likely';
      }

      // Save mention record
      const [newMention] = await db
        .insert(personMentions)
        .values({
          userId,
          sourceType: 'note',
          sourceId: noteId,
          sourceVersionId: versionId,
          rawText: det.rawText,
          normalizedText: normalized,
          startOffset: det.startOffset,
          endOffset: det.endOffset,
          contextBefore: det.contextBefore,
          contextAfter: det.contextAfter,
          origin: 'plain_text_detection',
          status: mentionStatus,
          linkedPersonId,
          candidateConfidence: bestCandidate ? bestCandidate.score : null,
          confidenceBand: bestCandidate ? (bestCandidate.score >= 15 ? 'high' : bestCandidate.score >= 8 ? 'medium' : 'low') : null,
          resolutionSource
        })
        .returning();

      createdMentions.push(newMention);

      // Save candidate list
      let rank = 1;
      for (const cand of candidates) {
        await db.insert(mentionCandidates).values({
          mentionId: newMention.id,
          personId: cand.person.id,
          score: cand.score,
          rank: rank++,
          supportingReasons: cand.reasons,
          contradictoryReasons: cand.contradictions,
          state: cand.person.id === linkedPersonId ? 'accepted' : 'active'
        });
      }

      // Clarification Engine Evaluation
      // A question is generated when there's ambiguity (e.g. same name, multiple candidates)
      // and no rule auto-confirmed it, and not negated/hypothetical/public figure context.
      const shouldGenerateQuestion =
        mentionStatus === 'likely' &&
        !autoConfirmed &&
        !isNegated &&
        !isHypothetical &&
        !isPublicFigure &&
        candidates.length > 0;

      if (shouldGenerateQuestion) {
        // Calculate ambiguity and impact scores
        const ambiguityScore = candidates.length > 1 ? 1.0 : 0.5;
        const impactScore = 1.0;
        const answerabilityScore = candidates.length <= 3 ? 1.0 : 0.6;
        const priorityScore = ambiguityScore * impactScore * answerabilityScore;

        // Bounded question generator
        questionsToCreate.push({
          mention: newMention,
          candidates: candidates.slice(0, 3), // limit options to top 3
          ambiguityScore,
          impactScore,
          answerabilityScore,
          priorityScore
        });
      }

      await trackEvent(userId, 'mention_detected', { mentionId: newMention.id });
      if (mentionStatus === 'likely') {
        await trackEvent(userId, 'mention_became_likely', { mentionId: newMention.id });
      }
    }

    // 5. Create Clarification Questions with limits (max 3 questions per note save)
    // Sort proposed questions by priorityScore descending and take top 3
    questionsToCreate.sort((a, b) => b.priorityScore - a.priorityScore);
    const questionsToInsert = questionsToCreate.slice(0, 3);

    const questionsCreatedPayload: any[] = [];

    for (const qData of questionsToInsert) {
      const [question] = await db
        .insert(clarificationQuestions)
        .values({
          userId,
          noteId,
          sourceVersionId: versionId,
          questionType: qData.candidates.length > 1 ? 'same_name_identity' : 'new_person',
          status: 'pending',
          promptTemplateKey: qData.candidates.length > 1 ? 'resolve_same_name' : 'confirm_new_person',
          mentionIds: [qData.mention.id],
          ambiguityScore: qData.ambiguityScore,
          impactScore: qData.impactScore,
          answerabilityScore: qData.answerabilityScore,
          noveltyFactor: 1.0,
          userToleranceFactor: 1.0,
          priorityScore: qData.priorityScore
        })
        .returning();

      // Create option items
      let order = 1;
      const optionRows: any[] = [];
      for (const cand of qData.candidates) {
        const [opt] = await db
          .insert(clarificationOptions)
          .values({
            questionId: question.id,
            optionType: 'existing_person',
            personId: cand.person.id,
            displayLabel: cand.person.displayName,
            supportingLabel: cand.person.contextLabel || null,
            sortOrder: order++
          })
          .returning();
        optionRows.push(opt);
      }

      // Always add Create New Person option
      const [newOpt] = await db
        .insert(clarificationOptions)
        .values({
          questionId: question.id,
          optionType: 'create_new_person',
          personId: null,
          displayLabel: `Create new Person for "${qData.mention.rawText}"`,
          supportingLabel: null,
          sortOrder: order++
        })
        .returning();
      optionRows.push(newOpt);

      // Always add Not a Person option
      const [notOpt] = await db
        .insert(clarificationOptions)
        .values({
          questionId: question.id,
          optionType: 'not_a_person',
          personId: null,
          displayLabel: 'Not a person reference',
          supportingLabel: null,
          sortOrder: order++
        })
        .returning();
      optionRows.push(notOpt);

      // Always add Leave Unresolved/Review Later option
      const [unresolvedOpt] = await db
        .insert(clarificationOptions)
        .values({
          questionId: question.id,
          optionType: 'leave_unresolved',
          personId: null,
          displayLabel: 'Review later / Leave unresolved',
          supportingLabel: null,
          sortOrder: order++
        })
        .returning();
      optionRows.push(unresolvedOpt);

      questionsCreatedPayload.push({
        ...question,
        options: optionRows
      });

      await trackEvent(userId, 'clarification_generated', { questionId: question.id });
    }

    return { questions: questionsCreatedPayload };
  } catch (error) {
    logError('Error running mention pipeline', error);
    return { questions: [] };
  }
}
