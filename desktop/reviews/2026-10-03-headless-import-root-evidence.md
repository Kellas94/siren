# Headless import and package dependency correction — root evidence

Author: root implementer, 3 October 2026. These are root-run tests, not independent approval or release admission.

Explicit native import now validates in an on-demand hidden sandboxed Electron entry rather than executing the workspace renderer. The build retains the frozen dependency closure, disables workspace startup, uses hashed inline scripts and denies network connections. Both doors share the same helper calling `validatePortableProjectForImport`, `prepareProjectWorkpapers` and `stampWorkpaperFileSignoff`. Selected bytes are copied, UTF-8 is validated, filename is a basename rather than path authority, scope is rechecked around awaits, and the hidden window/renderer must actually close before validation is acknowledged. No Home or source grant is installed there. Production Home/coordinator-backed navigation remain open.

The app renderer is byte-identical after helper extraction: SHA-256 `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93`; baseline remains `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`. The build receipt adds the separately hashed import entry; package admission adds only its runtime modules/entry plus the previously omitted `src/sources/readers.mjs`. A new closure test failed on that real omission before passing with the correction.

## Preserved adverse observations

First native probe at `evidence/headless-import/2026-10-03T08-05-45.606Z`: root runner exit1/ADVERSE, hidden entry ready, `IMPORT_DISPOSAL_FAILED`, no completed cases. Electron itself exited0 before the probe's intended final exit because the last-window auto-quit was unhandled; exit0 was not accepted as success. The product incorrectly required synchronous webContents destruction. A named delayed-destruction control also failed RED. The correction waits for confirmed native destruction (bounded10s), and the probe keeps its sequential hidden-window lifecycle alive until final oracles are written. Later native evidence directly shows webContents were still alive at `closed`, then emitted `destroyed`.

The intermediate completed probe used a nonexistent `#diagramHost` selector for its empty-preview count. That preview assertion is withdrawn: zero matches proved nothing. Its other exact source/provenance/storage/destruction assertions remain narrower evidence. The final probe requires the actual `#diagram` host to exist and have zero children. No historical result was rewritten.

## Final actual native probe

`node tests/native/headless-import.mjs` — exit0, COMPLETE, four cases, frozen captured inputs unchanged, owned PID36496 exited. Evidence: `evidence/headless-import/2026-10-03T08-16-03.801Z`.

- A valid Sequence import preserves the exact independent source, keeps the file's reviewer/digest assertion as imported provenance, and retains the forged incoming signoff only in opaque as-written history. A fresh native ProjectStore reads the imported copy exactly.
- Internal-cache masquerading as export, invalid Mermaid, and malformed diagram records are refused.
- Four real hidden windows have sandbox/contextIsolation, no Node/preload/workspace bridge/bootstrap, ephemeral partition, empty localStorage, a real empty preview host, and confirmed window plus renderer destruction. The original project is unchanged; remaining windows0.
- Electron44.5.1 / Chromium152.0.7977.130 / embedded Node24.21.0. Native validator uses existing dependencies only.

Final native result SHA-256 `7086a1e5504e6bc86bc887725831d5702a4a9e50f4f59047845f097a53f4193b`; outer result `cffb63e90129851401b99e5630d594f940938f6048f14fd25a5f8644c774c9ee`; prepared input record `b88d188873b6335993402233f0d6563fa9f388ece43015738bb5ef9a178c460f`. An exact PID census for35932/39816/36496 found none remaining. OS file-picker interaction, 64MiB valid-import performance and packaged hidden-import execution are not qualified by this probe.

## Full frozen unit/build batch

Actual extracted current CI unit step: `evidence/home-import-suite-step.ps1`, run through owned pwsh7 by `evidence/home-import-suite-runner.mjs`. Start08:17:37.495Z, end08:21:12.048Z. **465/465** total: native identity2/2 (32299.4983ms), remaining463/463 (181339.2491ms); aggregate exit0, zero failed/skipped/cancelled/todo, all captured product/build/test/script/workflow inputs unchanged. Log SHA-256 `ad2d7306eefdf28969ac1e149a6ad01aa1e99b5383285b4ea5aee650e3209fae`. Local tests use Node24.16.0. Earlier focused actual-main/import/save/package checks34/34 and metadata/source/domain checks98/98 passed.

The workflow adds the actual headless native probe and retains its nested result/identity/log artifacts. Hosted CI29's427/429FAIL remains historical; no local result relabels it. A new committed-source package and hosted qualification are separate. No main merge or public release.
