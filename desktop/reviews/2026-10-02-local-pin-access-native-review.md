# Independent local-PIN access native review — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. Ownership for this task is limited to `desktop/tests/native/access-screen.mjs`, `desktop/tests/native/packaged.mjs` and separate review reports. No product or driver edits were made by this reviewer. The earlier design-preview reports and failed native receipts remain unchanged; their historical design-only scope does not qualify the later implemented PIN gate.

**Disposition: the adapted native Settings/change test passes for the recorded local-PIN candidate. A genuine wrong-current-PIN session-loss defect was independently reproduced before the implementation owner corrected it. Packaged qualification is separate and was still pending when this access report was written.**

## Meaningful original failure and correction

The old Settings/change flow called `unlockPin()` to verify the current PIN. Source inspection identified that `LocalPinAccess.unlock()` revoked unlocked authority before checking the value. I reported this finding and retained an actual native failing execution at `desktop/evidence/access-screen-2026-10-02T17-06-20.671Z/`: typing synthetic wrong PIN `0000` into the real Settings → Change PIN flow produced its incorrect-PIN message, but native `getPinState().unlocked` became false. The assertion “Wrong current PIN must not revoke the existing editing session” failed. This was not a mocked refusal or a timing-only failure.

The implementation owner introduced `verifyCurrent()` and `verifyCurrentPin()` and routed the change-current stage to that operation. The source operation requires an existing unlocked session, checks the real verifier, and does not create or restore a session. The adapted native test retained its assertion rather than re-unlocking or weakening the wrong-PIN branch. This review does not claim that repeated failures/cooldown should preserve authority indefinitely; it checks a single wrong current attempt in each theme, with a correct verification between them.

## Independently executed current evidence

The first corrected run passed at `desktop/evidence/access-screen-2026-10-02T17-11-21.025Z/`. I then added real keypad pointer entry of synthetic fixture PIN `4826`, followed by cancellation before selecting a replacement. The final `node tests/native/access-screen.mjs` completed with exit 0 at `desktop/evidence/access-screen-2026-10-02T17-11-59.928Z/`.

The test uses raw `launchDesktop()` first and observes a locked bootstrap with null snapshot. It explicitly invokes `unlockDesktop(driver, { pin: '4826', autoSetup: true })`; that helper calls production native setup/unlock receipts and reloads the renderer. It does not rewrite bootstrap, storage or lock flags. The owned fixture is separate from user Data and uses no actual user PIN.

Both theme branches navigate through Desktop → Settings → Change PIN using native pointer events. They observe a full-viewport modal with one password input, four masked dot slots, ten numeric keypad buttons, synthetic decorative art, focused PIN input and running decoration with motion explicitly allowed. A wrong full-length keyboard entry auto-submits to the native verifier, clears the field, retains the current stage, leaves unlocked authority true and preserves the renderer snapshot and account state. Four actual keypad pointer clicks for `4826` then reach the new-PIN stage through native current-PIN verification. Cancel closes the dialog and restores Desktop-options focus without selecting or changing the PIN.

The existing real workspace toast is deliberately raised as a top-layer popover and reaches full opacity before actual visibility is checked; it remains invisible while the PIN dialog is open. The test hides the fixture popover only after the oracle. Explicit reduced motion produces zero running subtree animations, and Escape is allowed to dismiss change mode while idle, with focus and unlocked authority preserved. I visually inspected the retained light screenshot: the current-PIN prompt, empty masked dots, real keypad and incorrect-PIN message are visible, with no toast covering the decorative Code card.

## Source and renderer binding

The coordinator held the candidate build while these current runs executed. Renderer metadata and actual generated file hash matched before/after the final run:

| File | SHA-256 |
| --- | --- |
| `desktop/generated/app.html` | `2bfdf1b2b01f0631e80841fdc4d68277fed81a5f59a463f547a541bf733781d0` |
| `desktop/src/main.mjs` | `cd92ffdb54ef48f400eb904eb3c372b875df98453b4a47be683e0c27491dd72f` |
| `desktop/src/ui/pin.js` | `ccccdfd08113e4ae583ea8a92945dd2f5acc3720a1a0f4c1de94c567cd712a05` |
| `desktop/src/account/local-pin.mjs` | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| `desktop/tests/native/access-screen.mjs` | `b4b710d9c4d94e87d534a712d798aad53da22540e7284ca12f9459b00fb6bf23` |

The recorded frozen baseline is `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`. No baseline edit is part of this task.

## Limits

This is an actual native local-PIN Settings/change observation, superseding the earlier preview-only test scope. It does not by itself qualify all PIN setup/change lengths, full replacement confirmation, cooldown, corrupt protected records, concurrent lock/change/save races, all viewport/DPI combinations or all IPC methods; other work must carry its own evidence. No production online account, encrypted project storage, hostile local administrator resistance, signed update installation or release admission is claimed. The packaged test adaptations require execution against a newly built package and a separate report before any packaged result can be claimed.
