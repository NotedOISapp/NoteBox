import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { people, personAliases, personMentions, clarificationQuestions, boxPeople, personMerges, entitlements } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { reauthenticateUser, generateMockAppleToken } from '../utils/appleTestAuth.js';

describe('People Identity Resolution Integration Tests', () => {
  let token: string;
  let userId: string;
  let boxId: string;
  let workBoxId: string;

  beforeAll(async () => {
    const appleId = 'people_identity_spec_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Identity User' });
    token = resAuth.body.accessToken;

    // Decode JWT token to get userId
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = payload.userId;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    await reauthenticateUser(app, token, 'people_identity_spec_user');

    // Upgrade user to paid plan for unlimited notes in test
    await db.insert(entitlements).values({ userId, plan: 'paid' }).onConflictDoUpdate({
      target: entitlements.userId,
      set: { plan: 'paid' },
    });

    // Create boxes
    const resBox1 = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Personal Box' });
    boxId = resBox1.body.id;

    const resBox2 = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work Box' });
    workBoxId = resBox2.body.id;
  });

  it('allows duplicate names when creating people', async () => {
    const res1 = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Laura' });
    expect(res1.status).toBe(201);
    const id1 = res1.body.id;

    const res2 = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura' });
    expect(res2.status).toBe(201);
    const id2 = res2.body.id;

    expect(id1).not.toBe(id2);
  });

  it('validates and accepts explicit inline tags', async () => {
    // Create a person
    const resP = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura Bennett' });
    const personId = resP.body.id;

    // Create note with valid span
    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Laura Bennett told me to write this.',
        personSpans: [
          {
            clientSpanId: 'span_1',
            personId,
            displayText: 'Laura Bennett',
            startOffset: 0,
            endOffset: 13
          }
        ],
        clientMutationId: 'note_mut_1'
      });
    expect(resNote.status).toBe(201);
    expect(resNote.body).toHaveProperty('id');

    // Overlapping span validation
    const resFail = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Laura Bennett told me to write this.',
        personSpans: [
          {
            clientSpanId: 'span_1',
            personId,
            displayText: 'Laura Bennett',
            startOffset: 0,
            endOffset: 13
          },
          {
            clientSpanId: 'span_2',
            personId,
            displayText: 'Laura',
            startOffset: 0,
            endOffset: 5
          }
        ],
        clientMutationId: 'note_mut_2'
      });
    expect(resFail.status).toBe(400); // overlap error
  });

  it('runs post-save pipeline and classifies linguistic context', async () => {
    // 1. Negated reference
    const res1 = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'It was not Laura.'
      });
    expect(res1.status).toBe(201);

    // 2. Hypothetical reference
    const res2 = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Imagine if Laura did that.'
      });
    expect(res2.status).toBe(201);

    // 3. Quoted context
    const res3 = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: '“Laura: Sara told Mike to call.”'
      });
    expect(res3.status).toBe(201);

    // 4. Public figure
    const res4 = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Laura Dern was in the movie.'
      });
    expect(res4.status).toBe(201);

    // Verify mentions were created in the DB with lower confidence
    const noteId = res1.body.id;
    const resMentions = await request(app)
      .get(`/v1/notes/${noteId}/mentions`)
      .set('Authorization', `Bearer ${token}`);
    expect(resMentions.status).toBe(200);
    expect(resMentions.body.length).toBeGreaterThan(0);
  });

  it('implements possessive mom contexts', async () => {
    // Create global profile named Mom
    const resP = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Mom' });
    const momId = resP.body.id;

    // Create a note with "Mike's mom"
    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: "Mike's mom called."
      });
    expect(resNote.status).toBe(201);

    // Verify it doesn't automatically confirm the global Mom candidate due to possessive mismatch
    const mentionsRes = await request(app)
      .get(`/v1/notes/${resNote.body.id}/mentions`)
      .set('Authorization', `Bearer ${token}`);
    expect(mentionsRes.body.length).toBeGreaterThan(0);
    const mention = mentionsRes.body[0];
    expect(['likely', 'unresolved']).toContain(mention.status); // remains likely or unresolved, not auto-confirmed
    expect(mention.linkedPersonId).toBeNull();
  });

  it('ranks picker search by box affinity', async () => {
    // Create coworker Laura
    const resLauraWork = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura Work', contextLabel: 'work' });
    const workPId = resLauraWork.body.id;

    // Associate work Laura to Work Box
    await db.insert(boxPeople).values({
      boxId: workBoxId,
      personId: workPId
    });

    // Create family Laura
    const resLauraFam = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura Family', contextLabel: 'family' });

    // Search picker inside Work Box
    const resSearch = await request(app)
      .post('/v1/people/picker-search')
      .set('Authorization', `Bearer ${token}`)
      .send({ q: 'Laura', boxId: workBoxId });

    expect(resSearch.status).toBe(200);
    expect(resSearch.body[0].displayName).toBe('Laura Work'); // Work Laura ranks first
  });

  it('implements validation on alias creation', async () => {
    const resP = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Sarah' });
    const personId = resP.body.id;

    // Broad relationship global check
    const resAlias1 = await request(app)
      .post(`/v1/people/${personId}/aliases`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rawValue: 'mom',
        aliasType: 'relationship',
        matchMode: 'exact',
        scopeType: 'global',
        confirmationStatus: 'user_confirmed'
      });
    expect(resAlias1.status).toBe(400); // rejected

    // Fuzzy auto-confirm check
    const resAlias2 = await request(app)
      .post(`/v1/people/${personId}/aliases`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rawValue: 'Sara',
        aliasType: 'nickname',
        matchMode: 'fuzzy',
        scopeType: 'global',
        confirmationStatus: 'user_confirmed',
        autoConfirmAllowed: true
      });
    expect(resAlias2.status).toBe(400); // rejected
  });

  it('manages clarification answers and optimistic concurrency', async () => {
    // Create a person
    const resP = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Sara' });
    const personId = resP.body.id;

    // Save note triggers clarification
    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Sara called me today.'
      });
    expect(resNote.status).toBe(201);
    expect(resNote.body.clarifications.length).toBeGreaterThan(0);

    const question = resNote.body.clarifications[0];
    const option = question.options.find((o: any) => o.personId === personId);

    // Concurrency mismatch 409
    const resFail = await request(app)
      .post(`/v1/clarifications/${question.id}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        optionId: option.id,
        expectedQuestionVersion: 999,
        clientMutationId: 'ans_mut_1'
      });
    expect(resFail.status).toBe(409);

    // Valid answer
    const resAns = await request(app)
      .post(`/v1/clarifications/${question.id}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        optionId: option.id,
        expectedQuestionVersion: question.version,
        clientMutationId: 'ans_mut_2'
      });
    expect(resAns.status).toBe(200);

    // Verify mention is now confirmed
    const resMentions = await request(app)
      .get(`/v1/notes/${resNote.body.id}/mentions`)
      .set('Authorization', `Bearer ${token}`);
    expect(resMentions.body[0].status).toBe('confirmed');
    expect(resMentions.body[0].linkedPersonId).toBe(personId);
  });

  it('implements merges and 30-day reversals', async () => {
    // Create two people
    const resP1 = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura One' });
    const p1Id = resP1.body.id;

    const resP2 = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Laura Two' });
    const p2Id = resP2.body.id;

    const [survivorAlias] = await db.insert(personAliases).values({
      userId,
      personId: p1Id,
      rawValue: 'Original Survivor Alias',
      normalizedValue: 'original survivor alias',
      aliasType: 'nickname',
      matchMode: 'exact',
      scopeType: 'global',
      confirmationStatus: 'user_confirmed',
    }).returning();
    const [mergedAlias] = await db.insert(personAliases).values({
      userId,
      personId: p2Id,
      rawValue: 'Original Merged Alias',
      normalizedValue: 'original merged alias',
      aliasType: 'nickname',
      matchMode: 'exact',
      scopeType: 'global',
      confirmationStatus: 'user_confirmed',
    }).returning();

    // Create a note with confirmed mention of Laura Two
    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boxId,
        text: 'Laura Two called me.',
        personSpans: [
          {
            clientSpanId: 'span_l2',
            personId: p2Id,
            displayText: 'Laura Two',
            startOffset: 0,
            endOffset: 9
          }
        ],
        clientMutationId: 'tag_l2'
      });

    // Merge Laura Two into Laura One
    const resMerge = await request(app)
      .post('/v1/people/merge')
      .set('Authorization', `Bearer ${token}`)
      .send({
        survivingPersonId: p1Id,
        mergedPersonId: p2Id,
        clientMutationId: 'merge_l2_l1'
      });
    expect(resMerge.status).toBe(201);
    const mergeId = resMerge.body.mergeId;

    // Verify mentions are moved
    const resMentions = await request(app)
      .get(`/v1/notes/${resNote.body.id}/mentions`)
      .set('Authorization', `Bearer ${token}`);
    expect(resMentions.body[0].linkedPersonId).toBe(p1Id);

    // Reverse the merge
    const resReverse = await request(app)
      .post(`/v1/people/merges/${mergeId}/reverse`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clientMutationId: 'rev_l2_l1' });
    expect(resReverse.status).toBe(200);

    // Verify mentions are restored back to Laura Two
    const resRestored = await request(app)
      .get(`/v1/notes/${resNote.body.id}/mentions`)
      .set('Authorization', `Bearer ${token}`);
    expect(resRestored.body[0].linkedPersonId).toBe(p2Id);

    const [restoredSurvivorAlias] = await db.select().from(personAliases)
      .where(eq(personAliases.id, survivorAlias.id)).limit(1);
    const [restoredMergedAlias] = await db.select().from(personAliases)
      .where(eq(personAliases.id, mergedAlias.id)).limit(1);
    expect(restoredSurvivorAlias.personId).toBe(p1Id);
    expect(restoredMergedAlias.personId).toBe(p2Id);
  });

  it('searches people and returns PeopleSearchResult union', async () => {
    // Search for Laura
    const resSearch = await request(app)
      .get('/v1/search/people?q=Laura')
      .set('Authorization', `Bearer ${token}`);

    expect(resSearch.status).toBe(200);
    expect(Array.isArray(resSearch.body)).toBe(true);

    const hasPersonResult = resSearch.body.some((r: any) => r.kind === 'person');
    const hasUnresolvedResult = resSearch.body.some((r: any) => r.kind === 'unresolved_mention_group');

    expect(hasPersonResult || hasUnresolvedResult).toBe(true);
  });

  it('cascade deletes all identity records on account deletion', async () => {
    // Delete account
    const resDel = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(resDel.status).toBe(202);

    // Run background worker to purge user data cascade
    const { processDeletionJobs } = await import('../cron.js');
    await processDeletionJobs();

    // Check DB that user mentions are gone
    const mentionsCount = await db
      .select()
      .from(personMentions)
      .where(eq(personMentions.userId, userId));
    expect(mentionsCount.length).toBe(0);

    const questionsCount = await db
      .select()
      .from(clarificationQuestions)
      .where(eq(clarificationQuestions.userId, userId));
    expect(questionsCount.length).toBe(0);
  });
});
