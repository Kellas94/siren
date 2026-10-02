# Independent review of the current desktop development batch — 2 October 2026

Reviewed local branch: `feature/portable-foundation`.
Reviewed commit: `2e5a499084c10857a45926b59603bf8aa63d76a0`.
Initial batch base: `bbe7968e916e6a9b80362da9d801e5b908a8e976`.

This is an original review of a development batch, not portable-release
certification or release admission. I read `IMPLEMENTATION-STATUS.md`, the
original `reviews/2026-10-02-foundation-batch.md`, and the relevant foundation
plan/design sections; inspected native IPC/preload/protocol, project and recovery
storage, account/update failures, renderer patches, packaging, license inventory,
and verification configuration. The frozen 13 MB baseline was inspected only at
targeted integration points; no full baseline or full diff was printed.

## Actionable findings

### 1. [P2] Successful sign-in can reload before the original project's latest work is saved

Locations: `desktop/src/ui/desktop.js:29`, `desktop/src/main.mjs:94`–98;
grant rejection at `desktop/src/main.mjs:132` and queued persistence at
`desktop/src/ui/storage.js:15`–27.

The sign-in action directly awaits `beginLogin()` and reloads on success. The
native handler clears all project grants and snapshots after account login
succeeds, without invoking the renderer close/save guard or waiting for its
persistence queue. Work edited while the browser login is pending can therefore
still be queued when the successful reply triggers reload. Any later queued
write to the original project receives `PROJECT_REFUSED`; that text exists only
in the renderer memory that reload discards. This applies even to signing in
again as the same account. Existing account expiry/logout permission tests do
not exercise this transition.

Independent reproduction uses the exact current sign-in UI callback and native
login/save handlers, the real renderer storage adapter, and real
`ProjectStore`/`RecoveryStore` files. A controlled successful account result is
injected because the production service is intentionally unconfigured. Pause
the first workspace write at `revision-verified`, queue newer text, and complete
sign-in before releasing that write. Observed: one renderer reload before native
write completion, the original grant removed, the newer write refused, and disk
readback containing only `older work`; `latest unsaved work` remains only in the
adapter's memory. The probe records the reload call rather than destroying its
VM, so it can inspect the otherwise discarded text. No live OIDC/account switch
or native UI login was performed.

Fix direction: make account switching a guarded native transition. Before
changing credentials/policy or revoking the original project grant, quiesce
editing and acknowledge the latest workspace/private-draft writes, or preserve
them through an explicit recovery/export flow. Guarding only when login starts
is insufficient if editing continues during its browser round trip. Do not
reload or clear authority after a failed save. Test both delayed writes and
edits made while login is pending.

### 2. [P2] Native workspace saves do not enforce the startup/readiness read-only state

Locations: `desktop/src/main.mjs:52`, `desktop/src/main.mjs:62`–64,
`desktop/src/main.mjs:131`–144, and `desktop/src/main.mjs:185`.

The native `canSave` callback applies `mode === 'normal'` only to the development
bypass. Its account-permission alternative ignores the startup safety mode. A
packaged process with an active account and an already selected project can
therefore accept a renderer workspace write while native mode and bootstrap
both say `readonly` after journal/process-identity uncertainty. The selected
project receives a grant and is marked opened despite that safety state.

The readiness-journal failure path also replaces only `bootstrap`, leaving the
native `mode` unchanged and sending no state update to the already initialized
renderer. A normal development session keeps its unconditional development
write permission after the handler says it has entered read-only mode. The
existing renderer bootstrap flag is not a native authorization boundary, and a
changed native bootstrap does not update the preload's existing copy.

Independent reproduction evaluates the exact main `ProjectStore` construction,
native save handler, and readiness handler against real project/recovery files
and validated `invokeDesktop()` dispatch. With `app.isPackaged=true`, active
`AccessPolicy`, startup/native mode `readonly`, and bootstrap `readonly=true`, a
workspace write returned `ok:true` and advanced the original revision from 1 to
2. With `app.isPackaged=false`, injecting a readiness-journal write failure set
bootstrap mode to `readonly` while native mode stayed `normal`; a workspace
write likewise returned `ok:true` with verified revision-2 readback. The account
policy is a controlled active fixture, not production activation. These are
source-level native service integration probes, not Electron exploit or
Windows process-inspection qualification.

Fix direction: keep the native safety state authoritative for original
workspace writes, separately from account entitlement and the permission to
recover into new copies. On readiness failure, update that state and inform the
renderer. Test attempted original writes in startup read-only mode with an
active account, and after readiness failure in development and packaged modes.

## The original four findings are repaired in this candidate

- Required credential module: `scripts/package.mjs:11`–17 explicitly permits
  runtime source modules before secret-input filters, and the completed archive
  has `src/account/credentials.mjs`. The inspected current archive contained 26
  runtime source modules whose bytes matched current source. The package test
  also exercised the credential-module filter.
- Private Code recovery acknowledgement: `build/renderer.mjs:32`–43 now marks
  asynchronous writes pending and settles stored/failed only on the current
  receipt. The existing real-build integration test passed delayed, rejected,
  and superseded-write cases. The original false `stored` receipt was not
  reproduced.
- Separately chosen damaged project: `src/projects/selection.mjs:6`–16 grants
  validated owned selection before entering explicit recovery after read
  failure. Its integration test passed damaged A chosen from healthy B,
  verified recovery into a new copy, retained original bytes, and junction
  refusal. Main uses that helper at `src/main.mjs:118`.
- CI repository paths: `.github/workflows/desktop-verify.yml:4`, 15, 24 and 65
  consistently refer to the repository-root `desktop/` tree. This is source
  verification; I did not dispatch or independently inspect GitHub CI.

## Other checks and review limits

Node `v24.16.0`, from `desktop/`, executed exactly:

```powershell
$testFiles = (Get-ChildItem -LiteralPath tests -Filter '*.test.mjs').FullName
node --test --test-skip-pattern='actual 180-second callback deadline' $testFiles
node evidence/independent-current-review-2026-10-02/probe.mjs
```

The test run executed **72 tests: 72 passed, 0 failed, 0 cancelled, 0 skipped**,
duration 6479.1504 ms. The name filter excludes the one real 180-second OIDC
callback-deadline test from execution/census; this was not a full 73-test run.
The supplied CI run `37004902564` and supplied actual packaged restore/copy
results are coordinator evidence, not independently rerun evidence from this
review.

Focused probe source and final output are retained under
`desktop/evidence/independent-current-review-2026-10-02/` as `probe.mjs` and
`result.json`. The initial archive extraction attempt used forward-slash input
that the Windows ASAR extractor rejected; after correcting the probe to its
platform path format, extraction and byte comparison succeeded. That probe
formatting failure is not an application module omission.

Independently inspected the existing package
`desktop/dist/development-194c2d8c-ccce-4772-886c-c1f4f75c813a/`, whose identity
records the reviewed commit. Its archive SHA-256 matched the recorded value
`c521caca5a2b0bab653cacf157efaff2a4dd21c43c16c0147eb42d5a6ea796c1`.
I did not rebuild or launch it. The inventory independently returned four MIT
production npm packages, 780 Chromium components, zero remaining relative-only
notice references, and the exact-revision `better_any` supplement. The copied
packaged supplement's hash also matched provenance. This verifies inventory
mechanics and copied notice identity, not completeness of legal obligations,
embedded renderer coverage, or upstream provenance through an independent
network fetch. Inventory and package identities still explicitly deny release
qualification/admission.

Existing path/junction, IPC, crash-phase, recovery, and update-failure tests
passed. I did not reproduce another material containment or update-receipt
issue in the inspected paths. This does not qualify Windows handle/reparse
races. Existing negative update checks cover outage/rate limit/404,
invalid/short package bodies, cancellation, damaged trust state, and unsafe
destinations; they do not qualify production update application or rollback.

Reviewed product source/build/scripts/tests/licenses and workflow had no content
diff from HEAD at probe time. `provenance.json` initially appeared modified in
status, but its Git blob hash matched HEAD and there was no content diff. No
implementation file was changed by this review.

Launcher/helper, apply/rollback, signing-key rotation, production issuer/feed
and renewal/revocation integration, complete licensing/security qualification,
OS chooser cancellation, removable-drive power loss, further crash-phase
coverage, cross-user credentials, and a clean supported Windows 11 PC remain
documented open work. Their absence is not recast as a regression in this batch.
This review provides neither a whole-release PASS nor public-release approval,
and makes no claim of a human reviewer identity or release receipt.
