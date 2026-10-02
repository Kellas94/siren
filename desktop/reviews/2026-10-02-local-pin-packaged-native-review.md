# Independent local-PIN packaged native review — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. Only the two assigned native tests and separate reports were edited by this reviewer. The packaged native test and original evidence are preserved. No product/driver edits, WAC bypass or local Rust compilation were performed.

**Disposition: the recorded development package passed the adapted actual native packaged test. This is scoped local PIN/save/recovery/copy/safety evidence, not a production portable release admission.**

## Executed artifact

Package root: `desktop/dist/development-c322ffbd-3889-465d-b590-0548d6a962b5`. The existing build receipt identifies actual committed source `332551613e8e5cfa3015a5a15b7d20a22cc58450`, kind `development-preview`, and `releaseAdmitted:false`. The probe verifies the copied application archive hash before launching and the copied runtime binary hash afterward.

| Identity | Value |
| --- | --- |
| Renderer SHA-256 | `240a2b60f014d2be861c608b265e024b91373c12dfdda6fd580b4ff2abc2aca6` |
| `app.asar`, 14,276,435 bytes | `d0504ea20af8408d1a31ee5c8588a7d6b793f7b3702670c8d2d3c13502efeca6` |
| Electron runtime, 245,726,208 bytes | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Final reviewer-adapted `desktop/tests/native/packaged.mjs` | `856447dce1b8044a0380316ae6433a0c5c4eb4266a8b26a67ca7d2f7e5a851e6` |

The final test corrections occurred after the package source commit; they do not alter its archive. Product source changes made afterward require a new package and separate recheck.

## Independently executed outcome

`node tests/native/packaged.mjs <the package root above>` completed with exit 0 and `completed:true`: `desktop/evidence/packaged-2026-10-02T17-25-48.838Z/`. All operations occur in owned copies, not the original package or user project Data.

- Raw packaged startup exposes a locked bootstrap with null snapshot. A valid save request using the known selected fixture project ID returns the authoritative `PIN_REQUIRED` code and leaves its disk hash unchanged. `window.require` is absent and the supplied development-only test-root argument is ignored.
- Explicit fixture authorization calls `unlockDesktop(driver, {pin:'4826',autoSetup:true})` through production native setup/unlock receipts, then reloads. The packaged renderer becomes editable without an online account and displays the exact owned Unicode fixture source.
- A real packaged native workspace save acknowledges a new revision/hash. Disk readback matches the exact saved JSON, revision and hash, and a matching verified saved recovery checkpoint exists. The initial fixture hash is `42a9805241863d9b0a6ac9061cf634cf21dbf7753ca530a76f4a0695d5e350de`; the acknowledged save hash is `5cb37760438521f6d87bd4a60c66cceb46c5f5d8d4ac7f827e40e8e215f26342`.
- An actual pointer click selects that matching recovery checkpoint and opens a different project. The recovered source, immediate recovered JSON/hash and acknowledged original snapshot are exact. Recovery does not replace or modify the original.
- Moving/copying occurs only after the app acknowledges a normal exit and the native journal records `clean-close`. An editable recovered workspace may serialize its renderer storage envelope on that exit; the recovered source remains exact. The original remains byte-for-byte/snapshot-equal to the acknowledged save. The second Unicode folder copy retains the actual acknowledged normal-exit recovered snapshot exactly.
- Fresh process startup in the copied folder relocks, exposes no snapshot and refuses a known recovered-project save with `PIN_REQUIRED`. Native `4826` unlock without setup succeeds on this same Windows installation; recovered source and copied snapshots remain exact. The copied runtime binary matches the receipt.
- A third owned copy has a deliberately damaged native session journal. After a correct fixture PIN it remains in native `readonly` mode and refuses workspace saves with `ACCESS_REFUSED`. Both the acknowledged original and the recovered copy remain unchanged. A correct PIN does not override the existing native safety authority.
- The native Desktop UI reports updates as unconfigured. No update installation claim is made.

## Retained failures and test-boundary corrections

Two prior executions against this same archive remain retained as completed:false evidence, not deleted or rewritten:

1. `desktop/evidence/packaged-2026-10-02T17-22-57.047Z/` failed the exact recovered-source assertion while the new bootstrap was already present but the frozen renderer had not initialized its source. Adding the same updated-brand/actual-SVG readiness boundary already used at initial startup fixed this observation race. The fixture and exact source assertion were not changed.
2. `desktop/evidence/packaged-2026-10-02T17-24-04.885Z/` passed source, initial recovered JSON/hash and original-preservation checks, but later compared the editable recovered project's post-exit hash to its pre-exit legacy JSON. Disk inspection showed the normal acknowledged close had serialized a `siren-desktop` storage envelope with the exact source; the original still had its exact saved legacy JSON/revision/hash. The test now captures the actual acknowledged normal-exit recovered snapshot, validates its source and compares that full snapshot across the folder copy. It still checks exact original preservation at restore, exit, copy and safety boundaries, and exact recovered JSON/hash immediately after restore. This is an explicit expected state transition, not a relaxed source or original-preservation assertion.

The save fixture deliberately exercises native JSON save/readback; it does not claim complete renderer draft/private-Code adapter coverage. The earlier readonly-only packaged expectation no longer describes the user-authorized local-PIN-first behavior.

## Limits and later candidate

The coordinator subsequently identified an omitted `localAccess:true` field in the separately picked damaged-project selection branch and is preparing a new package. That specific selection flow was not part of this successful run; this report does not approve its correction. This report retains the old package/source binding and requires a separate recheck of the new artifact.

These runs demonstrate this Windows installation, owned fixture PIN, Unicode package copies, local save/recovery and native safety. They do not qualify another Windows account or clean PC, encrypted project contents, a hostile administrator, every private Code workflow, every PIN/race/cooldown scenario, production online activation, signed update/apply/rollback, launcher hostile-race closure or a production release. Original launcher and access reports retain their independent scopes.
