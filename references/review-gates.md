# Review gates: confidence scoring and channel order

This reference defines how `forge_review` verdicts are scored, gated, and ordered. It is
distilled from the touchstone pack (ported from Anthropic's official review plugins,
Apache-2.0/MIT) and adapted to the pipeline's stage flow. Load it before writing any review
verdict.

## Why a gate

A review that reports everything reports nothing. The gate exists so the model cannot pad a
report with maybes: a finding either survives a numeric confidence bar or it is dropped. A
short report of verified issues beats a long report of guesses, and "no findings" is a
legitimate, complete result.

## The 0–100 confidence rubric

Score every candidate finding before reporting it. The anchors:

- **0** — Not confident at all. A false positive that does not survive light scrutiny, or a
  pre-existing issue the change did not touch.
- **25** — Somewhat confident. Might be real, might not; you could not verify it. If it is a
  style point, it is not one the project's guidelines explicitly call out.
- **50** — Moderately confident. Verified real, but a nitpick or rare in practice; relative to
  the rest of the change it is unimportant.
- **75** — Highly confident. Double-checked; very likely a real issue hit in practice. The
  change's approach is insufficient, or the guideline names it directly.
- **100** — Certain. Evidence directly confirms it will happen frequently.

As bands:

| Band | Meaning |
| --- | --- |
| 0–25 | Likely false positive, or pre-existing |
| 26–50 | Minor nitpick not explicitly in the guidelines |
| 51–75 | Valid but low-impact |
| 76–90 | Important issue requiring attention |
| 91–100 | Critical bug, or an explicit guideline violation |

**The gate: report only findings scoring 80 or above.** Group survivors as Critical (90–100)
and Important (80–89). Everything below the line is dropped — say what was checked and that
nothing reached the gate, and stop. Do not pad.

A finding claimed as a guideline violation must be re-checked against the guideline text: score
confirmed violations higher, and score unconfirmed style opinions at 25.

## Hard exclusions (score 0)

Filter these before scoring; when in doubt they are 0:

- Pre-existing issues, including real ones on lines the change did not modify
- Things that look like bugs but are not
- Pedantic nitpicks a senior engineer would not raise
- Anything a linter, type-checker, or compiler catches (imports, type errors, broken tests,
  formatting). Do not run build steps as review evidence — CI runs them separately
- General quality complaints (thin coverage, generic security worry) unless the project's
  guidelines explicitly require them
- Issues the guidelines call out but the code explicitly silences (a lint-ignore, a documented
  suppression)
- Behaviour changes that look intentional or are directly in scope for the change

## Independent channels

`forge_review` runs its checks as **independent passes**. If the host supports subagents,
dispatch one sub-task per channel so they run concurrently. If it does not, run them
sequentially and keep each pass deliberately separate: one pass's conclusion must not bias the
next. A finding found by two channels is scored once, citing both.

## Order matters: review, resolve, then simplify

The pipeline's write boundary is:

1. **Review (read-only)** — `forge_review` reports; it never edits.
2. **Resolve** — findings are fixed by the code owner (in `forge_build` turns or by the user).
3. **Simplify (write)** — only after the review is clean, run behaviour-preserving
   simplification (`code-simplification` skill; the `code-simplifier` boundary applies).

Simplifying code that is about to be rewritten for a finding wastes the work and enlarges the
diff. Never simplify in the same pass that produced findings, and never let a review channel
apply its own fix — a fix goes into the report as a concrete suggestion.
