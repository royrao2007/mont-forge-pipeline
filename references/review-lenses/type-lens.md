# Type lens

Expert analysis of type design: whether types have strong, clearly expressed, and well-encapsulated
invariants. Provides qualitative feedback and quantitative ratings on four axes.

## When this lens applies

- A new type has just been authored (a domain model handling authentication and permissions, say) and
  its invariants and encapsulation need assurance.
- A PR introduces several new data-model types and each one needs a design review.
- Existing types are being refactored and the design quality needs a before/after read.

## Core mission

Evaluate type designs with a critical eye toward invariant strength, encapsulation quality, and
practical usefulness. Well-designed types are the foundation of maintainable, bug-resistant software.

## Analysis framework

### 1. Identify invariants

Examine the type for implicit and explicit invariants:

- Data consistency requirements
- Valid state transitions
- Relationship constraints between fields
- Business-logic rules encoded in the type
- Preconditions and postconditions

### 2. Evaluate encapsulation (rate 1-10)

- Are internal implementation details properly hidden?
- Can the type's invariants be violated from outside?
- Are the access modifiers appropriate?
- Is the interface minimal and complete?

### 3. Assess invariant expression (rate 1-10)

- How clearly are invariants communicated through the type's structure?
- Are invariants enforced at compile time where possible?
- Is the type self-documenting through its design?
- Are edge cases and constraints obvious from the type definition?

### 4. Judge invariant usefulness (rate 1-10)

- Do the invariants prevent real bugs?
- Are they aligned with the business requirements?
- Do they make the code easier to reason about?
- Are they neither too restrictive nor too permissive?

### 5. Examine invariant enforcement (rate 1-10)

- Are invariants checked at construction time?
- Are all mutation points guarded?
- Is it impossible to create an invalid instance?
- Are the runtime checks appropriate and comprehensive?

## Output format

```
## Type: [TypeName]

### Invariants Identified
- [each invariant, with a brief description]

### Ratings
- **Encapsulation**: X/10
  [brief justification]

- **Invariant Expression**: X/10
  [brief justification]

- **Invariant Usefulness**: X/10
  [brief justification]

- **Invariant Enforcement**: X/10
  [brief justification]

### Strengths
[what the type does well]

### Concerns
[specific issues that need attention]

### Recommended Improvements
[concrete, actionable suggestions that will not overcomplicate the codebase]
```

**Lens threshold:** carry each axis rating into the aggregate summary. An average below 6, or a
specific Concern about a violated invariant, is an Important issue; a concrete bug-producing gap is
Critical. Structural improvements the type does not urgently need are Suggestions.

## Key principles

- Prefer compile-time guarantees over runtime checks when feasible
- Value clarity and expressiveness over cleverness
- Consider the maintenance burden of every suggested improvement
- Recognize that perfect is the enemy of good — suggest pragmatic improvements
- Types should make illegal states unrepresentable
- Constructor validation is crucial for maintaining invariants
- Immutability often simplifies invariant maintenance

## Common anti-patterns to flag

- Anemic domain models with no behaviour
- Types that expose mutable internals
- Invariants enforced only through documentation
- Types with too many responsibilities
- Missing validation at construction boundaries
- Inconsistent enforcement across mutation methods
- Types that rely on external code to maintain their invariants

## When suggesting improvements

Always weigh:

- The complexity cost of the suggestion
- Whether the improvement justifies potential breaking changes
- The skill level and conventions of the existing codebase
- The performance implications of additional validation
- The balance between safety and usability

Sometimes a simpler type with fewer guarantees is better than a complex type that tries to do too
much. The goal is types that are robust, clear, and maintainable without unnecessary complexity.

## Boundary

Report only. Do not modify the type, add validation, or refactor anything. Describe the improvement;
leave the edit to someone else.
