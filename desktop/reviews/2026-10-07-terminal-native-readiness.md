# Terminal native admission preflight — 7 October 2026

Author: `/root/catalogue_view`. **NATIVE_OWNERSHIP_NOT_ADMITTED**. This is a read-only review of the approved Terminal specification/plan, the three 3 October readiness reports, their retained native evidence, current source and bounded tool discovery. No product or test code, manifests, packages, tools, trust settings or execution policy were changed. No native executable, shell-family probe, build or GUI was run.

## What exists now

The earlier isolated candidate did load node-pty **1.1.0** in actual Electron **44.5.1 x64**, Node24.21.0, ABI149/N-API10 on Windows10.0.26200. Real PowerShell `-NoLogo -NoProfile`, Unicode, resize and a 60-second flood were observed. xterm 6.0.0/fit 0.11.0/search 0.16.0 rendered in an isolated hidden renderer. These are retained original-agent results, independently read now, not fresh runtime execution by this reviewer.

Fresh readback at **12:06:06Z** verifies all **42** retained runtime/native/helper/license artifacts against the final inventory, the exact npm lock, and all **11** entries in the owner-readiness evidence manifest. The final inventory/current probe SHA is `57d575585de9c4258f933d89ed22a0a63880024d4697b91b2706aee09c55cf6c`; the actual earlier native run remains bound to `d0b08b123d60c24abbd5921771d31b3f0cf39123f8ba3265e2390fbece5a5afe`. No rerun is invented for the later inventory-only change. Existing Electron executable SHA `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` remains exact.

Key retained inputs:

- `evidence/terminal-candidate-2026-10-02T21-57-33.264Z/{inventory,native-result,host-result}.json`
- `evidence/terminal-candidate-2026-10-02T21-59-34.517Z/inventory.json`
- `evidence/terminal-candidate-dependencies/package-lock.json`
- `evidence/terminal-candidate-cleanup.json`
- `evidence/terminal-owner-readiness/evidence-manifest.json` and its 11 listed files

Exact file/artifact sizes, hashes, original failures, package integrity/resolved values and discovery results are retained in the JSON companion.

The old readiness description of a single-window URL-only IPC and missing source authority is now outdated. Current `WindowRegistry.caller` validates registered webContents, main frame, exact URL, live policy/project and epoch scope; `SourceRepository` exists. The registry still lacks a Terminal role and no product Terminal bridge/native host has been admitted. The12:06Z source snapshot contained only Terminal contracts/output; ROOT's concurrently added pure state/credit work is separate and cannot establish native ownership.

## Actual blockers

**1. Stop containment failed and no guard exists.** The original host receipt says `admitted:false`, `childAliveAfterPtyExit:true` and `nativeJobGuardImplemented:false`. The child disappeared at its own finite fixture deadline. A phase called “completed” means the observation finished; it does not mean ownership passed. The separate 20-PID cleanup observation proves only those recorded PIDs were absent at that historical check, not unknown-family containment. `AttachConsole failed` remains in the original helper log.

The inspected native tree contains a query-only process reader, not `native/terminal-ownership`. Its limited-information handle is closed after querying identity; it does not create Jobs, retain ownership handles, wait for family exit or terminate a session. Its C# compiler recipe cannot be treated as the specified C++ addon toolchain.

**2. Building a main-only guard would leave the session startup race.** The exact retained node-pty 1.1.0 `src/win/conpty.cc` hash is `52c893b689ab3210c0961e2a6aa805a82350003767b21069b164926b5becd4e2`. Lines393–424 initialize one startup-attribute slot for `PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE` and call `CreateProcessW` using `EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT`. This source has no Job-list attribute, suspended-create or Job assignment. Shell execution therefore precedes a later `adoptSession` call. Input gating and `-NoProfile` cannot make that interval atomic.

The host's own pre-adoption utility startup/helper interval must also be qualified. A host Job covers ordinary descendants created after membership; that does not prove already-created helpers were contained. An unchanged node-pty prebuild plus a post-spawn guard is insufficient for the approved per-session Stop/crash contract.

**3. No usable local C++ toolchain was found.** Fresh 12:05Z discovery inspected PATH, conventional VS/vswhere/LLVM/SDK locations, two VS/SDK registry families, Electron/node-gyp caches and bounded D-drive roots. It found Python and two .NET Framework MSBuild executables, but no C++ compiler/linker, VC/SDK directory or build-header cache. npm's node-gyp 12.3.0 and its exact delay-load source do exist; no product `@electron/rebuild` is installed. A rebuild wrapper would not provide the missing compiler/CRT/SDK.

This is bounded discovery, not proof that every arbitrary disk directory lacks a compiler. The old LLVM/xwin/CRT/SDK/Electron documents are metadata only, not acquired payloads. Their digests and recorded download sizes have not been silently upgraded to actual-payload or live-upstream verification.

**4. Packaging and remaining native scenarios are not qualified.** The inventory includes unselected winpty and bundled ConPTY artifacts. A product allowlist must select only required files, preserve helper load/fork paths and resolve notices for anything distributed. The old model-Lock/raw-byte flood cannot certify real PIN/Lock, VT-safe credits, eight sessions, control fairness, IME or portable helper ownership. No product node-pty dependency or native/unpacked Terminal package contract exists.

## Concrete next steps

1. Freeze an isolated guard/probe snapshot and record a small creation/lifetime design delta. Make atomic session membership and the host startup interval explicit before compiling; retain the existing candidate and every adverse.
2. Choose a real build lane. The prior workspace-only route is LLVM 21.1.8+xwin 0.10.0+Microsoft CRT/SDK+Electron 44.5.1 headers/import library, with actual payload/signature/terms checks still outstanding. The earlier 1,530,664,915-byte envelope is historical metadata, excluding extraction/cache overhead. Alternatively, existing `windows-latest` workflows and the launcher `x86_64-pc-windows-msvc` build offer a candidate isolated CI lane: first capture actual VC/SDK/compiler/header identities. A runner label/Rust recipe is not C++ qualification; no CI was launched here.
3. Build a minimal owned addon with explicit tool/sysroot/header/import-library paths and Windows delay-load hook. Record source/tools/link command/PE imports; load the exact addon in actual Electron 44.5.1 x64. Development-Node load alone is insufficient.
4. Implement actual main-owned non-inheritable root Job, held process identities/handles, native host/root exit monitors and bounded authoritative cleanup. Integrate session membership into shell creation, for example a reviewed patch to the pinned ConPTY path combining ordered Job-list and pseudoconsole attributes. Main-only post-spawn adoption does not close the identified race. If the utility host's earlier helper interval remains unresolved, keep admission refused.
5. Qualify finite early-child/grandchild/detached-child fixtures; two-session Stop isolation; natural root exit; abrupt host/main death with JS stalled; handle leaks; refused nested assignment; helper failure; PID/identity uncertainty and 10-second cleanup deadline. Success requires held-handle exit plus owned Job accounting, not merely a successful termination call or PID disappearance.
6. Define the selected native/helper/license allowlist and ASAR-unpacked contract. Hash every shipped native/helper file, then repeat actual Electron/ownership qualification from a Unicode/spaces portable copy without requiring end-user compilers.
7. Continue ROOT's pure manager/lease/output work in parallel. After native admission, integrate the terminal role, ten typed bridge methods, explicit cwd/profile grants, readonly/PIN/epoch checks, own dock/satellite preload and synchronous Lock fence. Fake transports prove control logic only; they never change `admitted:false`.

No new authorization loop is introduced here. The remaining decisions are concrete native design/build/terms scope, followed by actual evidence. No generic PID/name cleanup, hidden execution or source-open auto-run is recommended.

## Review limits and original observations

This reviewer performed only read-only source/JSON/hash/tool discovery. All earlier native results belong to their named original executor. The first readiness timeout, non-cloneable renderer result, publisher prompt, and failed containment remain retained and separately identified. One inline reviewer observer assumed `hostLogs` was an array; it is a string. Only that read-only observer was corrected, and the original log still confirms the helper failure. A Windows rg wildcard syntax error was similarly corrected without changing inspected files.

The specification/plan are project requirements; this audit does not claim their proposed Job mechanism already works. No compiler acquisition, license acceptance, build, native assignment, package execution, release/update/account or full-application Lock qualification occurred.
