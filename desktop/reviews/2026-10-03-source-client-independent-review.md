# Independent review: isolated source client

Date: 2026-10-03. Reviewer: recovery/diagnostics agent, independent of the source-client author. Result: no blocking finding in the reviewed isolated client. Independent suite: 8/8 pass. Selected client/IPC/independent combined suite: 40/40 pass. This is source-client/module qualification; it does not qualify live editor UI, IPC/preload installation, native Electron windows, Docs linking, schema-2 grant derivation, selected-manifest source selection, or a package.

The author explicitly froze the client and its tracked tests after replacing the 4096-operation hard stop with a bounded recent-ID cache and fencing obsolete observer delivery after subscriber reset. This review made no product, author module, tracked test, dependency, runtime, package, or old report edits. Its only additions are this report and ignored `evidence/source-client-review/independent.test.mjs`. No native launch, full-suite run, or commit occurred here. The parent's concurrent frozen full-suite/native-window qualification is separate evidence and is not claimed as this review's result.

## Reviewed behavior

The client copies a typed immutable source ID/version/SHA-256 identity from a SourceRef, binds only the four source bridge functions, and retains no source text cache. Metrics require the exact bound source/version/hash and flat numeric/encoding fields. Bounded reads use the exact source/version/start/end coordinates and a well-formed string of exactly the requested UTF-16 length; the read receipt deliberately contains no hash. The actual IPC/owned repository validates the referenced source version and selected journal/blob chain. The client bridge shapes agree with the flat `invokeSource` contract.

Mutation calls are serialized through the existing promise tail. Their source ID is injected from the client's binding. The queued expected version must match the then-current durable identity; there is no silent rebase. Only an exact typed receipt matching source/operation/resulting version/hash format and method-specific durability advances state. Commit additionally requires the unchanged current SHA-256. Unexpected fields, getter-bearing receipts, wrong source/operation/version/hash/durability, malformed failure receipts, and transport failures cannot advance the identity. Failures expose fixed metadata `{ok:false,code}`; private bridge messages/text/paths are not published.

`draft` edit receipts and `committed`/`recovery-degraded` blob-commit receipts remain distinct. Checkpoint degradation does not erase a verified source commit or masquerade as full recovery durability. It remains visible in state and metadata-only notifications. Source commit performs no implied Docs save or selected-project manifest commit.

Readonly/Lock/source/native-epoch policy remains authoritative in `invokeSource`, the registry, and SourceRepository publication guards. The client does not grant privileges or accept renderer project/path/role/epoch fields. A refusal fences later queued mutations until an explicit same-source reset. Reset supplies a typed same-source reference and changes the local generation; it does not cancel an already-running native write. New work remains behind the old promise tail until that operation settles. Disposal and reset withhold late results, and a durable version change withholds older in-flight read text. Subscribers receive immutable source/version/hash/durability metadata, and reset/disposal during delivery stops obsolete notification delivery to later subscribers.

There is no `idle()` API in this approved client contract. Exact mutation promises are its settlement barrier; reads report `SOURCE_BUSY` while mutations remain pending. This review checked that a same-source reset does not bypass the older write barrier.

Read ranges are capped at 131072 UTF-16 units. Well-formed insertion strings are capped at 8388608 UTF-8 bytes. Pending mutations are capped at 64 operations including the active call, with a separate 16777216 retained insertion-byte cap. Pressure returns `CLIENT_BUSY` and fences queued work; the already-active native write can still truthfully return its receipt. Recent operation IDs are limited to 4096 by oldest-ID eviction, allowing normal sessions beyond that count. Persistent replay/idempotence correctness remains with the owned repository: eviction never authorizes a second native application, and a historical authoritative refusal still fences the client.

## Actual independent assertions

The eight new ignored suite cases check:

1. **Full isolated chain:** actual sourceClient → actual invokeSource → actual registered Code WindowRegistry → actual owned temporary ProjectStore/SourceRepository. Only Electron's native window/WebContents boundary is doubled. Original UTF-8 source includes a BOM, emoji, and mixed CRLF/CR/LF terminators. A gated real edit keeps selected version 1 until publication; a queued identical-text edit advances to version 3 with the same independently expected hash; a queued blob commit returns explicit `recovery-degraded` after a synthetic checkpoint refusal. Fresh repository export verifies exact original version-1 bytes and exact edited version-3 bytes. The entire original selected ProjectStore snapshot remains unchanged. Metadata/hash and read-no-hash bridge shapes match.
2. **Actual stale native epoch at publication:** registry epoch invalidation runs inside the actual SourceRepository `before-select` hook. Edit returns `ACCESS_REFUSED`; queued commit never calls the bridge and returns `CLIENT_FENCED`. Exact original source pointer bytes, original source version/export bytes, ProjectStore snapshot, and client source identity remain unchanged.
3. **Actual bounded read chain:** real owned 131073-unit source; exactly 131072 units read successfully with the agreed flat metadata/read shape; 131073-unit request refuses client-side without dispatch.
4. **Adverse receipt projection:** wrong source, operation, version type, hash, durability, extra private path, changed commit hash, and SHA getter refuse without identity advancement or getter execution. Native failure message is stripped.
5. **Reset/dispose late answers:** old mutation and queued commit yield `STALE_RESULT` after reset. Fresh post-reset mutation waits for the old native call and then succeeds. Late metric and read responses after disposal disclose neither source data nor receipts.
6. **4200 successful operations:** controlled bridge acknowledges 4200 sequential edits with independently calculated content hashes; client remains usable beyond 4096 and reaches version 4201. Reusing the evicted oldest ID produces an authoritative synthetic replay refusal and leaves version unchanged. A recent duplicate refuses locally.
7. **Limits/pressure:** exactly 8 MiB of well-formed non-ASCII UTF-8 insertion is admitted; one-byte overflow does not dispatch. Both 64-operation and 16 MiB retained-byte pressure refuse promptly; only the active call reaches the controlled bridge and remaining queued calls are fenced.
8. **Observer/read generations:** a subscriber reset prevents later observers receiving an obsolete draft event; a read begun before a durable mutation returns only `STALE_RESULT`.

The operation-cache, maximum-insertion, queue-pressure, and late-answer control cases use bridge doubles to make those conditions deterministic; they do not claim thousands of native disk commits or an 8 MiB package write. Normal-size serialization, durability, byte preservation, checkpoint failure, bounded read, and native publication refusal use the actual owned chain. Owned temporary fixtures are cleaned through the canonical test fixture helper. They contain only synthetic content and no personal credentials.

The independently constructed full-chain fixture SHA-256 values are original `cbb79a468e66fb1d91d64a38ccba42ea10d61004823b2444dce1db536a84271b` and edited `723d6bcd8ce7b07721bedd79f9f40b60a0a14324f544e8e2836c28f4aa621dee`. The test derives them directly from expected UTF-8 bytes, not from repository receipts or selected metadata.

## Commands and results

- `node --test evidence/source-client-review/independent.test.mjs`: exit 0; 8 pass, 0 fail, 0 cancelled/skipped/todo; 1065.6986 ms.
- `node --test tests/source-client.test.mjs tests/source-ipc.test.mjs evidence/source-client-review/independent.test.mjs`: exit 0; 40 pass, 0 fail, 0 cancelled/skipped/todo; 1551.6877 ms. Breakdown: author client 22 + isolated IPC 10 + new independent 8.

This is independent review verification, not a new implementation TDD claim. The source-client author's RED/GREEN evidence is recorded in its own implementation report. All eight listed source/test content hashes were measured before and after the combined focused run and matched. The registry under test includes the parent's later close-boundary work; it is not the earlier registry identity from the initial Sources Task 4 implementation report. That prior report and evidence were not rewritten.

| File | SHA-256 |
| --- | --- |
| Frozen `src/ui/code/source-client.js` | `a2715ff2a1cb140fcdb7a4cfa8344626c13ce7aac201170d210a15e4f84a414e` |
| Frozen `tests/source-client.test.mjs` | `403502a5702f0c764f3dffbd0a33954905e0e7b0e6236ef3092e9e2a16c06dd7` |
| `src/sources/ipc.mjs` | `4261e0315589c66140b22df681cfe1866608f44bd09a9f3052adc17aed858447` |
| `src/sources/repository.mjs` | `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457` |
| Current `src/windows/registry.mjs` | `bf5138cf8ba028ede0b02722eece85e9185d4f1cf34c243e80e2bc3d8f8b670d` |
| `src/projects/store.mjs` | `e5b1d7faef5bab934577dcff40fc4a6aa31dd3d0c4c0d842aea614fe0147faf7` |
| `src/sources/text-model.mjs` | `359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585` |
| Ignored independent test | `7aea00f5d4f9b10ac956c9e925291b5d2f846bc9df8d9ae63f38c02461fcddd7` |

The native grant fixture derives its admitted source ID from the real imported SourceRef; its ProjectStore fixture establishes owned storage rather than claiming live schema-2 main grant wiring. Future integration must preserve native grant/access validation, supply verified same-source reset references, and expose only this exact typed bridge. No further focused run or product fix was needed after these passing checks.
