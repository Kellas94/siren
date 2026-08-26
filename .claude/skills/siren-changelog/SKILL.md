---
name: siren-changelog
description: How to write release notes for T-Industries SIREN so that every sentence is something the shipped build actually does. Use this skill whenever you are about to write a changelog entry, a release note, a tooltip, a disabled-state reason, a status message or any text the app shows about itself. Also use it when summarising what a round delivered, because a handback's own wording is where false claims enter. This check has caught eighteen would-be broken promises across four rounds and none of them shipped. If someone says "write the changelog", "cut the release", "what did this round change", or you are drafting a sentence beginning "now the app...", start here.
---

# Writing what the app actually does

## The rule this serves

*Nothing in this app may promise what it cannot deliver.* A tooltip, a chip, a count, a menu label,
a disabled state or a colour that overstates is treated here as a defect of the same severity as a
crash — because to the person using it, the effect is the same: they believed something and acted
on it.

A changelog is the largest promise the app makes, so it gets the strictest check.

## The check

**Write the note from the measurement, then verify the note against the shipped build.**

Not against the handback. Not against the patch. Against the bytes that are about to go out, driven
in a browser. The eighteen false claims caught so far were all caught in the gap between "what the
patch does" and "what a person gets".

Three of them, so the shape is recognisable:

**"Overflow now shows a scrollbar."** The old build already drew one and already scrolled. What was
new was that the menu now *announces* it — and only to assistive technology, because there is no
`[data-scrollable]` rule in the stylesheet at all. The corrected note said that.

**"Pressing the greyed-out tab did nothing."** Drafted from the patch's own reasoning. Measured on
the shipped build, it opens the visual builder panel, which then explains it cannot help with this
diagram type. Different sentence, different fix, and the draft would have been read by someone who
knew better.

**"The heading was cut off past the menu's border."** True of the build under test and not of the
build people had. On the previous release the whole menu hung 75 pixels off the left edge of the
screen — unreadable for a different reason. The note has to describe what the *reader* had.

## How to write one

**Lead with what a person lost or could not do**, not with the mechanism. "Typing a word straight
after a slash in a document no longer destroys it" — then the mechanism, if it helps.

**Use the measurement, in the units the person experiences.** "Nine characters destroyed", "77 Tab
presses", "37 points outside the shape", "three presses and two acts of reading". Not "improved
handling of" anything.

**Name the residual out loud.** If two ways in are still broken, say which two. A person who reads
"typing after a slash is fixed" and then loses a line to a slash-then-space has been lied to by a
release note, and will trust the next one less.

**Say what the change does not cover.** Where a fix reaches screen readers but draws nothing new on
screen, say that. Where a warning names a clamp rather than a measurement, say that.

**Do not describe a defect introduced and removed inside one release.** It is not news to anyone
outside the release, and it makes the note about the process rather than the product. What *is* news
is anything that was in the previous shipped build.

## Sentences to distrust in your own draft

Each of these has been wrong here at least once:

- **"now" without a before** — now *compared to what a person had*, which is the last shipped build,
  not the base you happened to patch
- **any number that the patch itself guarantees** — "87 violations became zero" when the patch
  hard-codes the attribute the violation check reads. Real number, wrong thing proved.
- **"fixed", unqualified** — fixed on which diagram types, at which window widths, through which
  route? A fix measured on one fixture is a fix on one fixture.
- **"editable", "native", "searchable", "offline"** — every one of these is a claim about a file's
  contents or a program's behaviour and every one is checkable. Check it.
- **a capability word borrowed from a handback** — an outside engineer describes what they built;
  the note has to describe what a person receives. Those are different documents.

## Where else this applies

The changelog is the loudest surface but not the only one. The same check belongs on:

- **tooltips** — one promised "an editable PowerPoint" unconditionally while the writer produced
  editable shapes for flowcharts only
- **disabled reasons** — the app's single honestly-disabled control carried a reason that was false
  on 18 of the 20 diagram types
- **status messages** — one names a number that never renders, because the bar is
  `text-overflow: ellipsis` on a single line and the ellipsis falls *before* the number
- **counts** — "0 blocks · 0 connections" was displayed on eleven diagram families for which it was
  never a true sentence
- **module names** — "Workpapers" implies authenticated sign-off, immutable history and retention.
  Without those it is a documentation surface, and calling it a workpaper is this rule broken at the
  level of a product name

## The correction habit

When a draft sentence turns out to be wrong, correct it in the release notes rather than deleting
it quietly — and correct it in the patch script's docstring too, so the next reader does not inherit
the mistaken reasoning.

The same applies to a brief handed to an outside engineer. Three times a diagnosis written here was
wrong and the engineer measured it and said so. Each time the brief was corrected in writing before
the next round, and each time saying "this was mine" cost nothing and bought a collaborator who
argues with the measurements. That is worth more than being right in the first draft.
