# Independent Terminal foundation review — 7 October 2026

Author: /root/terminal_foundation_review. Verdict: **No blocking finding within the current pure-foundation scope.** This verdict applies only to the captured source bytes below. **Native execution and ownership remain NOT_ADMITTED.**

I read the approved Terminal design and plan, the three scoped implementation modules, and the four scoped tests. I executed the scoped Node tests and ten separately authored adversarial probes. I changed only this report and its JSON companion; the earlier adverse review is preserved.

## Current host-loss repair

The original P2 TERMINAL-STATE-01 in reviews/2026-10-07-terminal-state-independent.md is **closed on the current captured session-state.mjs bytes** by this independent recheck. The original adverse report is not rewritten or retrospectively approved.

The independent transport accepted one input and withheld acknowledgement. A duplicate joined the same receipt, and a second sequence remained queued. Calling hostFailed() immediately settled the active request and duplicate HOST_UNAVAILABLE without waiting for transport acknowledgement; queued work was refused and all pending byte/count accounting returned to zero. The session remained host-failed and inputUnverified, and attachment remained unavailable after resumeInput(). I tested both a late accepted ACK and a late rejected transport Promise: neither mutated the captured snapshot/stats, issued another write, restored a receipt, or replayed input. Repeated hostFailed() was also inert.

Lock has the separately required behavior: closeInput() immediately revoked old queued/new input and returned localInputFenced:true, hostAcknowledged:false. The already delivered write remained untouched. A fresh generation waited behind that in-flight write, then wrote exactly once after its ACK. The old request resolved LEASE_STALE. An ambiguous rejection from the old generation instead revoked the fresh queued generation, marked inputUnverified and produced no replay.

## Independently executed checks

The four scoped test files passed **23/23**, exit 0, in Node v24.16.0 / Windows x64. This includes the 512 MiB pure-ring stress test: exactly 32 MiB retained across eight rings, peak credit 2 MiB, peak ring allocation 32 MiB, 80 visible gaps, and zero final outstanding credits. Observed RSS was 174014464 bytes and elapsed stress time 640 ms; these are a single pure-Node sample, not native performance qualification.

My ten independently authored probes passed **10/10**, exit 0:

| Probe | Exact observation |
| --- | --- |
| native identity and mode are independent authority checks | {"matchingGrantClone":"refused","matchingLeaseClone":"refused","normalModeWithoutWritableGrant":"refused","lockedPassiveMetadata":"refused"} |
| known host loss settles active and duplicate immediately; both late resolution kinds inert | {"lateAckKinds":2,"writerCallsPerCase":1,"pendingAfterFailure":0,"replayCalls":0} |
| Lock revokes queued work synchronously while new generation waits behind old in-flight write | {"writerData":["delivered","fresh"],"oldQueuedNeverWritten":true,"hostAcknowledged":false} |
| old generation transport ambiguity closes newly queued lease without replay | {"writerCalls":1,"inputUnverified":true} |
| Unicode whole-paste refusal does not burn next sequence and duplicates serialize once | {"peakUtf8Bytes":262144,"duplicateWrites":0,"refusedSequenceReusable":true} |
| eight sessions of zero-byte input remain bounded and dead-host settlement clears all metadata | {"boundedPendingEntries":2048,"writerCalls":8,"settledWithoutAck":2048} |
| latest 256 receipts expire exactly and operation-id changes never replay payload | {"writes":800,"retained":256,"expiredThrough":543,"firstRetained":544} |
| output exact saturation, partial-boundary refusal and detach refund | {"maximumBytes":2097152,"detachedRefundBytes":229376,"otherLeasesOutstandingBytes":1835008} |
| deterministic independent interval oracle matches credit counters after every operation | {"operations":30000,"accepted":10726,"refused":19274,"outstandingBytes":32768} |
| safe integer exhaustion and tiny-frame bound never mint credits | {"maxFrames":256,"outstandingBytes":2} |

The deterministic credit oracle used seed 0x7110642 and a separate interval/frame model. It exercised attach, reserve, boundary ACK, retained-gap advance and detach over eleven potential lease names, comparing success/refusal and exact attachment/byte/frame totals after each of 30000 operations. The model accepted 10726 and refused 19274 operations. This adds independent accounting evidence beyond invoking the production tests.

Policy probes supplied native-like object-identity callbacks. Matching grant/lease field clones were refused. Normal mode without actual writable permission was refused; recovery refused execution while allowing unlocked passive listing; locked listing was refused. Missing, false, asynchronous and throwing execution-authority providers refused. These probes verify this callback boundary's logic only. They do not prove real WindowRegistry caller integration.

## Captured identities

SHA-256 was captured before and after the independent probes for every file below; all eleven were identical. The initial review read also captured the seven scoped source/test hashes before the scoped test execution, and those match this manifest.

| File, relative to desktop | SHA-256 |
| --- | --- |
| `src/terminal/session-state.mjs` | `bdaccf7b0246d1b8d5429674f615b8bb648b3da03e3cfa9c6020bf823eac61b7` |
| `src/terminal/credits.mjs` | `e739005886735bdf39faf0b62e60cb995a0718d1ec0755686220990d354b0f16` |
| `src/terminal/policy.mjs` | `dcb53dfb4586ba63ffe2a86cea2171ac6fe2aae2670af68de97981a9cc373115` |
| `tests/terminal-session-state.test.mjs` | `cb5fc93ebb74ced3bac0c7606df183af2c24e5112e6818bbdaa95ec855fcd161` |
| `tests/terminal-credits.test.mjs` | `8f689ddf4ad4a7607768decba6404e76bd45482fb4b41b317bff77046b69d863` |
| `tests/terminal-policy.test.mjs` | `c8dfbb25cbbea0c35c4394a8fc0945a5e7ae7facb5c126edc1359cdf8dc98778` |
| `tests/terminal-state-stress.test.mjs` | `62002ea02d9df42fc631dd7e2983b03ab61244d92f7a52b8a75ca6ee63660a72` |
| `src/terminal/contracts.mjs` | `1637bc7b9b7687b988ea45b7bee5418727e0c4e00a284e966953d0a56efae79e` |
| `src/terminal/output.mjs` | `13617af44f8b0023cd8dff735c90638c780671e58ae0840c7e2bf9108b0c1baf` |
| `../docs/superpowers/specs/2026-10-03-siren-terminal-design.md` | `eb7d3ff43defc73026207faf7f1d6f53dce037be8d66ff205ff9106cf0d2f1d5` |
| `../docs/superpowers/plans/2026-10-03-siren-terminal.md` | `509d19c2c04ace952406551a2e745965db0f38d3eebf520412606795c814c045` |

The JSON companion records exact results, runtime, scope-test metrics, input hashes, the current P2 recheck status and validation limits. The independent probe source was submitted inline through the review tool call; no product test file or new executable artifact was added.

## Limits and required later integration

- Pure Node state and accounting only; no native manager/host, Electron caller/IPC, PTY, xterm or GUI integration qualification.
- Native policy callbacks must establish current caller and writable execution authority; matching context fields alone are not caller identity proof.
- Session registration, local resume and credit lease identifiers are trusted native inputs; unique never-reused native lease identity and immediate host-side generation recheck remain integration responsibilities.
- Credit ACK boundary validation does not establish that xterm processing callback actually occurred.
- Lock receipt explicitly has hostAcknowledged:false; no native host fence or process-lifetime claim.
- No dependency installs, runtime downloads, product/test modifications, package/release validation or full-suite execution by this reviewer.
- Task 1 ownership/adoption and tooling/spawn-race work remain open; native execution is NOT_ADMITTED.

No full-suite, GUI, real shell, process-family ownership, release or package approval is inferred. ROOT's final full-suite evidence is separate and must bind these exact final bytes. Product Terminal remains unavailable until native qualification and the approved integration work establish their own evidence.
