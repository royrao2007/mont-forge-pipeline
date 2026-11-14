# Incident response

Manages an incident from detection through postmortem. Distilled from the touchstone pack (ported
from anthropics/knowledge-work-plugins, Apache-2.0).

## Boundary

**Artifacts only**: it may create and write document-class artifacts (status updates, incident
records, a postmortem), but it must not modify code or configuration. Its deliverable is a
document, not a change to the running system.

Code changes belong to the code owner — hand off a concrete proposal instead of applying it.

## Modes

- **New incident** — "new" plus a description: start a new incident
- **Status update** — "update" plus the current status: post a status update
- **Postmortem** — "postmortem": generate a postmortem from incident data

If no mode is specified, ask what phase the incident is in.

## The four phases

```
┌─────────────────────────────────────────────────────────────────┐
│                        INCIDENT RESPONSE                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: TRIAGE                                                 │
│ ✓ Assess severity (SEV1-4)                                      │
│ ✓ Identify affected systems and users                           │
│ ✓ Assign roles (IC, comms, responders)                          │
│                                                                 │
│ Phase 2: COMMUNICATE                                            │
│ ✓ Draft internal status update                                  │
│ ✓ Draft customer communication (if needed)                      │
│ ✓ Set up war room and cadence                                   │
│                                                                 │
│ Phase 3: MITIGATE                                               │
│ ✓ Document mitigation steps taken                               │
│ ✓ Track timeline of events                                      │
│ ✓ Confirm resolution                                            │
│                                                                 │
│ Phase 4: POSTMORTEM                                             │
│ ✓ Blameless postmortem document                                 │
│ ✓ Timeline reconstruction                                       │
│ ✓ Root cause analysis (5 whys)                                  │
│ ✓ Action items with owners                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Severity classification

| Level | Criteria | Response Time |
|-------|----------|---------------|
| SEV1 | Service down, all users affected | Immediate, all-hands |
| SEV2 | Major feature degraded, many users affected | Within 15 min |
| SEV3 | Minor feature issue, some users affected | Within 1 hour |
| SEV4 | Cosmetic or low-impact issue | Next business day |

## Communication guidance

Clear, factual updates at a regular cadence. Every update states: what is happening, who is
affected, what we are doing, and when the next update comes. No speculation about causes before
they are confirmed.

## Output — status update

```markdown
## Incident Update: [Title]
**Severity:** SEV[1-4] | **Status:** Investigating | Identified | Monitoring | Resolved
**Impact:** [Who/what is affected]
**Last Updated:** [Timestamp]

### Current Status
[What we know now]

### Actions Taken
- [Action 1]
- [Action 2]

### Next Steps
- [What's happening next and ETA]

### Timeline
| Time | Event |
|------|-------|
| [HH:MM] | [Event] |
```

## Output — postmortem

```markdown
## Postmortem: [Incident Title]
**Date:** [Date] | **Duration:** [X hours] | **Severity:** SEV[X]
**Authors:** [Names] | **Status:** Draft

### Summary
[2-3 sentence plain-language summary]

### Impact
- [Users affected]
- [Duration of impact]
- [Business impact if quantifiable]

### Timeline
| Time (UTC) | Event |
|------------|-------|
| [HH:MM] | [Event] |

### Root Cause
[Detailed explanation of what caused the incident]

### 5 Whys
1. Why did [symptom]? → [Because...]
2. Why did [cause 1]? → [Because...]
3. Why did [cause 2]? → [Because...]
4. Why did [cause 3]? → [Because...]
5. Why did [cause 4]? → [Root cause]

### What Went Well
- [Things that worked]

### What Went Poorly
- [Things that didn't work]

### Action Items
| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [Action] | [Person] | P0/P1/P2 | [Date] |

### Lessons Learned
[Key takeaways for the team]
```

## Rules

1. **Start writing immediately** — don't wait for complete information; update as you learn more.
2. **Keep updates factual** — what we know, what we've done, what's next. No speculation.
3. **Postmortems are blameless** — focus on systems and processes, not individuals.
4. **Unknowns are written as unknowns.** "Cause not yet identified" is a valid timeline entry; a
   guessed cause is not.

## Where it sits in the flow

Incident response **branches off** the pipeline rather than replacing it: it is triggered by an
out-of-band alert, not by a stage. The `forge_verify` stage is where a suspected incident is
first diagnosed; once it is confirmed as an incident, this workflow takes over the communication
and postmortem artifacts, while the actual code fix goes back through `forge_build` → `forge_verify`
→ `forge_review`. The postmortem's action items are the hand-off back into the pipeline.
