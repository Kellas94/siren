# Round 8 — the method half

This is the part of the brief that does not change between rounds. The job list is in
`ROUND8_BRIEF.md`; read this first, then that.

## The base

Round 8 is authored against the **shipped v1.68.0**, frozen as `codex\FROZEN_R8_BASE.html`:

```
8,552,615 bytes
SHA-256  F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56
```

Do not author against 1.67.0 or against any round-7 intermediate. Twelve patches separate them, and
four of those moved code you will be anchoring near:

- the preview toolbar was regrouped — `zoomChipButton`, `zoomMenuButton`, `verticalLayoutButton`,
  `horizontalLayoutButton`, `styleShortcutButton`, `commentsButton` and `reviewButton` still exist
  and still work, but are `display:none` under `body[data-preview-grouped="on"]` and are opened from
  two new menus;
- `openStructureMenu` gained a line (`role === 'listbox' || current`) and two helper functions above
  it;
- the theme menu gained a cap, which added rules keyed on `.struct-menu`;
- `structureNativeSummary` and `codeOnlyMaybeShowHint` were both edited after Codex delivered them.

Anchors taken from an older file will either miss or, worse, hit a different occurrence.

Specifically, these ids still exist and still work, but are `display:none` under
`body[data-preview-grouped="on"]` and are opened from the **View** and **Inspect** menus:
`zoomChipButton`, `zoomMenuButton`, `verticalLayoutButton`, `horizontalLayoutButton`,
`styleShortcutButton`, `commentsButton`, `reviewButton`. If a job needs one of them, drive it by id
as before — nothing was removed — but do not assume it is visible on screen.

## What a delivery looks like

One script per job, applied in a stated order, each:

- pinned to an exact input SHA-256 and an exact output SHA-256;
- asserting the exact occurrence count of every anchor **before** replacing (`count === expected`,
  not `>= 1`);
- writing through a same-directory temporary file and renaming atomically;
- refusing a wrong-SHA input with a non-zero exit and leaving the file byte-identical.

Plus an `APPLY_ORDER.md` with every script's SHA, input SHA and output SHA, and a handback naming
what you did **and what you did not**. Round 7's handback is the model: its "Deliberately not done
or claimed" section is the most useful part of it.

Do not touch `APP_VERSION`, `CHANGELOG` or the CSP. Those are cut at release time, deliberately, so
that a version number never claims work that has not been verified.

## Anchors drift — say so when they do

Round 7 found three anchors that did not exist as briefed: one encoded CRLF where the file is LF,
one named a function preamble that had since changed, and one short pair that occurred three times
rather than two. All three were caught before any write, tightened, and reported. That is exactly
right. Report anchor drift rather than loosening the guard to make it match.

## Verification

A claim is only delivered if it was **measured in the running app**. In particular:

- **Guided is a view inside Code mode.** Reading `#structureRows` without entering Code mode first
  finds zero rows on every diagram type and looks like a real result.
- **The confirm dialog is load-bearing.** Several flows do nothing until it is answered. A probe
  that skips it measures the state *before* the action it thinks it triggered — this is how an
  earlier round produced a confident "does not reproduce" on a defect that reproduced every time.
- **A brand intro covers the whole app for 1.7 seconds after load.** The DOM underneath is laid out
  and answers `getBoundingClientRect()` and `.click()` perfectly, so a screenshot taken before it
  clears is a photograph of a splash screen over a page of correct numbers. Wait for
  `document.getElementById('sirenIntroOverlay').hidden`.
- **A check that measures nothing is not a pass.** If a probe reports "not found" on both the
  patched build and the base, it has established nothing. Say so out loud rather than counting it
  green. This has produced false all-green runs twice on this project.
- **Look at the picture.** Where a fix is visual, render it and look. Two defects in the current
  release were found only by looking at a screenshot, and neither was visible in any failing number.

Positive controls are worth the extra minute: show the probe failing on the base before showing it
passing on the patch.

## The standing rule

Nothing in this app may promise what it cannot deliver. A tooltip, a chip, a menu label, a count or
a disabled state that overstates is a defect of the same kind as a crash, and is treated that way.
Two of round 7's four jobs existed only because of this rule, and the last two fixes before this
round were a menu that greyed a row without saying why, and a menu that named a current flow
direction on a diagram type that has none.

If a job as briefed cannot be done honestly, say so and deliver the rest. Scaling the work down is
the owner's call, not yours.
