# Workspace readiness independent review — 2026-10-03

Reviewer: `/root/source_authority_review`. The root authored the helper, integration and regression fix; this reviewer authored only this report and ran independent assertions without changing runtime/tests.

Final verdict: **APPROVED for the native-load helper and the narrow setup/unlock, IPC error-map and package allowlist source seams reviewed below.** The initial **CHANGES REQUIRED** finding and failed assertion are preserved. No full-suite, actual native renderer, package build, ASAR/binary identity, or product/package qualification is claimed.

## Scope

Initially reviewed `desktop/src/windows/readiness.mjs` and `desktop/tests/workspace-readiness.test.mjs`. After explicit parent notification, also reviewed the main import and actual `setupPin`/`unlockPin` service wrappers, the `WORKSPACE_NOT_READY` IPC error mapping, the exact added package source allowlist entry, and `desktop/tests/workspace-readiness-integration.test.mjs`. This is a narrow diff review, not approval of all main process behavior.

The helper uses native WebContents state for the exact workspace URL `siren://app/app.html` and waits for main-frame loading to finish before calling the operation. It rechecks after event subscription and immediately before admission. It refuses unavailable native state, wrong URL, destruction, load failure, renderer loss, fresh main navigation and a bounded deadline. It cleans up listeners/timer on success or refusal. The integration calls `LocalPinAccess.setup`/`unlock` inside that admission callback, rechecking `pinTransition` after the wait; PIN mutation is therefore gated before the original methods start. The IPC mapping exposes only the fixed readiness refusal message and retains the existing generic mapping for other failures. Package inclusion adds one exact source path rather than allowing a windows directory.

## Initial finding — CHANGES REQUIRED (resolved below)

Initial source identities:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/readiness.mjs` | `1a38292bd9269e445ca0b94fadc339b74da111793eeca1bf7f241e680cfef6d4` |
| `desktop/tests/workspace-readiness.test.mjs` | `dc50eb1554db0f4590efdd6874fde7a582457b75a11f406694f5d535cf4f2d37` |

**Pending continuation lost renderer-failure invalidation.** In that initial helper, lines 17–21 removed failure/crash watchers as soon as `did-finish-load` settled the wait. The async continuation had not yet invoked the operation. `render-process-gone` could then arrive while WebContents retained the expected URL, was not destroyed, and reported no current main-frame loading; the final state query could not detect the lost invalidation.

Independent reproduction, with an EventEmitter WebContents fixture initially loading:

```js
const pending = runAfterWorkspaceLoad(contents, () => {
  mutations++;
  return 'PIN_MUTATED';
});
contents.loading = false;
contents.emit('did-finish-load');
contents.emit('render-process-gone', {}, -2, 'load invalidated', contents.url, true);
const outcome = await pending.then(
  value => ({ acknowledged: value }),
  error => ({ code: error.code }),
);
assert.equal(mutations, 0);
```

Expected: `WORKSPACE_NOT_READY`, zero mutations. Actual stdout and assertion from the independent `node --input-type=module` stdin probe:

```text
{"event":"render-process-gone","outcome":{"acknowledged":"PIN_MUTATED"},"mutations":1,"listeners":[]}
AssertionError [ERR_ASSERTION]: render-process-gone after finish but before continuation must refuse pending mutation
1 !== 0
Node.js v24.16.0
Exit code: 1
```

The initial checked-in focused suite passed 5/5, exit 0 (77.9613 ms), so its green result did not cover this race. The extracted actual-service integration suite also passed 3/3, exit 0 (68.9867 ms), before the fix. Twelve additional independent non-race scenarios passed, exit 0, covering final state changes, ignored subframe failure, repeated finish while still loading, invalid timeouts and preservation of the operation's own error. None of those green results displaced the failed race assertion.

The finding was sent immediately to the parent with the exact source identity, sequence, expected/actual result and suggested retained-listener/latch fix. No runtime patch was made by this reviewer.

## Fix and independent resolution

The root retained watchers through the final admission check, added an `invalidated` latch for main-frame failure, renderer loss, destruction and main navigation, and moved cleanup into `finally`. Completion can settle the wait while invalidation remains observable until the operation is invoked. A regression covers renderer loss, load failure and navigation after finish but before continuation. I read the updated helper and independently reran the original sequence plus both additional event forms, using the native event positional signatures rather than only the regression's event-object form.

Actual final independent stdout:

```text
{"event":"render-process-gone","outcome":{"code":"WORKSPACE_NOT_READY"},"mutations":0,"listeners":[]}
{"event":"did-fail-load","outcome":{"code":"WORKSPACE_NOT_READY"},"mutations":0,"listeners":[]}
{"event":"did-start-navigation","outcome":{"code":"WORKSPACE_NOT_READY"},"mutations":0,"listeners":[]}
Independent final readiness/seam assertions passed: 18
Exit code: 0
```

Those 18 scenarios also checked reload/wrong-URL/destruction before continuation; ignored subframe failure and subframe navigation; finish while still loading; seven invalid timeout values; operation-error identity; four concurrent waiters called exactly once each despite repeated finish; the exact sanitized readiness IPC refusal versus generic unrelated errors; and exact package admission of the helper with denial of sibling/core modules, backup/test paths and path traversal. All waiters removed their listeners. These assertions ran from stdin and did not add product/test files.

Final focused command ran in `C:/Claude/SIREN_WORK/portable`:

```text
node --test desktop/tests/workspace-readiness.test.mjs desktop/tests/workspace-readiness-integration.test.mjs desktop/tests/ipc.test.mjs desktop/tests/package.test.mjs desktop/tests/local-pin.test.mjs
```

Actual result: **29 tests, 29 pass, 0 fail, 0 skipped/cancelled/todo, exit 0**, duration 3081.5329 ms. This includes six readiness and three actual-service integration subtests alongside the selected existing PIN/package checks. The VM integration executes the actual main service source slice and verifies no mutation/ACK before readiness, successful invocation afterward, refusal on failure, and `PIN_BUSY` when the transition becomes busy during the wait. It does not launch Electron or exercise an actual renderer reload.

`git diff --check -- desktop/src/main.mjs desktop/src/ipc.mjs desktop/scripts/package.mjs` exited 0; Git emitted CRLF-to-LF notices for main and IPC. That command covers the tracked seam diff, not a package build.

## Final source identities

Captured after the final focused run and independent assertions:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/readiness.mjs` | `02a111bbab90dfb5eff482153396391b7405ac2bbc6f47178158fb8ab46e53fc` |
| `desktop/tests/workspace-readiness.test.mjs` | `4ec269339460ddc7522b444acdf78b56b7bed4851493d51ae5f8563ce3705f78` |
| `desktop/tests/workspace-readiness-integration.test.mjs` | `1a47c3febe8b5231b4055020bc5c820ee93ca48159057bfa64d848897d1b9aae` |
| `desktop/src/main.mjs` | `0c3f56c0fa6d60c77453a9a03ec53976d131ad2b145dd1fe317ab63c30a87058` |
| `desktop/src/ipc.mjs` | `d695a1133654472479e5338525ce36c81630461ee62bd9fbfac01981b93ecaf5` |
| `desktop/scripts/package.mjs` | `b1dc232c49856941c28b9d39be2a6463c1d8490710577ade3a03703cbc2b8fe6` |

## Limits

This is an initial native-load admission gate. It is not a transaction barrier for later lifecycle changes after the operation has been invoked, and it does not certify owner queues, all-window Lock, source selection, role grants or renderer generation handling outside this diff. Native event fixtures and extracted-service VM tests cannot prove Electron timing or packaged startup behavior. The parent separately observed an immutable-native differential, but that observation is not my independent evidence and I make no historical causality or package PASS claim from it. Full-suite, build, committed-source package identity and actual native setup/unlock/save/restart checks remain parent-owned qualification.
