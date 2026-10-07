# Independent first-document PIN gate review — 2026-10-02

Author: independent reviewer `/root/review_native_launcher`. This is a scoped source review and actual Windows Electron verification. Earlier negative reports and receipts remain unchanged. No product or test changes were made for this review; the additional release probe is evidence only.

## Result and source boundary

The current generated document holds workspace visibility from its opening HTML token. I found no new actionable defect in the two reviewed changes. Independent Guided, full local PIN, returning-project and damaged-recovery executions passed against renderer `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`. This is not release admission or a claim about a later CI run.

SHA-256 values independently read before and after execution:

| File | SHA-256 |
| --- | --- |
| build/renderer.mjs | 321aa70263827454e9efe23a51ea74205f1312042d94f1d1062dd9e7cb14cde2 |
| src/ui/pin.js | 37a91b5e6fe6907cd6997276db8fedcdcd9ec2292fd658d9b0acb190e546eb44 |
| generated/app.html | 808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8 |
| tests/native/drive.mjs | e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4 |
| tests/native/guided-intro.mjs | 918314d133be8609849e10143496761cfaecceb024cddf81a5ff2839e46aeab3 |
| tests/native/local-pin.mjs | 987578e446a01e5b3dbe0bf7d1bba424c79ccfeee621dc7f1ef8d642919e6ee0 |

## Independent assessment

The builder checks the frozen baseline digest and anchors the replacement to the opening DOCTYPE/html sequence. It adds `data-desktop-locked="true"` before body parsing. The existing head CSS hides `#app` while that attribute is present. This covers the earlier gap before the late adapter initializes; an unanchored substring elsewhere in the embedded document cannot satisfy this opening-token match. A marker mismatch throws rather than emitting a candidate document.

The PIN adapter leaves the attribute present when the bridge/bootstrap is absent or mode is locked. It removes it after a real nonlocked bootstrap, before its localAccess-specific early return. That ordering permits normal, readonly and recovery UI to render while native access decisions remain authoritative. The attribute is a display gate, not an authorization mechanism. The native startup helper independently waits for a recognized bootstrap, readonly boolean and actual PIN-state receipt; discovering a CDP page alone is insufficient. Its wait does not manufacture an unlocked state.

Parent-reported CI21 evidence observed two DOM geometry frames with appVisible=true while introVisible=true. That does not establish that the user saw a physical workspace flash. CI21's renderer digest was `767a4cbc...`; the parent's local old-renderer reproduction used `240a2b60...`. These are distinct receipts. The retained local old-renderer RED is `evidence/guided-intro-2026-10-02T18-08-14.299Z`. I did not execute that historical RED or independently diagnose CI21's early bridge failure. The current observations below are my own.

## Actual executions

- `node tests/native/guided-intro.mjs`: exit 0, `evidence/guided-intro-2026-10-02T18-10-44.220Z`. The passive new-document observer recorded 263 animation frames; the first frame had appVisible=false and introVisible=false. All sampled app observations remained hidden through the locked startup/PIN transition. The test then performed real PIN setup/unlock and actual Guided pointer editing with exact source writeback, normal animated intro replay and reduced-motion replay with its overview retained. The receipt's flashConfirmed=false means its DOM/CSS geometry predicate passed; it is not compositor/video proof.
- `node tests/native/local-pin.mjs`: exit 0, `evidence/local-pin-2026-10-02T18-11-28.669Z`. Actual startup exposed null snapshot and refused a known-project save/export before unlock. Real four-digit setup, six-digit change, wrong-current refusal retaining the session, manual lock/unlock, normal exit/restart, exact source/private-draft retention and persisted cooldown all passed. Five wrong PINs led to a real cooldown; restart preserved it, disabled startup controls and Escape retained the lock screen, and actual expiry restored input before successful unlock. PINs and project data were owned synthetic fixtures.
- Evidence-only `node evidence/firstpaint-release-independent-2026-10-02/probe.mjs`: exit 0. Both owned returning and damaged-recovery raw launches first had locked/null bootstrap and the static gate. After production PIN unlock, the returning project had exact source, real SVG and a visible code-mode control. The damaged project had a visible recovery panel with rows, recovery/readonly bootstrap and unchanged damaged original bytes. Both removed the gate. `result.json`, `returning.png` and `damaged-recovery.png` retain these observations.

## Limits

This review covers the opening-token display gate, native readiness boundary as source inspected and the named local executions. It does not prove absence of every physical paint artifact on every GPU or host, authenticate later CI results, or qualify signed updates/launcher races. The original CI20 process-identity failure cause remains unconfirmed. Packaged qualification for the newly committed renderer is separate. No original user Data was accessed or changed.
