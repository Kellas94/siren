# Independent desktop foundation batch review — 2 October 2026

Author: `/root/review_portable_foundation_batch`, independently delegated reviewer.
Reviewed commit: `837db24471f53c4b74f1fb7b903239fe56bf81d6`.
Base: `e3f6197480297a9d1b3fe0abecc44bcd82eebbf0`.

This reviews a private DEVELOPMENT BATCH, not a completed portable release or
release admission. I read `desktop/IMPLEMENTATION-STATUS.md`, foundation plan v2
and design spec v4; inspected main/IPC/preload/protocol, project storage/recovery,
account credentials/permits/OIDC, signed update discovery/staging, renderer storage
patches, packaging and verification configuration. Baseline inspection was targeted
to `desktop/baseline/R78.html`; its private Code draft contract matters below.

## Actionable findings in the reviewed candidate

### 1. [P1] The development package excludes a module required at startup

Location: `desktop/scripts/package.mjs:12`, also the filter at line 38 and the
static import in `desktop/src/main.mjs:20`.

`allowedAppFile()` applies its `credentials[^/]*` secret-file deny pattern before
the runtime source allow rule. Consequently it rejects
`src/account/credentials.mjs`, which main imports unconditionally. Every candidate
ASAR produced by this packager omits that required module, so the packaged main
cannot start. This is an implementation failure of the development package, even
though launcher/production qualification are honestly incomplete.

Reproduction: evaluate the exact candidate's exported filter with
`allowedAppFile('src/account/credentials.mjs', new Set())`; it returns `false`.
The independently executed source probe pins this observation with `git show` to
the reviewed commit. The missing required module follows directly from the
candidate's candidate-list/filter/copy loop; I did not independently launch an
ASAR in this review. The coordinator separately reported an actual failed ASAR
launch; that report is not substituted for my own runtime evidence.

Fix direction: explicitly include the required runtime source modules and keep
secret-file exclusions scoped to actual secret inputs. Inspect required module
presence in the built ASAR and run the resulting package.

### 2. [P2] Private Code drafts claim durable recovery after a rejected native write

Location: `desktop/build/renderer.mjs:30`; related native receipt handling in
`desktop/src/ui/storage.js:20`. Frozen contract: `desktop/baseline/R78.html:109796`
and the user-visible message at line 110059.

The build replaces the Code draft storage writer with
`desktopCache.setItem()`, whose implementation discards `sirenStore.set()`'s
promise. The existing synchronous `createCodeDrafts.persist()` sees that writer
return without throwing and marks every draft `recovery='stored'`. The later
native failure only invokes a generic storage error handler; it never corrects
the draft receipt. Code continues to say **Private recovery stored**, including
after `SAVE_FAILED`, `ACCESS_REFUSED` or `NO_PROJECT`.

Reproduction: execute the unchanged baseline draft function against the real
desktop store/patch writer and a bridge returning injected `SAVE_FAILED`.
Observed output: `beforeNativeReceipt: 'stored'`,
`afterRejectedNativeWrite: 'stored'`, `nativeReceiptOk: false`. This is a focused
source-level integration probe, not a native disk-full qualification. The generic
save warning does not make the per-draft durability assertion true. A user can
trust this receipt and close/force-close with a draft that never reached recovery.

Fix direction: keep the draft pending/in-memory until the corresponding native
acknowledgment, update its recovery status on success/failure, and test a rejected
write and a delayed write without allowing an older receipt to qualify newer text.

### 3. [P2] A damaged project cannot enter recovery unless it was already selected

Location: `desktop/src/main.mjs:114`–117; grant check at line 142.

Opening an owned folder calls `projects.readProject(id)` before granting/selecting
that project. If its current pointer/revision is corrupt, the exception becomes
generic `OPERATION_FAILED`, and the previous project's grant/selection survives.
The recovery panel is bound to that previous selection, while `getRecovery()` for
the damaged project is refused. Its verified saved/draft checkpoints exist but
cannot be recovered through the desktop bridge. The special damaged-selection
startup branch only covers whichever project was selected previously.

Reproduction: create A with a verified saved checkpoint, select healthy B, damage
A's `current.json`, then choose A through Open project folder. Using the exact
main pick handler with dialog results injected and real ProjectStore/RecoveryStore
files yielded `openCode: 'OPERATION_FAILED'`,
`recoveryCode: 'PROJECT_REFUSED'`, `verifiedCheckpoints: 1`,
`grantedDamagedProject: false`. OS chooser behavior itself was not exercised.

Fix direction: after validating the user's owned folder choice, retain an opaque
grant and transition to explicit recovery when normal read fails. Preserve the
damaged original and offer its verified points/export handles without initializing
the damaged workspace.

### 4. [P2] Verification workflow paths do not match the candidate repository

Location: `.github/workflows/desktop-verify.yml:4`, 15, 24 and 47.

The workflow refers to `portable/desktop/**`, `portable/desktop` as the run working
directory, and lockfile/evidence paths under that prefix. The reviewed repository
tree has `desktop/` at its root and no `portable/` entry. Desktop-only PR changes
therefore do not trigger this check; a manually dispatched run or workflow edit
cannot find the cache lockfile/run directory, and evidence upload points nowhere.

Reproduction: `git ls-tree --name-only <reviewed-commit>` includes `desktop` and
does not include `portable`; `git ls-tree <reviewed-commit> portable` has no output.
No GitHub workflow was dispatched in this review. The coordinator explained that
a later remote composition under `portable/` had been planned; that later tree is
outside this exact local candidate and does not make its workflow runnable.

Fix direction: make all paths match the chosen repository layout consistently.

## Executed checks and limits

Node `v24.16.0`. From `desktop/`, I independently ran:

```text
node --test tests/shell.test.mjs tests/projects.test.mjs tests/recovery.test.mjs tests/recovery-access.test.mjs tests/io.test.mjs tests/account.test.mjs tests/account-service.test.mjs tests/updates.test.mjs tests/update-service.test.mjs
```

Observed census: 61 tests, 61 passed, 0 failures/cancellations/skips; 6.37 seconds.
These existing checks did not detect the integration findings above. I did not
rerun the real 180-second OIDC timeout or native UI/packaged qualification.
Focused additional probes and their output are retained in
`desktop/evidence/independent-review-2026-10-02/`. The first probe setup attempt
failed on an omitted VM helper; that failed attempt is retained and makes no
positive claim. Later probes reproduced the reported behaviors.

Product source/build files matched the reviewed candidate during these probes.
Concurrent coordinator work left `desktop/tests/native/drive.mjs` modified and
`desktop/tests/native/packaged.mjs` untracked; neither was executed as review
evidence or treated as part of this commit. Repairs made after this review need
their own commit identity and validation; this report remains on 837db24.

The absent Rust launcher/helper/apply/rollback, blocked local Rust compiler,
production account/feed/keys and renewal/revocation, key rotation, unresolved
license qualification, Windows handle/reparse races, OS chooser cancellation,
removable-drive power loss, broader startup/checkpoint crash-phase coverage,
cross-user credentials and second clean PC are honestly documented open planned
work. Their absence is not relabeled as a discovered regression here. This review
does not confer whole-release approval, independence of other reports, public
publication authorization or portable-release admission.
