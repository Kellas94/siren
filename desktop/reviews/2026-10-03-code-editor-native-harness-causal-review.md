# Isolated Code editor harness startup: first failure and causal diagnostic

The first six-case native attempt was **ADVERSE**, exit 1. Every fixture failed before driver attachment at its unchanged approximately 30-second discovery deadline. No editor input, history, search, Save, or reopen operation ran. This is not native editor qualification, and the original matrix remains failed.

Evidence: `desktop/evidence/native-source-editor/2026-10-03T05-51-37-135Z/result.json`, SHA-256 `9f0d8522d6e8949c172b11d26f5eaf646898edc057ce754d5311e018edd4f61e`. All captured source/build/package/driver bytes, the probe, and bundle were unchanged. The six independently owned fixtures were compact, 61-character Python-like, and Unicode/BOM/CRLF sources, each at 100,000 and 300,000 lines; their initial bytes match the earlier profiles. No production main or user data was activated.

Each failure was `No owned Electron page`, with empty Electron logs and discovery `fetch failed`. An owned-process observation found the actual Electron process alive, responding, and without a window title. The ignored ESM entry held module evaluation with top-level `await app.whenReady()`. The retained working native candidate harness completes entry evaluation and registers `app.whenReady().then(async()=>...)` instead.

One separately authorized causal diagnostic changed only that ignored entry to the continuation form and ran the first compact-100,000 fixture once. The bundle, driver, deadlines, fixture bytes, and native source-module inputs stayed identical. It completed with actual Electron **44.5.1**, Chromium **152.0.7977.130**, and Electron Node **24.21.0**; the outer probe used Node **24.16.0**. A real sandboxed, context-isolated BrowserWindow was pinned and activated by the real WindowRegistry. Genuine IPC events supplied sender/frame authority to SourceReadService and an owned SourceRepository. No NativeWindowDouble was used.

The corrected entry attached in 308.644 ms. Native openRead took 27.733 ms, two bounded readChunk calls succeeded, and closeRead succeeded. The actual EditorView contained 200,000 UTF-16 units, 100,001 lines, and 200,000 UTF-8 bytes, with 36 rendered lines. Its complete SHA-256 matched independently generated original bytes: `660aaa8fa7ab10f125196ef272b89b4ce3830f2b2c46978ac658d3b9ac48ee6e`. This controlled result confirms the isolated entry/app-ready ordering cause. It does not establish product regression, input correctness, or Save qualification.

Diagnostic evidence: `desktop/evidence/native-source-editor/2026-10-03T05-51-37-135Z/diagnostic-entry-continuation/result.json`, SHA-256 `80e27c97d0d3e0681a6a8e40fc2b337ab00fb12d6e722cfd8ee829732ddb1dc6`.

| Identity | SHA-256 |
|---|---|
| Original ignored entry | `80be66582a0e9a90c9bfec7da9acbf2651b5ee3676267283064d9db0ba40cb3b` |
| Continuation-only entry | `48f4710d4d0c5286468bad7206dd1e4ecb5e3aa857692d5df925c42b8ca050db` |
| Original product editor bundle, 485,042 bytes | `af2a957d7d1ef0a77415b2341c4f2e05710a97e63c1a1b91518ea51cc5e7560f` |
| Adapter represented in that bundle | `cfedf6fec2982f4c10e66417ea8e5ac79203746c22b5a49d25ced9cd41992f54` |
| Editor wrapper represented in that bundle | `0b265aab4b7ca3dccf35c857890208cf98635b3acabe000bd3db4d22d79b3e5a` |
| Unchanged native driver | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |

Both diagnostic receipt facts and scoped process cleanup are retained. A subsequent corrected functional matrix needs a fresh, explicitly frozen product bundle; its result must be reported separately. Production Code-window shells, all-window Lock, Docs, PIN, packaging, and native workspace integration remain outside this review. No tracked product or existing test was edited.
