# Independent access-flow Escape regression addendum — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. The original local-PIN access native report and its original failure/source bindings remain unchanged. No product change or additional test change was made by this reviewer for this rerun.

The coordinator reported a distinct real cooldown/startup Escape failure: disabled PIN input allowed focus to leave the dialog, so its bubbling keydown listener did not see Escape. That original cooldown observation belongs to its separate test owner and was not independently rerun as part of this Settings-flow addendum.

I inspected the correction in `desktop/src/ui/pin.js`: a document capture listener prevents Escape while the dialog is open in startup mode or while an operation is busy. The listener is removed on close. Its explicit mode/busy condition leaves idle Settings/change cancellation permitted.

I independently reran `node tests/native/access-screen.mjs`, completed with exit 0, evidence `desktop/evidence/access-screen-2026-10-02T17-16-32.710Z/`. Both themes, actual wrong-current refusal with unlocked-session preservation, real keypad current-PIN verification into the new stage, Cancel, real-toast isolation, zero reduced-motion animations and allowed idle-change Escape/focus restoration still pass. This execution qualifies those Settings-flow behaviors under the new renderer, not the separately owned full cooldown/restart scenario.

| File | SHA-256 |
| --- | --- |
| Stable `desktop/generated/app.html` | `240a2b60f014d2be861c608b265e024b91373c12dfdda6fd580b4ff2abc2aca6` |
| `desktop/src/main.mjs` (unchanged) | `cd92ffdb54ef48f400eb904eb3c372b875df98453b4a47be683e0c27491dd72f` |
| `desktop/src/ui/pin.js` | `9f03d50e545fcc979bd63ba23d49d3c1064907e8c39a9cf960a1b26356c898ba` |
| `desktop/tests/native/access-screen.mjs` (unchanged) | `b4b710d9c4d94e87d534a712d798aad53da22540e7284ca12f9459b00fb6bf23` |

Hashes matched before/after the current native run. Packaged execution still requires a source-tied new package and its separate report. No online activation, encrypted-project boundary, signed-update installation or production release admission is claimed.
