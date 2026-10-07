# Independent Help catalog review — 2026-10-07

One original P2 independently reproduced; closed on current exact bytes. No remaining actionable finding in the reviewed pure scope.

Scope: `src/help/catalog.mjs`, `src/help/resolve.mjs` and their two focused tests. Approved spec/plan were read; only new reviewer reports were written.

## Original finding retained

**P2 HELP-CATALOG-P2-001 — closed on current bytes.** Required own data properties could be non-enumerable. The validator accepted them, while the resolver copied with JSON.stringify. Independently making only unknown-error.id non-enumerable returned validation `{ok:true}`, get(unknown-error) `null`, unknown resolve `undefined`, and an undefined search ID. No getter was invoked and no global prototype mutation was needed.

Original reproduction:
```js
const input=structuredClone(HELP_ARTICLES); const a=input.find(a=>a.id==='unknown-error'); Object.defineProperty(a,'id',{value:a.id,enumerable:false,writable:true,configurable:true}); const r=createHelpResolver(input); // original: validation ok, get unknown null, resolve unknown undefined
```

The owner required enumerable===true for every required object data field and added a regression for article ID, mapping namespace and flow label. The original RED receipt fails with true !== false; GREEN is 12/12. Reviewer independently reran 12/12 and exhaustively refused 549 non-enumerable required object properties plus 549 accessor variants with zero getter calls. The resolver is unchanged. This closes the pure data defect; no native integration claim follows.

## Independent results

- Original focused run: 11 passed, 0 failed. Current focused run: 12 passed, 0 failed.
- Original adversarial run: 10 groups passed, alongside the separate adverse descriptor reproduction. Current adversarial run: 11 groups passed.
- All 59 exact namespace/operation/code identities resolve correctly; namespace, operation, case and NUL mutations return the generic article.
- Extra fields, own toJSON, symbols, accessors, sparse arrays, unexpected prototypes, malformed paths and oversized prose are refused. Null-prototype data identities and non-enumerable array indices retain their correct values.
- Flow checks reject cycles, disconnected nodes, duplicate edges, missing targets and invalid starting order. Snapshot article/mapping/flow data stays frozen and independent from caller edits.
- HTML and regex input remain literal searches; this does not test a renderer.

## Source-backed advice

src/navigation/backup-export.mjs:49-50 reports EXPORT_COMMITTED only after publish returned ok and caller access changed. Advice preserves saved backup.

src/windows/diagram-catalogue.mjs:69-83 appends first and attaches opening result separately; src/ui/diagram/catalogue-view.js validates creation/current/opening independently. Advice preserves created diagram and retries opening same operation.

Source import uses repository MAX_SOURCE_BYTES (32 MiB); backup wireLimit is 64 MiB; preview rejects source length above 50000.

All 59 code literals exist in at least one declared source (focused test). Not a proof of future UI operation identity wiring.

## Exact inputs

| Input | Original SHA-256 | Current SHA-256 |
| --- | --- | --- |
| `src/help/catalog.mjs` | `a6669721aad3804dad19a7efc4ff04e5eacc22f1aa037a6586137c164b00c912` | `a420ccca79919af4f7c520429f9c202476f1b0af7c465ab5177b0cbf84138b80` |
| `src/help/resolve.mjs` | `1f4fb1d20623851c19af39c5e7e9ed03e4ce348f323c55d8aa2d02d037f4bb3f` | `1f4fb1d20623851c19af39c5e7e9ed03e4ce348f323c55d8aa2d02d037f4bb3f` |
| `tests/help-catalog.test.mjs` | `542fb34f662492139605f7327590f3457bff1385ff65db75d67d81f7a3b704d1` | `3d6985c624c443688be7280698bfbdd468b17cfdf9a1842b244663ab9e5ef42d` |
| `tests/help-resolve.test.mjs` | `db36a6fabad50834f85399b8d807737f0bfb0307d9e17b3edbdadc5765d43780` | `db36a6fabad50834f85399b8d807737f0bfb0307d9e17b3edbdadc5765d43780` |

Current source/test/support inputs and all 26 declared source reference hashes stayed unchanged during the final own probe. The JSON contains complete before/after hashes, including the approved documents and retained RED/GREEN receipts. Only catalog.mjs and help-catalog.test.mjs changed from initial review to owner repair.

## Limits

- No product or existing test files edited by reviewer; only these new independent report files written.
- No GUI, Electron, IPC caller, native menu, Lock clearing, accessibility, focus, packaged runtime, generated artifact, installer or release validation performed. Native Help UI is not part of Task 1.
- Literal search and schema checks do not prove future renderer uses safe textContent. No HTML was rendered in these probes.
- Catalog source references are static local application content; resolver does not grant write/repair/execution authority. This is not a general validation API for hostile JavaScript proxies or mutated built-in prototypes.
- No complete application-suite claim is inferred from 12 focused pure tests.
