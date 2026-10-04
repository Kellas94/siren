# T-Industries SIREN

A single-file HTML tool for diagrams, documentation and presentation. One file, opened in any
browser, working entirely offline: `T_Industries_SIREN_v1.html`, currently **1.69.0**, 8,563,119
bytes, SHA-256 `1C088DAC741F7D216474FDC7F6F58ED941E26F053B0175718F7281BD8B3A1288`.

The live copy is not in this repository — it lives at
`C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` and is replaced only by a verified release.

## What this repository is for

Not the application. The application is one enormous file that diffs badly and merges catastrophically.

What is kept here is everything that makes a release **reproducible and checkable**: the patch
scripts that built it, the harnesses that proved it, and the briefs and handbacks that record what
was asked for and what was actually delivered.

That is a deliberate choice. Every build is reproducible by taking the frozen base named in a round's
`APPLY_ORDER.md` and replaying the tracked scripts against it, byte for byte. If a build cannot be
reproduced that way, that is a defect in the round — not a reason to commit the artefact.

## Layout

| Path | What is there |
|---|---|
| `tools/` | Patch scripts. One per change, anchor-guarded, each one the record of how a release was actually built. |
| `qa_exports/` | Verification harnesses. Playwright drivers that open the real app, drive it with real input, and measure. `r7_lib.js` is the shared harness — read its comments before writing a new one. |
| `codex/` | Briefs, prompts, handbacks, and the SHA-pinned patch chains for each round, with their `APPLY_ORDER.md`. |
| `antigravity/` | Spike briefs and the reports that came back. Measurement work, not application changes. |
| `audit/` | Written critiques and plans. |
| `releases/` | The shipped application, from 1.69.0 onward. |
| `RESUME_HERE.md` | What shipped, when, and why. Read this first after a break. |
| `AGENT_CONVENTIONS.md` | What every agent must read before touching anything. |

Earlier release snapshots and all working copies stay on disk and are not tracked; `.gitignore`
explains each exclusion where it is made.

## How a change actually happens

1. **Freeze a base.** A release is snapshotted and its SHA-256 pinned. Every agent in that round
   authors against that exact file and nothing else.
2. **An agent delivers patch scripts**, never an edited application. Each script pins its input and
   output SHA-256, asserts the exact occurrence count of every anchor before replacing, writes
   through a temporary file and renames atomically, and refuses a wrong input with a non-zero exit.
3. **The chain is replayed** from the frozen base. If the final SHA does not match, the delivery is
   not accepted.
4. **The claims are verified independently**, in a browser, with real keyboard and mouse input —
   not by reading the diff. Round 7 was delivered as complete and two of its four jobs were not.
5. **Only then** does the version move and the file ship, and the changelog is written from what was
   measured rather than from what was claimed.

## The rule everything is judged against

> Nothing in this app may promise what it cannot deliver.

A tooltip, a chip, a count, a menu label or a disabled state that overstates is a defect of the same
kind as a crash, and is treated that way. A confidently wrong number is worse than an obviously wrong
one — `0 participants · 3 messages` beside a drawing of three people is worse than `0 blocks · 0
connections`, which at least announced itself as nonsense.

Two corollaries, both learned expensively:

- **A check that finds nothing on both the patched build and the base has established nothing.**
  Say so out loud rather than counting it green.
- **Look at the picture.** Where a fix is visual, render it and open it. Several defects in shipped
  releases were found only that way, and none of them was visible in any failing number.

## Splitting work between engineers

Split by **what a change does to the code**, not by which feature it belongs to. In a single-file
app, feature boundaries do not map onto code boundaries: two agents told to stay in "Docs" and
"Present" collided anyway, because both had to touch the same menu primitive.

Additive work and modifying work can run in parallel. Two modifying jobs on the same seam cannot,
whatever features they are labelled with. Freeze a snapshot per handoff.
