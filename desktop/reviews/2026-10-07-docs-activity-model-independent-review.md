# Docs Activity pure model — independent original review

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07.

Scope: `src/documents/document-activity.mjs`, its browser build wrapper, scoped model tests, and the approved Docs Activity plan. Source/probe review only. No controller/integration, GUI/native, build execution, full suite, packaging, commit or release assessment. I made no product/test/build changes.

This is an **original snapshot review**, not a final frozen review. Root's expected metadata-alias additions changed model and tests during the review. My original model is retained byte-exact under `evidence/docs-activity-model-independent/original-document-activity.mjs`; my separate adversarial probe imports that retained file. I inspected the subsequent diff: additional recorded metadata keys and nested provenance/fingerprint projections, without modifying comparison or lookup. I did not qualify the later alias implementation or claim its tests as my execution.

## Finding R1 — minor: unsupported entries escape the page character accounting

Priority P3; `src/documents/document-activity.mjs`, original line 43 / alias snapshot line 44.

The fallback field for a non-record entry is appended directly rather than charged to `rowChars`. Eight comments with four fields of 4,096 characters each consume the exact 131,072-character page allowance. Twelve following `null` entries each add a 48-character fallback message, yet the page still returns all twenty rows and `nextCursor: null`. Actual output field text is **131,648 characters**, 576 above the declared cap. This fixture is ordinary JSON and does not require accessors or prototypes.

The defect is a small bounded accounting violation, not evidence of unbounded processing or data loss. All rows remain accessible and originals remain unchanged. Count the fallback message through the same row/page accounting path; when it does not fit, leave its source position for the next page. Add a regression with saturated valid rows followed by malformed entries, also checking pagination retains the first deferred source position. The defect remains in the later alias snapshot inspected here.

## Independent evidence and other observations

I executed `node --test tests/docs-activity.test.mjs`: **15 passed, zero failed/skipped**, output retained in `scoped-tests.log`. These are my actual model test results, not root's earlier RED/GREEN history. The test set includes real build-wrapper injection in a Node VM; this is not a generated browser/native build execution.

I separately executed `node evidence/docs-activity-model-independent/probe.mjs` against the retained original model. It reproduced R1 and verified:

- Complete opaque `__proto__`-named nested source-reference changes produce `changed`, while malicious-looking valid IDs retain identity.
- Frozen inputs can be compared without mutation; nested object key ordering does not manufacture a change; block reordering is still reported.
- A getter is never invoked and complete comparison refuses it; excessive depth is refused.
- Filtered source pagination across 1,025 comments scans 256/256/256/256/1 positions and returns the exact matching source position 1,024 once, without treating source count as filtered count.
- The budget fixture's original JSON is byte-identical after projection.

Code inspection also confirms complete comparison validates array containers, rejects cycles/non-JSON values and own descriptor anomalies, charges the aggregate UTF-8 representation across both sides, and returns failure rather than partial equality. No material canonical-comparison defect was found in this bounded review. Pointer-value equality is not represented as underlying source-byte or execution equivalence.

**Lookup caveat, not promoted to a demonstrated native defect:** `locate` ignores sparse entries and accessor-backed array entries. A regular matching block plus a getter-backed second entry yields `{ok:true,index:0}` without calling the getter, so its uniqueness proof concerns descriptor-readable IDs, not arbitrary hidden getter results. The probe preserves this observation. Such accessor/sparse containers are not ordinary imported JSON; no evidence supplied here shows them admitted into the native saved-document path. If lookup is intended to defend arbitrary in-memory malformed containers as strictly as comparison, explicitly refuse non-data entry/ID descriptors and anomalous containers. I do not claim a source-reference bypass or actual wrong native jump from this observation.

The model is projection-only and has no mutation bridge. It does not stringify unsupported objects or invoke imported value coercion. Unsupported/future values are displayed as inert unsupported messages and remain in preserved data. Options are an internal caller contract; this review does not claim resilience to active JavaScript Proxies or malicious caller-supplied option getters.

## Input identities and retained output

Before/after maps are retained in `evidence/docs-activity-model-independent/inputs-before.json` and `inputs-after.json`.

| Input | Before SHA-256 | After SHA-256 |
|---|---|---|
| src/documents/document-activity.mjs | 40f7df461f575afd9c8424ef5a8150c161ddd9b5cb13efc5b54fc7b171283254 | 138829b4b43f10275f4cf94f50738bc4155ad05cca7d794afd7e25f0c8a65937 |
| build/document-activity.mjs | 663faf06a90707605fccb259bd7ee74ff71f883bf6ce79a866f817fe10ebb113 | unchanged |
| tests/docs-activity.test.mjs | 1b6474e1e547f8cab0eba87652030b5fccb7931b2bf555c3b2b167d5595f65db | 903dcc429f50fc48c0f761e1345bdfa89d9ba76a4b2f91c1fac254b91a3aef0a |
| docs/superpowers/plans/2026-10-07-siren-docs-activity.md | b68ac909dd724f97e480d882f7db29ce519b2ca5a2c98292ccd5cd74e4ed7a55 | unchanged |

Reviewer evidence SHA-256:

- `probe.mjs`: `a146b93d1c0bd1d405bf32b573177b08925b0aa6117c62f3b1389c9072513dcb`.
- `probe.log`: `b81aeda5dabc712acd9efd81ee1ce66b16bd97c1ab3fa97e743753eec7344ebc`.
- `scoped-tests.log`: `14f5364aa7252c45c226f141a70fd5319d3bc721dd9881bc4829e73758fd87ba`.

No Important user-facing defect was established in the inspected pure-model scope. R1 remains a concrete minor correction, and this report makes no whole-batch/native approval claim.
