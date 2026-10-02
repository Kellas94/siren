# Desktop foundation — development evidence, 2 October 2026

This branch implements an isolated Electron desktop prototype from unchanged R78
(v1.131.0; baseline SHA-256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`).
It is **not an admitted portable release**. No live HTML, public binary release or
production account service has been replaced or published.

Implemented: sandboxed local renderer/validated IPC; local revisioned projects;
explicit full-project import and saved backups; verified recovery into new copies;
private Code draft persistence; guarded close; OIDC/PKCE integration, signed
30-day permits and current-user protected credentials; exact-byte signed update
verification, anonymous GitHub discovery, bounded staging, cancellation and daily
checks; Desktop controls, Find commands, native menus, Guide and Quick Tour.

Evidence is local and scoped. Selected Node integration run 9 completed 71 tests
with no failures. The later full CI-reproduction run completed all 72 tests,
including the real 180-second OIDC callback timeout, in 180.8 seconds with no
failures, cancellations or skips. The private draft implementation is PR #2.
Remote CI exposed test fixtures using Windows's short TEMP alias (`RUNNER~1`)
as an owned project path; product guards correctly rejected it. Test-created
roots now use their real filesystem paths, keeping junction/alias rejection
unchanged. The subsequent CI qualification is pending.
Actual Electron probes exercised
keyboard edits, redraw, disk readback/restart, corruption recovery, real private
Python drafts, full .siren export, Dark/Warm Light controls and current-user DPAPI.
Failed probes are retained; earlier renderer hashes do not qualify later builds.
Guide verification exposed and fixed a tour card clipped by the desktop footer.
Screenshots are inspected, not accepted from selector presence alone. The independent
batch review on commit `837db24` found four real bugs; the original report remains
in `reviews/2026-10-02-foundation-batch.md`. Subsequent commits repair the missing
packaged credential module, premature Code recovery acknowledgement, inaccessible
recovery for a separately chosen damaged project, and CI root paths.

Packaged run 6 used source commit `224fb324d0ddd7f281660fb41bb5e64c8a7f812e`,
renderer SHA-256 `b2d5ae84c8032cff8c3e623cbede9a29d11930c4336e9d1e00b30f19d08d151f`,
and app.asar SHA-256 `811bf8b3cb562cfe76fd28084b1192f1d4ae957018fc3cc90e17bda968ac9573`.
The actual SIREN.exe launched from a Unicode folder, denied unactivated workspace
writes, visibly applied read-only mode, restored a verified new project through
the Recovery button and retained the same project bytes after copying the folder.
This was one current Windows machine, with an owned synthetic fixture, not a
clean-PC or production-login/update qualification. Runtime binary was copied
unchanged; development ASAR inputs are outside the package root.

Still open:

- Native launcher/helper, archive apply/rollback and signed-key rotation.
  Local Rust installer execution was blocked by Windows Application Control;
  no compiler test or policy bypass is claimed.
- Production account backend, renewal/revocation integration, signing keys and
  public update feed. The user confirmed no account service exists yet.
- Complete license/security qualification. The inventory includes four production
  npm dependencies (MIT) and 780 Chromium notice entries. `better_any` has only an
  unresolved upstream license reference; embedded renderer notices need review.
- Actual OS chooser cancellation, Windows reparse/handle races, removable-drive
  power loss, detailed startup/checkpoint crash phases, second clean PC and
  cross-user credential portability.
- Genuine independent whole-release review and release admission. Coordinator
  reports, labels and hashes are never substitutes for original reviewer receipts.
- Large-source scalability. Existing Code limits and T256 are unchanged.

Build with Node 24.16.0 and the committed npm lock; generated output, profiles,
toolchains, credentials and local evidence are ignored. Development package
identity explicitly records unqualified account, feed, inventory and launcher.
