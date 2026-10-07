# Presenter notes export batch — independent original review

Author `/root/native_menu_trace_review`, 2026-10-07. Verdict: CHANGES_REQUESTED for the captured publisher snapshot. This report preserves the original adverse finding; later corrections require a separate recheck. No product/test/build/workflow/git input was edited and no GUI/full suite was run by this reviewer.

## P2 — final awaited cleanup can deliver a stale success receipt

`src/windows/presenter-export.mjs` SHA-256 `266cbb6aff1e63a558c6322cce78b9ee1c6c790dcfb9166ddaf74db0faa33c3f`, lines 56–64 of retained original: publication/readback passes, receipt is recorded and retained=true, and success is returned from try. Its finally then awaits the missing temporary file ownership check. Lock or genuine Refresh can run during that await. There is no final authority/version check after cleanup, so the service delivers ok:true for the prior version after revocation. Refresh to a new version reproduces this even though its prior readback and checks succeeded.

Own exact-class-body controlled phase probe uses actual registry, PresentationSession, ProjectStore, formatter and filesystem. Only the existing ownedFile await is adapted to insert the transition. Normal control succeeds; Lock and genuine Refresh both deliver stale success. Each accepted file remains and drain is idle. The file surviving is appropriate for an already retained user file; the stale receipt delivery is the defect. No disclosure of note bodies in IPC was observed. Original captured input hashes were identical after the probe.

At the parent's request, the same scope was independently tested on actual Docs exporter SHA-256 `74bb26715bc82ee444d572e23434fdf3bc7b7f4a2363e938eda2fde7660ab850`: normal control succeeds; service pause, actual coordinator pause('Lock') and fixture lock during final temporary ownership await still deliver ok:true. Real Docs reads/store/formatter/filesystem were used. This establishes a shared delivery bug, not the cause of any hosted failure.

Requested correction: complete awaited cleanup before deciding final delivery. Recheck live grant/session/version (Docs also saved CAS/hash), invalidate stale delivery receipt and refuse stale success; preserve accepted user files. Keep cleanup uncertainty permanently fenced. Add phase-controlled regression with unchanged dependencies and real filesystem, including success controls.

## Other batch boundaries inspected

Finite formatter counts UTF-8 output before final join/Buffer allocation, preserves note text and order, rejects malformed fields/getters/duplicate IDs and enforces 600 slides/8MiB. Publisher authority comes from current genuine Presenter grant and captured session; Audience/Docs/subframes/copied senders, injected text/path and wrong version are refused. Normal navigation is intentionally distinct from captured version invalidation. Pending jobs are bounded 2 globally/1 per window; retained receipts are capped 32.

Main tracks operations in writes, refuses transition fences, pauses/joins exporter in workspace barrier, includes failed cleanup in quiescence and checks before retirement. Preload exposes only exportNotes/revealExport on Presenter pathname. Audience gets no export bridge. Controller uses captured version, rejects malformed receipt identity, hides stale Show file and joins pending work under cover. Build concatenates controller before actual window UI under exact script hash, retains restrictive CSP, has Presenter-only controls and finite module admission. Source review found no additional concrete issue in these boundaries.

The reviewed window snapshot already has interactive-target/meta guards for playback keys and serial checks after Refresh follow-up getPresenter. Earlier unguarded source was evolving before capture; it is not asserted as an adverse finding on the captured hash. No native keyboard/focus/theme/CSP execution is claimed.

## Immutable own evidence

`desktop/evidence/presenter-export-independent-2026-10-07/` contains actual original input copies plus `inputs.json` (14 exact SHA-256 values), `completion-probe.mjs`, `completion-original-result.json`, `docs-export-original.mjs`, `docs-completion-probe.mjs`, and `docs-completion-original-result.json`. Presenter original core hashes:

- Formatter `0ee4c031802088b0e2ad35ad91e29452e1b4a25d146c585304f1fb2b101dbbe8`.
- Controller `8088e0e8af8796935d6ac6a7994bc4ccbb429adac6b1355b2db7885b7a20b812`.
- Window UI `f97f0e0a8b451044e5adf8c98a8479395449bea5d718ac6cc7abdffb4cfa4879`.
- Main `5fea6af52afdb4398b536b82cda4316596e5e43a7240bbe64a241b984155c07e`.
- Preload `96a6fc49c28e042dcaef14d331726894a5df19f60bab3ea012f928b3cea30118`.
- Build `489e1b319ad1aa834703c12be6511eb6e21ea8e24eea068f70dcc64033467309`.
- Package admission `d6a6132b2d6c070875ba8c58ec74ed245bd2f17147023c3d4218644351ef47dc`.

One first Docs phase adapter omitted the required coordinator pause reason; it consequently exercised cleanup failure instead and stopped before producing a result. That original reviewer harness is preserved as docs-completion-probe-first-adapter-error.mjs. The corrected adapter produced the separately retained genuine adverse result above. This is not a product RED.

## Separate original hosted Docs evidence

Own read of retained `evidence/workspace-surface/ci37546239582/unit-job-decoded-original.json` SHA-256 `00de029593e884bc1c418b2e0551a6cd0101a52c4ad7fd324c72b9ba9fafbfb6` found exactly seven failures, all hookFailed at native-docs-export.test.mjs:18:27. Each compares expected C:\Users\RUNNER~1\AppData\Local\Temp against actual C:\Users\runneradmin\AppData\Local\Temp. Full-suite counts in that original log are tests1288/pass1281/fail7. Own extracted factual summary is docs-hosted-original-summary.json. This pins those reported failures to teardown path spelling, not publication/body failures.

Current test correction compares realpath of fixture parent with realpath(tmpdir), preserves prefix check and owned teardown, and removes inherited NODE_TEST_CONTEXT only in the child regression environment. Own focused run completed 17 parent tests including the real child alias regression; focused-original.log is retained. This does not retroactively make hosted37546239582 successful, close any original adverse report, or prove every Windows 8.3 alias environment. Full-suite/hosted/native/copied package/install/release qualification remains separate.
