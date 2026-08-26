---
name: siren-patch
description: How to change T-Industries SIREN — an 8.6MB single-file HTML app edited by anchor-guarded Python scripts, never by hand. Use this skill whenever you are about to modify the SIREN application file, write a patch script in its tools/ directory, merge work from an outside engineer, or cut a release. Also use it before promising that a change is small, because the anchor discipline is what makes a change reversible and replayable. If someone says "patch SIREN", "apply this round", "ship it", "make this change to the app", or you are looking at a file in C:\Claude\SIREN\tools\, start here.
---

# Changing SIREN

## What you are editing

One HTML file, ~8.6MB, holding a single IIFE, an inlined Mermaid, a strict CSP and forty
changelog entries. It is opened by double-clicking it. There is no build step, no npm, no
bundler and no network — so anything that would need React, Tailwind, a CDN or a package
manager is not a design preference to argue about, it is impossible.

**Nobody edits this file by hand.** Every change is a Python script in `tools/` that transforms
one known input into one known output. That is what makes a change reviewable, reversible, and
replayable onto a base that has moved underneath it.

## The anchor discipline

A patch script asserts the *exact* number of occurrences of the text it is about to replace, then
replaces it, then writes through a temporary file and an atomic rename.

```python
def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)
```

The count assertion is the whole point. If the file has moved under you the script refuses rather
than half-applying, and you find out immediately instead of three steps later.

Two rules that come from being burned:

**Take anchors from the file, never from memory.** Copy the exact bytes out of the source. The JS
in this file contains literal escape sequences, curly quotes, em dashes and non-breaking spaces
that do not survive being retyped.

**Never use a line number as an anchor.** Line numbers move; text does not.

## SHA-pinned or anchor-guarded — and why they differ

Both are used here deliberately, for different jobs.

**The outside engineer's scripts are SHA-pinned.** Each verifies the input file's hash before
writing and the output hash after. That gives an exact, provable chain: this base, these scripts,
in this order, produce these bytes. When a round comes back, replaying it must reach the stated
hash byte for byte or the delivery is not what was described.

**Scripts written here are anchor-guarded and deliberately NOT SHA-pinned**, so they survive
re-application on a rebuilt chain. Work here often has to sit on top of a round that has just been
re-cut; a SHA pin would refuse, and the anchor still matches because the anchored text did not move.

The cost of the second choice is that it can apply to a file you did not intend. The count
assertion is what makes that safe, so never loosen it to `count=None` or drop it to get past a
failure — a failing count is information.

## Before you write the script

Measure the anchor. `grep -c` the exact text you are about to replace and confirm it appears the
number of times you expect. A patch whose anchor appears twice when you assumed once will either
refuse (good) or change the wrong thing (bad, if you wrote `count=2` to make it pass).

Check the surrounding lines too, and read what runs *after* your insertion — not only what you
replaced. A change was shipped that made an editor tab honest, while eight lines further down a
block written for the old tab still painted it disabled. The patch was correct and the result was a
control that named an action, performed it, and told the person it could not.

## Writing the file

Use the Write tool. **The Bash tool collapses backslashes in heredocs**, so `"\\n"` in a Python
string becomes a real newline and the script fails to parse, or worse, parses and produces mangled
JavaScript. This has happened six times in one session. It is not a rare edge case.

## The docstring is the record

Every patch script here opens with a docstring that says what the defect was, what was measured,
and why this shape of fix rather than another. Six months later, that docstring is the only place
the reasoning exists — the diff shows what changed and never why.

Write it for someone who did not see the defect. Include the measurement:

```
    typed "Review request" (14 characters) into #visualNodeLabel
      the field holds        "Revie"        5 of 14 — nine characters destroyed
      focus ended on         BUTTON.btn     the tour's Next button
```

And say what you did *not* fix, and why. A docstring that only lists wins is a sales document.

## Applying a chain

Work on a copy under `pending/`, never on the live file:

```bash
cp codex/FROZEN_R15_BASE.html pending/round15/app.html
node codex/round15_patches/R15_01_....js pending/round15/app.html
python tools/patch_your_change.py pending/round15/app.html
```

Then gate it before you believe it:

- **syntax** — extract each inline `<script>` and run `node --check` on it
- **protected sections** — `APP_VERSION`, the whole `CHANGELOG` array and the CSP `<meta>` must be
  byte-identical to the base unless the change was explicitly about one of them
- **the hash and the byte count** — record both; they are how the next person proves they have the
  same file you had

## Shipping

The order matters and every step has caught something:

1. **Replay the whole chain from the frozen base**, cleanly, and confirm it reaches the same bytes.
   A chain that only works incrementally is not a chain.
2. **Back up the live file first**, and verify the backup is byte-identical to it before writing
   anything. Check the live file is the version you think it is — if the hash is not the one you
   verified against, stop.
3. **Run the suites on the shipping bytes**, not on a copy.
4. **Write the changelog from what was measured** — see the `siren-changelog` skill; that check has
   caught eighteen false promises across four rounds.
5. **Copy to live, then read the bytes back** and confirm they are the bytes you tested.
6. **Snapshot to `releases/`**, and confirm that too.

## Merging parallel work

Two engineers work on this file at once, so before handing out a round, measure whether the areas
overlap. Diff each branch against the shared base, collect the touched line ranges with a couple of
lines of context, and intersect them. Rounds 11, 12 and one local fix were all measured disjoint —
zero overlapping lines in any pair — which is why they could be written in parallel against the same
base with only a rebase between them.

If the intersection is empty, say so with the numbers. If it is not, the later round waits.

## What is reproducible, and why that matters more than the backups

The frozen bases are copies of convenience. The real guarantee is that each one is the previous one
plus a tracked, SHA-pinned chain: `FROZEN_R11_BASE` is byte-identical to `releases/SIREN_v1.70.0.html`,
and every later base is that plus the scripts in `codex/roundN_patches/`. Losing the backup folder
costs nothing. Losing the scripts would cost everything, so they are tracked and the 8MB HTML files
mostly are not.
