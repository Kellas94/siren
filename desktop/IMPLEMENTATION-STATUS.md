# Desktop foundation — development evidence, 2 October 2026

## Code window navigation follow-up

The native Code window already had minimise/maximise, movement, resize,
transparency, keyboard commands and a restore tray. Opening it from the Code
library left that full-screen section visible and the diagram workspace inert.
The original actual-pointer regression failed after minimising. The desktop
build now closes the library when the floating window opens or restores;
minimising leaves the application available and keeps the exact Python draft.
The frozen renderer remains unchanged.

The full 83-test suite passed after this repair. Actual Electron probes verified
minimise/restore, two windows, maximise geometry, drag, resize, transparency,
keyboard minimise, right-click commands, Dark/Warm Light and private draft
recovery after restart. A separate reviewer reproduced the focused probe and
the renderer SHA-256 `a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e`;
their original report is `reviews/2026-10-02-code-window-navigation.md`.
This is scoped development evidence, not whole-release admission.

`../SIREN-Development.cmd` provides a double-click entry to the local editable
checkout after the documented setup. It is distinct from the portable native
launcher and uses `.dev-data/`. The native launcher is being compiled/tested in
private hosted Windows CI because the local Rust installer was denied by Windows
Application Control; no local policy was disabled or bypassed.

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
unchanged. The subsequent full CI run passed all 72 tests and generated the
same renderer hash. Its native stage failed because a fresh npm installation
did not contain Electron's executable; explicit pinned runtime installation
has now been added to CI and the development setup instructions. Run
[37003615939](https://github.com/Kellas94/siren/actions/runs/37003615939) then
passed all steps on Windows Server 2025: 72 tests, guarded renderer, actual
Electron isolation, current-user protected storage and packaged recovery/folder
copy. This is CI development evidence, not qualification on a second supported
Windows 11 PC. Remote screenshots were retained, not independently inspected here.
The supplemental-license CI run
[37004902564](https://github.com/Kellas94/siren/actions/runs/37004902564)
passed all steps, including 73 full tests. The current transition-repair batch
has 83 full tests; the local 81-test full run passed before the final timer/cache
deltas, and 82 selected tests passed after those deltas (the real 180-second case
was excluded by name). Private CI
[37009751476](https://github.com/Kellas94/siren/actions/runs/37009751476)
passed all 83 tests and the renderer, actual sandbox, protected-storage,
account-guard and packaged recovery/folder-copy probes. It used Windows Server
2025, not a second clean Windows 11 PC; its screenshots are retained but were
not inspected here.
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

The next original review, `reviews/2026-10-02-current-batch.md`, found two more
real problems: successful sign-in could discard queued late edits, and native
startup/readiness read-only mode could still permit original workspace writes.
The repairs preserve old-account authority until the final renderer flush is
acknowledged; credential changes happen afterwards. Editing is temporarily
inert/locked during final commit. Failed login/logout does not reload. Native
safety remains authoritative across recovery selection, and readiness failure
updates the renderer too. `reviews/2026-10-02-current-batch-recheck.md` is the
reviewer's separate recheck, with service/VM evidence and exact source hashes;
the coordinator did not replace the original report or author a release PASS.

Actual renderer guard testing found a further false autosave error caused by
a pending timer after the final flush. The failed toast-observer probe is
retained. The final guard cancels save/draft timers and paused callbacks return
without touching live controls. Native guard run 4 then verified Python private
draft readback/checkpoint, blocked keyboard input, safe resume, an unavailable
login that leaves editing usable, and runtime read-only UI. Its two screenshots
were inspected. This directly invokes the final guard, not production login.
Final Code run 2 separately verified Python structure, private recovery without
implicit Docs save, native Quit acknowledgement and restart. Both use renderer
SHA-256 `91e3e20e4c6772c2abda15db0c0bcdb4c5f1af67b8ad5d8fb8290e833fecade9`.

The same reviewer subsequently reproduced an old-account timestamp write
overwriting successfully switched credentials. This additional finding is
preserved in the separate recheck report. Credential read/verify/cache writes,
final activation commits and logout now share a native queue. Browser login and
the renderer flush stay outside that queue, since saving revalidates access.
Both delayed-login and delayed-logout regressions failed before the fix and
passed afterwards using real owned files and a controlled test codec. These
tests do not certify production account deployment or real DPAPI failures.
The reviewer authored `reviews/2026-10-02-account-cache-recheck.md` separately;
its real-file probes verified the repair, queue recovery after errors and a
native save that rechecks access without deadlock. No report admits a release.

The final local preview was built from `88d92eaac151772a4e8c056b1cc9c5f662aceb18`;
its archive SHA-256 is
`45e581575850d113d7e9297f5e4601efb46f93a6597f0ef7f53ec34de5c9dd46`.
Actual package launch verified sandbox/inactive-account write refusal, explicit
new-copy recovery preserving original bytes, and restart after a Unicode folder
copy. Both local screenshots were inspected. Two earlier local probe failures
are retained: Windows reported the owned window hidden and suspended animation
frames until screenshot capture. The native driver now uses Chromium's documented
test-only occlusion switch; the packaged application is unchanged. DOM hit tests
remain strict. That run does not qualify native Windows occlusion behavior.
Follow-up CI [37010798911](https://github.com/Kellas94/siren/actions/runs/37010798911)
passed all 83 tests and development probes but failed the package folder copy:
the old driver killed only the browser parent and Chromium still held a network
temporary file (`EBUSY`). This is retained as failure. The package probe now
requests native Quit, waits for process exit and requires the final session event
to be `clean-close` before copying. The new close assertion failed against the
old driver (`ready` was last), then the unchanged local package passed complete
restore/clean-exit/folder-copy/restart with the repaired probe. Final CI is pending.

Packaged run 6 used source commit `224fb324d0ddd7f281660fb41bb5e64c8a7f812e`,
renderer SHA-256 `b2d5ae84c8032cff8c3e623cbede9a29d11930c4336e9d1e00b30f19d08d151f`,
and app.asar SHA-256 `811bf8b3cb562cfe76fd28084b1192f1d4ae957018fc3cc90e17bda968ac9573`.
The actual SIREN.exe launched from a Unicode folder, denied unactivated workspace
writes, visibly applied read-only mode, restored a verified new project through
the Recovery button and retained the same project bytes after copying the folder.
This was one current Windows machine, with an owned synthetic fixture, not a
clean-PC or production-login/update qualification. Runtime binary was copied
unchanged; development ASAR inputs are outside the package root.

Current Code follow-up (2 October 2026): opening an editor from the Code library
now closes that library's inert overlay. Minimising returns to the usable main
workspace; restoring retains exact draft bytes. Actual local pointer/keyboard
probes passed minimise/restore, maximise/restore geometry, move, resize,
transparency, multiple windows and right-click commands. All 83 foundation tests
passed against renderer SHA-256
`a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e`.
The original independent scoped report is
`reviews/2026-10-02-code-window-navigation.md`; it does not admit a whole release.
A separate real diagram-edit probe verifies native save with Code minimised and
exact Python restoration, without implicit Docs publication. The current package
from commit `a92692f523e8664fab24e0862a1b7fcc5c7db006` also passed recovery,
clean Quit and Unicode folder-copy/restart. CI run 13 failed a theme-option hit
check after the menu opened. That failure is retained; the probe now waits for
actual visible hit readiness and emits failure geometry. Its CI rerun is pending.
`../SIREN-Development.cmd` opens the editable development build; packaged previews
retain the activation write guard while the account service is unconfigured.

Still open:

- Native launcher/helper, archive apply/rollback and signed-key rotation.
  The first development-only launcher compiled with Rust 1.99.0 in private
  Windows CI, run 37020405429: 10 selection tests, 2 actual native launch tests,
  1 production publisher-refusal test and 7 attachment tests passed. The release
  binary is 465,920 bytes, SHA-256
  `6dde7374e965dcef44d730f1bc4a08042fab77b5873cc14fa96292edc2b5bfc2`.
  Authenticated source/receipt mapping is independently recorded in
  `reviews/2026-10-02-native-launcher-ci6-observation.md`. The two attachment
  findings were independently rechecked; hostile directory-member insertion and
  production helper/apply qualification remain open. Local Rust installer
  execution was blocked by Windows Application Control; no policy was changed.
  Actual released-launcher integration exposed lossy ASCII process identities
  in Unicode folders. A real Windows Unicode Node process test failed against
  the old inspector and passed after explicitly emitting UTF-8. Recovery tests
  passed too. The rebuilt package and final CI are pending; earlier failed
  integration and UI CI evidence is preserved.
- Production account backend, renewal/revocation integration, signing keys and
  public update feed. The user confirmed no account service exists yet.
- Complete license/security qualification. The inventory includes four production
  npm dependencies (MIT) and 780 Chromium notice entries. `better_any`'s reference
  now has an exact-revision supplement bound to the unchanged runtime notice;
  embedded renderer and distribution obligations still need review.
- Actual OS chooser cancellation, Windows reparse/handle races, removable-drive
  power loss, detailed startup/checkpoint crash phases, second clean PC and
  cross-user credential portability.
- Genuine independent whole-release review and release admission. Coordinator
  reports, labels and hashes are never substitutes for original reviewer receipts.
- Large-source scalability. Existing Code limits and T256 are unchanged.

Build with Node 24.16.0 and the committed npm lock; generated output, profiles,
toolchains, credentials and local evidence are ignored. Development package
identity explicitly records unqualified account, feed, inventory and launcher.
