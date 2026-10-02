# Independent access-screen design preview review — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. This report preserves the original inspected preview and the independently reproduced layout finding. Subsequent fixes require a separate recheck.

**Disposition: design-preview privacy and normal modal keyboard checks pass; one P3 small-viewport layout finding was reproduced. This is not completed PIN authentication or production account admission.**

## Original inspected snapshot

| File | SHA-256 |
| --- | --- |
| `desktop/src/ui/desktop.js` | `8f08b059fd1072e2bc04e24f7e3fac3a9a7df037b6371b7842add1d9dba620df` |
| `desktop/src/ui/desktop.css` | `6757547c51c47313828303f19c3f05feb27e0099a9b413a2253dbf85eecdfdd4` |
| `desktop/tests/native/access-screen.mjs` | `5950db52787bde5d57696ccce95800b46277964855d645456fd79279ffe61c9d` |
| Actual `desktop/generated/app.html` | `f02418a0ea8d28edbf991ea76a5e2751bfe52d1695b7dcb30e54dd682c29a335` |

These source hashes were read before the coordinator's footer correction. I made no product changes. My retained observational probe is `desktop/reviews/native-access-layout.mjs`; its fixture changes only the viewport and records DOM/hit-test evidence against the actual Electron window and renderer.

## Independently executed and inspected evidence

- Reran `node tests/native/access-screen.mjs` with approved ordinary Electron execution and synthetic owned Data: completed successfully, evidence `desktop/evidence/access-screen-2026-10-02T15-31-54.197Z/`. Both theme/fullscreen field/PIN/unchanged-account checks, unconfigured online status, reduced motion and Escape focus restoration passed.
- Reran 14 shell, renderer-storage and native-transition Node regression tests: all passed, none failed/skipped/cancelled. The actual online handler remains subject to the existing native queued-save/account authority test rather than a preview-only substitute.
- Independently executed `node reviews/native-access-layout.mjs` twice. The expanded view matrix is retained in `desktop/evidence/independent-access-layout-2026-10-02T15-35-28.586Z/`: 960×600, 640×360, 480×300 and 320×240 CSS viewports. Normal browser modal Tab navigation cycled through Unlock, Activate online, Back, Username and PIN, and remained inside the dialog for all eight observed steps. Settled centre opacity was 1. There was no horizontal overflow in the four tested layouts; scrolling to and clicking Back restored focus to Desktop options.
- Visually inspected the supplied dark/light screenshots and my settled default screenshot and 320×240 screenshot. Earlier supplied pictures captured the centre midway through its 0.7-second arrival fade, so their faint text is not evidence of a persistent contrast failure. The coordinator updated screenshot readiness to wait for centre opacity above 0.99; my independent screenshot also waited for that state.

## Finding: [P3] Absolute footer overlaps the primary button at 320×240

Location in the original snapshot: `desktop/src/ui/desktop.css`, `.desktop-access-note` absolute footer positioning; `desktop/src/ui/desktop.js`, note appended directly to the full-screen dialog.

At the 320×240 emulated CSS viewport, the footer rectangle was y=214–228 while the Unlock button occupied y=193–238. `document.elementFromPoint()` at the button's centre returned `desktop-access-note`, and the retained screenshot visibly shows the footer text crossing the primary button. This prevents that centre pointer click and impairs readability. At 960×600, 640×360 and 480×300 the probe did not observe a covered visible control.

The current native window minimum is 960×640; 320×240 is therefore a below-minimum CSS layout observation, not proof that a normally sized desktop window is unusable. The finding is a bounded responsive design issue and should not be escalated into an authentication/security failure. A footer in the scrollable content flow avoids the collision; merely making its pointer events transparent would still leave the visual overlap. The coordinator reported applying the flow-based correction after this observation; this original report does not mark that later correction verified.

## Keyboard, privacy and scope assessment

The preview is opened explicitly from Desktop → Sign in / access preview. Its modal dialog has a labelled heading and description; the two inputs have explicit labels, the PIN is a password field with numeric input mode, and the status is polite/live. Native modal focus confinement and Escape restoration were observed. The screen stops bubbling keydown events from its fields; this does not disable app-level capture handlers such as the intentional global quit command, and no blanket claim about all application shortcuts is made.

On a valid form submission, the handler prevents navigation, immediately clears the PIN, shows an explicit unconfigured/non-activation status and refocuses the PIN. No bridge, network or storage method receives that value. Online activation clears it before invoking the existing `beginLogin()` flow; close clears it before DOM removal. Native tests used synthetic `0000` only and observed an unchanged account state after preview submission. Native browser validity checks can keep an invalid/partial entry in the field until it is corrected or closed; this is not a persistent credential store. I did not read or use the user's actual PIN.

The scene uses constant authored diagram/Code/Docs/presentation markup, with `aria-hidden`, noninteractive pointer behavior and no locked-project read call. The reviewed PIN preview has no authentication backend, credential derivation, activation entitlement or startup lock policy. It must remain described as a design preview. Production login and any authenticated locked-workspace boundary remain unimplemented and unqualified; the surrounding app remains the existing development session.

Reduced motion disables the preview's subtree animations/transitions and was observed by the native test. Dark/light layout and actual current preview submission are covered; account-service success, a real PIN verifier, all zoom/DPI combinations and true automatic locked startup are not covered by these tests and are not claimed.
