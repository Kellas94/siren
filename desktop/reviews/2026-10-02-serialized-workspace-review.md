# Serialized workspace bound review

Author: `/root/launcher_implementation`, independent read-only review of the coordinator's patch. No product/test edits, new full suite, native launch or packaging run. This is not release approval. The coordinator's prior RED/GREEN and ongoing full-suite outcomes are not reattributed to this reviewer.

No must-fix was found in the changed serialized-size path by source inspection. The raw accepted workspace limit remains 67,108,864 UTF-8 bytes. The common record limit is 134,283,264 bytes: twice the raw limit plus 65,536 bytes of metadata. For valid JSON source, outer JSON-string encoding can double quote, backslash and permitted control-whitespace bytes. Lone UTF-16 surrogates become six ASCII escape bytes instead of three replacement UTF-8 bytes; ordinary multibyte characters do not create a larger multiplier. The metadata allowance covers the existing fixed native envelopes, including the allowed 200-character label with six-byte control escapes. Actual serialized bytes are independently checked, so optional extra metadata cannot bypass the cap.

`ProjectStore.commit` now validates the snapshot and serializes/checks the entire record before writing a revision or publishing `current.json`. Revision readback, pending listing/acknowledgement and pruning share the same serialized limit. `preservePending` checks the complete pending envelope before its atomic write. Recovery checkpoint serialization occurs before the point file is written; point verification, scanning and damaged-point export use the same bound. Existing `RecoveryAccess` uses a numerically equivalent 128MiB + 64KiB limit. Empty owned directories may be created before rejection; the patch does not claim that no filesystem operation happens before preflight.

IPC now imports the raw workspace constant without importing ProjectStore, so the new budget module does not create an IPC/store import cycle. Exact IPC payload keys, sender checks, PIN authority, raw byte counting and object-only JSON validation remain in place. This changes accepted storage-envelope capacity, not raw import size, login authority, Code limits or the recovery catalog's separate 16MiB limit.

The new positive fixture independently derives an exactly 64MiB raw JSON string, uses escaping-heavy source and a maximally escaped label, and asserts that the selected revision exceeds the old 128MiB threshold. It checks fresh-store create/save reads, pointer hash, pending content and a recovery read. The negative revision test verifies exact unchanged pointer bytes and revision filenames; the negative recovery test verifies unchanged point filenames/catalog bytes and no new invalid point. These are meaningful boundary and adverse-state assertions, rather than testing only the presence of a limit constant.

Low-priority coverage suggestions, **not blockers found in this patch**: add exact serialized-limit versus limit+1 assertions, a multibyte/lone-surrogate fixture, and a direct oversized pending-envelope refusal assertion. Existing negative tests already cover the publication failure mechanism for revisions and checkpoints. Large records still require substantial memory for parse, stringify, buffers and readback; the fix does not provide streaming or general hundred-thousand-line scalability qualification.

Scope limits: atomic IO failure after a rename, crash/power-loss recovery, hostile concurrent modification and broader snapshot/directory identity constraints are not newly qualified here. The size preflight specifically prevents publishing a record that the configured reader must reject for its size. No additional claim that every possible failed write preserves the pointer is made.

Reviewed SHA256 identities:

| File | SHA256 |
| --- | --- |
| `desktop/src/projects/budgets.mjs` | `daee49a88b2991356e54a9301fc121dc0b60b75ca5e870f1f9fdd2efe8bbbc1e` |
| `desktop/src/projects/store.mjs` | `3aa5ed291ac65a87753865e5ef7ca009930bddec43cf10caa2c1bf2df2411bc2` |
| `desktop/src/recovery/checkpoints.mjs` | `8a5a00f1fc7afee9b07a6525c701fa392130cb5b2b909d6fe0c65e8edcda4fe5` |
| `desktop/src/ipc.mjs` | `08cf59def87cbaea267c5950a3beb5e83b06a9e4ca75b6b40b04fa05ef0b01a0` |
| `desktop/tests/serialized-workspace.test.mjs` | `926fd683f728d050c96218e91a4bd056828d4c2a34e7047f3c7e59d1e43df775` |
