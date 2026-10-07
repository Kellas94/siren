# Sources Task 4 — isolated source client

Implemented only `src/ui/code/source-client.js` and `tests/source-client.test.mjs`. The client wraps an injected typed bridge for one immutable source identity, serializes edits/commits, accepts only matching durable receipts, and fences subsequent mutations after a failure until explicit same-source reset. It keeps no text model, source cache, project snapshot, or Docs copy. This is a pure client foundation; native IPC integration, editor transport, package admission, large-source interactive performance, manifests, and explicit Docs save are not qualified here.

## Concrete API and agreed receipts

`sourceClient({bridge,sourceRef})` copies only own data properties `sourceId`, `version`, and lowercase 64-hex `sha256` from the reference. It accepts the full native SourceRef without reading provenance. The injected bridge must have own function-valued `getMetrics`, `readRange`, `applyEdit`, and `commitSource` properties. The client exports:

- `getState()` returns frozen `{sourceId,version,sha256,durability,fenced,disposed}`. Initial/reset durability is `null`; a manifest reference alone does not establish an edit or commit acknowledgement.
- `getMetrics()` calls the bridge with the bound `{sourceId,version}`. Accepted result is exactly `{ok:true,sourceId,version,sha256,utf8Bytes,utf16Units,lines,longestLineUnits,encoding,bom,newline}`. Source/version/hash must equal the bound reference; counts, encoding, nullable unsupported-text metrics, BOM, and newline shape are checked. No provenance is returned.
- `readRange({start,end})` supplies the bound source/version and accepts exactly `{ok:true,sourceId,version,start,end,text}`. Offsets are UTF-16 units and each requested/result range is at most 131,072 units. Result length must equal the requested span and text must be well formed. This contract was agreed directly with the source IPC author: range receipts do not contain a hash. The client cannot independently derive a full-source hash from a partial range.
- `applyEdit({operationId,expectedVersion,start,end,insertedText,sourceId?})` and `commitSource({operationId,expectedVersion,sourceId?})` inject the bound source ID. Optional supplied source IDs must match. No project, epoch, native role, path, or access assertion is accepted. Mutations are serialized without rewriting expected versions; stale requests conflict rather than silently rebasing.
- `subscribeSource(callback)` returns an idempotent teardown. Notifications are frozen metadata `{type,sourceId,version,sha256,durability,fenced,code?}`, without source text. Throwing observers cannot change receipt acceptance; removing observers, disposing, or resetting during publication stops obsolete delivery.
- `reset(sourceRef)` requires the same source identity and a syntactically valid, explicitly supplied reference. It fences late in-flight/queued results by generation, clears the failure fence, resets durability, and publishes reset metadata. Obtaining an authoritative fresh reference remains the integration caller's responsibility. Reset is not an implicit conflict retry and does not cancel a native write.
- `dispose()` drops observers and invalidates all late results. Reads/mutations after disposal return `CLIENT_DISPOSED`. There is no separate `idle()`/drain API; callers await their actual mutation promises. The existing pending queue settles after its dispatched bridge call settles, and never dispatches obsolete queued work after reset/disposal.

Mutation success is exactly `{ok:true,sourceId,operationId,version,sha256,durability}`. The native repository does not echo `expectedVersion`; the client verifies it through exact receipt version semantics: edit is expected version + 1, including no-op edits; commit preserves the exact current version/hash. Edit durability must be `draft`; commit durability must be `committed` or `recovery-degraded`. Degraded recovery is retained as a visible success state, without claiming a checkpoint or project-manifest save. Wrong source/op/version/hash/durability, unknown keys, thrown transports, and invalid refusal shapes cannot advance the local reference. Failures expose only `{ok:false,code}`; native message/error text is not forwarded.

## Bounds and lifecycle behavior

Insertion matches the agreed native 8 MiB UTF-8 limit. A bounded UTF-8 count scans the well-formed input without materializing a second full encoded buffer. Exact ASCII and four-byte Unicode boundaries are exercised; unpaired input and byte overflow are refused. Each client retains at most 64 pending mutations and 16 MiB of pending inserted UTF-8 bytes. Overflow returns `CLIENT_BUSY` and visibly fences later mutations. A previously dispatched native edit may still acknowledge its verified version while the client remains fenced; it is never falsely rolled back. These client queue bounds do not modify native source/file limits.

Recent operation IDs use a 4,096-entry cache that evicts the oldest entry. This is not a lifetime typing limit. A regression test accepts 4,100 sequential acknowledgements and then preserves a historical native operation conflict. The native repository remains the authority for older duplicate IDs; an unexpected historical version cannot pass the receipt check. The earlier proposed hard-stop was removed at coordinator review before freezing.

Reads are refused with `SOURCE_BUSY` while mutations remain pending and with `CLIENT_FENCED` while a mutation failure awaits explicit reset. A read begun before mutation/reset/disposal cannot return old text or metric data afterward. The bridge remains responsible for registered caller/PIN/epoch checks, correct byte computation, actual source bounds, and refusing range endpoints that split surrogate pairs; this client does not copy surrounding source text merely to infer those boundaries. The real repository test exercises the actual bounded Unicode read path.

## TDD and actual verification

Applied `superpowers:test-driven-development` and its `writing-good-tests.md` reference. Expectations include literal Unicode bytes and independent Node SHA-256, real owned SourceRepository IO, and controlled deferred bridges for lifecycle races. Per the explicit isolated-task instruction, no native or full suite was launched by this worker; coordinator integration verification remains separate.

- Initial RED: missing client assertion failed, 15 dependent cases skipped, 71.3874 ms. `red.log` preserved.
- First implementation: 16/16 passed, 231.9342 ms, including real original/read/edit/no-op/commit/export behavior.
- Bound refinement RED: 17 passed/3 failed, 234.1384 ms, catching the initial too-small insertion cap and missing pending count/byte limits. After implementation, 20/20 passed, 291.6624 ms.
- Recent-cache/observer RED: initial bridge fixture mistakenly refused its first oldest-ID use, so that first failure was a test-fixture error. Its log is preserved, not claimed as the typing-limit regression. After correcting the fixture, RED was 20 passed/2 failed, 321.8913 ms: normal edit 4096 refused and old `draft` metadata delivered after observer reset. Both production issues were then fixed. The focused run passed 22/22, 366.696 ms.
- Final frozen command: `node --test tests/source-client.test.mjs`, Node `v24.16.0`, **22/22 passed**, zero failures/cancellations/skips/todos, exit 0, **323.2403 ms**. The complete saved transcript exists; start/end identities for the 11 relevant test/source dependency files matched exactly.

The real repository case imports `a😀b\r\nc`, reads the exact emoji span, replaces `b` with `Ș`, checks an independently computed hash of `a😀Ș\r\nc`, applies a no-op edit that increments version again, commits version 3, and checks exported bytes exactly. Its owned temporary root is removed through the test teardown.

## Frozen identity and evidence

| File/artifact | SHA-256 |
| --- | --- |
| `src/ui/code/source-client.js` | `a2715ff2a1cb140fcdb7a4cfa8344626c13ce7aac201170d210a15e4f84a414e` |
| `tests/source-client.test.mjs` | `403502a5702f0c764f3dffbd0a33954905e0e7b0e6236ef3092e9e2a16c06dd7` |
| `evidence/source-client/final-green.log` | `45a45580f6e72f299de8aa871ad328dd817fe800c0c2ca22f79d6c442f22bdce` |
| `evidence/source-client/final-start.json` | `d3b6c3fa84ec43ad2571aa6cc2122433a2a3f3609aa71c4e708dd0d6c570aec3` |
| `evidence/source-client/final-end.json` | `3da1d7b6ee2a4c8ff7f96f9823217065b2dbfe3e96ae2592eaede89da55d6151` |
| `evidence/source-client/red.log` | `7d3fdcac3667b7cda8bc8a6a9edbd0b1beed3af56da206a983ba3e63b6e067c2` |
| `evidence/source-client/limits-red.log` | `cd42e10471eb88cd88db2391c649ae4eb3991b1c03a4dd32df93f60bf0ff852d` |
| `evidence/source-client/cache-observer-red.log` (fixture error retained) | `517a2e51cdff5af2b8dbfdf5fbad0b82803b0530a7a4eb8fcd3f315739f1440e` |
| `evidence/source-client/cache-observer-red-corrected.log` | `7fd20bf8bf437f4ce56446d6188241d347c0a61bbfee1d1fb1e710169a08d7b4` |

Independent review was requested through the coordinator and frozen hashes sent to the source IPC author/reviewer. No independent verdict is fabricated here. This worker changed no main/preload/package/build/editor/dependency file and made no commit. A future editor can consume the API only after native authority integration and the separately required actual interactive qualification.
