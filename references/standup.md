# Standup report

Generates a standup update by pulling together recent activity. Distilled from the touchstone pack
(ported from anthropics/knowledge-work-plugins, Apache-2.0).

## Boundary

**Read-only**: it reads files, searches content, and runs read-only commands to gather facts. It
must not modify code, configuration, or any file. Its deliverable is a report.

Code changes belong to the code owner — hand off a concrete proposal instead of applying it.

## Two modes

**Standalone (always works)** — the caller says what they worked on, and it is structured:

- Tell me what you worked on and I'll structure it
- Format for daily standup (yesterday / today / blockers)
- Keep it concise and action-oriented

**Supercharged (when tools are connected)** — the plugin's own `forge_standup` tool collects the
source-control facts automatically (see the tool's own contract): recent commits and branches,
files touched, and the current working-tree state. When a project tracker, chat, or CI
integration is available, those add ticket moves, relevant discussions, and build status.

## Output shape

```markdown
## Standup — [Date]

### Yesterday
- [Completed item with ticket reference if available]
- [Completed item]

### Today
- [Planned item with ticket reference]
- [Planned item]

### Blockers
- [Blocker with context and who can help]
```

## Rules

1. **Run it every morning** — build the habit, never scramble for notes.
2. **Add context after generation** — nuance about blockers and priorities comes from the human.
3. **Match the format to the channel** — Slack, email, or the team's standup tool.
4. **Yesterday / Today / Blockers** are the three sections. If there are no blockers, say
   "Blockers: none" rather than dropping the section — a skipped section reads as an omission.
5. **Never invent ticket references.** If no tracker is connected, omit the reference; do not
   fabricate an ID.
6. **One line per item.** Standup notes are read in seconds; a paragraph defeats the format.

## Where it sits in the flow

Standup is a **rhythm artifact**, not a development stage: it reads the results of whatever the
pipeline produced (`forge_build` → `forge_verify` → `forge_review` → `forge_ship`) and reports
them. It never gates the next stage — a standup does not block shipping.
