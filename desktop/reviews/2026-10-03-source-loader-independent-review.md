# Independent review — renderer source document loader

No remaining blocking finding in the final captured loader. The reviewer inspected the actual module and original tests, added thirteen independent controls, and reproduced two captured-identity contract defects before the author repaired them. The final author suite passed 9/9 and the unchanged independent controls passed 13/13. This qualifies isolated loading into actual CodeMirror `Text` under Node; it does not admit a live preload/main channel, EditorView, native source ownership, packaged renderer, source save/manifest behavior, or large-source performance.

## Final contract and controls

The source ID, explicit version and expected SHA-256 are copied from own data descriptors and frozen before bridge dispatch. Open/chunk/close receipts must contain exact whitelisted own data fields on plain objects, with no getters, symbols, hidden extras or inherited receipt fields. Open receipts must match the captured source identity/hash, report UTF-8, and satisfy bounded byte/unit/metric fields. UTF-8 bytes are limited to 32 MiB and UTF-16 length to 33,554,432 units; each requested chunk is capped at 131,072 UTF-16 units. Chunks must match the read/source/version and next starting position, advance within bounds, have the exact span length and contain well-formed Unicode. Metrics other than final byte length/hash are shape/bounds checked native metadata; they are not all independently recomputed by the loader.

Actual CodeMirror `Text` is constructed with explicit LF splitting. Literal CR, CRLF, BOM, Unicode and source offsets remain intact, including when two-unit native chunks split a CRLF across responses. The completed document is converted to UTF-8 and checked against the expected byte length and independent full SHA-256. No complete or partial document is returned before these checks and the exact owned close acknowledgement. Equal-length corruption is refused. Empty input opens/verifies/closes without a chunk request. Final result/metrics and progress metadata are frozen; progress contains identity and counts, not source text. Synchronously throwing and asynchronously rejecting observers do not affect the completed document.

Cancellation before dispatch starts no read. Cancellation during open/read waits withholds late data and progress. A delayed successful open after cancellation receives a best-effort close using its own data read ID and the captured source/version. Cancellation after hash verification while close is pending also withholds the document. Every bridge request has a 15-second timeout; a mocked-clock test exercised open timeout and late lease cleanup without a real 15-second wait. This is a per-request timeout, not a whole-load deadline or cancellation of synchronous Text construction/native I/O.

Cleanup of an otherwise successful load requires a matching read/source/version acknowledgement against an immutable expected close identity. Wrong or malformed acknowledgement yields `SOURCE_READER_CLOSE_FAILED` with no document. An earlier failure remains the primary result when cleanup also fails. Cleanup and late cleanup can fail; this module does not prove that every native lease was released, and late cleanup acknowledgement is not used to publish a success. Native lease expiry/owner disposal remains native-service responsibility. Supported native errors retain their code without private messages; other codes deliberately collapse to `SOURCE_LOAD_FAILED` under the author-confirmed finite allowlist.

## Preserved findings and run history

1. **Mutable captured source identity.** `openRead` originally received the mutable object later used as the loader's identity/hash oracle. An adapter changed the requested source/hash and supplied matching foreign receipts; the loader published a verified foreign document even though the caller supplied a frozen original reference. The initial independent run passed 11/12 and failed this control, **90.3738 ms**, exit 1. The author froze the captured identity. The same twelve controls then passed, **81.6172 ms**, alongside 8/8 author tests, **128.2547 ms**, with ten captured identities unchanged.
2. **Mutable expected close identity.** The equivalent object in `finally` was still mutable. A close adapter changed its read/source/version and acknowledged those foreign values. The loader published success while an actual reader remained open, independently confirmed by another read from that same reader. The additional precise control failed **1/1**, **68.9708 ms**, exit 1. The author froze the expected close identity. That control passed unchanged in the final run.

These are browser adapter captured-identity/acknowledgement contract defects. The tests substitute bridge implementations; they do not demonstrate a native cross-window access bypass. Actual native IPC clones arguments and has its own captured grant/owner checks, which this loader review did not qualify. The reviewer's files remain unchanged through each corresponding repair; both RED logs and the intermediate GREEN artifacts are retained separately.

## Final focused evidence

Working directory: `C:/Claude/SIREN_WORK/portable/desktop`. Runtime: Node `v24.16.0`, Windows x64. Actual installed `@codemirror/state` is version `6.7.6`, with its imported `@marijn/find-cluster-break` module captured too.

- `node --test tests/source-loader.test.mjs`: **9/9 passed**, exit 0, **127.7396 ms**.
- `node --test evidence/source-loader-independent-review/independent.test.mjs evidence/source-loader-independent-review/close-owner.test.mjs`: **13/13 passed**, exit 0, **94.7197 ms**.

Both runs had zero skipped/cancelled/todo cases. The focused commands ran concurrently against separate in-memory reader pools. An actual before/after comparison confirmed all eleven captured source/test/runtime-module identities unchanged. The controls use real TextModel/SourceReaderPool and CodeMirror Text, with controlled bridge/gate/observer doubles. They do not traverse SourceReadService, a real ProjectStore/disk repository, IPC, or EditorView; any separate coordinator end-to-end result is outside this evidence. Pools are disposed by test teardown. No GUI/native shell was launched, product/original test/dependency edited, full suite run, or commit made by this reviewer.

| File/artifact | SHA-256 |
| --- | --- |
| Final `src/ui/code/source-loader.js` | `2e3bf966a63c17df7d1aee8cf268fddfcf44af43b45b38441cef2a061f029ab4` |
| Final `tests/source-loader.test.mjs` | `a4e1f1931dc37321dad47813bb45332235a4d3dd63c6458236cec3a4d4f27154` |
| Independent twelve controls | `b59e1721759db0cf91032a93d176b45f77ce6b61f188a11cbea1a074cf696e99` |
| Precise close-owner control | `ebeed3218c2a02583b4c2cb971112ab2a9fa5b641b302a796046df7b406f9f6b` |
| Initial identity RED log | `82b472ed03a268398eaaddf1b311127593f78d3319d3748160ab2be82a8feadb` |
| Close-owner RED log | `e3691741027f73a2cb83f2767038655a5b3471f3a838104d5cd7400cd86f8f81` |
| Final author-suite log | `ad4c58dd716477c5080e625f95214e8f42e96499872e1eb71278530893db83fa` |
| Final thirteen-control log | `24d62cb5121edff0164e5ac1869add162ddea3fc98d845fb6d46da8be91160e6` |
| Final start identities | `81fac093b2619d3e2bd5ecffda40d1e982f49b7d5f97bf1e5e1f4cded71073a2` |
| Final end identities | `5bb139880ab87664c077f52a8cdcac83ddb3e16497a9db2b78e64349fba306bd` |

Ignored evidence resides under `desktop/evidence/source-loader-independent-review/`. Initially inspected loader/test hashes were `dc6539ae6c9248c3b8a3c8f759ab9d575c35c7c24f550ad7a5f54a08033b1f4a` / `73692a3946f5e3e039ef923ef56bbb209c1da03bfe97b23d269c437a51df95e2`. Intermediate source-identity repair hashes were `f45e0ebc20c80471843df37a452fb78de103e3531bf53544cf2a063d5ec9eef2` / `777917317a2a9e8eef08acb1aa7473c74c2d65f33692158b03e77125176b95ee`; its ten-file manifests/logs were preserved separately. Initial RED has captured file reads/logs rather than the final eleven-file manifest. Full document/string/UTF-8 verification allocations and native model/index allocations are not an RSS bound or a tested renderer performance envelope. Adjacent source-client loading integration has separate ownership/review.
