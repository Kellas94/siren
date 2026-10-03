# Narrow window IPC implementation

Author: `/root/terminal_contract`, 3 October 2026. Owned scope: `desktop/src/windows/ipc.mjs`, `desktop/tests/window-ipc.test.mjs`, this report and ignored `desktop/evidence/window-ipc/` logs/manifests. Main, preload, native factory, registry, package, product dependencies and other sources were not edited by this task. No commits, full-suite run or native experiment occurred.

The pure `invokeWindow({event,method,payload,registry})` boundary is implemented and tested against the actual WindowRegistry with doubles only for Electron's window objects. It derives caller authority exclusively from `registry.caller(event)`. No renderer-supplied role, project, epoch or native identity is accepted as caller authority. It does not create a service container, register fake product windows, deliver source/project/notes content or implement editor/presentation transport.

## Concrete contract

Every failure is `{ok:false,code,message}` with a fixed sanitized message. Only known local codes are returned: `SENDER_REFUSED`, `REQUEST_REFUSED`, `ACCESS_REFUSED`, `VIEW_REFUSED`, `CANCELLED`, `WINDOW_DESTROY_FAILED`, `OPERATION_FAILED`. Native error text, stack, file paths and arbitrary codes are not forwarded.

| Method | Exact payload | Authority and result |
| --- | --- | --- |
| `getView` | omitted, null or `{}` | Current caller only; `{ok:true,view:grant}` |
| `listViews` | omitted, null or `{}` | Workspace only; `{ok:true,views:ViewRecord[]}` filtered to caller project/epoch |
| `openView` | `{role,entityId,version?}` | Workspace only; role must be Code or Docs, entity must be in native caller grants; `{ok:true,view:ViewRecord}` |
| `focusView` | `{windowId}` | Workspace can target its project/epoch; satellite can target only self; `{ok:true,focused:true}` |
| `closeView` | `{windowId}` | Same target scope; closing workspace through this channel is refused; `{ok:true,closed:true}` only on actual registry success |

IDs use the registry's bounded ID syntax; version is an optional nonnegative safe integer, including zero. Unknown keys, symbol keys, accessors, inherited-prototype payloads and invalid types are refused before registry actions. Request values are copied before asynchronous work. The role/version syntax checks do not establish immutable source-version ownership: native authorizer/factory and later source transport retain that responsibility. Presenter/Audience opens are deliberately unavailable under the coordinator's Task 1 ruling; Task 5 must supply their coordinated transport first.

Grants returned by `getView` contain only `webContentsId,mainFrameUrl,windowId,role,projectId,epoch,entityIds`; Audience's entity list is forcibly empty. Lists/opens expose only `windowId,role,projectId,epoch,entityId,state`, dropping extra native/content fields. Audience has no global shelf/list permission and no source/project/notes method. Focus/close on another satellite is refused even if its ID is known.

After fulfilled **or rejected** asynchronous operations, caller window ID, role, project, epoch, native webContents ID, exact main-frame URL and the original event sender/frame object references are rechecked through the registry. Late open cannot publish a view after caller revocation. It calls the coordinator-added trusted `registry.discardView(windowId)` to bypass user-cancelable close and destroy the newly registered view. Failed discard returns a visible sanitized destruction failure; no fake success is returned. Epoch/policy changes during the actual registry factory already cause native disposal/refusal there.

Actual registry focus/close are synchronous; they require no artificial await. This permits legitimate self-close to return success even though that close intentionally removes its grant. Any thenable adapter path is awaited and caller-checked; it cannot retain authority after revocation. Canceled close returns `CANCELLED` and retains the original registry/window. This module does not replace the later coordinated editor drain/Quit lifecycle.

## Actual test evidence

I used the test-driven-development skill. Before implementation, the explicit missing-interface assertion failed: **1 fail, 18 dependent cases skipped**, exit 1, **68.4504 ms**. This is the real initial RED, not a claim that all dependent behavior cases ran without their implementation. Saved `red.log` SHA256 `d7dc0847f5aa1a9ca35d297e575523b19d0ce99855d43b3b84bb309041590790`.

Initial implementation passed **19/19**, zero fail/skip, **71.3389 ms** (`green-first.log`). An initial combined run passed **50/50**, **78.5115 ms** (`focused.log`). Self-review then identified that rejected awaits sanitized errors without rechecking revocation. A new test independently reproduced **ACCESS_REFUSED instead of SENDER_REFUSED** after revocation: **19 pass, 1 fail**, exit 1, **74.6971 ms**. That failure is retained in `rejected-await-red.log`, SHA256 `3c1fffbc6b610d1924e03cec3222b16f28e9d703c866932a847a73ee3c5a2e9c`. The catch path was corrected; those earlier GREEN hashes are historical, not the final implementation identity.

Final command: `node --test tests/window-registry.test.mjs tests/window-ipc.test.mjs`, cwd `desktop`, **Node v24.16.0**. Actual final result: **51 tests = 20 IPC + 31 registry; 51 pass, 0 fail/cancel/skip/todo**, exit 0, **79.9711 ms**. Saved `final-focused.log` SHA256 `abade7748eeeda5a62469d036fef7da172bf4b55f6a12f802c1e64555444b5a8`; tool chunk `36bd40`. Final start/end manifests bind the same four hashes across the run:

| File | Final SHA256 |
| --- | --- |
| `desktop/src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `desktop/tests/window-ipc.test.mjs` | `87d80d8918af05f5ea7eb789474e2584ebfe5f5618804809bc83885360fdf9f9` |
| Coordinator's `desktop/src/windows/registry.mjs` | `d491cb58dc88297fbf3ff7ef69c0a986df9aac75dbb2254d4b6940580024067f` |
| Coordinator's `desktop/tests/window-registry.test.mjs` | `911429fac72f29b09879d6fbcec5929626a84899e72e9164685f38e8b5609002` |

Coverage includes forged/missing/subframe/unregistered sender, event-identity spoofing, exact payloads/accessor avoidance, Code/Docs role/version validation, foreign entities, Audience privacy, scoped/stripped lists, negative sibling/global permissions, foreign project/epoch targets, actual canceled close, self-close, pending open revocation and trusted discard, failed destruction, policy/epoch change during factory creation, async lookup/action/error revocation and sanitized native failures. Focused checks have no UI or physical monitor significance.

The final files are ready for independent review. Main/preload IPC wiring, actual native role-shell probe, sandbox/resource/package allowlists, source-version transport, editor drain, Lock/Quit coordination, shelf/geometry persistence and presentation remain separate required integration work. No native multi-window admission is claimed by these pure tests.
