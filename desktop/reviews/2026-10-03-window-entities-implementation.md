# Native window entity roster

Author: `/root/terminal_contract`, 3 October 2026. Owned scope is `desktop/src/windows/entities.mjs`, `desktop/tests/window-entities.test.mjs`, this report and ignored `desktop/evidence/window-entities/` evidence. No main/preload/registry/package/other product edits, full-suite run, native experiment or commit occurred.

`workspaceEntities(snapshot)` now returns only `{code:[sourceId...],docs:[docId...]}`. Inputs must come from the native owner's already ProjectStore-verified schema-1 or schema-2 snapshot. This helper is a defensive roster extractor, not a substitute for manifest/blob verification, caller/PIN/project/epoch checks or version authorization in main.

Code IDs come exclusively from own schema-2 `snapshot.sourceRefs` entries. Each qualifying entry has a valid native lowercase source ID, safe integer version at least 1 and lowercase 64-hex SHA256. IDs are deduplicated in first-occurrence order. It does not infer source authority from legacy Code file IDs, knowledge-row IDs, renderer caches or provenance `docId` values. Missing/malformed reference arrays grant no Code IDs. The existing manifest reference-count cap of 65,536 applies; sparse/inherited/accessor entries cannot contribute IDs.

Docs come only from the chosen active workspace's immediate `workpapers` array. Precedence is:

1. Exact own `storage['t-industries-siren-v23-state']`, parsed as object JSON.
2. Own imported `state` object when no primary is present.
3. Direct top-level workpapers.

A desktop storage bag without its primary entry fails closed rather than falling back to stale `state`/top-level data. A present invalid primary or imported state also fails closed; it never selects an old backup/cache. There is no recursive traversal of releases, drafts, provenance, nested unrelated workpapers or other storage keys. Docs IDs use the registry's legacy-compatible bounded ID syntax, including uppercase imported workpaper IDs. Source IDs reuse the stricter ProjectStore native ID validator.

Snapshot/schema/JSON must be own data fields on an ordinary or null-prototype object; supported schemas are exactly 1/2. Outer and primary JSON must parse to objects and fit the imported **MAX_WORKSPACE_BYTES = 64 MiB UTF-8** limit. Malformed input returns fresh empty arrays without throwing. Source field reads use own data descriptors, do not invoke getters/coercion, and ignore provenance/content. Parsed JSON special keys cannot introduce inherited authority. Outputs are new ID arrays only; modifying them does not mutate the snapshot or future roster calls.

The implementation was informed by actual frozen `src/ui/storage.js`, builder import handling and source migration shapes. The primary-key precedence follows the current bag path; imported `state` and direct workspace forms are explicit fallbacks, not a generic recursive search. Read hashes are retained in ignored `identities.json`; these are read-time identities, not a complete immutable branch snapshot.

## Actual verification

I used test-driven development. The implementation did not exist during the first run: **1 explicit missing-interface failure, 14 dependent cases skipped**, exit 1, **65.1074 ms**. Saved `red.log` SHA256 `ddab14901d6e84ce23637b30d7aacefc8df0505e59baedecfd73450daf464cbd`. No claim is made that the fourteen dependent cases ran before import availability.

Initial GREEN was **15/15**, zero failure/skip, **102.9338 ms** (`green.log`). Final verification additionally uses actual `ProjectStore.verifySnapshot` on schema 1 and a complete schema-2 manifest fixture with its real request-hash calculation. The empty-source fixture uses the actual empty-byte SHA256 and valid line metrics; defensive malformed-ref cases remain separate from that verification fixture.

Final command: `node --test tests/window-entities.test.mjs`, cwd `desktop`, **Node v24.16.0**. Result: **16 tests, 16 pass, 0 fail/cancel/skip/todo**, exit 0, **109.4095 ms**. Saved `final-focused.log` SHA256 `d796348bfebca4df2a268dd373afde758d0aecf300989b06303c82e9d83a4043`; tool chunk `69ca92`. Final start/end manifests confirm the same source/test and imported budget/ID module hashes across the run:

| File | SHA256 |
| --- | --- |
| `desktop/src/windows/entities.mjs` | `f85a1152def37065c69d66ca143278e82dd3da264c11a7efc8a0c4b0d28dd03a` |
| `desktop/tests/window-entities.test.mjs` | `28c0c898a2b1ad2e0315c47fab4d83e6b70577dd97b6c020bec2f6ac7439aa90` |
| `desktop/src/projects/budgets.mjs` | `daee49a88b2991356e54a9301fc121dc0b60b75ca5e870f1f9fdd2efe8bbbc1e` |
| `desktop/src/projects/paths.mjs` | `0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554` |

Tests cover actual native bag/import/direct forms, schema-1 Code denial, schema-2 deduplication and malformed refs, primary precedence, stale backups/releases/drafts and orphan provenance denial, invalid JSON/schema, getter/prototype/array-accessor avoidance, special JSON keys, frozen input/fresh output and a multibyte JSON whose character count is below the cap but UTF-8 byte count exceeds it. No content/provenance appears in the returned shape.

The frozen files are ready for independent review and native-owner integration. The caller must supply an already verified native snapshot; passing a renderer's object to this pure function does not establish authority. No source blob loading, version admission, UI content transport, native window or physical monitor behavior is qualified by this roster test.
