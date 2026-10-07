# Independent parser, copy and route review

Author: `/root/native_menu_trace_review`, 2026-10-07 (Bucharest). Reviewed other authors' parser/copy and root's main/status/catalog/package integration. I did not approve or independently review my own metadata helper. No product/root test/generated inputs were edited for this review, and no GUI or global suite was run. Two changes were requested against the captured inputs below; subsequent corrections need separate rechecks.

## Findings: changes requested

**P1 — Ordinary legacy source-bundle import bypasses the native readonly creation gate.** At captured `src/main.mjs:316`, `importCurrent` accepts the captured mode rather than requiring normal mode and `nativeReadonly:false`. The new copy primitive owns its stores and uses its supplied current guard; it cannot inherit the global `projects.canSave` denial. Therefore the actual legacy chooser service can create and select an external schema-2 copy during a native safety readonly state. Home explicitly refuses this operation in readonly/recovery, and legacy JSON import still refuses creation through the global store.

My bounded actual-service probe reproduces this difference through real `invokeDesktop`, the extracted actual chooser and actual selection/atomic writer: readonly source-bundle import creates **one** project and changes the selected pointer; readonly legacy JSON control creates **zero** and returns `OPERATION_FAILED`. Selection remains readonly, so this is a creation-gate regression, **not** a claim that safety was cleared or original content changed. Preparation and hidden metadata validation are controlled boundaries in this probe; actual parser, copy, source/recovery stores and writer are used. Root subsequently confirmed the intended policy is the normal import gate, not an authorized recovery bypass. Require that gate before ordinary import selection and at its continuing authority checks, with an actual-service readonly/recovery regression. Root reported a correction after the reproduction; this original finding is not rewritten as approval of that correction.

**P2 — A failure after completion-marker rename reports a durable complete copy as incomplete.** At captured `src/navigation/source-bundle-copy.mjs:72–75`, a post-rename/readback-hook error returns `ok:false`, `BUNDLE_COPY_FAILED` and `incompleteProjectId`, even when the `complete` status marker was already published. My actual atomic-write probe interrupts `after-rename` only after the final checkpoint/catalog stage. The result names an incomplete copy, but actual status is `complete`, the exact saved checkpoint verifies, `assertImportComplete` accepts it, and Home catalog discovers it.

This does **not** expose partially copied bytes: source/manifest/checkpoint verification preceded the marker. It is a contradictory committed-state result that can mislead failure/recovery reporting and retries. Reconcile the actual owned marker/readback after an accepted publication; if authority is revoked, retain the committed copy unselected and report its actual completed/uncertain state rather than an unconditional incomplete identity. Keep pre-publication failures quarantined. Add an actual post-rename regression distinct from the existing before-rename final-marker failure test. Root assigned this correction to the copy author.

## Boundaries reviewed without a new defect reproduced

The parser validates exact declared bundle/schema fields, original manifest/request/metadata hashes, one-to-one complete references/provenance, canonical base64 and predecode aggregate/per-source bounds, then actual bytes and metrics. Native chosen bytes are owned independently of decoded sources. Invalid declared bundles do not fall back into the legacy path. Metadata admission is metadata-only; the native copy re-verifies the parsed bundle and exact original pointer graph after that await. This report does not approve the semantic coverage of my own helper.

Copy identities are locally generated. Distinct original versions/identities retain separate new version-one references and full provenance, including equal bytes. Remapping includes native source/base pointers in parsed storage without granting filesystem authority. The copy writes only the fresh project and keeps the supplied genuine global recovery source reader, avoiding false corruption of existing checkpoint catalogs. It reopens every copied source and requires the exact saved checkpoint before attempting its complete marker. Failed allocation is retained; there is no destructive rollback or source cleanup addressed by imported IDs.

The incomplete marker precedes initial placeholder manifest publication. Root invokes its status gate at startup, Home open, legacy folder open and catalog discovery; malformed/oversized/mismatched status fails closed. Complete status is bound to the selected manifest or genuine selected ancestry after a later save. Absent status is the documented ordinary-project case; this review did not simulate external deletion of a quarantine marker or catastrophic filesystem metadata loss.

Home captures its import epoch before preparation and permits exactly its own preparation increment; another preparation/Lock rollback cannot be adopted as a new authority. Legacy scope is captured before chooser and read/admission, after its own all-view preparation. Copy guards latch revocation. Main IPC blocks access/selection transitions during a selection transaction; close is delayed. Guarded final session-pointer publication refuses before rename, tracks the accepted write for drains, finishes genuine post-rename readback/state handoff, and exposes uncertain selection in readonly recovery on a post-rename error. Package allowlists include new admission/status/parser/copy modules. No packaging or actual UI behavior is qualified by this static review.

## Executed evidence and limits

Own probe: `evidence/source-bundle-copy-route-independent-2026-10-07/probe.mjs`; complete receipt under `2026-10-06T21-05-35.514Z/result.json` (UTC, already Oct 7 locally). Its three cases preserve original project snapshots, run no GUI and confirm captured product inputs were unchanged during the probe. The first execution reached its assertions but failed in my catalog fixture's extra unsupported `locations` field; those owned data files remain retained. The corrected probe uses a fresh timestamp directory and the genuine finite catalog record. That harness correction is not a product fix.

I also ran the bounded focused existing parser/copy/selection tests: **27/27 passed**. They cover bytes/provenance/version fidelity, unsupported raw encoding, budgets and malformed sources, graph substitution refusal, incomplete states/checkpoints, global recovery isolation, selected ancestry and actual atomic session-pointer fault semantics. These passes do not negate the independently reproduced missing readonly gate and post-marker contradiction; those scenarios were outside the existing tests.

No native GUI, packaged import, global full suite or hosted CI was run for this review. Root's concurrently owned actual native runs, including any forced-kill/restart adverse evidence, are separate and are not classified here.

## Exact captured identities

```text
src/main.mjs 1107a877064de2d81a1abeaee6c90e7b6a85a84859bba53c445387aebdbb73c8
src/navigation/source-bundle-copy.mjs a85b1adc01ec485bcce83f37d86da84beff63048fb4f42a85dc9be0b804164f9
src/sources/bundle-import.mjs 551dc265aae802b35e46e9bc5fab44f8adbbe35a8157166facc2ef60cda20345
src/projects/import-admission.mjs 13131f80a2a7cc96a15e683256c0df6631d045cac9b5702ba4672a35290ff491
src/projects/import-status.mjs 720e3de3fa3fa3574a37bb9f30322d4ac331d6b2403d436cb412251bff5818e5
src/navigation/catalog.mjs dc0ca149d425b1debc1f0350301b5b801775e03649ae7e10a4de3d9bd09181c5
own probe.mjs 4e678fe30127838d8c76e10855308b7ba574c33c585290b47422a771de11574f
own result.json 8c001fd99a935daffc464e03566987db18cb555dc59d74113a2bc07ba2514ffd
```
