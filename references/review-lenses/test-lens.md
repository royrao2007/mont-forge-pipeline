# Test lens

Review a change for test coverage quality and completeness. The goal is adequate coverage of critical
functionality, not pedantic 100% coverage.

## When this lens applies

- A PR with new functionality has just been opened and it is unclear whether the tests cover it.
- A PR gained new validation, parsing, or business logic and the existing tests may not cover the new
  branches and edge cases.
- A final pass before marking a PR ready for review.

## Core responsibilities

### 1. Analyse coverage quality

Focus on **behavioural** coverage rather than line coverage. Identify the critical code paths, edge
cases, and error conditions that must be tested to prevent regressions.

### 2. Identify critical gaps

Look for:

- Untested error-handling paths that could cause silent failures
- Missing edge-case coverage for boundary conditions
- Uncovered critical business-logic branches
- Absent negative test cases for validation logic
- Missing tests for concurrent or async behaviour where that matters

### 3. Evaluate test quality

Assess whether the tests:

- Test behaviour and contracts rather than implementation details
- Would catch meaningful regressions from future changes
- Are resilient to reasonable refactoring
- Follow DAMP principles (Descriptive And Meaningful Phrases) for clarity

### 4. Prioritise recommendations

For every suggested test or modification:

- Give a specific example of the failure it would catch
- Rate its criticality from 1 to 10
- Explain the specific regression or bug it prevents
- Consider whether existing tests already cover the scenario

## Analysis process

1. Examine the change to understand the new functionality and the modifications.
2. Review the accompanying tests and map coverage onto that functionality.
3. Identify the critical paths that would cause production issues if broken.
4. Check for tests too tightly coupled to the implementation.
5. Look for missing negative cases and error scenarios.
6. Consider integration points and their test coverage.

## Rating guideline

- **9-10** — Critical functionality that could cause data loss, security issues, or system failures
- **7-8** — Important business logic that could cause user-facing errors
- **5-6** — Edge cases that could cause confusion or minor issues
- **3-4** — Nice-to-have coverage for completeness
- **1-2** — Minor, optional improvements

The lens threshold: gaps rated **8-10** are Critical and belong in the aggregate summary's Critical
section. Gaps rated **5-7** are Important Improvements, surfaced as Suggestions. Gaps below 5 are
mentioned only if the user asked for completeness.

## Output format

1. **Summary** — brief overview of test coverage quality
2. **Critical Gaps** (if any) — tests rated 8-10 that must be added
3. **Important Improvements** (if any) — tests rated 5-7 worth considering
4. **Test Quality Issues** (if any) — tests that are brittle or overfit to the implementation
5. **Positive Observations** — what is well-tested and follows good practice

## Considerations

- Focus on the tests that prevent real bugs, not academic completeness.
- Use the project's own testing standards where they exist.
- Some code paths may already be covered by integration tests elsewhere.
- Do not suggest tests for trivial getters or setters unless they contain logic.
- Weigh the cost and benefit of each suggested test.
- Be specific about what each test should verify, and why it matters.
- Note when a test is testing implementation rather than behaviour.

Be thorough but pragmatic. Good tests are the ones that fail when behaviour changes unexpectedly, not
the ones that fail when implementation details change.

## Boundary

Report only. Do not write, modify, or delete tests; do not disable a failing test. Describe the test
that should exist and let someone else add it.
