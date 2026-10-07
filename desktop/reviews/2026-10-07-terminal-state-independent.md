# Independent pure Terminal state review — 7 October 2026

Author: `/root/catalogue_view`. **Original frozen review: ADVERSE, one P2. Owner repair reported separately.** Terminal native execution remains **not admitted**.

This review covers `src/terminal/{session-state,credits}.mjs` and their two focused tests against the approved Terminal Task2. The reviewer read code and executed controlled Node-only probes. No product/test edit, process creation, GUI, native build, package or full-suite execution occurred.

## P2 TERMINAL-STATE-01 — known host loss leaves active input unresolved

Original `session-state.mjs` SHA-256: `c5a7571c3c1a9865f016c1d5ffd889655b3dfc9fa984ba5ca5d23d5c8aa6ec75`. Original state-test SHA: `86f3fa061c3f8961b4e40f1ffe9d44831764d21af040baa5b957f0e56b7ea815`.

The independent adversarial transport accepted one already delivered 18-byte input but withheld its Promise acknowledgement. Calling `hostFailed()` changed the session to `host-failed` and revoked queued work, yet left the active input request unresolved. After two event-loop turns, exact observed state was:

- `replySettled:false`
- `queuedInputUtf8Bytes:18`, `pendingInputs:1`
- `inputUnverified:false`
- one writer call; no replay or native execution

Only manually releasing the impossible late ACK allowed the original request to resolve `HOST_UNAVAILABLE`. The assertion that known host loss should settle without depending on a lost host exited **1**. Exact output is retained in the JSON companion.

Static cause: original `hostFailed()` marks state and invokes `#revoke`; `#revoke` settles queued entries but not `s.active`. A transport Promise from a dead host may never settle. A future manager/UI awaiting it therefore cannot obtain its failure receipt.

Lock has different semantics: the host remains alive and already-delivered work may retain an in-flight ACK. Known host loss should immediately settle active input unavailable/ambiguous, refuse further attachment/input and make all future callbacks inert. It must not replay or execute a replacement command.

Original identities were captured immediately after this reproducer, before the owner's reported repair; this first probe itself did not capture begin/end hash manifests. ROOT confirmed the original source was frozen during its simultaneous original full suite. This timing limit is recorded honestly rather than inventing a launch capture.

## Owner's repair announcement — not an independent repair verdict

ROOT subsequently announced:

- Original 1601-check full suite completed with original captured bytes unchanged.
- A new permanent host-loss regression failed 0/1, retained in `terminal-host-loss-owner-red.log`.
- `hostFailed` now settles active unavailable, marks ambiguity and clears active; late then/catch callbacks ignore done entries and finally clears only its matching active.
- Focused 32 owner tests passed.

These are attributed to ROOT's collaboration message. This reviewer did **not** rerun the host-loss repair regression, inspect that owner log, or issue a repair/full-suite approval. The original P2 and exact adverse remain the primary original-source verdict.

## Additional independently executed probes — newer bytes, separate scope

During the continuing review ROOT changed the source. The eight-probe runner therefore captured these **new** identities before and after execution:

| File | SHA-256 |
| --- | --- |
| session-state.mjs | bdaccf7b0246d1b8d5429674f615b8bb648b3da03e3cfa9c6020bf823eac61b7 |
| credits.mjs | e739005886735bdf39faf0b62e60cb995a0718d1ec0755686220990d354b0f16 |
| terminal-session-state.test.mjs | cb5fc93ebb74ced3bac0c7606df183af2c24e5112e6818bbdaa95ec855fcd161 |
| terminal-credits.test.mjs | 8f689ddf4ad4a7607768decba6404e76bd45482fb4b41b317bff77046b69d863 |
| contracts.mjs | 1637bc7b9b7687b988ea45b7bee5418727e0c4e00a284e966953d0a56efae79e |

All five identities were unchanged across this run. **Eight probes passed**, exit 0. Their exact inline script/output is retained in the JSON companion; no new test file was added.

| Independent probe | Observed result |
| --- | --- |
| Eight sessions of zero-byte pending input | 2048 entries maximum; one writer per session; Lock clears every queued entry; no hidden unbounded metadata |
| Unicode queue and retry | 262144 UTF-8 bytes exact; whole excess paste refused; refusal does not burn sequence 8; pending duplicate produces no second write |
| Lock/lease/epoch transition | Only “old delivered” then “fresh” reach writer; revoked old queued/late requests never write; fresh work waits behind still-live old transport |
| Ambiguous old-generation rejection | Session stays unverified; newly queued command is refused and never replayed; one writer call |
| Receipt expiry | 1024 empty settled inputs retain 256 receipts; expired/conflicting/gapped requests do not replay |
| Exact output credit | 2 MiB total cap; boundary-only ACK and duplicate ACK release exact bytes once; detach refunds only its own lease |
| Deterministic interval oracle | 20000 credit/ACK/detach/gap operations: 16001 accepted, 3999 refused; independent byte/frame totals match after every operation |
| Tiny frames and safe integers | 256 one-byte frame metadata cap; exhausted cursor refuses without minting credit |

These eight cases do **not** exercise repaired `hostFailed()`; they cannot close the original P2 or become an approval of original frozen bytes. They provide narrow, separately attributed evidence for other requested boundaries on their captured later source.

## Remaining integration limits

The ledger explicitly says `nativeExecutionAdmitted:false` and its Lock receipt says `hostAcknowledged:false`. Controlled writers verify local state, not actual PTY fencing. A real host must recheck generation immediately before write and acknowledge its fence.

Caller context, registered session metadata and credit lease IDs are trusted native inputs to these pure components. Future manager/bridge must establish current registered caller, role, project, epoch, PIN, readonly state and unique native-issued lease identities. The output-credit model cannot itself verify that an xterm processing callback occurred.

No actual shell, Job ownership, process cleanup, full-application Lock, utility host, xterm lifecycle, native/package/hosted/release qualification is granted. The separate native-readiness report remains **NATIVE_OWNERSHIP_NOT_ADMITTED**.
