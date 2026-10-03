# Isolated native source-backed Code editor qualification

The repaired isolated source editor passed **6/6 actual native functional cases**, exit 0, using the same functional probe and oracles that previously failed all six Find cases. This qualifies the measured isolated EditorView/source boundary only. Production main, Code-window shells, all-window Lock, Docs linking/Save, PIN, and packaged admission were not exercised.

Passing evidence: `desktop/evidence/native-source-editor-functional/2026-10-03T06-01-55-047Z/result.json`, SHA-256 `ffd96a681aa2c8af5952ba27c6c86b0b2cd080dc88d2ab6e4ee4ca718ebb1047`. All captured source/build/package/native-driver bytes, functional probe and bundle were unchanged before/after this run. Native BrowserWindows were real, sandboxed, context isolated and without Node integration. The actual WindowRegistry captured native workspace sender/frame grants. One isolated IPC channel invoked SourceReadService/invokeSource and actual SourceRepository instances against six independently owned projects. Renderer requests contained source IDs and typed operations; project authority and filesystem roots came from the native fixture, not renderer fields. No NativeWindowDouble or production main was used.

The preserved sequence is:

1. First harness attempt: **six startup failures**, unchanged 30-second target-discovery deadlines, before any editor operation. Ignored ESM entry held module evaluation with top-level `await app.whenReady()`.
2. One separately authorized continuation-only startup diagnostic: the same old bundle attached, loaded a real compact-100k EditorView and matched its complete original hash. This resolved the harness cause; the original matrix stayed failed. [Detailed causal review](2026-10-03-code-editor-native-harness-causal-review.md).
3. First corrected functional attempt: **six Find failures**, after exact full model/input/history/paste verification. Immediate search input plus Enter left the EOF caret instead of selecting the known match. No Save or reopen ran. [Preserved adverse review](2026-10-03-code-editor-native-find-failure-review.md).
4. Owner repaired the product query listener to attach to the editor root, which includes the search panel. One unchanged functional matrix against that frozen changed bundle passed all six exact match selections and subsequent operations. There was no unchanged retry, added search delay, weakened oracle or timeout increase.

Each passing case verified initial complete UTF-8 bytes/hash, native `Input.insertText` including emoji, actual toolbar Undo and Redo, actual middle clipboard Ctrl+V paste with multiline text, EOF insertion, and complete independently computed hashes after every mutation. Find input followed immediately by Enter selected the exact EOF marker range. Theme and Wrap controls dispatched successfully, with theme data and wrap aria-state verified; this does not independently certify painted colors or wrap geometry. Save source produced one genuine native `committed` receipt at version 6. A fresh Node repository then exported byte-for-byte independently expected content, preserved the original v1 source/blob and ProjectStore snapshot, and the actual disposed/reopened EditorView matched the saved full hash. Final disposal removed the view.

| Fixture | Open ms | Input ms | Undo ms | Redo ms | Middle paste ms | EOF input ms | Find ms | Save stage ms | Native commit ms | Reopen ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Compact 100k | 71.90 | 187.72 | 216.96 | 216.33 | 213.27 | 201.54 | 36.34 | 155.32 | 96.68 | 74.95 |
| Compact 300k | 134.30 | 428.07 | 310.07 | 314.79 | 429.93 | 403.50 | 60.29 | 322.64 | 178.97 | 205.00 |
| Python 100k | 116.00 | 280.03 | 248.70 | 254.86 | 452.28 | 425.28 | 401.09 | 337.21 | 155.27 | 238.59 |
| Python 300k | 257.00 | 642.31 | 581.61 | 599.17 | 934.32 | 804.46 | 947.26 | 723.85 | 381.35 | 553.57 |
| Unicode 100k | 180.40 | 277.41 | 269.54 | 255.74 | 446.87 | 407.72 | 417.28 | 337.61 | 176.95 | 238.91 |
| Unicode 300k | 376.20 | 735.90 | 737.96 | 732.02 | 959.16 | 1017.35 | 1104.57 | 750.89 | 447.71 | 752.23 |

Open is a renderer clock around verified load and EditorView construction. Action stages include native CDP interaction, asynchronous durable draft acknowledgement, the unchanged driver's 100-ms polling, and complete model hashing. Native commit time is independently recorded inside the isolated main handler around invokeSource. These are single samples per action/fixture, **not input-to-frame latency or p95 measurements**. No `<=100 ms` interactive latency requirement was established; the largest measured action stage was 1,104.57 ms for Unicode300k Find. Case wall times ranged from 1.73 to 8.50 seconds. No latency threshold was relaxed.

Original readChunk counts were 2/5 for compact, 48/142 for Python, and 49/145 for Unicode at 100k/300k, each capped at 131,072 UTF-16 units. Full-model Unicode retained literal BOM/CRLF and valid emoji boundaries. On reopen only 66 visible/overscan lines were rendered for each full source. Fixture byte sizes were 0.2/0.6 MB compact, 6.2/18.6 MB Python, and 6,600,003/19,800,003 Unicode. Each project remained within the unchanged 256-MiB retained-source budget; this run does not admit arbitrary larger fixtures, every offset, queue saturation or write-fault handling.

| Fixture | Browser peak through Save MiB | Renderer peak through Save MiB | One Save snapshot: all app process working sets MiB |
|---|---:|---:|---:|
| Compact 100k | 274.11 | 181.51 | 697.38 |
| Compact 300k | 381.22 | 223.67 | 841.55 |
| Python 100k | 336.37 | 255.01 | 745.23 |
| Python 300k | 499.13 | 412.85 | 817.17 |
| Unicode 100k | 359.96 | 277.58 | 793.63 |
| Unicode 300k | 748.07 | 430.96 | 1142.39 |

Memory comes from actual Electron app.getAppMetrics sampled after opening and after Save. Windows working-set sizes are converted from KiB to MiB. Per-process peakWorkingSetSize values can peak at different times and are **not summed as a simultaneous peak**. The final column sums workingSetSize values returned by one Save observation; it includes app-owned processes such as browser, renderer and utility/GPU, excludes the outer Node probe, and is a snapshot rather than a lifecycle peak. No post-reopen aggregate peak was sampled. These native process measurements differ from earlier Node-only RSS profiles and do not establish a production memory budget.

Actual native runtime receipts reported Electron44.5.1, Chromium152.0.7977.130, Node24.21.0. Outer Node was24.16.0 on Windows10.0.26200, i9-13900HX/32 logical CPUs and 31.74GiB RAM. A supplementary after-run executable digest is retained; no pre-run executable digest was captured, so executable byte invariance is not claimed beyond the captured package inputs and actual runtime receipt.

| Final measured identity | SHA-256 |
|---|---|
| Bundle, 485,311 bytes | `71c00ab24f7ad5d6d173bdd521f857f1efda7827d9b836f06143aa8a7d5dd661` |
| Editor wrapper | `1fdb622f657fa901c49e075127dfc11d31229d98693409721f914468404c71d2` |
| Adapter | `6645f2b481199d3f5ffe46d2d0665da428c79c198efbc302e19b435575d68fbd` |
| Patched Python module | `594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589` |
| Build seam | `86d7ef62e9a9185d170a16976cb8231c4d92d9131486dac6cf3d3338e92d9a98` |
| Unchanged native driver | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |
| Same functional probe for Find RED and repaired GREEN | `d0786e98d00fb0055fffb7b4834d687cd652794bae2aca83f2aea340f2d49af7` |

All final sources were v6 with `committed` blob receipts. Independently expected saved hashes were compact100k `434fbefb33c9e64d86c2233c49f7746e50bba76b3b8502cfa815d029cafdf83d`, compact300k `f697f6e9aaa07636ddd78b9e20777e3b93787cc3705041a8187c11b584d8e0cc`, Python100k `73baa68278e2e10ea8ff2274df8137f4e29ceaef473f4397b73b577deb7f72a7`, Python300k `300c1cad88714a25180b6d36f0865fc708e3ceb2dc4cb7d85d1b417ff11f05e9`, Unicode100k `57ada01d0cd10cb948d2f5de0ae912eb65a68be026ae3405e480adfd85b95c1a`, and Unicode300k `b7a2c1cfad5a5127aa7105c2ed8b23f5b66df0ab6ba726f956fb2d090dc48593`. Native receipt, actual complete model, and fresh disk matched each hash and all expected bytes. Save refers to source blob persistence; ProjectStore snapshot preservation proves no linked Docs/selected-manifest commit was implied.

All six owned drivers/windows closed. Scoped CIM verification found **zero owned Electron processes remaining** after each completed matrix; no unrelated process was killed. Synthetic clipboard contents were restored on normal owned-window close without recording prior clipboard text. Original six startup failures, one causal diagnostic and six Find failures remain immutable.

A portable extraction candidate is prepared at `desktop/evidence/native-source-editor/large-source-editor-candidate.mjs`, SHA-256 `207e710c6f971e34ecb8b9aa0405c9c0b070303506dbb60c9eda26200e546ee7`, intended for `tests/native/large-source-editor.mjs`. It derives the desktop root from import.meta.url, uses relative imports, creates unique ignored evidence, preserves the unchanged native driver, explicit native allowlist and six functional oracles, and asserts the six original known fixture hashes. Default execution prepares and runs once; `--prepare` and `--run <printed path>` separate fixture freezing from native execution. It was **syntax checked only** at its ignored path; it has not itself been admitted by a native run after extraction. Root must review/copy/freeze it and qualify that tracked test separately. No tracked product or existing test was edited by this reviewer, and no full suite was run here.
