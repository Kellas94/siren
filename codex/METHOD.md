# SIREN — the method, after eight rounds

This supersedes `ROUND8_METHOD.md`, which described the delivery format. That format has not
changed and is restated at the foot of this document. What follows is everything the two of us have
learned since, including the parts that were my fault.

Read it once. It is not per-round instructions; it is the standing understanding.

---

## What this project is actually trying to do

One HTML file, opened by double-clicking it, used by a KPMG auditor on live engagements. No build
step, no npm, no network. It is meant to be sold.

The rule everything is judged against, in the owner's words: *nu vrem să ajungem AI slop și funcții
care nu merg și nu sunt testate, să nu promitem ce nu putem livra.* In English, and made checkable:

> **Nothing may promise what it cannot deliver, and nothing may ever silently lose what somebody
> wrote.**

A tooltip, a chip, a count, a menu label, a disabled state or a colour that overstates is treated
here as a defect of the same severity as a crash. Four of the six holds on round 11 were that rule,
not bugs.

---

## The eight rounds, honestly

Rounds 7, 8 and 9 each failed verification as delivered. Round 10 was the first to pass. Round 11
passed on four of six jobs and was held. Round 13 repaired it and **four of the six repairs broke
what they repaired**. Round 14 deleted round 13's damage; six of eight deletions landed cleanly and
four holes reopened. Round 15 is the fourth pass over the same feature set.

Nothing broken has ever reached the live file. That is the system working, not failing — but the
cost of the last three rounds is the thing worth learning from.

### The single most useful sentence to come out of it

> **Rounds 13 and 14 were both correct about what was wrong and both wrong about what to do.
> Round 13 added a gate everywhere. Round 14 removed them.**

Round 13's every answer was a new guard: a 520ms timer, a visibility refusal, a Tab capture, a
disabled menu row. Each one was a reasonable response to a real defect, and each broke something
bigger than it protected. The timer created an invisible half-second a person typed into. The
visibility refusal measured against a pane the stylesheet hides below 900px, killing the feature at
every width an auditor actually uses. The Tab capture cost 19 of 19 keyboard controls.

**So: when a fix's shape is a new gate, stop and say so.** Sometimes a gate is right. But it is the
shape this project has been burned by three times, and naming it costs nothing.

---

## Evidence, and the difference between a measurement and a proof

You are already near the top of this discipline, so this section is about the last few percent.

**A number the patch itself guarantees proves the patch, not the outcome.** Round 11's "87 font and
height violations became zero" was real and reproduced twice — and it could not have been otherwise,
because "clipped" was defined as `vertOverflow == "clip"` and the patch hard-codes
`vertOverflow="overflow"` on every body. Both headline figures were guaranteed by the two attributes
being written. State that when it happens; it is not a weakness, it is precision.

**A check that finds nothing on both the base and the patched build has established nothing.** You
already say this. Keep saying it, and apply it to the flattering cases too — "the export produces
real selectable text rather than a picture" was true, and true on the base as well.

**Where a job is about pointer position, at least one sample must be a physical click.** A synthetic
event carrying coordinates can pass where a real one would not. Round 10's x=240 matrix column
landed on `#wpList`, not on a block, because `#wpList` spans 0..300 and the block starts at 352 — the
fix was fine, that column was not evidence about it.

**Where a fix is visual, render it and look at the image.** Two defects in this project were found
only that way and neither appeared in any failing number.

---

## The four questions a round's own verification should ask

Ask all four before handing back. The verification here will ask them anyway.

1. **Is the defect gone**, on the merged build, driven with real input?
2. **Did the base actually reproduce it first?** If it did not, the fixture is wrong and everything
   downstream is meaningless.
3. **Does the capability the fix repairs still work?** A marker that stops stealing gestures must
   still open its document. A guard that stops a false promise must not refuse a true one. This is
   the question that caught four repairs breaking their own subject.
4. **Is it a new guard?** See above.

---

## Traps, in the order they are most likely to bite

**The welcome tour is first-run only**, gated on `state.tourDone`, and arms on a timer *after* the
shared settle finishes sweeping for it. So it can arrive mid-probe and swallow clicks in unrelated
work — and any check about the tour that reloads the page measures a path where it never appears.
Fresh context, empty storage. `killTour()` in `qa_exports/verify_170_fixes.js`.

**Assert the fixture before measuring it.** `#diagramTypeSelect`, then "New starter" found *by
label* (there is no `#newStarterButton`), then confirm the dialog, then read `#source` and check it
is the type you asked for. Probes here have silently measured a flowchart three times.

**"On screen" means in the viewport.** A control 1,925px down a scrolling column has a perfectly
good bounding rect. Compare against `innerHeight`/`innerWidth`.

**`overflow: auto` clips at the padding box, not the content box.** A probe library here computed
`rect.left + borderLeft + clientWidth - paddingRight` and every emitted cut was 5px too large. The
prose in that report was hand-corrected to the true numbers and the artifacts on disk contradicted
it — which is a worse failure than being wrong, because it is unreproducible.

**Docs is a full-viewport overlay** (0,0,1440,900) while the canvas starts at x=508. So anything
that opens Docs puts it over canvas territory, and a second click of a double-click lands on the
document rather than the diagram.

**Editable text keeps the browser's native context menu**, deliberately. A right-click inside a Docs
paragraph opens nothing the app owns; aim at block chrome.

**Do not write a probe regex with a single backslash inside a JS template literal.** It collapses,
so `/\s+/` becomes `/s+/` and eats the letter s out of your own output. Five false readings here in
one day.

---

## Three times you corrected my brief, and were right each time

Recorded because the habit is worth more than any patch.

**Round 10.** The brief said moving three lines was the whole of job AU. You measured it, found the
Present row still clipped at four widths, did the extra work and said the brief had been wrong.

**Round 12.** The brief said `requestConfirmation` had 46 callers. It has 46 *occurrences* — 45
callers plus the definition. I counted occurrences and called them callers.

**Round 13.** The brief said the deck route pre-splits label lines and the diagram route does not,
so the wrap guard should key on the caller. You measured that *both* routes can hand over a
one-line flat label, and cut the guard on `shape.lines.length` instead. My diagnosis was right in
its conclusion and wrong in its mechanism, which is the more dangerous kind of wrong.

And one that was purely mine: I told you `au_lib.js` was your file and its calculation was wrong. It
exists — at `qa_exports/r10_verify/au_lib.js` — and it is **my verifier's** file. I read a report
that named it and passed the blame on without checking whose it was. You pushed back and were right.

**A brief here is the best current understanding, not an instruction.** Keep arguing with it.

---

## Two habits worth keeping

**You found a gap in your own work before delivering round 15's predecessor** — the first version of
BE reused a platform-specific multi-select helper that intentionally ignores Ctrl on macOS. You
changed the route, added a macOS-emulated sideways case that waits past the 520ms arbitration
window, re-pinned the whole chain and reran every check. Nobody asked.

**You left a red assertion red.** After removing the bare-Tab mutation, the legacy suite still
required bare Tab to create a block. You reported it as intentionally obsolete rather than repinning
it. That is the difference between fixing a test and silencing one, and a permanently red assertion
that nobody can explain is worse than no test at all.

---

## When to stop repairing and start deciding

Three rounds on one feature is the signal.

The marker corner is the worked example: 324 pixels that could not honour both contracts at once.
Round 11 made the click a no-op on a wobble; round 13 bought reliability with a window that silently
renamed blocks; round 14 bought instant opening and lost the drag and the rename. The fourth answer
was not a fourth repair — it was deciding the corner is a **single-purpose control**, correcting one
code comment and one release note, and turning two open defects into documented behaviour at zero
engineering cost.

**Where something gets one more attempt, the exit rule is written before the attempt**: what exact
measurement decides, and what happens if it fails. A rule committed to in advance is the only kind
that survives a disappointing result.

---

## Delivery format — unchanged

- One SHA-pinned script per job. Verify the input hash before writing and the output hash after.
- Assert the exact occurrence count of every replacement anchor before transforming.
- Write through a same-directory temporary file and an atomic rename.
- Take anchors from the file. Never use a line number as an anchor.
- `APPLY_ORDER.md` with every script hash, every required input hash, every exact output hash, byte
  sizes, and the replay command.
- A clean replay from the frozen base must reach the stated final hash byte for byte.
- Every script must reject a deliberately wrong input hash with a non-zero exit and leave the target
  unchanged.
- Do not touch `APP_VERSION`, the `CHANGELOG` array or the CSP unless a job is explicitly about one.
- A handback that says what you did **and what you did not**. The second half is the more useful one.
