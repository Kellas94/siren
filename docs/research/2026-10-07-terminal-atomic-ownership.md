# Terminal native ownership — concrete admission delta

Date: 7 October 2026. Author: /root. This records the next isolated probe within the approved Terminal Task1. It is not an implemented guard, a successful native build or an admitted shell.

## Reason for the delta

The independently read retained node-pty1.1.0 `src/win/conpty.cc` hash is `52c893b689ab3210c0961e2a6aa805a82350003767b21069b164926b5becd4e2`. Its six-argument `PtyConnect` builds one startup attribute for the pseudoconsole and calls CreateProcessW. An owner which only adopts the shell after that call leaves a window in which early descendants may escape the intended per-session Job. The old actual candidate remains NOT_ADMITTED: a Start-Process child survived PTY Stop. No result is replaced by this design note.

Microsoft documents `PROC_THREAD_ATTRIBUTE_JOB_LIST` as an ordered list of Job handles assigned to the child being created, supported from Windows10/Server2016. Attribute backing storage must remain alive until the attribute list is destroyed. [Microsoft API contract](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute).

Inference for this isolated probe: test Job membership as part of shell creation, alongside the pseudoconsole attribute, before any shell thread executes. Do not infer that an unchanged node-pty prebuild plus post-spawn adoption qualifies this requirement. Actual nesting/inheritance, handle lifetime, error paths and helper containment must be measured on the selected Windows build.

## Proposed probe changes

Preserve the exact original candidate tree and receipts. Make a separate source-only clone and retain an explicit diff against the pinned source; do not edit node_modules in the product or the original probe. Start from the exact six-argument PtyConnect path and extend only the isolated candidate's native-owned call envelope to obtain the required verified Job handle(s). Update the JS/TypeScript call and native argument checks together. Do not silently use upstream main as the source for version1.1.0.

The main-owned native guard holds non-inheritable root/session Jobs and real process identities/handles. A host receives only handles explicitly duplicated into that exact trusted host process by native code, not arbitrary PID/handle values supplied by a renderer or saved project. The host cannot create a PTY until its root containment is confirmed. Create the session ownership context before shell creation. The native connect path combines pseudoconsole and Job-list attributes, keeps all backing storage alive, refuses unknown handles or attribute/assignment failure, and cleans every partially initialized resource without reporting a running session.

Qualify the correct ordered Job list against actual inherited host membership. Do not guess that assigning an already inherited Job twice works, or that a newly created nested Job already has the intended parent relationship. Verify both host and session membership through held identities before issuing an input lease. Include early descendants and every selected node-pty helper in the creation/lifetime observation. A still-unresolved utility-host or helper startup interval keeps admission refused.

Stop is session-scoped and succeeds only after held-handle exit and owned Job accounting. A native root-exit/host-loss monitor must work while main JavaScript is stalled. The owner close path retains kill-on-last-handle-close semantics and does not leak duplicate handles which keep the Job alive. No journal/PID search can restore authority. Lock invokes neither termination nor pause; its separately acknowledged host input fence still has to work.

## Build lane and evidence

Prefer an isolated build on the existing Windows CI infrastructure over adding a large compiler/sysroot download to the user's PC, **conditional on actual tool discovery**. Record runner image, VC/SDK/compiler/linker/delay-load-hook and Electron44.5.1 headers/import-library identities, explicit compile/link commands, source diff, PE imports, selected artifacts and notices. A runner label or an existing Rust launcher build is not proof that the C++ addon was built correctly. No new workflow was created or launched by this note.

Build tools remain outside the product package. Candidate native output must load in actual Electron44.5.1 x64 utilityProcess with its recorded Node/ABI/N-API/OS versions; development-Node success alone is insufficient. Keep all first failures. End users receive compiled artifacts only after admission, with no compiler or SDK requirement.

Required finite adversarial observations: immediate early-child/grandchild and console-detached child, two-session Stop isolation, natural root exit, abrupt host/main loss, stalled main loop, refused nested assignment, stale/unknown held identity, helper timeout, duplicate-handle leak, failed startup cleanup and the10-second stop deadline. Also verify that a live command continues through Lock, no late/replayed input reaches PTY, and output stays bounded. Package/unpacked native paths, notices and hashes then need separate portable-copy qualification.

## Status

No new dependency, compiler installation, license acceptance, native build, guard, patched node-pty binary, shell launch or qualification is delivered here. Pure contracts/output/session-state/credits/policy may continue independently. Task1 native admission, real manager/host, cwd/profile grants, Terminal registry/bridge/views and packaged ownership matrix remain open. Related: `desktop/reviews/2026-10-07-terminal-native-readiness.md` and the approved `docs/superpowers/plans/2026-10-03-siren-terminal.md`.
