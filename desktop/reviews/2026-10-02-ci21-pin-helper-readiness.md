# CI21 native PIN helper readiness

Scope: reviewer-owned `tests/native/drive.mjs` and `tests/native/dev-first-run.mjs`, observational owned native evidence, and this report. Product first-paint changes belong to root. This is not a CI21 or release approval.

## Original adverse evidence

CI21 run 37043937173 / job 110960561112 reported `Native PIN bridge unavailable` at `unlockDesktop`, before fixture setup. The full original log is retained at `portable/.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/ci21-failure.log`, SHA-256 `67bcc70f2a1b73f11700b878c18ae5b0a2f21d84fcf6292e05958486f878b618`. Downloaded artifact ZIP hash supplied by root: `b194d9b9a518d548e6f88de4342f7f7f88cdbda65007d7b5820d75414bf7ee04`.

The downloaded `desktop/evidence/ci21-downloaded/evidence/dev-first-run-2026-10-02T18-02-06.532Z/result.json` has SHA-256 `1f9b13cf2cfa6af7281731f6156a44b15bab7e7e23edb49b6574a341ac2f4eb3`. It records renderer `767a4cbc1803aa5009c8b9b86e5ce20469ea20defdf8d30ef3019272ad65075c`, the missing-bridge exception, and a populated app DOM afterward. Its failure screenshot visibly contains the baseline source/preview UI, without a desktop bar or PIN screen. Neither URL, bootstrap, nor bridge state was recorded after the exception. The Electron log contains only DevTools startup, with no reported preload error.

These facts establish the native helper failure and visible fallback app at failure capture. They do not establish whether a transient default execution context or persistent missing preload caused the original bridge absence. This review does not claim about:blank was observed in CI21, or that waiting necessarily repairs its unknown cause.

## Investigation and bounded qualification

The unmodified local native test passed at `desktop/evidence/dev-first-run-2026-10-02T18-05-47.427Z`. The existing driver already discovered only a page whose target URL was exactly `siren://app/app.html`; changing target selection was therefore unwarranted. Preload exposes `sirenDesktop`, obtains the synchronous native bootstrap receipt, then exposes `sirenDesktopBootstrap`. Authentication previously assumed those operations were complete immediately after CDP attachment. Its reload predicate also accepted an absent bootstrap because `undefined !== 'locked'` is true.

An observational probe, `desktop/evidence/ci21-cold-context.mjs`, attached to the first actual page on three fresh owned launches without injected navigation, authentication, bootstrap, storage contents, or renderer timing changes. All three first observations at `desktop/evidence/ci21-cold-context-2026-10-02T18-07-26.728Z/result.json` had the real app URL and `document.readyState='loading'`, but already had a native bridge and locked bootstrap. It did not reproduce CI21.

The helper now calls exported `waitForDesktopStartup(driver)` before native PIN operations. Its existing 30-second driver bound requires the real app URL, native getPinState function, a recognized native bootstrap mode, readonly Boolean, and actual PIN configuration/lock Boolean fields. Failure reports the last observed URL, document readiness, bridge type, and bootstrap receipt. A persistent missing preload remains a failure rather than a bypass. Post-unlock reload now requires an actual normal/readonly/recovery bootstrap with PIN unlocked, never an undefined mode. Recovery/read-only startup authority remains observable.

The dev-first-run test records its initial CDP context and qualified first app entry; it asserts the real URL, initial locked mode, withheld snapshot, and unconfigured fresh owned PIN before explicit fixture setup. Failure stdout and retained result now include URL/bridge/bootstrap diagnostics. `launchDesktop` still never auto-authenticates. Caller-supplied PIN and explicit `autoSetup:true` remain required for fresh fixture setup. No product or storage fixture patch was made.

## Final local native result

The final actual dev-first-run test passed at `desktop/evidence/dev-first-run-2026-10-02T18-11-38.660Z/result.json`, owned project `d8ca4c0d-21dd-4c1b-b1b9-3d231e40c9ea`, renderer `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`. It recorded the real app URL, native bridge, locked bootstrap with null snapshot and unconfigured PIN, then actual setup/unlock receipts and reload to a normal editable owned project. Actual private Python entry, floating Code minimise/restore, Guided keyboard edit, native acknowledged save, and exact native source/private-draft readback passed. The result binds main/preload/helper/test source hashes.

Main SHA-256: `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63`. Preload SHA-256: `198353950873f884d48604e0238e3cf270412da2679666b2c7238b70d89f9206`. Helper SHA-256: `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`. The baseline hash remains `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`.

Syntax and scoped diff checks passed. This is local native qualification with stronger bounded readiness and diagnostics. The exact CI21 preload/context cause remains unresolved; the next genuine CI result must qualify it. Guided intro first-paint diagnosis and repair are outside this report.
