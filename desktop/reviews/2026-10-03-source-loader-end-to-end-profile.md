# Independent Node profile: owned source to actual CodeMirror Text

Date: 2026-10-03. One frozen six-case measurement. All six completed exact byte/hash and disk-preservation checks. This is **Node + an explicit NativeWindowDouble**, with the actual owned repository, WindowRegistry, SourceReadService, loader, and CodeMirror Text implementation. No Electron, EditorView, live IPC/preload, native window, editor paint/highlighting, or packaged admission is claimed.

For the 18.6 MB / 300k-record Python fixture, `loadSource` completed in **195.040 ms**, including a **124.025 ms** typed service open. The 19.8 MB Unicode fixture completed in **301.956 ms**, including **192.117 ms** open. Their documents contained the exact independently expected UTF-8 bytes. These timings are single observations on the stated machine, not native-renderer latency guarantees.

## Exactly one run

Command: `node evidence/source-loader-profile/profile.mjs`, exit 0. Result: `evidence/source-loader-profile/2026-10-03T05-23-21-063Z/result.json` with six case files; 6 `COMPLETE`, no timeout or refusal. Every child exited 0 and cleaned its canonical owned temporary fixture. The original 60000 ms per-case bound was retained, with no new operation started after 59000 ms. There was no retry, limit change, second matrix run, or adjustment to make a case pass.

Only this new report and ignored `evidence/source-loader-profile/*` files were added. Product modules, tracked tests, prior profiles/probes/reports, dependencies, renderer/main, and EditorView were not edited. SourceClient was neither imported nor included in the measured hash manifest; its ongoing integration is separate.

Before any case, the driver required the exact root-frozen loader `2e3bf966…`, reader `c68d1efe…`, and service `1b58e7f3…` content identities. It measured 18 imported source/dependency/helper hashes before and after the matrix. All matched. CodeMirror state was the installed actual **6.7.6** implementation; its runtime dependency was `@marijn/find-cluster-break` **1.0.4**. No package was installed for this measurement.

## Chain and independent oracle

Each case imported the same deterministic source fixture into an actual owned ProjectStore/SourceRepository and fetched metrics once. The real WindowRegistry registered one Code window with read access and its imported source ID. Only Electron's native boundary was represented by the explicitly named `NativeWindowDouble` (EventEmitter/window/WebContents/main-frame methods). The actual SourceReadService then captured that registry grant, supplied its actual shared reader pool to a fresh repository on open, and enforced read sessions. Its three typed methods were the loader bridge; the bridge recorded timing/count/coordinates and returned actual receipts unchanged.

The loader ran once, using the imported SourceRef. It opened exactly one version-1 session, transferred sequential chunks with `maxUnits:131072`, assembled actual CodeMirror `Text`, validated its own complete UTF-8/hash, and received one typed close acknowledgement before returning. The profiler asserted `doc instanceof Text`, the returned result's frozen status, exact source/version, original UTF-16 length, and completed progress. Actual objects were `TextNode` instances, not a fake editor/text implementation.

The independent expected full hash came from Node crypto streamed over the predetermined BOM prefix and repeated line UTF-8 bytes. The actual input buffer was separately hashed. After the loader returned, a separate Node SHA-256 streamed the **actual CodeMirror Text iterator**, including literal LF values, with an independent UTF-8 byte count. This did not reuse the loader's digest or receipt hash as the expected oracle. Every document hash and byte count matched the expected fixture; no full returned document text was assembled by this independent hash pass.

The original source blob was independently streamed from disk before and after. Exact source pointer and selected source-journal bytes were hashed before and after; the original selected ProjectStore snapshot was compared before and after. All were preserved. Raw project-pointer bytes were not a separate sampled oracle; ProjectStore readback verifies and returns its selected snapshot. No edit, project/Docs commit, source write or manifest selection was performed by the measured chain.

The service was disposed and the registry epoch invalidated in the worker's `finally`, destroying only the owned double and closing its remaining resources. Each case had exactly one open, one repository factory call, one close, and `closeOK:true`. No read ID remained intentionally open after return.

## Same six fixtures and results

Shapes are unchanged from the original range and reader profiles: compact `x`+LF; 61 ASCII Python-ish characters+LF; 61 UTF-16 units containing emoji/Ș+CRLF with one source BOM. Each has 100k or 300k records and a final empty line. Input hashes match the original profile for every case. All sources remain below the 32 MiB cap.

Milliseconds; the service open is included in total `loadSource` time. Chunk sum measures the actual service invocation through the registry/pool/repository boundary, inside this one Node process. The independent full-document hash pass is additional reviewer work after loader completion.

| Shape / records | Source UTF-8 bytes | Service open | Chunks | Service chunk sum | Total loadSource | Independent doc hash | Whole case | Peak RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact 100k | 200000 | 29.140 | 2 | 0.364 | 44.092 | 20.811 | 215.161 | 169.258 |
| Compact 300k | 600000 | 72.123 | 5 | 0.854 | 127.638 | 55.852 | 460.880 | 301.496 |
| Python 100k | 6200000 | 47.156 | 48 | 1.575 | 75.599 | 27.952 | 331.847 | 171.602 |
| Python 300k | 18600000 | 124.025 | 142 | 3.240 | 195.040 | 86.384 | 808.558 | 379.352 |
| Unicode 100k | 6600003 | 62.979 | 49 | 4.249 | 102.713 | 35.639 | 426.110 | 183.695 |
| Unicode 300k | 19800003 | 192.117 | 145 | 10.982 | 301.956 | 101.520 | 1049.414 | 423.074 |

Longest observed service chunk durations were 0.252 / 0.506 / 0.283 / 0.281 / 0.317 / 0.418 ms respectively. Close acknowledgements took 0.082 / 0.077 / 0.075 / 0.098 / 0.092 / 0.098 ms. Whole-case time includes fixture generation, import, metrics, disk checks, the independent document oracle and cleanup in addition to loadSource; it is not the loader's elapsed time.

Document UTF-16 lengths were 200000 / 600000 / 6200000 / 18600000 / 6300001 / 18900001; every document had nominal records + 1 LF-based CodeMirror lines. Unicode had 24 / 72 explicit acknowledged shorter chunk boundaries. The profiler never changed a request or retried a refusal: the new upper-bound API returned its actual end, which the actual loader consumed. Complete byte/hash equality confirms that BOM, literal CR in CRLF, Ș and emoji were neither dropped nor normalized. The two original fixed-end Unicode failures stay adverse; this new protocol/document result does not relabel those original probes.

## Limits and process scope

The unchanged loader's source caps are 33554432 UTF-8 bytes and bounded metadata UTF-16 units, with chunk maximum 131072 units and per-request deadline 15000 ms. The actual service/pool defaults bound pending/active readers to two, with 60000 ms lease expiry. This measurement used one reader and did not exercise quota/expiry or adverse identity inputs; those belong to the separate root/independent contract tests. No limit or TTL was widened. Reader count/byte caps are not a fixed RSS bound.

Environment: Node v24.16.0, win32 x64, OS release 10.0.26200, Intel Core i9-13900HX, 32 logical processors, 34086969344 bytes RAM (about 31.74 GiB), matching prior profile hardware. Every case used a fresh Node child; peak memory came from native `process.resourceUsage().maxRSS` KiB converted to bytes plus sampled RSS. Peak covers runtime/module imports, fixture input buffer, full SourceModel/index, actual CM Text construction, temporary complete hash encoding, independent document hashing, disk checks and GC. It is not SourceReadService-exclusive, EditorView, renderer, GPU or Electron main memory.

Files were imported immediately before loading. No cold-cache control, forced GC, CPU isolation, repeated statistical sample, OS-process-to-renderer serialization/copying, EditorView creation, syntax highlighting, layout, paint, selection/keyboard handling or scrolling was measured. Typed bridge calls were real service logic in the same Node process; Electron transport is absent. Actual Text construction and loader whole-document hash are included, but this does not imply DOM readiness or interactive performance. The earlier reader-only comparison also had a different helper snapshot and workload; no memory-saving or transport-overhead percentage is derived from comparing its peaks.

## Exact source/document hashes

Expected fixture, actual input, actual document UTF-8 iterator, and original before/after blob hashes all match:

| Fixture | SHA-256 |
| --- | --- |
| Compact 100k | `660aaa8fa7ab10f125196ef272b89b4ce3830f2b2c46978ac658d3b9ac48ee6e` |
| Compact 300k | `c141d2b3dc45071a03e28382aa0fc56142b7ba38a63401381f51cb81b12a0563` |
| Python 100k | `148c9186dc5670f01ab55c04bbf8507f262ac6f194eac79a3de52fb7b0fac325` |
| Python 300k | `2c700abdb4075f6256d3322e8f07d47fa56e5703a802cf0a72433598dbdfe888` |
| Unicode 100k | `386b3738a83cbb63c8711fb23697d7c0695f9f36444fdd84d1fc61f6c412d752` |
| Unicode 300k | `18602ea7d1fba9ac7783e7ea165f04c8cc2a756830c5de2556e65ed0e750eab8` |

## Frozen identities

All 18 hashes in the matrix `beforeHashes` and `afterHashes` maps matched. Key measured inputs and artifacts:

| File | SHA-256 |
| --- | --- |
| `src/ui/code/source-loader.js` | `2e3bf966a63c17df7d1aee8cf268fddfcf44af43b45b38441cef2a061f029ab4` |
| `src/sources/read-ipc.mjs` | `1b58e7f3cf86e3b4f7be7bf1e24bd4ff22e2306a5f6543172642d39a8e107c6c` |
| `src/sources/readers.mjs` | `c68d1efea2b205caa9d710bb1f5ea944b06a290080f4d83037d8a5768c8f684d` |
| `src/sources/repository.mjs` | `af78ecd33712e94ec05385bd4d7a8ee466dbd2f52376edccb16ebd91dd5164bf` |
| `src/windows/registry.mjs` | `bf5138cf8ba028ede0b02722eece85e9185d4f1cf34c243e80e2bc3d8f8b670d` |
| Actual `@codemirror/state/dist/index.js` | `cf4ffe7d177bf2c7c5da66c49be0811cc79a29e12cb658238876bbdcef12939c` |
| Actual cluster-break runtime | `4e9e441fac9db54e09e4e3b1cb0b0393da207ebe943f2ff9efc577821fc03751` |
| Ignored driver | `3b96dff630674ddaf34acf2d640fbe1332887ecbba632f93553f0160fe5b6e9e` |
| Ignored worker | `a3ac21c7d88e8c893acfaae5e1fed1e8d7eab756d692cc75cf57c3e2858e658f` |
| Immutable matrix JSON | `9f4932c5e29b666e434592269d549077ce91c6693a71bcf6ef521ce341012d24` |

The remaining manifest entries cover TextModel, source metrics, ProjectStore/paths/atomic/I/O/budgets, source manifest validation, canonical temporary fixture helper, and dependency package manifests. This native-boundary fixture derives entity IDs from imported verified SourceRefs; it is not the live main schema-2 grant derivation or source-manifest/Docs linking implementation. Future admission must independently qualify those seams and native transport/EditorView behavior; this report preserves the exact frozen Node evidence only.
