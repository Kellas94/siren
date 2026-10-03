# First functional native Code editor matrix: Find failure

The corrected isolated harness's first functional matrix was **ADVERSE**, exit 1. All six actual native cases failed the full-model Find oracle. For compact-100,000, entering the synthetic EOF query with `Input.insertText` and immediately pressing Enter should select `[200041,200071]`; actual selection remained the EOF caret `[200071,200071]`. All six cases showed the same caret-versus-match failure. No delay, driver timeout, oracle, or input sequence was changed, and no retry ran against these bytes.

The first attempt is retained in `desktop/evidence/native-source-editor-functional/2026-10-03T05-58-35-716Z/result.json`, SHA-256 `b0a8a816125a2b5239e16170c2fc69d2f002d880038953dba744b61af7c899a5`. Captured source/build/package/driver inputs, probe, and built bundle were unchanged. Each case used its own synthetic ProjectStore project, actual Electron 44.5.1 BrowserWindow, actual WindowRegistry native sender/frame grant, typed SourceReadService and invokeSource, owned SourceRepository, sourceClient, patched Python grammar, and actual CodeMirror EditorView. Production main and production Code-window shells were not activated.

Every case passed initial complete model SHA/byte verification, native `Input.insertText`, toolbar Undo and Redo, actual middle clipboard paste with Ctrl+V, and EOF native input. After every change the full model matched independently generated expected UTF-8 bytes/hash; Unicode sources retained literal BOM, CRLF and emoji. Native durable draft versions reached 6, with no pending writes or fence at failure. Theme/wrap, Save source, and dispose/reopen were sequenced after Find and were therefore **not reached**.

| Fixture | Verified source open ms | Input ms | Undo ms | Redo ms | Middle paste ms | EOF input ms | Case wall ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Compact 100k | 72.80 | 189.90 | 220.95 | 215.44 | 211.90 | 206.52 | 1443.09 |
| Compact 300k | 128.60 | 400.13 | 312.25 | 313.86 | 425.53 | 401.48 | 2359.58 |
| Python 100k | 119.80 | 280.59 | 258.17 | 260.21 | 450.87 | 407.92 | 2138.69 |
| Python 300k | 257.60 | 623.02 | 557.71 | 608.22 | 935.99 | 821.76 | 4502.93 |
| Unicode 100k | 184.10 | 280.95 | 409.80 | 271.62 | 454.24 | 410.14 | 2451.08 |
| Unicode 300k | 370.10 | 736.88 | 724.62 | 740.97 | 933.81 | 1006.72 | 5276.72 |

Action timings include CDP interaction, durable draft acknowledgement, the driver's existing 100-ms polling, and complete document hashing. They are not direct keyboard-to-paint latency measurements. Opening is measured inside the renderer around verified source load plus EditorView construction. At EOF only 66–67 lines were rendered from the full 100k/300k models.

A separate read-only disk audit reconstructed expected text independently and verified all six current v6 draft blobs byte-for-byte, preserved the v1 source and original blob, and preserved every ProjectStore snapshot. All source commit heads remained null: no Save/commitSource acknowledgement was produced. Audit: `disk-audit-after-failure.json`, SHA-256 `ec5664ac36e6658382cef00de12d1abbcd41fea3993bd79597f3bfdf74142291`. This checks draft persistence, not source Save qualification or a linked Docs commit.

The wrapper had installed its query `input` bridge through EditorView.domEventHandlers. The installed CM view routes those handlers through editor content; its search panel input is outside contentDOM. The installed search panel commits queries on change/keyup. Thus the immediate Enter keydown can see the previous query. The actual EOF-selection failure is consistent with this concrete route defect; a product repair and a separately frozen follow-up are required.

| Measured identity | SHA-256 |
|---|---|
| Bundle, 485,269 bytes | `adc9afa16b5e044a9daca728059cdd9df45d6e348928caf6d561869f79e20aa6` |
| Adapter | `6645f2b481199d3f5ffe46d2d0665da428c79c198efbc302e19b435575d68fbd` |
| Editor wrapper | `d936b0e7c19d5dad37738f2b06cb474f8541784ce3c1ba3c9c6626ab51dafd9b` |
| Build seam | `86d7ef62e9a9185d170a16976cb8231c4d92d9131486dac6cf3d3338e92d9a98` |
| Native driver | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |

Native app.getAppMetrics captured opening-stage process memory, including per-process peak working sets through that observation. For Python300k the renderer opening peak was 240.02 MiB and main opening peak 341.02 MiB; Unicode300k renderer opening peak was 279.23 MiB. No measurement of the entire mutation lifecycle peak was taken. Native Electron Node was 24.21.0; the outer probe used Node24.16.0 on Windows10.0.26200, i9-13900HX/32 logical CPUs and 31.74GiB physical RAM. These native figures cannot be equated directly with earlier Node-only profile RSS.

All six owned windows/processes closed, and a scoped CIM cleanup observation found zero owned Electron processes remaining. No tracked product or existing test was edited. Prior startup failure and its continuation-only causal diagnostic remain in the separate [harness review](2026-10-03-code-editor-native-harness-causal-review.md). Actual production workspace integration, all-window Lock, Docs, PIN, packaging and Code-window shell admission remain open.
