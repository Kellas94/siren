# SIREN Round 9 — the residuals round 8 left behind

Read `ROUND8_METHOD.md` first; the method is unchanged. The base has moved:

```
codex/FROZEN_R9_BASE.html
8,563,119 bytes
SHA-256  1C088DAC741F7D216474FDC7F6F58ED941E26F053B0175718F7281BD8B3A1288
```

That is the shipped v1.69.0 — round 8 plus three patches that landed on top of it before release.
Two of those are in areas this round touches, and `PROMPT_ROUND9.txt` names them.

Round 8 was good work. Four of five jobs hold on the ship build, the positive control was run before
anything was claimed, and the handback said what was not done. This round is the tail: every item
below was found by driving the round 8 build with real input, and every one is a case somebody
ordinary reaches.

Ranked, as always, by what a person loses.

---

## AN — three ways to still lose what you typed after a slash

AI fixed the common case and it genuinely holds: `/2026 field work`, `/.gitignore and /1099-MISC`,
Romanian text, a 16-block agent spec, delay-0 typing, across a reload and a blur. Nine ordinary
inputs, none of them yours or mine, all held.

Three do not, all measured on the round 8 build:

| you type | what you get |
|---|---|
| `/` then Space then a word | the slash **and** the space are destroyed, the word becomes a Heading |
| `/` then Enter then a word | the slash destroyed, a Heading created — byte-identical to the old build |
| `/` then Backspace | **nothing at all** — the menu stays open with `/` still sitting there |

The cause is one line, the guard that excludes Space and every non-printable key so the menu keeps
its keyboard selection:

```js
if (event.ctrlKey || event.metaKey || event.altKey || event.key === ' ' || event.key.length !== 1) return;
```

**Space was disclosed and is a real design tension** — it is how the menu is operated. Enter and
Backspace were not disclosed, and Backspace is the worst of the three: it is the gesture a person
makes when they opened the menu by accident, and it is dead.

**Start with Backspace.** Making it cancel the menu, restore the paragraph and leave the caret where
it was is the smallest of the three and closes the "I did not mean that" route. Then Enter. Then say
what you propose for Space rather than changing it silently — a person typing `/ ` at the start of a
line is writing, not choosing.

**Done means** each of the three keeps every character on screen, in IndexedDB and after a reload,
**and** a bare `/` still opens the five-row Add block menu, and a pick still consumes only the marker
paragraph. The second half is the trap: disabling the trigger passes every typing test and destroys
a working feature.

---

## AO — a typed diagram name still dies to one Undo, in a narrow window

AJ works, and it is real new machinery rather than the old timer coasting: on the base a title edit
never armed the debounce at all. It holds for the two routes people use — typing into the source, and
anything routed through `applySource`.

The residual, measured with the gap timed inside the page so harness latency cannot move it:

```
title keystroke -> whole-buffer source replacement after   85ms  title destroyed
                                                          113ms  destroyed
                                                          328ms  destroyed
                                                          516ms  destroyed
                                                          684ms  kept
                                                          996ms  kept
```

Name a diagram, immediately Ctrl+A and paste a new source, press Undo — the name goes with it. Redo
brings it back together with the paste, so nothing is unrecoverable, but the name is gone from the
one gesture a person makes to undo the paste.

**The repair is already identified:** build the undo entry from the previous `state.source` rather
than from `el.source.value`, which by then already holds the new text.

**Done means** the title survives at a gap of 0ms as well as 1000ms, and the Undo the person asked
for still happens — the source really reverts. A fix that makes Undo do nothing is not a fix.

---

## AP — the submenu still opens far from the click, on the commoner route

AL fixed the right-click on blank page space, and that half is solid — measured adjacent to the
cursor at six x positions including under 300 and near the right edge, which is what separates a
real fix from one that only looks right against the clamp.

But **only one of eight `openWorkpaperAddMenu` call sites passes the point.** Right-click a
*paragraph*, or the gap between two blocks, and the second-level menu still opens roughly 700px
away — identical to the old build. Right-clicking a paragraph is at least as ordinary as
right-clicking empty space; most documents have very little empty space.

This was scoped deliberately, and that was a defensible call. It was not in the "deliberately not
done" section, which is where it belonged.

**Done means** all three second-level rows open adjacent to the click from a paragraph, from the gap
between blocks, and from blank page space, at several x positions including under 300; and the
keyboard route still anchors on its element rather than a stale point.

---

## AQ — front matter that is one space away from being seen

AM's scanner requires the very *first* line to be exactly `---`. So this is front matter:

```
---
title: Q3 approvals
---
pie
```

and this is not, as far as the app is concerned:

```
   
---
title: Q3 approvals
---
pie
```

A leading blank or whitespace-only line — which is what pasting from a document produces — makes the
whole thing invisible again: `Advanced Mermaid` in the chip, the New-diagram button disabled, the
wrong generated title, while the lint says the syntax is valid and the pie renders correctly with its
title. Two other shapes were reported and need their own handling: tab-indented YAML, and front
matter with no body after it.

**Careful here, and this is the whole job:** the scanner has six consumers, and widening what counts
as front matter changes all of them at once. Say what each shape does before and after, per consumer.

**A fix already landed that you must not undo.** A Guided row inside the front matter was offering
"Insert block below", which wrote a Mermaid node inside the YAML and counted it — a block sealed
where it can never be drawn. `mermaidFrontmatterEnd(source)` now exposes the span and
`mermaidSourceLinesForScan` consumes it, so the two cannot disagree. Whatever you change about
detection must keep that gate honest: check it on a flowchart with front matter, on a flowchart
without, and on a body line beneath front matter.

---

## AR — an 8px overflow at the left edge, at narrow widths

Pre-existing, small, and it has waited long enough. A menu clamps its left edge and overshoots by
8px at narrow viewports. Reproduce it, name the widths, fix it, and confirm no menu moves at 1440.

---

## Not in this round

The three changelog corrections from round 8 are the owner's and are already being handled: the
overflow scrollbar was not new (only the announcement was), the `.struct-menu` rule was restyled
rather than left unchanged, and AL's config argument moved the block menu's cap — which is why **AK
and AL must land together or not at all**. Nothing for you to do; it is recorded so the next handback
does not repeat it.
