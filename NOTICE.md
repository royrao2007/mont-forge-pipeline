# NOTICE

`mont-forge` bundles engineering skills from **two** upstream projects, both
licensed under the MIT License. Their license texts are retained verbatim in
this repository as [`LICENSE`](LICENSE) and [`LICENSE-mattpocock`](LICENSE-mattpocock).

## Upstream sources

| # | Project | Author | License file | Contributed skills |
|---|---|---|---|---|
| 1 | [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) | Addy Osmani | [`LICENSE`](LICENSE) | 25 (lifecycle base) |
| 2 | [`mattpocock/skills`](https://github.com/mattpocock/skills) | Matt Pocock | [`LICENSE-mattpocock`](LICENSE-mattpocock) | 19 (merged via `overrides/`) |

## What comes from where

- **`skills/` — 25 skills** are mirrored from `addyosmani/agent-skills`
  (the "upstream" layer). The shared checklists in `references/` come from the
  same project.
- **`skills/` — 19 additional skills** are merged from `mattpocock/skills` via
  the `overrides/skills/` layer. These are the skills that upstream 1 does not
  cover (e.g. `wayfinder`, `domain-modeling`, `codebase-design`, `triage`,
  `retro`, `teach`, `writing-for-agents`).
- **Everything else** (`index.js`, `cordis.patch.yml`, `market/`, `locale/`,
  `scripts/`, the six-platform wrappers) is mont-forge's own packaging work.

Total: **44 skills** (25 + 19).

## Attribution notes

- Both upstream projects are MIT. Their copyright notices and permission
  texts are preserved unmodified in the two `LICENSE*` files.
- `mont-forge` is a redistribution and repackaging. It is **not** authored,
  endorsed, or maintained by Addy Osmani or Matt Pocock.
- Skills merged from `mattpocock/skills` keep their original author's wording,
  with two reference names adjusted so they resolve inside this bundle
  (`tdd` → `test-driven-development`, `code-review` → `code-review-and-quality`). The `grill-me` alias forwards to `grilling`.
- The `mont` project maintains the packaging, sync tooling, and any future
  `overrides/` additions.
