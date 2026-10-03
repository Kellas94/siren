# Workspace registry extension independent review — 2026-10-03

Reviewer: `/root/source_authority_review`. The root authored the extension and fixes. This reviewer changed no product/runtime/tests, authored this report, and created ignored independent probe/evidence files only.

Final verdict: **APPROVED for the frozen registry core extension, source/unit scope only.** Initial **CHANGES REQUIRED** findings are preserved below. Main/IPC/renderer integration, native process/window behavior and package admission are not approved by this report.

## Scope and contract

Reviewed `desktop/src/windows/registry.mjs` and `desktop/tests/window-registry.test.mjs`, concentrating on the new pinned native workspace binding/activation, workspace-preserving epoch invalidation, modern/positional navigation details and forced satellite discard. Existing registry checks were rerun; this report supplements `2026-10-03-window-registry-review.md` and does not rewrite its original findings or author identity.

`bindWorkspace` pins the genuine native window/WebContents objects and numeric identities, creates no grant and cannot be substituted by a later binding. `activateWorkspace` is an explicit trusted native action; it rechecks policy, native objects/IDs, exact URL and current frame, then registers the workspace in the current epoch. Repeated activation retains an existing valid record, while frame/policy substitution requires prior epoch retirement. `invalidateEpoch({preserveWorkspace:true})` revokes every grant, destroys satellite handles and keeps the ordinary pinned owner handle for a future explicit activation; it may not forgive earlier failed destruction. `discardView` bypasses canceled satellite close but refuses to discard the pinned owner. Modern main-frame navigation and the positional fallback revoke grants; subframe navigation does not.

These are source contracts. The authorizer and native factory remain trusted main-process adapters; a renderer cannot invoke workspace binding/activation directly. Actual successful PIN bootstrap, adapter sandbox/load behavior, coordinated flush, all-window Lock, native destruction, and reactivation ordering remain integration duties.

## Initial findings — CHANGES REQUIRED

Initially reviewed identities:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/registry.mjs` | `d491cb58dc88297fbf3ff7ef69c0a986df9aac75dbb2254d4b6940580024067f` |
| `desktop/tests/window-registry.test.mjs` | `911429fac72f29b09879d6fbcec5929626a84899e72e9164685f38e8b5609002` |

The initial suite passed **31/31**, exit 0, duration 79.2723 ms. Four separate independent stdin assertions then exited **1** on the following adverse cases. All findings were sent to the parent immediately; no runtime fixes were made by this reviewer.

### 1. Workspace exclusivity was checked only before factory wait

`openView` could start a workspace factory while no owner was bound. Binding and activating the permanent owner during the wait did not invalidate the pending factory; the post-await admission lacked a bound-owner workspace-role check. The distinct factory window was then published as a second workspace grant.

Sequence: start pending `openView({role:'workspace',entityId:null})`; bind/activate a distinct native owner; resolve the pending factory; inspect both callers.

Expected: pending request refused, candidate destroyed, pinned owner retained as the sole workspace. Actual independent stdout:

```text
{"outcome":{"accepted":true,"role":"workspace"},"views":["workspace","workspace"],"ownerGrant":true,"factoryGrant":true,"factoryDestroyed":false}
AssertionError: a bound owner must block a pending second workspace factory
actual: true; expected: undefined
Exit code: 1
```

A synchronous sibling case existed in `bindWorkspace`: first complete an ordinary workspace `openView`, then bind/activate a different owner. Object-reuse checks did not detect the existing workspace role.

```text
{"bindOutcome":"ACCEPTED","roles":["workspace","workspace"]}
AssertionError: binding must not coexist with an already registered different workspace
Exit code: 1
```

### 2. Inactive bound owner numeric identities were absent from collision checks

Binding created no active view entry. A factory could therefore return distinct objects with the pinned owner's native window ID or WebContents ID and bypass the active-views-only numeric collision check. Binding itself also lacked numeric collision checks against existing entries.

The independent failing case bound owner ID 99/WebContents ID 1099 without activating it, then returned a distinct docs window with the same numeric identities.

Expected: reject/destroy the candidate without destroying or granting the pinned owner. Actual summary:

```text
outcome: { accepted: true, role: 'docs' }
ownerDestroyed: false
candidateDestroyed: false
views: [ { role: 'docs', projectId: 'project_a', epoch: 1, ... } ]
AssertionError: satellite native IDs must not collide with a bound workspace before its activation
Exit code: 1
```

These deliberately hostile adapter identity collisions are synthetic. Their rejection strengthens the core contract; this is not evidence that Electron issued duplicate live IDs.

### 3. Preservation cleared an owner destruction failure without completing destruction

An activated pinned owner whose destruction threw during default `invalidateEpoch()` was correctly retained/fenced. A subsequent workspace-preserving invalidation skipped that retained owner and reset `#destructionFailed` to false, allowing explicit activation of the still-live failed-destruction handle.

Expected: keep the fence and report `WINDOW_DESTROY_FAILED` until the retained handle is actually destroyed. Actual stdout:

```text
{"firstBlocked":true,"secondEpoch":3,"activation":{"accepted":true,"epoch":3},"ownerDestroyed":false}
AssertionError: preserving an owner must not clear its prior failed-destruction fence
Exit code: 1
```

Fourteen additional independent nonblocking scenarios passed on the initial source. They covered pinned object/ID/URL substitution, frame replacement, changed trusted policy, explicit epoch reactivation, protected owner discard, failed satellite discard/retry and both navigation event forms. Those green assertions did not displace the failed cases above.

## Resolution independently verified

The frozen update adds the workspace-role post-await guard to the candidate validation/disposal path; rejects an existing workspace role and numeric identity collisions during binding; compares every candidate against permanently pinned IDs even before activation; and permits preservation to skip the owner only when it is not in the retained failed-destruction set. The new regressions cover all three classes plus the synchronous exclusivity sibling. The reviewer inspected these conditions and their failure/disposal paths.

Final relevant locations: `bindWorkspace` at line 64; `activateWorkspace` at line 76; post-await role/native-ID guards at lines 115/122 inside `openView`; `discardView` at line 210; retained-handle preservation check at line 228 inside `invalidateEpoch`. Approval is tied to the hashes below rather than future moving line numbers.

Independent final focused command, run in `C:/Claude/SIREN_WORK/portable`:

```text
node --test desktop/tests/window-registry.test.mjs
```

Actual result: **34 tests, 34 pass, 0 fail, 0 skipped/cancelled/todo, exit 0**, duration **73.849 ms**. No full suite or native suite ran in this review.

The ignored probe `desktop/evidence/workspace-registry-independent-probe.mjs` also ran with its stdout retained in `desktop/evidence/workspace-registry-independent-final.log`. Git ignore coverage of both files was verified before creation. Command ran in the desktop directory:

```powershell
node evidence/workspace-registry-independent-probe.mjs | Tee-Object -FilePath evidence/workspace-registry-independent-final.log
exit $LASTEXITCODE
```

Actual output, exit 0:

```text
Pending second workspace refused; candidate destroyed; pinned owner retained.
Binding alongside an existing different workspace refused.
Inactive bound-owner window-id collision refused; candidate destroyed.
Inactive bound-owner contents-id collision refused; candidate destroyed.
Preservation retains failed-destruction fence; successful retry destroys owner, which cannot reactivate.
Registry source SHA256: 275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28
Independent final registry scenarios passed: 23
```

Those 23 cases use literal expected refusals/lifecycle outcomes rather than reproducing the implementation predicates. In addition to the resolved reproductions, they separate window-ID and WebContents-ID collisions, check both collision directions, reject reused bound native objects while protecting the owner, reject pinned native/URL/frame substitutions and changed project/mode/access/entity policy, require explicit epoch retirement for a replacement frame, check failed minimized satellite discard/retry, protect the pinned owner from discard, and exercise modern/positional main-versus-subframe navigation. EventEmitter/native adapter fixtures execute the real registry core.

`git diff --check -- desktop/src/windows/registry.mjs desktop/tests/window-registry.test.mjs` exited 0.

## Final identities

Captured after the final focused execution and independent probe:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `desktop/tests/window-registry.test.mjs` | `dc4d846d21db841a052528b42f71779ab0b6a8e4ac2137eccd4286e6b827439c` |
| Ignored independent probe | `18bcb730f6df3fbabab7459e1e456099b7c59b697d7d5e2c33f0004917f6979b` |
| Ignored final stdout log | `caf76f47d8a77bc0d979b3f4bee6a9f045cfa95e6d37b6b3cb10c45dfad2b2b1` |

## Qualification limits

Registry grant absence and simulated native-handle destruction are distinct results. The tests prove synchronous revocation and the adapter contract's destroy/isDestroyed observations; they do not prove actual OS windows disappeared, renderer processes ended, minimized/Audience content was physically removed, or package boundaries retained the module. Workspace preservation keeps a native owner but no grant; only a later trusted activation may establish a new frame/epoch grant. A successful PIN response, renderer bootstrap and native load ordering are not independently exercised here. No native launch, source/content persistence, full-suite run, commit or package artifact was produced by this reviewer. Main integration remains pending and requires its own review/qualification.
