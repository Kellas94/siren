# Independent Terminal Task 3 preflight

Author: /root/hosted_resume_retention. 2026-10-07T15:41:51.097Z. **Pure implementation can proceed; native execution remains NOT_ADMITTED.** Read-only source/contract review only. No tests, GUI, build, dependency change, product mutation or native execution. Existing reports and adverse evidence are untouched.

The approved interfaces already permit a coherent next batch: implement `src/terminal/cwd.mjs` and `profiles.mjs`, test them with injected main-owned picker/filesystem/OS providers, and reuse `policy.mjs` and `contracts.mjs`. The four expected cwd/profile/IPC files listed as missing in the JSON are absent. Existing policy already distinguishes workspace configuration/create/stop from terminal-only attach/input/resize/ACK/detach and refuses Docs/Code/Diagram/Presenter/Audience. Do not duplicate that policy or change public payloads.

## Concrete pure batch

- **cwd:** retain approved `pick(grant) -> {cwdId,projectId,displayPath}` and `resolve(grant,cwdId) -> canonical path`. Keep private bounded tokens with native origin/project/run scope and directory identity. Test cancellation, no fallback/writes, Unicode/literal path handling, protected-root boundaries, replaced/missing/link directories and foreign/stale grants. Inject revocation at every asynchronous inspection and before grant return.
- **profiles:** retain `listShellProfiles()` and `resolveShellProfile(profileId)`. Return only profileId/label/available publicly. Trusted discovery yields absolute PowerShell with immutable `['-NoLogo','-NoProfile']`, never caller argv/env/executable or an imported command. Test unavailable/replaced executable, exact args, copied OS environment, case-insensitive injection filtering and no added app credentials. Optional shells remain unavailable until their discovery/argv policy exists. A focused `terminal-profiles.test.mjs` is a suggested new test file, not an added bridge method.
- **policy/boundary:** extend finite pure checks around the current exact ten methods and live authority callbacks. Reject path/argv/env/command/project fields, copied grants, unsafe modes and late picker/profile completions. Until ownership admission, an actual-host dispatch spy must remain at zero even for a valid pure cwd/profile result. This is model evidence, not Electron IPC qualification.

## Important integration details

`WindowRegistry.caller(event)` supplies native identity, but `isCurrent` accepts only objects recorded through `capture(event)`. Use capture for queued work, plus `captureAdmissionGuard` for monotonic invalidation across freeze/rollback. Passing a fresh caller projection or cloned grant to isCurrent will refuse. Grants contain no mode/access fields: main must provide live getMode/canExecute checks from real authorization, PIN and selected-project/quiescence state. A current originating window guard fences pending selection; later project-bound cwd reuse requires fresh same-project caller authorization.

Protected roots must include the actual relocated Data root and real install/runtime/resources/generated roots. `ownedDirectory` is a useful read-only check with create:false, but does not remember filesystem identity or bind a future spawn atomically. Never create a selected directory or call writableDataRoot. Explicitly define supported Windows namespaces and reparse policy; double quote is an invalid path fixture, not command escaping. Provider/lifecycle/capacity details in the earlier preflight are implementation recommendations, not additional approved renderer controls.

## Real remaining blocks

Pure fake providers cannot establish real Windows reparse/identity discovery, immutable executable selection or native OS environment provenance. Those need later actual adapters and witnesses. Rechecking paths leaves a pre-spawn TOCTOU interval and does not sandbox the shell. Separately, atomic host/session Job membership, the host startup interval, native lifetime monitors, cleanup and exact compiler/SDK/Electron/helper/package qualification block PTY execution and product integration. They do not prevent implementing the pure Task 3 authorities now.

Do not add registry roles, dock/window/UI/preloads/IPC/host/PTY/dependencies/package integration in this pure batch. The existing ledger explicitly returns nativeExecutionAdmitted:false. The JSON records exact approved shapes, suggested files/cases, inspected limits and 15 input hashes; changed inputs during final report capture: 0. This review claims feasibility and concrete boundaries, not implementation or test success.
