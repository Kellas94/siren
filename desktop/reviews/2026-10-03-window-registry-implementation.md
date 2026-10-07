# Window registry core implementation — 3 October 2026

Scope: Native Workspaces Task 1's independent registry core only. This agent owns `desktop/src/windows/registry.mjs`, `desktop/tests/window-registry.test.mjs`, and this report. No main/preload/IPC/protocol/build/package changes, dependencies, commit, native probe, or full-suite run were made here. Task 1 as a whole remains incomplete until the parent integrates and qualifies those boundaries.

## Interface for integration

`new WindowRegistry({createWindow, authorize})`.

- `openView({role,entityId,version?})` is asynchronous and returns a frozen serializable `{windowId,role,projectId,epoch,entityId,state}`. IDs are generated in native code. Workspace accepts `entityId:null`; other roles require native-owned IDs. Version is an optional nonnegative safe integer supplied to the factory.
- `authorize(normalizedRequest)` must be synchronous and derive `{projectId,mode,access,entityIds}` from native authority. Supported modes are `normal`, `readonly`, `recovery`; `locked` and unsupported modes refuse data views. Access is `read`, `write`, or `presentation`. Readonly/recovery may admit read views but never write authority. Audience requires presentation access and receives an empty source entity grant.
- Workspace gets only the explicit native-authorized entity set. Satellite source grants are limited to their requested entity. Entity sets are copied, frozen in returned grants, and never expanded from later policy additions.
- `createWindow(options)` supplies the actual ready, hidden BrowserWindow. Options include the native view identity/scope, optional version, exact `mainFrameUrl`, and `modal:false`; there is no forced parent. Workspace URL stays `siren://app/app.html`. Satellite URL is `siren://app/windows/<role>.html?windowId=<native UUID>`.
- The adapter owns sandbox, context isolation, Node refusal, allowed resources/CSP, popup/webview/navigation refusal, readiness, and showing the window only after successful registry publication. The registry imports no Electron.
- `caller(event)` returns an immutable `{webContentsId,mainFrameUrl,windowId,role,projectId,epoch,entityIds}` or null. Identity requires the registered webContents object, unchanged native IDs and window/webContents relationship, registered main-frame object, actual current main-frame object, exact frame and webContents URL, live objects, and current native authorization matching the captured project/mode/access/entity ownership. Event payload identity fields cannot influence grants.
- `listViews()` returns detached serializable view snapshots with current active/minimized state. `focusView(id)` restores minimized eligible views; unknown/stale views return false. `closeView(id)` preserves cancelled native closes and returns false until destruction; closing a satellite preserves others.
- Destroyed/crashed/navigating main renderers lose their grants permanently. Crash/navigation also destroys the data view. Subframe navigation does not revoke the unrelated main-frame view.
- `invalidateEpoch()` advances the epoch, revokes all grants first, then destroys every tracked view (including minimized/Audience). It returns the new epoch only after destruction succeeds. Failure throws `WINDOW_DESTROY_FAILED`, keeps authority revoked, blocks new openings, and retains the failed native handle for retry.
- An unresolved old-epoch factory cannot publish a grant. Its returned window is destroyed on completion; failed disposal is retained for invalidation retry. The adapter must keep pending windows hidden and with no project bootstrap, because the registry cannot cancel an unresolved external factory promise.

Roles are workspace/docs/code/presenter/audience. Terminal is unsupported until explicitly admitted. The narrow bridge must enforce per-role methods independently: a valid Audience grant never permits reading sources or project snapshots. Registry null callers should become IPC `SENDER_REFUSED`; this module deliberately does not implement IPC.

## Decisions and limits

1. Trusted policy is synchronous so every caller can revalidate the actual native state without awaiting renderer-controlled work. A promise-shaped policy fails closed.
2. Main-frame object identity is captured after the ready factory resolves, in addition to sender identity and URL. A same-URL replacement frame cannot inherit authority.
3. Mode/access changes invalidate an existing caller until native recreation, rather than silently changing its capability. This is conservative: readonly transition may require recreating a read view.
4. Native entity authorization is explicitly supplied, including for workspace. A workspace null entity does not independently create a full-project grant.
5. Factory scope is rechecked after await before registration; any removal from the initially authorized entity set conservatively refuses the pending opening, even if an unrelated authorized entity was removed.
6. This scoped core delivery follows the parent/user-authorized focused-only scope. Parent must perform Task 1's bridge/native probes and the next full suite after integration. Unit adapter doubles do not establish actual native, package, multi-monitor, or BrowserWindow wrapper identity qualification.

## Verification

Runtime: Node v24.16.0 in `C:/Claude/SIREN_WORK/portable`.

Commands:
- `node --test desktop/tests/window-registry.test.mjs` → final 27/27 pass, exit 0.
- `node --check desktop/src/windows/registry.mjs` → exit 0.
- `node --check desktop/tests/window-registry.test.mjs` → exit 0.
- `git diff --check` → exit 0 (tracked working changes only; these new files were untracked).

The first RED run asserted the absent registry feature instead of allowing a missing-module import to crash. The second RED run exposed the missing caller method. The lifecycle RED run included actual stale minimized/list state and accepted reused-renderer failures plus missing lifecycle methods. The fourth/fifth cycles produced behavioral assertion failures for frame replacement, native ID collisions, sparse arrays, failed destruction admission, stale-factory failed disposal, and navigation destruction exceptions. Some later added tests passed immediately because earlier implementation already covered their behavior; they are not represented as independently observed RED tests.

Actual focused output from each cycle is preserved below. No fabricated native or full-suite evidence is included.

## Cycle 1 RED

```text
✖ opens distinct native views with trusted project scope and serializable records (0.9674ms)
✖ refuses forged scope, unsupported roles and malformed versions before creating a window (0.178ms)
✖ refuses cross-project entities and absent or malformed native authorization (0.2014ms)
✖ locked and readonly write authorization cannot create data windows (0.1275ms)
✖ readonly and recovery read authorization admits eligible views without overriding safety (0.1397ms)
✖ workspace scope permits no entity while audience requires presentation authorization (0.1304ms)
ℹ tests 6
ℹ suites 0
ℹ pass 0
ℹ fail 6
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 62.9844

✖ failing tests:

test at desktop\tests\window-registry.test.mjs:57:1
✖ opens distinct native views with trusted project scope and serializable records (0.9674ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:58:35)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.start (node:internal/test_runner/test:1177:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:385:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:74:1
✖ refuses forged scope, unsupported roles and malformed versions before creating a window (0.178ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:75:33)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:385:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:90:1
✖ refuses cross-project entities and absent or malformed native authorization (0.2014ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:91:41)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:104:1
✖ locked and readonly write authorization cannot create data windows (0.1275ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:105:41)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:115:1
✖ readonly and recovery read authorization admits eligible views without overriding safety (0.1397ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:116:32)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:126:1
✖ workspace scope permits no entity while audience requires presentation authorization (0.1304ms)
  AssertionError [ERR_ASSERTION]: Native WindowRegistry must exist
  + actual - expected
  
  + 'undefined'
  - 'function'
  
      at setup (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:38:10)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:127:41)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'undefined',
    expected: 'function',
    operator: 'strictEqual',
    diff: 'simple'
  }
```

## Cycle 1 GREEN

```text
✔ opens distinct native views with trusted project scope and serializable records (1.2624ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.4238ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2157ms)
✔ locked and readonly write authorization cannot create data windows (0.1305ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1493ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.5731ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 63.871
```

## Cycle 2 RED

```text
✔ opens distinct native views with trusted project scope and serializable records (1.3217ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.4014ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2232ms)
✔ locked and readonly write authorization cannot create data windows (0.5845ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1618ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.1544ms)
✖ caller derives its grant from registered native objects and ignores forged payload identity (0.2237ms)
✖ same URL and numeric renderer ID never grant an unregistered sender native object (0.1624ms)
✖ subframes and role, query or fragment URL substitutions never authorize IPC (0.206ms)
✖ live caller authorization refuses closed, destroyed or native ID replacement (0.2145ms)
✖ caller revalidates trusted current project, entity ownership, mode and access (0.1851ms)
✖ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1174ms)
✖ authorization exceptions and asynchronous policy never grant renderer access (0.1254ms)
ℹ tests 13
ℹ suites 0
ℹ pass 6
ℹ fail 7
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 68.3865

✖ failing tests:

test at desktop\tests\window-registry.test.mjs:137:1
✖ caller derives its grant from registered native objects and ignores forged payload identity (0.2237ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:141:26)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:148:1
✖ same URL and numeric renderer ID never grant an unregistered sender native object (0.1624ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:152:25)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:157:1
✖ subframes and role, query or fragment URL substitutions never authorize IPC (0.206ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:162:25)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:173:1
✖ live caller authorization refuses closed, destroyed or native ID replacement (0.2145ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:185:27)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:190:1
✖ caller revalidates trusted current project, entity ownership, mode and access (0.1851ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:200:24)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:206:1
✖ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1174ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:209:30)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:220:1
✖ authorization exceptions and asynchronous policy never grant renderer access (0.1254ms)
  TypeError: registry.caller is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:228:25)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)
```

## Cycle 2 GREEN

```text
✔ opens distinct native views with trusted project scope and serializable records (1.3321ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.4001ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2313ms)
✔ locked and readonly write authorization cannot create data windows (0.5911ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1546ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.1521ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2471ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1312ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1904ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2653ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2341ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1616ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.1227ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 63.1216
```

## Cycle 3 RED

```text
✔ opens distinct native views with trusted project scope and serializable records (1.4175ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.8899ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2512ms)
✔ locked and readonly write authorization cannot create data windows (0.1311ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1415ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.1517ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.3333ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1208ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1695ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2452ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2115ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1372ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.135ms)
✖ focus restores a minimized native view and closing one view preserves the others (0.5814ms)
✖ cancelled native close retains the registered view and its grant (0.1016ms)
✖ native destruction, crash and main navigation permanently revoke the renderer grant (0.4118ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0675ms)
✖ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.0971ms)
✖ pending creation cannot publish after epoch invalidation or a native policy change (0.1234ms)
✖ a destroyed or reused factory renderer cannot acquire a second view grant (0.1114ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.0693ms)
ℹ tests 21
ℹ suites 0
ℹ pass 15
ℹ fail 6
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 69.7692

✖ failing tests:

test at desktop\tests\window-registry.test.mjs:235:1
✖ focus restores a minimized native view and closing one view preserves the others (0.5814ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'active'
  - 'minimized'
  
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:240:10)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'active',
    expected: 'minimized',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:253:1
✖ cancelled native close retains the registered view and its grant (0.1016ms)
  TypeError: registry.closeView is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:257:25)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:262:1
✖ native destruction, crash and main navigation permanently revoke the renderer grant (0.4118ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
  +   {
  +     entityId: 'doc_a',
  +     epoch: 1,
  +     projectId: 'project_a',
  +     role: 'docs',
  +     state: 'active',
  +     windowId: '5c44f39e-a72f-470d-bddc-dc1eafc1f766'
  +   }
  + ]
  - []
  
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:274:12)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { windowId: '5c44f39e-a72f-470d-bddc-dc1eafc1f766', role: 'docs', projectId: 'project_a', epoch: 1, entityId: 'doc_a', state: 'active' } ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:287:1
✖ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.0971ms)
  TypeError: registry.invalidateEpoch is not a function
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:294:25)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:305:1
✖ pending creation cannot publish after epoch invalidation or a native policy change (0.1234ms)
  TypeError: registry.invalidateEpoch is not a function
      at native.mode (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:307:36)
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:320:5)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1306:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:897:18)
      at Test.postRun (node:internal/test_runner/test:1447:19)
      at Test.run (node:internal/test_runner/test:1372:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7)

test at desktop\tests\window-registry.test.mjs:329:1
✖ a destroyed or reused factory renderer cannot acquire a second view grant (0.1114ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:336:3)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }
```

## Cycle 3 GREEN

```text
✔ opens distinct native views with trusted project scope and serializable records (1.7332ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (1.0059ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2548ms)
✔ locked and readonly write authorization cannot create data windows (0.137ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1596ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.1796ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.3131ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1154ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.2023ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2384ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2165ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1437ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.1323ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.2002ms)
✔ cancelled native close retains the registered view and its grant (0.0929ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.2026ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0566ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.1484ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2344ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.1219ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.0761ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 71.5871
```

## Cycle 4 RED

```text
✔ opens distinct native views with trusted project scope and serializable records (1.5916ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.9117ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2677ms)
✔ locked and readonly write authorization cannot create data windows (0.148ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1643ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.2882ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2591ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1118ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.2062ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.266ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2304ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1596ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.137ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.1972ms)
✔ cancelled native close retains the registered view and its grant (0.1045ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.2106ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0587ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.1519ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2507ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.1359ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.1006ms)
✖ a replacement main-frame object at the same URL cannot inherit a prior grant (0.8305ms)
✖ factory identity collisions reject the new view without destroying an existing renderer (0.1886ms)
✖ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.2099ms)
✖ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1263ms)
ℹ tests 25
ℹ suites 0
ℹ pass 21
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 73.0084

✖ failing tests:

test at desktop\tests\window-registry.test.mjs:357:1
✖ a replacement main-frame object at the same URL cannot inherit a prior grant (0.8305ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + {
  +   entityIds: [
  +     'doc_a'
  +   ],
  +   epoch: 1,
  +   mainFrameUrl: 'siren://app/windows/docs.html?windowId=2d060197-0996-4d05-818a-42c0da744b8b',
  +   projectId: 'project_a',
  +   role: 'docs',
  +   webContentsId: 1001,
  +   windowId: '2d060197-0996-4d05-818a-42c0da744b8b'
  + }
  - null
  
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:362:10)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: { webContentsId: 1001, mainFrameUrl: 'siren://app/windows/docs.html?windowId=2d060197-0996-4d05-818a-42c0da744b8b', windowId: '2d060197-0996-4d05-818a-42c0da744b8b', role: 'docs', projectId: 'project_a', epoch: 1, entityIds: [ 'doc_a' ] },
    expected: null,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:365:1
✖ factory identity collisions reject the new view without destroying an existing renderer (0.1886ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:378:5)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:385:1
✖ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.2099ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:395:3)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:401:1
✖ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1263ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:404:3)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }
```

## Cycle 4 GREEN

```text
✔ opens distinct native views with trusted project scope and serializable records (1.56ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.869ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2489ms)
✔ locked and readonly write authorization cannot create data windows (0.1409ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1769ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.2451ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2408ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1927ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2455ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2096ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1491ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.1399ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.1853ms)
✔ cancelled native close retains the registered view and its grant (0.096ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.1965ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0506ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.1603ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2276ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.124ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.0901ms)
✔ a replacement main-frame object at the same URL cannot inherit a prior grant (0.0543ms)
✔ factory identity collisions reject the new view without destroying an existing renderer (0.1872ms)
✔ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.1671ms)
✔ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1764ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 68.5851
```

## Cycle 5 RED

```text
✔ opens distinct native views with trusted project scope and serializable records (2.0844ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.4312ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2464ms)
✔ locked and readonly write authorization cannot create data windows (0.1518ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1687ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.2148ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2673ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1024ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1652ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.3628ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2921ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.2291ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.1394ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.204ms)
✔ cancelled native close retains the registered view and its grant (0.0928ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.2055ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0574ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.1674ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2509ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.1362ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.1208ms)
✔ a replacement main-frame object at the same URL cannot inherit a prior grant (0.0689ms)
✔ factory identity collisions reject the new view without destroying an existing renderer (0.1809ms)
✔ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.1628ms)
✔ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1954ms)
✖ a failed stale factory disposal is retained for epoch retry and never gains a grant (0.4509ms)
✖ navigation destruction failure revokes synchronously and prevents new grants until retry (0.2446ms)
ℹ tests 27
ℹ suites 0
ℹ pass 25
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 73.0732

✖ failing tests:

test at desktop\tests\window-registry.test.mjs:412:1
✖ a failed stale factory disposal is retained for epoch retry and never gains a grant (0.4509ms)
  AssertionError [ERR_ASSERTION]: The validation function is expected to return "true". Received false
  
  Caught error:
  
  Error: late native destruction failed
      at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:425:3)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: Error: late native destruction failed
        at late.destroy (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:418:36)
        at WindowRegistry.openView (file:///C:/Claude/SIREN_WORK/portable/desktop/src/windows/registry.mjs:83:127)
        at async waitForActual (node:assert:646:5)
        at async strict.rejects (node:assert:769:25)
        at async TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:425:3)
        at async Test.run (node:internal/test_runner/test:1313:7)
        at async Test.processPendingSubtests (node:internal/test_runner/test:897:7),
    operator: 'rejects',
    diff: 'simple'
  }

test at desktop\tests\window-registry.test.mjs:434:1
✖ navigation destruction failure revokes synchronously and prevents new grants until retry (0.2446ms)
  AssertionError [ERR_ASSERTION]: Got unwanted exception.
  Actual message: "navigation destruction failed"
      at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:438:10)
      at async Test.run (node:internal/test_runner/test:1313:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:897:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: Error: navigation destruction failed
        at windows.<computed>.destroy (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:437:38)
        at EventEmitter.revoke (file:///C:/Claude/SIREN_WORK/portable/desktop/src/windows/registry.mjs:97:41)
        at EventEmitter.emit (node:events:509:28)
        at file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:438:52
        at getActual (node:assert:611:5)
        at strict.doesNotThrow (node:assert:779:32)
        at TestContext.<anonymous> (file:///C:/Claude/SIREN_WORK/portable/desktop/tests/window-registry.test.mjs:438:10)
        at async Test.run (node:internal/test_runner/test:1313:7)
        at async Test.processPendingSubtests (node:internal/test_runner/test:897:7),
    expected: undefined,
    operator: 'doesNotThrow',
    diff: 'simple'
  }
```

## Cycle 5 GREEN

```text
✔ opens distinct native views with trusted project scope and serializable records (2.0255ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.4249ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.2407ms)
✔ locked and readonly write authorization cannot create data windows (0.1542ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.1641ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.2287ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2392ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1095ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1887ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2415ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2257ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1581ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.124ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.1914ms)
✔ cancelled native close retains the registered view and its grant (0.0886ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.2448ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.0555ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.1795ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2465ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.1381ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.0925ms)
✔ a replacement main-frame object at the same URL cannot inherit a prior grant (0.0581ms)
✔ factory identity collisions reject the new view without destroying an existing renderer (0.2099ms)
✔ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.1802ms)
✔ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1784ms)
✔ a failed stale factory disposal is retained for epoch retry and never gains a grant (0.1495ms)
✔ navigation destruction failure revokes synchronously and prevents new grants until retry (0.2138ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 75.0798
```

## Final focused run

```text
✔ opens distinct native views with trusted project scope and serializable records (1.6086ms)
✔ refuses forged scope, unsupported roles and malformed versions before creating a window (0.9141ms)
✔ refuses cross-project entities and absent or malformed native authorization (0.362ms)
✔ locked and readonly write authorization cannot create data windows (0.2855ms)
✔ readonly and recovery read authorization admits eligible views without overriding safety (0.21ms)
✔ workspace scope permits no entity while audience requires presentation authorization (0.2745ms)
✔ caller derives its grant from registered native objects and ignores forged payload identity (0.2895ms)
✔ same URL and numeric renderer ID never grant an unregistered sender native object (0.1255ms)
✔ subframes and role, query or fragment URL substitutions never authorize IPC (0.1846ms)
✔ live caller authorization refuses closed, destroyed or native ID replacement (0.2495ms)
✔ caller revalidates trusted current project, entity ownership, mode and access (0.2312ms)
✔ entity grants are isolated immutable snapshots and audience receives no source IDs (0.1648ms)
✔ authorization exceptions and asynchronous policy never grant renderer access (0.1296ms)
✔ focus restores a minimized native view and closing one view preserves the others (0.193ms)
✔ cancelled native close retains the registered view and its grant (0.0899ms)
✔ native destruction, crash and main navigation permanently revoke the renderer grant (0.2128ms)
✔ subframe navigation cannot revoke the unrelated main-frame view (0.1596ms)
✔ epoch invalidation destroys minimized and audience views and locked policy blocks new grants (0.2477ms)
✔ pending creation cannot publish after epoch invalidation or a native policy change (0.2818ms)
✔ a destroyed or reused factory renderer cannot acquire a second view grant (0.1666ms)
✔ returned view records cannot mutate registry role, epoch or lifecycle state (0.1006ms)
✔ a replacement main-frame object at the same URL cannot inherit a prior grant (0.0698ms)
✔ factory identity collisions reject the new view without destroying an existing renderer (0.1948ms)
✔ failed epoch destruction revokes every grant and blocks new windows until destruction completes (0.1882ms)
✔ sparse trusted entity lists and malformed native windows fail closed without publishing (0.1904ms)
✔ a failed stale factory disposal is retained for epoch retry and never gains a grant (0.1569ms)
✔ navigation destruction failure revokes synchronously and prevents new grants until retry (0.2027ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 72.0798
```

