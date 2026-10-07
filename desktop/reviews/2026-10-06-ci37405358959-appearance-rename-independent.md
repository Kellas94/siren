# Independent packaged appearance write analysis — 2026-10-06

Author: Codex `/root/shared_workspace_review`. Read-only inspection and independently executed Windows filesystem fixtures. No product source, repository tests, generated output, build output, workflow, CI oracle or deadline was edited. Previous reports were preserved.

## Provenance and scope

Local source inspected at `2c9b4461b0283d55516e879f80aa21fe73259d47`. SHA256: `src/appearance/store.mjs` = `dce3369edc9458d2bda2093e77141944b180a887ee1ccb9c299128cbcb555951`; `src/projects/atomic.mjs` = `261010e6177ecb43a29779ddbb519c7c75277c4372142f3471d921880b79628f`. The store hash equals the appearance probe's recorded hosted input. The atomic helper is current inspected source; that helper's bytes were not separately hashed in the hosted appearance result, and the hosted merge object is unavailable in this local repository. No exact hosted helper-byte identity is asserted.

Original retained evidence: `desktop/evidence/workspace-surface/ci37405358959`. Independently checked the original ZIP: 849592 bytes, 21 entries, SHA256 `1580b87192a31ff7d86126fda364df4e3923deab13164f242589bb6ab2f812e7`. Saved artifact metadata identifies artifact 11387500962, desktop-packaged-evidence, with that size/digest. Saved run metadata records final failure, head 8f3b543c3b11631c628aaed7fe90769b7193fcbf; packaged BUILD-IDENTITY records merge source 98186ada14af62746faf68cc9e253d58f5e058dd and releaseAdmitted=false. This is not the current local metrics source snapshot.

Original appearance result: `package-original/evidence/workspace-appearance/2026-10-06T02-43-15.370Z/result.json`: ADVERSE after six completed cases. The failing condition at native probe line 71 expected persisted Dark and both Studio choosers to agree. Actual retained observations instead report KPMG in Workspace, Code, Docs and Diagram, with the Workspace finite failure code APPEARANCE_WRITE_FAILED. The condition correctly refuses to call this success.

Original `electron.log`, line 144, independently read directly: `SIREN_APPEARANCE_FAILURE {"phase":"before-rename","code":"EPERM"}`. Log SHA256 `5f8c84b10aa9d1e4e59d46a8ad2c4c4afb599dee929bed19a9566f9d271ef178`. My initial `rg --files` listing excluded ignored *.log files; the ZIP was complete. Reading the literal retained path resolved that inspection limitation.

## Findings

Critical: none established. No corruption, unauthorized appearance write, project-source modification or Audience exposure was established.

**Important — appearance change can fail on a Windows replace conflict even while the previous preference remains readable.** `src/projects/atomic.mjs:21-22` makes one guarded rename attempt. `src/appearance/store.mjs:25-29` maps any resulting ordinary filesystem refusal to APPEARANCE_WRITE_FAILED. A real Windows target handle with ReadWrite sharing but no Delete sharing reproduces this behavior with unmodified production modules. This is a concrete reliability failure mechanism consistent with the observed packaged refusal; the exact hosted locker/callstack is not established. User effect: a requested new theme is refused and all views keep the previous saved theme. Current fail-closed behavior retains valid data and is preferable to an unsafe replacement fallback.

**Minor — failed/cancelled precommit writes leave staging files.** `src/projects/atomic.mjs:10-26` closes the staging handle, but has no staging cleanup for pre-rename rejection or rename failure. In my actual store fixture, two Windows rename refusals left two pending UUID files in UI; a later successful save did not remove them; pre-rename retirement left another. Repeated failures can accumulate preference metadata staging files. This is not demonstrated to cause the hosted EPERM, and does not establish leaked project bodies. Cleanup should address only the known temporary file owned by that write, never remove the existing destination or scan/delete arbitrary pending files.

## What the phase proves

The diagnostic phase is the last entered boundary, not a captured filesystem syscall. The before-rename callback first records that phase and then awaits directory revalidation and the current-write guard (`store.mjs:26`); rename follows only if those checks succeed. A failure in that revalidation could also retain phase before-rename. Thus the original log establishes EPERM after entering that boundary, but cannot uniquely identify rename, a source-versus-destination handle, antivirus/indexer, Electron, the test reader, ACLs or a specific locking process. No such identity was observed.

My direct `atomicWrite` experiment separately captures the actual error syscall=rename, code=EPERM, errno=-4048. That is an independently demonstrated candidate mechanism, not the hosted callstack. Current `readOwnedBytes` closes its handle in finally, so source inspection alone does not identify an internal leaked reader handle as the CI cause.

## Independently executed Windows evidence

All owned files and scripts are under `C:/Claude/SIREN_WORK/tmp-appearance-rename-review`. No production profile, native grant, project, application or package was launched.

1. `probe.mjs seed` used actual AppearanceStore to save KPMG successfully. Parent PowerShell then opened only the owned appearance.json and an owned direct-atomic target using FileStream(Read, FileShare.ReadWrite), deliberately omitting Delete sharing. Microsoft's [FileShare documentation](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileshare?view=net-10.0) describes ReadWrite sharing and the separate Delete flag.
2. While those handles remained open, two actual AppearanceStore changes returned APPEARANCE_WRITE_FAILED and emitted exactly before-rename/EPERM; KPMG bytes and readback remained unchanged. The separate actual atomicWrite call captured rename/EPERM/-4048 and preserved its old target bytes. `locked-result.json` retains the complete observations.
3. Both owned streams were disposed in finally. Unmodified AppearanceStore then saved Dark successfully, and unmodified atomicWrite replaced its target successfully. A separate captured-current flag retired at before-rename caused ACCESS_REFUSED and retained Dark. `released-result.json` preserves this control and the orphan staging count. This cancellation case is a store seam, not actual native Lock/IPC timing.

No synthetic EPERM was injected in these actual store/atomic experiments. No application click, native wait or CI retry was performed.

## Minimum candidate handling and its limits

A bounded retry is technically feasible at the rename operation itself, with one already flushed/closed temporary file and one root-serialized store task. It should be opt-in for appearance until broader callers are assessed, retry only observed transient Windows rename failures such as EPERM, and keep a small finite attempt/time budget. EPERM can also be permanent; reaching the bound must still refuse, retain the old file and emit a finite failure diagnostic. Do not replay the complete set operation or every atomicWrite caller: this helper also commits project pointers, sources, recovery records, credentials and update records.

Before every attempt after a delay, revalidate the owned directory and existing regular target and rerun the captured-frame/current-write authority checks. Lock, retirement or navigation must prevent a delayed pending preference from committing. Retry only an error thrown by rename before commit, not a phase-hook failure, after-rename callback, or durable readback failure. Keep the destination in place throughout: no unlink-destination, truncation, direct-overwrite or permission change fallback. On failure clean only the closed, uncommitted staging file. After success retain the current readback contract. Once rename has succeeded, later cancellation cannot be described as preserving the previous bytes; that is the commit point.

Own standalone `candidate.mjs` implements a limited rename-only prototype on owned files, not modified production atomicWrite. It uses at most three attempts with 20/40ms inter-attempt delays. Controlled holder-release handshake is fixture coordination, not a proposed production deadline or CI wait change. `candidate-results.json` records:

| Fixture | Outcome | Rename attempts | Target after operation | Staging left |
|---|---|---:|---|---|
| Actual Windows lock released after first refusal | Committed | 2 | Dark | No |
| Actual Windows lock held throughout | Refused EPERM | 3 | KPMG | No |
| Authority retired after first actual refusal | Refused ACCESS_REFUSED | 1 | KPMG | No |
| Controlled unexpected EIO | Refused immediately | 1 | KPMG | No |

This supports the feasibility of a guarded finite commit retry and cleanup. It does not prove production integration, IPC Lock safety, system-wide timing, optimal delay values or repair of the hosted failure. The prototype's first setup attempt used a .ps1 file and encountered the existing disabled-script execution policy; a subsequent fixture-only inline helper used the same owned-file commands without changing execution policy. One intermediate fixture string edit had a syntax error. Neither setup attempt produced validation evidence; only the final recorded four cases above did. All helper handles/processes were closed.

A narrowly scoped diagnostic could identify rename versus boundary validation and finite attempt count, without paths, PINs or content. It would help the next unmodified strict packaged probe determine whether its failure is the same mechanism. This review proposes no changed UI hit oracle, retry of clicks or longer native deadlines.

## Declined conclusions

The original hosted run remains FINAL FAILURE. Owner-reported native 20/20/17 and full-unit 1087 results are not my executions or independent release evidence. I did not rerun production/native/package qualification. No hosted locker has been identified, no production fix was made, and no packaged/hosted/release PASS is inferred from the isolated reproduction or prototype. Previous reports remain unchanged.