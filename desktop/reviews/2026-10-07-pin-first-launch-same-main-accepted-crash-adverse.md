# Same record accepted before crash, refused after restart

Status: **ADVERSE / controlled instrumented failure reproduced. Product defect remains OPEN.**

Author/executor: `/root/disk_inventory`, delegated owner-side diagnostic, 2026-10-07 local date. Exactly one corrected fresh case was run: two actual SIREN launches, one owned abrupt termination and one restart. This is separate from the untouched six-case baseline and from the earlier unsuccessful inspector diagnostic. No product/test/build/renderer/workflow file, protected file or key was manually edited; no reset, canary or flush was introduced.

Evidence: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-first-launch-accepted-before-crash-corrected/2026-10-06T21-33-30.594Z/result.json`, SHA-256 `c7d85b2af176db8a230d34f63df1813b881007c3a80e350eb6ecd015748c19eb`.

Controller: `desktop/evidence/pin-first-launch-accepted-before-crash-corrected-controller-2026-10-07.mjs`, SHA-256 `e3e0a24ed933419819b0b1da7053b41c17b1b89654f96316684d3850019057a3`.

## Actual sequence

1. Launched actual SIREN with one new owned Data root and Electron 44.5.1. Main inspector PID matched the controller-owned child; native executable/creation identity was captured. Actual userData and sessionData both matched the intended Data root.
2. Before setup, preflighted the fixed `process.getBuiltinModule('module').createRequire(absoluteActualMainPath)` expression. It obtained the actual `LocalPinAccess` module and Electron safeStorage without dynamic import or an arbitrary-path bridge.
3. Set up the synthetic fixture PIN through the production native API using existing `unlockDesktop(...surface:'home')`. Setup acknowledged; real product state was configured=true, pinLength=4, unlocked=true, available=true, blocked=false, retryAfterMs=0.
4. In that same main process, instantiated a **new actual LocalPinAccess** with the fixed owned Data root and real safeStorage. Called **initialize only**. It read the existing ciphertext, decrypted it and accepted its parsed/validated record: configured=true, pinLength=4, unlocked=false, available=true, blocked=false, retryAfterMs=0. The new instance did not receive the PIN and did not call verify, unlock, setup or write.
5. Compared the record's length/hash before and after this diagnostic read: unchanged. Verified the original process identity, then used the existing driver's owned `child.kill()` path.
6. Restarted actual SIREN once with the same Data root and runtime. Both profile-root equality checks and module preflight passed again. Before any unlock attempt, the identical record hash was still present, but product state was configured=true, pinLength=null, unlocked=false, available=true, blocked=true, retryAfterMs=0.
7. Attempted known-fixture-PIN unlock using `autoSetup:false`. It did not acknowledge. State remained blocked and ciphertext remained identical. Closed the restarted process gracefully after these observations. All nine captured input hashes were unchanged.

No plaintext, ciphertext, PIN record contents, key, salt/verifier or raw inspector/native exception was logged. Only public class states, equality booleans and fixed file metadata were returned from the inspector.

## Exact record identity across boundaries

At all five observed boundaries—before same-main initialize, after it, after abrupt termination, before restart unlock and after its refusal—`Access/local-pin.bin` was **222 B**, SHA-256:

`05c11be159aec55d93bc18e11873ba901faf84fcdc00dfb2f78fee9455e3278b`

`Local State` and `Preferences` were absent at each of those five boundaries. Later graceful cleanup can create profile files; current post-cleanup file presence is not a replacement for the retained boundary observations.

Relevant unchanged input SHA-256 identities:

| File under desktop | SHA-256 |
| --- | --- |
| `src/main.mjs` | `ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1` |
| `src/account/local-pin.mjs` | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| `generated/build.json` | `96f45e663b74de7b6730cd4d994c9d1d1732dda36bc3926bd1a2ae5def89a2f8` |
| `generated/home.html` | `3f7619e8daf4557ef77a62959a43e2b7eca74201f0891af5fbe6e94ed9461603` |
| Electron executable | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

The six-case matrix report records the distinction between source153f and exact CRLF working main bytes; no byte-equality claim to the LF Git blob is made here.

## What this adds

For this controlled case, the same encrypted record was **actually decryptable and schema-valid before termination**, then refused after restart with identical bytes and matching profile roots. This excludes an initially indecryptable or initially malformed record as the explanation for this case. Setup acknowledgement alone was not used for that stronger inference; the fresh class performed the real read/decrypt/validation.

The experiment still does not directly identify a missing encryption key or the native persistence mechanism. Restart's unchanged product state collapses read/decrypt/parse/validation failure categories. The separate copied-profile diagnostic established native-decrypt failure for a different retained adverse profile; it must not be presented as direct stage instrumentation of this case. Missing durable cryptographic/profile state remains strongly supported as a direction for native implementation investigation, not a named key-loss cause or completed fix.

The instrumented same-main read is an additional action compared with the untouched baseline. This report makes no baseline-equivalence, packaged, established-profile, power-loss or other-account qualification claim. The original dynamic-import harness ADVERSE remains unchanged in `pin-first-launch-accepted-before-crash/2026-10-06T21-32-31.045Z/`; it reached no same-main acceptance result and is not relabeled. No further repeat was run.
