---
name: siren-verify
description: How to verify a delivered patch round for T-Industries SIREN before it reaches the live file. Use this skill whenever a round comes back from an outside engineer, whenever you are about to call a fix "done", or whenever you catch yourself reading a diff and agreeing with it. Also use it when writing any Playwright probe against SIREN — it carries the harness traps that have each cost real hours. If someone says "Codex finished", "the round is done", "verify this", "does this actually work", or hands you a handback document, start here.
---

# Verifying a SIREN round

## Why this exists

Five consecutive rounds have been held after they were delivered, and **not one of them was
caught by reading the diff.** Every single defect was found by driving the running build with a
real mouse and a real keyboard. Twice the delivered fix was *worse* than the defect it repaired.

So the question this skill answers is not "does the patch look right". It is "what happens to a
person using this".

## The shape of a verification

Three passes, and the third is where the value is.

**1. Replay.** Apply the chain to a frozen copy and confirm it reaches the hash the engineer
stated, byte for byte. If it does not, stop — nothing below means anything, because you would be
measuring a build nobody delivered. Then run the syntax gate and confirm `APP_VERSION`, the
`CHANGELOG` array and the CSP are byte-identical to the base unless the round was explicitly
about one of them.

**2. Verify.** One agent per job, driving both the base and the merged build.

**3. Refute.** A second agent per job, handed the first one's report and told to *break* it.
This is the pass that changes the verdict. A verifier who has just concluded "it works" looks for
confirmation; someone told "prove this is wrong" looks somewhere else entirely.

The clearest example: a verifier measured that a new clickable marker opened its document at 25 of
25 sampled points — correct, nothing wrong with the measurement. The skeptic armed connect mode
first and clicked the same pixel. The connection died silently, Docs opened over the canvas, and
the mode stayed armed. Same control, same pixel, opposite verdict.

## The four questions every job gets

Ask all four. Three of them are usually skipped and each one has caught a shipped-blocking defect.

**Is the defect gone?** The obvious one. Prove it on the merged build.

**Is the positive control real?** Reproduce the defect on the base *first*. If you cannot, your
coordinates or your fixture are wrong and every green result below is meaningless.

**Does the capability it repairs still work?** A marker that stops stealing gestures must still
open its document. A guard that stops a false promise must not refuse a true one. This question
has caught four repairs that broke the thing they repaired.

**Is it a new guard?** A timer, a refusal, a capture, a disabled state. This project lost a week
to a round that answered every problem with a gate, and each gate broke something bigger than it
protected. If a fix's shape is a new guard, say so out loud rather than measuring around it.

## Vacuity

A check that returns the same answer on the base and on the merged build has established
**nothing**, whatever it was labelled. Report it as vacuous rather than counting it green.

This is worth being strict about because it hides so well. One report claimed "the export produces
real selectable text in a real shape rather than a picture" — true, and true on the base too. The
patch had changed the point size and two overflow attributes; the text was already real.

A subtler form: a number that is *guaranteed* by the thing the patch writes. "87 violations became
zero" sounds decisive until you notice the patch hard-codes the attribute the violation check reads.
Both are real numbers. They evidence the attribute flip, not the outcome.

## The harness traps

Each of these has cost hours. They are listed in the order they are most likely to bite.

**The welcome tour arms on a timer** *after* the shared settle has finished sweeping for it, so it
can arrive mid-probe and swallow every click. Use the `killTour(page)` helper in
`qa_exports/verify_170_fixes.js`. And the tour is **first-run only**, gated on `state.tourDone` — so
anything about the tour needs a fresh browser context with empty storage. Pressing F5 measures a
path where the tour never appears, and that check passes on the unfixed build.

**Assert the fixture before measuring it.** To reach a diagram type, use `#diagramTypeSelect`, then
the "New starter" control found *by label* — there is no `#newStarterButton` — then confirm the
dialog. Then read `#source` and check it is the type you asked for. Probes here have silently
measured a flowchart three times and reported it as three diagram types.

**"On screen" means in the viewport, not laid out.** A control 1,925px down a scrolling column has a
perfectly good bounding rect. Compare against `innerHeight` and `innerWidth`, not just `width > 2`.

**Right-clicking inside a Docs paragraph opens the browser's own menu**, not the app's. Editable
text keeps the native menu deliberately. Aim at block chrome, or you will report a working menu as
absent.

**The Bash tool collapses backslashes in heredocs.** `/\s+/` becomes `/s+/` and silently eats the
letter s out of your own output — "code-fir t in SIREN". Write probe files with the Write tool.

**Check your own instrument before blaming the build.** A smoke suite read its path positionally, so
the ordinary `--app <path>` made the string `'--app'` the filename; the server 404'd every request
and the blank page looked like the app had lost `#source`. Three separate harness bugs in one
session reported a working app as broken.

## Real input, or it does not count

`page.mouse.click`, `page.keyboard.press`, physical right-click, real drags with real distances.
Not `.click()` from inside the page — the whole question is usually whether a person's pointer or
keyboard can reach the thing.

Two details worth knowing. Playwright's locator API refuses to click an element carrying
`aria-disabled`, which is a fair proxy for what a screen-reader user is told; when that happens,
record it and then click the raw coordinates, because the difference between the two *is* the
finding. And a double-click needs `detail: 2` — a defect that only appears on the second click of a
pair will not show up otherwise.

## Where a fix is visual, look at it

Render it and open the image. Two defects in this project were found only because somebody looked at
a screenshot, and neither appeared in any failing number. When an agent reports on something visual
without having read the picture, that report is incomplete.

## Writing the verdict

Sort findings into four buckets and keep them apart, because they need different decisions:

- **Confirmed** — survived the skeptic
- **Refuted or overstated** — the claim is wrong, or right about the wrong thing
- **Vacuous** — same answer on both builds
- **New** — nobody was looking for it. Say whether it reproduces on the base: pre-existing is not a
  ship-blocker; a regression introduced this round is.

Then answer the one question the owner actually has, first and plainly: **can this ship?** If not,
what is the shortest path, and is it another round or is it dropping something?

## When to stop repairing and start deciding

Three rounds on one feature is the signal. At that point ask whether the *claim* can be abandoned
instead of the feature repaired again — a code comment and a release note corrected can turn two
open defects into documented behaviour at zero cost.

And where a fix gets one more attempt, write the exit rule **before** the attempt: what exact
measurement decides, and what happens if it fails. A pre-committed rule is the only kind that gets
honoured when the result is disappointing.
