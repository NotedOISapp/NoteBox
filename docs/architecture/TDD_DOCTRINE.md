# Evidence-Based Test-Driven Development Doctrine

This doctrine applies repository-wide.

It applies to every production-code change regardless of branch, agent, contributor, feature, platform, or release stage.

No branch, agent session, task prompt, or emergency label overrides this doctrine unless the founder explicitly approves a documented exception.

## Required cycle

Every behavior change must follow:

RED -> GREEN -> REFACTOR -> VERIFY

## RED

Before modifying production code:

1. Write or update the smallest meaningful automated test that describes the required observable behavior.
2. Run that test against the unchanged implementation.
3. Confirm that it fails.
4. Confirm that it fails for the expected behavioral reason.
5. Save the command and relevant failure output in the task report.

Production implementation must not be written before a valid RED result exists.

## GREEN

After RED:

1. Implement the minimum production change required.
2. Run the new test.
3. Confirm it passes.
4. Run directly affected tests.
5. Do not add unrelated refactors or features.

## REFACTOR

After GREEN:

1. Refactor only when needed.
2. Keep behavior unchanged.
3. Re-run affected tests.
4. Preserve the regression test.

## VERIFY

Before completion:

1. Run affected tests.
2. Run full available test suite.
3. Run typecheck.
4. Run lint.
5. Run build validation.
6. Run coverage.
7. Confirm no tests were skipped.
8. Confirm no coverage threshold was lowered.
9. Confirm no assertions were weakened.
10. Confirm no hooks were bypassed.

## Bug fixes

Every bug fix must begin with a failing regression test.

The test must fail before the fix and pass after the fix.

## Coverage

Coverage is not proof of correctness.

Coverage thresholds must not be lowered without explicit founder approval.

Files must not be excluded from coverage because they are difficult to test.

Critical security and privacy logic requires behavioral tests.

## Completion

A task is complete only when:

- RED was demonstrated
- GREEN was demonstrated
- Verification was run
- Tests are meaningful
- Coverage was not reduced without approval
- No guardrail was weakened
- The change was committed
- The change was pushed
- The remote branch was verified
