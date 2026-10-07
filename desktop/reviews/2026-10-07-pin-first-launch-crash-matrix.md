# First-launch PIN crash matrix — real failure reproduced

Status: **ADVERSE / OPEN. Four abrupt first-session terminations failed restart unlock; two graceful controls passed. No correction or root-cause attribution.**

Author/executor: `/root/disk_inventory`, owner-side delegated qualification, 2026-10-07 local date. This is actual execution evidence, not independent approval. The result is limited to the six owned development profiles and exact runtime identities below. Original source-import adverse evidence was not changed.

## Actual execution and identity

Original matrix evidence: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-first-launch-crash-matrix/2026-10-06T21-28-34.766Z/` (UTC directory timestamp). The original aggregate `result.json` has SHA-256 `5972ac31e5aad95a251c0efc6ddf9b3856efa54e98f44bbe3ed0aa60768fc381`. Each named case has its own `result.json` and disjoint `owned-data`. `verification.json` records the controller digest and native post-run process checks; `controller.snapshot.mjs` preserves the exact executed controller as an inert snapshot.

- Product source commit: `153f760d7b7cf72e06532a57b8537ee7103d0e7c`; checkout checkpoint: `ca14246bc407a4702928d49ba4780189704dac22`.
- Working main SHA-256: `ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1`. Git blob main SHA-256 is `b4de20837af0a10215924076346cadf074e64f43eac1de8b319fa11842627e0b`; only CRLF/LF differs. Exact runtime bytes are the working digest, not the Git blob digest. The other 12 tracked files captured in the controller are byte-identical to source153f.
- Electron **44.5.1**, executable SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.
- `generated/build.json`: `96f45e663b74de7b6730cd4d994c9d1d1732dda36bc3926bd1a2ae5def89a2f8`.
- `generated/home.html`: `3f7619e8daf4557ef77a62959a43e2b7eca74201f0891af5fbe6e94ed9461603`.
- `generated/app.html`: `2c9244ce238665993a0f6b97d4af020ad979164be11c8cd582f8a51fd1fcd8a3`.
- Controller SHA-256: `2993bcc0ac413eacaa93b218be324cb1ae6e3f144db9be68302b359fe5f7e4ba`.

All **18** captured source/helper/package/build/runtime inputs are unchanged after the matrix (`inputsUnchanged:true`). No source, test, build, renderer or workflow file was edited. There was no package copy, no canary and no encryption-method replacement.

The controller used existing `launchDesktop`, `waitForDesktopStartup` and `unlockDesktop`, with `surface:'home'` and synthetic fixture PIN. First setup was acknowledged through the production native API in all six cases. Every case has exactly one restart. `autoSetup:false` on restart prohibits replacing an existing record.

The read-only main inspector verified the actual PID, ready state, expected executable and equality of both `userData` and `sessionData` with the case's intended Data root. All these equality checks passed in all **12** launches. Native process PID/path/creation identity was captured and rechecked before closing each child. Abrupt cases called the existing driver's owned `child.kill()` path; graceful cases requested the application close, waited for exit, then closed the driver. No process-name kill, ACL change or sandbox-disabling flag was used. After completion, native checks confirmed all 12 original owned main processes had exited.

## Results

| Case | First-session acknowledgements | Restart state before unlock | Known fixture PIN acknowledged on restart |
| --- | --- | --- | --- |
| `setup-abrupt-1` | Setup yes | configured=true, pinLength=null, available=true, blocked=true, retryAfterMs=0 | **No — ADVERSE** |
| `setup-abrupt-2` | Setup yes | Same | **No — ADVERSE** |
| `setup-lock-abrupt-1` | Setup yes; Lock yes | Same | **No — ADVERSE** |
| `setup-lock-abrupt-2` | Setup yes; Lock yes | Same | **No — ADVERSE** |
| `setup-lock-graceful-1` | Setup yes; Lock yes | configured=true, pinLength=4, available=true, blocked=false, retryAfterMs=0 | **Yes — PASS** |
| `setup-lock-graceful-2` | Setup yes; Lock yes | Same | **Yes — PASS** |

All six reached the end of the intended case, rather than failing a later import/rendering oracle. Failed restart unlock attempts retained the blocked state. Successful attempts changed unlocked from false to true. Aggregate status is **ADVERSE**, process exit code 1; the two passing controls do not turn the overall matrix into a pass.

## Fixed file metadata at the actual boundaries

Only presence, length and SHA-256 were sampled. No protected key, PIN record contents, plaintext, ciphertext or raw native exception was logged.

In **all six** cases before the first termination, the PIN record existed at 222 B and `Local State`/`Preferences` did not exist. After abrupt termination, both profile files were still absent in all four cases. The PIN length/hash remained identical from before termination through before restart unlock and after its refusal. After graceful close, `Local State` existed at 490 B and `Preferences` at 57 B in both controls; their original PIN ciphertext remained identical up to restart unlock.

| Case | PIN SHA-256 before first termination and before restart unlock | Local State after first termination |
| --- | --- | --- |
| `setup-abrupt-1` | `1329871767422ccef55d74e5fa4500f9bd5c0f405d1a4daf1b54785aad7a62ee` | absent |
| `setup-abrupt-2` | `5164ab842b6fa6cd4c42937ab84320aba574c5e048e9bcdf25e4fee7e858c156` | absent |
| `setup-lock-abrupt-1` | `9493747b9ddaf3ce7e6bb220603ac29866e464904e15e84ad5073d415595e444` | absent |
| `setup-lock-abrupt-2` | `68e75ba42888b42bcad64c44a0e6cadbffccb1d234924eb802ea7b6fc67ca08e` | absent |
| `setup-lock-graceful-1` | `a46bf12dd20dda3916b877b267782c889b503a78e53680d5bc843fc9c8ce19b8` | 490 B, `3da3c834c29548fa2d5b86877fee1f56b65eea6b9f65cbb3f25071cae353d0d5` |
| `setup-lock-graceful-2` | `29a4abf360f324d332f6b605127253bc4007a86c5c9db4defd786c90d1b3fa2d` | 490 B, `aa803024c7a6490e62a74dbb5e9f583b0424a7d639ce1bc83c6df7a84a6dc3b8` |

Both graceful `Preferences` files had SHA-256 `be4b8924ab38e8acf350e6e3b9f1f63a1a94952d8002759acd6946c4d5d0b5de`. A successful unlock legitimately rewrites the PIN record; its new hashes are retained in the originals. This must not be confused with unexpected crash damage.

Each restarted process was closed gracefully during cleanup, after recording the restart observations. That cleanup can subsequently create or update profile files; current on-disk post-cleanup presence must not be substituted for the captured pre-unlock metadata.

## Retained execution refusals

Before the actual native matrix, strict byte-equality preflight stopped at `pin-first-launch-crash-matrix/2026-10-06T21-27-40.362Z/result.json`, with zero native launches, because main's CRLF differs from Git LF. The next controller explicitly retained both exact digests and the EOL-only comparison.

The sandbox-token attempt at `pin-first-launch-crash-matrix/2026-10-06T21-28-05.277Z/` retained six startup ADVERSE cases and unchanged inputs. A separate no-PIN diagnostic reported Electron `install_dir_access.cc:52` sandbox-token ACL refusal before driver attachment. This is retained as an environment refusal, not a PIN result. The actual matrix ran with approved external-to-restricted-token execution, preserving Electron's own sandbox behavior and the same product inputs/oracles.

## Open conclusion and limits

The original first-session crash/restart PIN failure is **reproduced** on untouched source153f with exact captured working/build identities, four abrupt cases and two successful graceful controls. Same-profile ciphertext damage between the observed boundaries and mismatched intended `userData`/`sessionData` roots are not supported by these observations.

Missing durable profile state is strongly correlated with the failure. This baseline still cannot distinguish native decryption failure from JSON/record-validation failure because the unchanged product collapses those stages. No protected Local State fields or native key implementation were inspected. Therefore the matrix does not prove missing encryption-key material, prescribe a key restore, or qualify any proposed correction.

The cases terminate soon after setup (first-session startup/setup took 569–615 ms). They do not measure a delayed checkpoint boundary, long sessions, an already established profile, packaged execution, OS shutdown or power loss. Inspector/test flags and the same Windows account are part of this scope. The matrix stops after the authorized six cases; no broader test or additional crash experiment is claimed.

Next step remains sanitized diagnostic stage separation and native persistence-contract verification as specified in `reviews/2026-10-07-pin-first-launch-crash-source-trace.md`. Preserve fail-closed behavior and existing bytes; do not reset PIN, silently replace protection, sleep until a guessed timeout, or claim DOMStorage flushing as a safeStorage durability fix.
