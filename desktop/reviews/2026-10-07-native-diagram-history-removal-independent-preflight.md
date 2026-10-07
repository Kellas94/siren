# Diagram history/style removal — independent bounded preflight

Author `/root/native_menu_trace_review`, 2026-10-07. Analysis only for the plan committed as727a277. No Diagram history implementation was reviewed or approved; no product/test/build/plan/git input edits, GUI or full suite were performed. Presenter qualification and historical Diagram timeout evidence remain separate and unchanged.

## Conclusion

Exact Undo after an acknowledged Save requires an explicit typed removal operation. The existing merge-only protocol cannot represent restoration of an absent optional style property. Do not implement it by persisting defaults, null, undefined, sanitized replacement diagrams, or historical version/hash values.

Own three bounded observations, using current actual draft/repository/store and extracted hash-verified frozen functions, confirm:

1. Start with absent fontWeight/nodeStyles; add fontWeight700 and save. Empty style patch, undefined and null are refused. Setting500 and nodeStyles{} saves, but both own properties remain present. Actual source, presentation notes, other diagram and unrelated metadata stay intact.
2. Frozen normalizeFontWeight(null/'inherit') produces500 and normalizeFontFamily(null) producesInter. These are values, not deletion semantics.
3. Current draft accepts per-node fontFamily/fontWeight:'inherit', but frozen sanitizeNodeStyles omits those fields. The hidden update-style gate compares sanitized values with original values, so this is a Save refusal, not a safe persistent inheritance representation. A controlled actual draft save against that exact selected-function equality refused DOMAIN_VALIDATION_FAILED and preserved the saved entity.

The third observation is a pre-existing admission mismatch to avoid exposing in new typography controls. It is not a new native failure claim.

## Smallest honest contract

Use a finite **nonpersisted control field**, for example payload.removeStyle, under the existing update-style/replace-content/replace-deck-content actions. No new preload method, project save route or arbitrary JSON deletion is needed.

- Allow only the six properties the current draft actually owns: fontFamily, fontSize, fontWeight, diagramTitle, diagramTitleTouched, nodeStyles. Never allow source, id, name, sirenNativeVersion, presentation, presentationEdits, source pointers, arbitrary paths, classes, node metadata or opaque project fields. A later broader editable scope needs its own decision.
- Require a dense bounded array of unique allowed strings; reject extras, getters, symbols, sparse arrays, prototype authority, duplicates and a property appearing in both ordinary set values and removals. Keep the existing bounded plain-data copy and request fingerprint/idempotence rules. Omission means leave current saved value unchanged. Explicit removal means delete that own property. An absent removal target may be an idempotent no-op; define this once rather than relying on truthiness.
- Normalize/validate the removal control separately. Continue applying frozen exact-value validation to actual set values and the existing source gate. Do not send removeStyle as a value to a frozen sanitizer or persist it. A remove-only composite request must not accidentally fail the old 'source plus another key' check or be accepted as an empty arbitrary patch.
- In DomainRepository, copy the current selected entity through the existing workspace path, assign only genuine payload data, apply allowlisted deletions and apply typed presentationEdits against **current** presentation. Exclude the control from Object.assign and the saved metadata. Preserve existing per-entity CAS, request operation identity, single commitManifest, exact readback and full resulting entity hash. No special conflict retry or version rewind.
- In the draft, track a removal set alongside ordinary style values. getDiagram must clone the current acknowledged diagram, apply additions/deletions, then retain current source and typed presentation edits. Its expected receipt hash must cover actual own-property deletion. Clear removals only after the exact accepted receipt. Undo after Save changes local source/style relative to the new acknowledged baseline and uses that baseline's current version/hash/project revision.

## Node-style and imported metadata limits

Top-level nodeStyles removal is sufficient for the common originally-absent → newly-added → Save → Undo case, provided the added bag contains only managed style data. An empty map is not equivalent to an absent map; likewise an absent node entry, an empty node object and an omitted leaf are distinct states. History must preserve presence as well as values if exact restoration is promised.

For a selected block's inheritance/reset, delete only that managed leaf (fontFamily/fontSize/fontWeight or colour) from a clone, preserving its other keys and other nodes. Do not store literal inherit. Omission naturally falls back to the existing class/global/Mermaid precedence.

Frozen sanitizeNodeStyles also drops unknown nested fields. Therefore do not sanitize-and-save the entire imported bag, and do not silently delete an opaque-bearing bag through a whole-nodeStyles reset. For this narrow tranche, refuse a whole-bag removal/replacement that would discard unrelated opaque fields; or implement a separately typed managed-leaf diff and validate only changed managed values while proving all opaque siblings are retained. Prune empty containers only when the restored history state says they were absent and no opaque content remains. This is narrower than granting arbitrary renderer replacement/deletion authority.

Keep presentationEdits out of source/style history snapshots. Restoring an old full diagram would undo newer acknowledged notes/cards; replacing presentation with a sanitized old copy would lose imported fields. The existing applyPresentationEdits path already preserves unknown cards/note metadata and should remain authoritative.

## Validator/build integration and focused tests required

Changes are needed together in draft.js, normalizeDomainIntent/DomainRepository, validateDomainPatch and the generated domainHelper. Current composite splitting sends every non-source/non-presentationEdits field to update-style; it must distinguish the nonpersisted removal control. The isolated BrowserWindow transport remains finite and unchanged: no body/path authority or persistent profile is needed. The frozen R78 baseline must remain byte-identical.

Meaningful REDs before implementation should cover:

- Absent fontWeight/nodeStyles/title flags → add → accepted Save → Undo → accepted Save, exact absence and next CAS/version/hash. Redo and change-after-Undo must work without restoring old counters.
- Originally present empty map/node and nested absent leaf; reset one leaf preserves colour, sibling nodes, class maps, source pointers and opaque metadata. Refuse any reset that would erase unrelated data.
- Concurrent/same-diagram saved change, disposal/Lock/pending fences and uncertain receipt; no automatic rebase of unsaved restore. Undo after a later acknowledged presentation edit preserves that edit.
- Remove-only source/style save and combined source/style/presentationEdits save, one transaction, frozen gates/disposal still required; getters/duplicates/overlap/sparse/unknown control fields refused and control never persisted.
- Inheritance UI omits fields, validates pending values before history commands and keeps unfinished fields on refusal. Actual hidden-validator native probe remains necessary; current Node VM observations do not qualify it.

Source typography protection is currently a coarse fontDeclared flag for Mermaid config family/size; applyStyle then writes admitted family/size/weight with !important when that flag is false. Do not infer arbitrary per-node/source-class font precedence from the colour flags. The new typography tranche needs explicit source-declared family/size/weight versus global/class/block reset cases with actual Mermaid rendering.

## Scoped identities and evidence

All15 inspected inputs matched before/after the bounded probe. Full identities are in `desktop/evidence/diagram-history-preflight-independent-2026-10-07/result.json`.

| Source | SHA-256 |
| --- | --- |
| Plan | `e398ff1988041e7107c167fd066463c8120d1ea10ad742ac48a229934efa4fa9` |
| draft.js | `52c3cd19dd17d709935b1b600f02c328436c360f0dd69cf072e1f96e72754396` |
| domain.mjs | `720723ae51323c29aa07fe5262c40df8f6cdc8c8aa8b78a67f35951a17b8b0b1` |
| domain-validation.mjs | `f89fc40ed109e74876d1f3b1ada3530a9421a95d5b7b5c3b009ac4d99186b338` |
| import-validation builder | `4165c09ea6199f7a503225563f9997a163f1b46a6a6372c1d8e7683434499696` |
| Frozen R78 | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |

Own probe SHA-256 `694b387700c5344adb236f78d9a9c4e20ae8ffbb835895dd3d83e01da528d412`; result SHA-256 `80dc54e58ffccb09229d9d99c4fee3397405f696bd4fc4ed704fe7e4d0148ca7`. Status OBSERVED_CURRENT_LIMITATION; no proposed reset implementation was executed. Source/hidden-validator closure was inspected, but the bounded runtime adapter used only actual selected frozen functions, not the complete hidden BrowserWindow. Synthetic owned data is retained under the same ignored evidence directory. An initial reviewer-only extra-parenthesis syntax error is preserved separately; it failed before product execution and is not a product RED.
