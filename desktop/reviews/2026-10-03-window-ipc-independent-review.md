# Window IPC independent review — 2026-10-03

Reviewer: `/root/source_authority_review`. Implementation author: `/root/terminal_contract`. This reviewer authored only this report and ignored independent probe/log files; no product/runtime/tests changed.

Verdict: **APPROVED for the frozen window IPC core against the reviewed registry core.** No actionable source blocker was found in this scope. This does not approve main/preload wiring, native role shells, actual window/process lifecycle, package admission, source-version transport, editor drain or coordinated Lock/Quit.

## Scope and inspected behavior

Reviewed `desktop/src/windows/ipc.mjs`, `desktop/tests/window-ipc.test.mjs`, the implementation report, and its interactions with frozen `desktop/src/windows/registry.mjs`. The implementation author's historical 51-test result used the earlier registry identity and remains historical; this independent run uses the final workspace-extension registry below. The module derives authority from the real registry caller, not payload/event identity metadata.

| Boundary | Review conclusion |
| --- | --- |
| Payload normalization | Known methods and exact own data fields only; nonempty IDs and nonnegative safe versions; empty get/list requests accept omitted/null/empty objects; accessor/symbol/unknown/inherited keys refused without executing ordinary field getters. Copied/frozen request data cannot change while an open waits. |
| Caller identity | Real registry grants establish sender/frame/project/role/epoch. Rechecks also bind the original event sender/frame objects and initial window/role/project/epoch/native ID/URL metadata. Native identity is not reconstructed from numeric IDs or a URL alone. |
| getView/Audience | Metadata only. Audience entity list is forced empty; there is no project/source/notes content method. No arbitrary extras are copied into the response. |
| Open/list authority | Only workspace can open Code/Docs shells or list the current project/epoch's shelf. The requested entity must be in its native grant. Presenter/Audience/workspace opens are denied here. Native authorizer/factory retain entity-role and immutable version authority. |
| Target authority | Satellites may focus/close self only. Workspace can act on records in its current project/epoch; workspace close via this channel is denied. Canceled close reports cancellation and retains the view. |
| Async boundaries | Fulfilled and rejected awaited operations recheck current native caller. A newly registered late open whose caller is revoked is discarded using the trusted force-disposal method; cancelable close cannot retain it. Failed destruction stays visible and fenced. |
| Returned data/errors | Records/grants use explicit field allowlists. Native text/path/stack/arbitrary codes are not forwarded; known refusal codes use fixed messages. Source/notes getters on extra record fields are not read. |

Actual registry focus/close remain synchronous; successful self-close may acknowledge its intentional grant removal. The module does not promise later authority after the action or asynchronous editor-drain semantics.

## Independent focused evidence

Command, cwd `C:/Claude/SIREN_WORK/portable/desktop`, Node v24.16.0:

```powershell
node --test tests/window-registry.test.mjs tests/window-ipc.test.mjs | Tee-Object -FilePath evidence/window-ipc-independent-focused.log
exit $LASTEXITCODE
```

Actual result: **54 tests = 20 IPC + 34 registry; 54 pass, 0 fail, 0 skipped/cancelled/todo, exit 0**, duration **84.9928 ms**. The retained ignored log records the actual stdout. This was a focused combined run, not a full suite or native execution.

The independent probe uses the actual WindowRegistry with a bound/explicitly activated workspace and EventEmitter objects only at the native boundary. Command:

```powershell
node evidence/window-ipc-independent-probe.mjs 2>&1 | Tee-Object -FilePath evidence/window-ipc-independent-final.log
exit $LASTEXITCODE
```

Actual final output, exit 0:

```text
../src/windows/ipc.mjs SHA256: bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295
../tests/window-ipc.test.mjs SHA256: 87d80d8918af05f5ea7eb789474e2584ebfe5f5618804809bc83885360fdf9f9
../src/windows/registry.mjs SHA256: 275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28
Independent window IPC scenarios passed: 36
```

These 36 cases cover:

- Missing/null/incomplete caller events, a same-ID foreign WebContents object, and replacement sender frames.
- Null/omitted/empty/null-prototype data; primitive/array/prototype/symbol/nonenumerable/unknown/accessor payloads. Ordinary accessor read count remains zero and no native view is created by refusals.
- A null-prototype Code/Docs open, including version zero; mutation of the caller-owned request after starting a deferred open, with the original role/entity preserved.
- Late open after pinned-owner destruction, event frame substitution and native main-frame substitution; canceled close does not prevent trusted discard, and candidate grants disappear.
- Epoch invalidation followed by explicit reactivation of the same pinned owner with a replacement frame while an old open is waiting. The old request is refused, its candidate destroyed, and the new grant cannot resurrect the old invocation.
- Failed late-open destruction returns exactly the sanitized destruction failure, revokes the candidate grant and blocks subsequent grants until retry.
- Rejected async list/focus/close operations after caller loss; fulfilled metadata after native policy becomes locked; both refuse rather than publish a stale result.
- Code/Docs/Presenter/Audience metadata, prohibited global list/open/sibling operations, allowed intentional synchronous self-close, and Audience's empty entity grant.
- Extra private record fields stripped without invoking their getters; canceled close has no successful-close receipt.

The first independent probe attempt exited 1 due to a **reviewer fixture error**: its convenience `call(..., event = defaultEvent)` replaced an explicitly supplied `undefined` test event with the legitimate workspace event. Consequently the intended missing-event refusal assertion saw a correct successful getView. The fixture was corrected to invoke the module directly with that event value. No module/runtime change was made or required. This is not recorded as a product RED or a fixed source finding; the final script/log above records the corrected assertion run.

## Final identities and retained evidence

Captured after the focused run and the final probe; the IPC/runtime/test source hashes match the parent-provided frozen identities. Ignored evidence coverage was confirmed with `git check-ignore`.

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `desktop/tests/window-ipc.test.mjs` | `87d80d8918af05f5ea7eb789474e2584ebfe5f5618804809bc83885360fdf9f9` |
| `desktop/src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `desktop/tests/window-registry.test.mjs` | `dc4d846d21db841a052528b42f71779ab0b6a8e4ac2137eccd4286e6b827439c` |

| Ignored evidence artifact | SHA-256 |
| --- | --- |
| `desktop/evidence/window-ipc-independent-probe.mjs` | `52ebca691b9b6f568c7b1631a578515b83e85244eb7d3c83f05d41d5aa103c20` |
| `desktop/evidence/window-ipc-independent-focused.log` | `f648d26c55d9559fdbc99197bcd2b7494b71751e96f03edad5e88509a3960354` |
| `desktop/evidence/window-ipc-independent-final.log` | `56c827bdb601402793e00c39d6102ca41288d5f85ea6f1650e193e8798797501` |

The source approval is scoped to those exact runtime identities and the retained outcomes above.

## Qualification limits

The pure IPC boundary assumes the trusted registry's caller/record contract and native adapter; it is not an untrusted registry-plugin interface. Node fixtures can prove grant decisions, disposal requests and simulated destruction, but do not prove actual BrowserWindow creation/destruction, no application-content flash, real main-frame timing, process revocation, CSP/sandbox/navigation configuration or packaged module inclusion. No native launch, package build, ASAR/binary qualification, full-suite run or commit occurred in this review. Code/Docs shells have no source content/editor transport under this scope, and Presenter/Audience creation remains deliberately unavailable through the IPC channel until its separate integration work.
