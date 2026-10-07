# SIREN: real project-linked Terminal

Date: 3 October 2026. Author: `/root/terminal_contract`. Implementation preparation under the user's explicit instruction to start implementation with scoped agents. This document makes the chosen real-shell and Lock behavior concrete; it does not claim an installed dependency, native qualification, evaluator approval, public release, or account backend. No additional authorization loop is introduced for the work already requested.

## Intent and scope

The user can work in an actual shell associated with the current project, inspect code beside its output, and detach the terminal onto another monitor. Work already submitted to the shell continues when SIREN locks. Every new input path closes before the application locks; a program asking for input waits until Unlock. Lock does not suspend processes, send Ctrl+C, close stdin, stop a pipeline, or cancel OS permissions.

The first implementation provides PowerShell, session tabs, explicit working-directory selection, resize, search, clear-view, Stop, detach/attach and the common window shelf. The shell and directory are visible. A terminal is local and runs with the user's OS privileges; the local PIN protects SIREN access, not arbitrary code execution at OS level. AI remains last. Online accounts and eventual public signed binary updates are separate work; private application source is not published by this feature.

Opening/importing/viewing a source never executes it. There is no `autoRun`, saved startup command, imported executable, renderer-controlled environment, or automatic command replay. Python is available only if the user separately has and invokes it; an editor grammar is not an interpreter.

## Prerequisites and current evidence

Read with the approved [large-source design](2026-10-02-siren-large-sources-design.md), [native-workspaces design](2026-10-02-siren-native-workspaces-design.md), their plans, and [Terminal research](../../research/2026-10-03-siren-terminal.md).

The inspected `main.mjs` creates one BrowserWindow. `ipc.mjs` accepts an exact app URL/main-frame check but has no registry/caller epoch; `preload.cjs` has no Terminal API. `protocol.mjs` serves only `app.html`; packaging uses a positive source-file allowlist and currently has no native-addon unpacking contract. Terminal must consume the planned registry/coordinator and SourceRepository, rather than copying single-window authorization or exposing spawn through the existing generic desktop invoke.

Pure contract, ring-buffer and policy tests and an isolated candidate probe can progress independently. Product shell creation waits for actual registry/epoch authority, source receipts and the native qualification in this plan. Completing Sources and native windows is required integration work, not another user-permission request.

## Architecture and alternatives

Use locally bundled xterm.js in a dedicated terminal view, a native `TerminalManager` in main, and one Electron utility process owning all node-pty instances on one JS thread. Main mediates every message; no host MessagePort is transferred directly to a renderer. A native owner guard must establish process-family lifetime before the host is allowed to spawn a shell. The guard's actual mechanism is qualified in the isolated probe, not assumed from `pty.kill()`.

Plain `child_process` pipes cannot provide the full interactive terminal behavior selected by the user. A bespoke ConPTY implementation would add unnecessary native maintenance. node-pty/ConPTY is the candidate, conditional on the exact pinned artifact working in Electron and meeting ownership tests. node-pty's own packaged helpers are part of that artifact; the application's rule against multiple worker-thread PTY instances does not pretend upstream has no internal helper threads. [node-pty](https://github.com/microsoft/node-pty), [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process).

File responsibilities:

| File | Responsibility |
| --- | --- |
| `desktop/src/terminal/contracts.mjs` | Strict request/event validation and exact finite budgets |
| `desktop/src/terminal/policy.mjs` | Registry/PIN/mode/project/epoch/session/lease authorization |
| `desktop/src/terminal/cwd.mjs` | Native directory picker grants and canonical-directory validation |
| `desktop/src/terminal/profiles.mjs` | Native-owned shell discovery and immutable argv/environment policy |
| `desktop/src/terminal/manager.mjs` | Sessions, input fence, attachment leases, main-to-host transport |
| `desktop/src/terminal/host.mjs` | Only application module that imports node-pty; PTY callbacks and native ring |
| `desktop/src/terminal/output.mjs` | UTF-8 budgets, sequence/gap accounting, bounded delivery and VT sequence filter |
| `desktop/src/terminal/ownership.mjs` | Qualified owner-guard adapter, held process identities/handles and cleanup receipts |
| `desktop/native/terminal-ownership/{binding.gyp,ownership.cc}` | Proposed small main-only Windows Job/handle guard, built and qualified for the actual runtime |
| `desktop/src/ui/terminal/{client,view}.js` | Typed bridge and xterm lifecycle; no Node privileges |

The host receives the minimum spawn envelope, not source bytes, project snapshots, PIN values, account tokens or AI keys. Its environment derives from a main-owned OS snapshot, preserves required OS variables such as `SystemRoot` and PATH, and removes Electron/Node injection variables including `NODE_OPTIONS`, `NODE_PATH`, `ELECTRON_RUN_AS_NODE`, `ELECTRON_NO_ASAR` and `ELECTRON_EXTRA_LAUNCH_ARGS`. Main supplies no application credentials. This is privilege separation inside SIREN, not a claim that the shell cannot read files available to its OS user.

## Caller and IPC contracts

All IDs are opaque native-issued IDs, using the project's existing bounded ID syntax. Numbers are safe nonnegative integers unless a narrower bound is stated. Payloads reject unknown keys, prototype-bearing non-data objects, wrong types and excessive byte sizes. Main obtains `Grant` from `WindowRegistry.caller(event)` and verifies live webContents identity, current main frame, exact role URL, active project, epoch, mode and local PIN on every call and after every await before a side effect or delivery. A matching URL by itself never authorizes a caller.

Extend the native role set with `terminal`. Workspace may pick a cwd/profile, create/list a project session and open a Terminal view; input requires the native-issued active terminal attachment, whether displayed in the dock or satellite. Code/Docs/Presenter/Audience never receive execution methods. The dock is a native WebContentsView with its own registered webContents/main frame, terminal-only preload and the same minimal entrypoint as a satellite BrowserWindow. It is added to the workspace's contentView; main validates/clamps layout requests against workspace content bounds. Registry records `surfaceKind:'dock'|'window'` and a native parent window ID for a dock, without inheriting the parent's role/grants. Main explicitly closes dock webContents at Lock/close; removing a visual child alone is insufficient. Close/minimize/detach changes the view, not shell ownership. [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view).

```ts
type TerminalRequest = { operationId: string; epoch: number };
type CwdGrant = { cwdId: string; projectId: string; displayPath: string };
type ShellProfile = { profileId: string; label: string; available: boolean };
type SessionInfo = {
  sessionId: string; projectId: string; profileId: string; cwdDisplay: string;
  state: 'starting'|'running'|'exited'|'host-failed'|'stopping'|'cleanup-failed';
  exitCode: number|null; droppedUtf8Bytes: number; attachedWindowId: string|null;
};
type Attachment = {
  session: SessionInfo; leaseId: string; generation: number;
  firstSequence: number; nextSequence: number; droppedUtf8Bytes: number;
};
type Receipt<T> = { ok: true; operationId: string; value: T }
  | { ok: false; operationId: string; code: string; message: string };
```

Bridge methods, each async and available only to its native-authorized role:

| Method | Exact payload after `TerminalRequest` | Result |
| --- | --- | --- |
| `terminalPickCwd` | no extra fields | `Receipt<CwdGrant>`; native dialog, no renderer path |
| `terminalListProfiles` | no extra fields | `Receipt<ShellProfile[]>` |
| `terminalCreate` | `cwdId, profileId, cols, rows` | `Receipt<SessionInfo>`; shell only, no command |
| `terminalList` | no extra fields | `Receipt<SessionInfo[]>` for current project |
| `terminalAttach` | `sessionId` | `Receipt<Attachment>`; one active attachment |
| `terminalInput` | `sessionId, leaseId, generation, inputSequence, data` | `Receipt<{inputSequence, accepted:true}>` |
| `terminalResize` | `sessionId, leaseId, generation, cols, rows` | `Receipt<{cols,rows}>` |
| `terminalAck` | `sessionId, leaseId, generation, throughSequence` | `Receipt<{throughSequence}>` |
| `terminalDetach` | `sessionId, leaseId, generation` | `Receipt<SessionInfo>`; discard lease |
| `terminalStop` | `sessionId` | `Receipt<SessionInfo>` after cleanup verification |

Typed events are `terminalData={epoch,sessionId,leaseId,generation,sequence,data,utf8Bytes}`, `terminalGap={epoch,sessionId,leaseId,generation,droppedUtf8Bytes,resumeSequence}`, and `terminalState={epoch,session}`. Events never broadcast all project output. Preload filters shapes and returns a disposer for each subscription; main checks the current grant before send. `terminalInput` accepts at most 32 KiB UTF-8, including typed characters, paste, Ctrl+C and xterm-generated protocol replies. The UI has at most 256 KiB queued input; overflow refuses the whole pending paste without partial hidden submission. Main and host both fence input immediately before `pty.write`.

Session IDs are bound to one project and app run. An attach invalidates the previous lease; grants cannot take a session from another project. Input sequences increase strictly within one generation. Duplicate sequence with the same payload hash returns the prior receipt, without writing twice; conflicting duplicates or skipped sequences refuse. Keep only the latest 256 hashes/receipts, then return `INPUT_RECEIPT_EXPIRED` for older input. A lost ACK is ambiguous, not permission to resubmit text under a new sequence. The host has no persisted command queue and discards not-yet-written input when its generation closes.

Execution-capable operations (`create`, `attach` with input grant, `input`, `resize`, `stop`) require normal writable local mode and an unlocked PIN. readonly/recovery never creates a shell and cannot use PIN to escape safety mode. Entering a safety mode closes all input fences immediately and invokes explicit session cleanup through the coordinator; cleanup failure remains visible. A passive session metadata list is allowed only to a current unlocked eligible project view. Locked output and metadata stay native.

## Explicit cwd and source authority

`terminalPickCwd` derives project identity from the registered caller and presents a native directory dialog. It canonicalizes the chosen directory, checks that it still exists and is a directory, and issues a project-bound `cwdId`. Reject SIREN's installation/runtime directories and its owned Data tree, including immutable blobs, recovery, credentials and journals. A project with only virtual sources has no implied filesystem cwd. No fallback to process cwd, temporary extraction, user home or the blob directory occurs on cancellation or missing directory. Canonical paths with spaces, Unicode and supported drive roots are tested; redirected/replaced paths are revalidated before spawn. The grant remembers the selected canonical directory, not an authority to claim any descendant is sandboxed.

The initial profile is the absolute Windows PowerShell executable resolved by main with `['-NoLogo','-NoProfile']`, normal interactive behavior and no `-NonInteractive`, `-Command` or changed execution policy. Optional PowerShell 7 or cmd profiles are offered only when main discovers an actual executable and pins their native argv. No renderer path/argv/env is accepted. PATH commands the user types are normal OS shell behavior.

SourceRepository and SourceRef remain the source authority. This first lot offers “Terminal here” only after cwd selection, and it opens a shell without running text. “Run version” and “Save output to Docs” are separate future explicit actions: they must use an immutable source version/hash, an independently displayed materialized path and the normal Docs version receipt. No helper reads a raw internal blob as an executable. They are not silently implemented as import/open side effects or promised by this lot.

## Bounded output and view lifecycle

Initial implementation budgets, to be measured rather than described as qualified performance:

| Resource | Exact cap |
| --- | ---: |
| Sessions per project/app run | 8 |
| Host raw-output ring per session | 4 MiB UTF-8 |
| Sum of raw rings | 32 MiB UTF-8 |
| One output delivery | 32 KiB UTF-8 |
| Unacknowledged delivery per attachment | 256 KiB UTF-8 |
| Host-to-main unacknowledged delivery total | 2 MiB UTF-8 |
| UI input queue per attachment | 256 KiB UTF-8 |
| xterm scrollback | 10,000 lines |
| PTY dimensions | 2–500 columns; 1–200 rows |
| Incomplete VT control sequence retained by filter | 4 KiB UTF-8 |

The host always drains PTY output into its bounded ring; rendering backpressure never pauses the shell. Ring overflow drops the oldest complete UTF-8-safe data chunks and advances sequence/gap accounting. A single enormous upstream string is streamed/split without retaining a second full-log copy. PTY output transport to main and the renderer uses credits; a credit is returned only after xterm's `write(data, callback)` processing callback. Receipt/resize/input/Lock messages use a separate bounded control lane, so flood output cannot delay the input fence. `handleFlowControl` stays false; Ctrl+S/Ctrl+Q do not become SIREN flow-control commands. This adapts xterm ACK guidance to the user's requirement that Locked output keep draining. [xterm flow control](https://xtermjs.org/docs/guides/flowcontrol/).

When no view is attached, when its credit is exhausted, or when it locks, the host does not enqueue renderer IPC indefinitely. It retains only the ring. Once credits return, missing sequences produce a visible `terminalGap` and resume at the retained tail. Clear is clear-view; it does not type a shell command or pretend to erase the native tail. Search covers the retained view buffer and labels that coverage; it is not a full disk log. Full disk capture is absent from this lot. Hidden/minimized views can release attachment credits while preserving session identity.

Output is untrusted VT data, never HTML, Markdown, SIREN commands or executable IPC. Bundle xterm and only fit/search locally. Disable hyperlink activation, clipboard writes/OSC52, title changes, image/WebGL addons and external navigation. A streaming VT budget filter discards a control sequence longer than 4 KiB until its terminator, keeps filter state bounded across chunks, and reports that display data was omitted. DOM labels use text. Clipboard paste is a user input action; multiline paste shows the text for review before submission, and nothing is pasted while locked. [xterm security](https://xtermjs.org/docs/guides/security/).

Unlock creates a new emulator and lease. Retained-tail replay is display-only: `onData` and generated reply forwarding are disabled during replay, then activated only after replay completion and a live input grant check. A truncated tail is labeled incomplete history; replay is not promised to reconstruct an exact alternate-screen state. This avoids mistaking an old terminal query response for newly authorized input. No source or output is shown in a locked renderer.

## Lock, selection, Stop, Quit and failure

`TerminalManager.closeInput(reason)` is the first synchronous step of Lock, before editor drain, PIN transition awaits or any Lock ACK. It rejects all newly arriving keyboard/paste/menu/protocol input in main and revokes attachment generations in the host. Already delivered commands and shell pipelines continue. Host ACK establishes the completed input fence; it does not wait for shell exit or output completion. Terminal routing stops, subscriptions are disposed and data-bearing dock/satellite views are destroyed before the coordinator returns Lock success. Output continues into the ring; `pty.pause`, `kill`, Ctrl+C and stdin close are forbidden in this path.

If document drain fails, the common coordinator reports Lock failure and retains work. Input can resume only by issuing fresh attachment generations after rollback; old leases and queued paste stay invalid. A prompt can stay pending for as long as SIREN remains locked. Wrong PIN leaves native sessions running and data hidden. Correct PIN recreates views only when the existing safety mode allows it. Resize comes only from a live attachment; the shell keeps its last dimensions while locked.

Project selection with active sessions presents a native choice: cancel selection or Stop sessions and switch. No session is silently reassigned to the new project. A view close offers keep session in background or Stop; Ctrl+W closes the view, Ctrl+C submits user input only while unlocked, and Stop is the explicit termination action. A minimized workspace keeps sessions alive. Main close/Ctrl+Q and restart/update with active sessions offer cancel or terminate owned sessions and continue; no clean-close/restart receipt precedes verified cleanup. The existing unqualified update helper remains unqualified.

Normal Stop first closes the session input fence, then invokes the qualified ownership adapter. Return success only after the exact owned shell/helpers/process family has exited. A session with unknown ownership or failed cleanup stays `cleanup-failed`; no kill-by-name, indiscriminate PID-tree sweep, or PID-only restart cleanup is permitted. Renderer crash revokes its lease and leaves shell/ring running. Host crash marks all sessions `host-failed`; no automatic host/shell restart or command replay occurs. Owner/app crash is covered by the native lifetime guard; startup displays prior session metadata as terminated/unverified, never restores a live PID from a journal as authority.

The proposed guard is a small SIREN-owned Windows native module loaded only in main; it does not import node-pty. It creates a non-breakaway host Job with kill-on-last-handle-close, assigns the utility host before the host can create PTYs, holds actual process/Job handles and monitors host death natively to terminate the Job even if main's JS loop is delayed. A nested per-session Job adopts the freshly created, no-profile shell before an input lease is issued. Main verifies the shell's held identity and membership in the host Job; session Job assignment failure refuses the session. Stop terminates that session Job and verifies absence through held handles/Job accounting, rather than searching process names. Owner main exit closes its Job handles; host loss triggers the native monitor; session-root exit cleans its remaining owned family. The startup/adoption interval and helpers must be included in the qualification: any startup descendant not contained correctly prevents admission. This is a concrete proposed mechanism, not a statement that the module or Job assignment already exists. [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).

`ownership.startHost({hostProcessIdentity})` returns `{hostOwnerId}` only after native host containment; `adoptSession({hostOwnerId,sessionId,shellProcessIdentity})` returns `{sessionOwnerId}` only after session containment. `stopSession({sessionOwnerId,deadlineMs})` and `stopAll({hostOwnerId,deadlineMs})` return `{ok,verifiedExited,code?}`; `verifyExit({ownerId})` returns `{verifiedExited,remainingCount,identityKnown}`. All IDs/handles stay native. No renderer or saved journal can create them. Require held PID/path/start-time identity plus actual process handle; unknown identity refuses adoption. Initial native stop deadline is 10 seconds and failure is explicit, with retained diagnostic state. An arbitrary external OS service/process deliberately launched through another system broker is outside the owned family; the OS shell is not sandboxed.

## Native dependency and distribution admission

Candidate pins: `node-pty 1.1.0`, `@xterm/xterm 6.0.0`, `@xterm/addon-fit 0.11.0`, `@xterm/addon-search 0.16.0`. Top-level manifests declare MIT. node-pty declares `node-addon-api ^7.1.0`; its resolved version and license file, packaged native/third-party artifacts, build tools and helpers are not yet inventoried. Pin and hash the actual resolved graph before admission; do not extrapolate complete MIT licensing from the top-level label. [pinned node-pty manifest](https://raw.githubusercontent.com/microsoft/node-pty/v1.1.0/package.json).

The observed SIREN runtime is Electron 44.5.1/Windows x64 with Node 24.21.0; local build Node 24.16.0 is different. The numeric `process.versions.modules` ABI and `napi` must be recorded from the actual utility host and packaged binary, together with Electron/Node/V8/arch/OS build. They have not been measured here. A successful load under build Node, or node-addon-api use, does not prove Electron host compatibility. Rebuild or use a verified compatible prebuild for exactly 44.5.1/x64; preserve the Windows delay-load hook and record addon build identity. Every Electron change requalifies the addon. [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

For this pinned release, use explicitly qualified OS-inbox ConPTY (`useConpty:true`, `useConptyDll:false`) and refuse the winpty branch. Its source chooses ConPTY at Windows build >=18309, which is an upstream branch fact, not a qualified SIREN support-floor promise. Current upstream main has different winpty behavior and is not the evidence for 1.1.0. Its Windows kill path may fall back to only the shell PID after console discovery timeout; neither that path nor a utility-process kill establishes detached-family cleanup. Inspect/reproduce startup helper stalls, helper fork behavior under Electron utilityProcess and cleanup before deciding admission. [pinned Windows agent](https://raw.githubusercontent.com/microsoft/node-pty/v1.1.0/src/windowsPtyAgent.ts).

The isolated probe inventories every selected `.node`, helper JS, DLL/EXE and runtime license file, including the proposed SIREN Job guard and its build inputs. Packaging must include required node-pty internal helpers at their actual relative paths and unpack native/helper files outside ASAR where their loading/spawn requires it. Source and output directories are not package inputs. Package receipts hash both ASAR and all unpacked/helper/native artifacts; eventual release signatures cover the complete release graph. End users receive ready binaries and are never asked for compilers/build tools. No product manifest or dependency has been changed by this preparation.

## Qualification and acceptance

Native acceptance uses declared hardware, OS build, actual runtime/addon hashes and independently fixed output/process expectations. Required evidence: interactive shell and no-profile startup; ANSI/Unicode/IME/selection; fit/resize; reviewed multiline paste; search/clear/themes; eight sessions; native detach/reattach; wrong role/frame/epoch/lease input; readonly/recovery refusal; Lock during input/flood; timed completion while Locked and prompt waiting for Unlock; truncated history; replay producing zero PTY input; old queued input rejected; renderer crash; Stop of child/grandchild/console-detached child; host/main abrupt death; PID reuse/unknown ownership; portable launch from Unicode/spaces path without build tools.

Flood runs for at least 60 seconds with a finite fixture output budget and then terminates itself independently; record peak process memory, retained/omitted bytes, Ctrl+C and Lock latency. Targets are input/Lock fence within 500 ms and no sustained output-queue growth after configured caps; these are qualification targets, not existing measured results. VT control-sequence abuse and a 10 MiB single line must preserve the same queue/control bounds. Do not extend a failed timeout or rerun until it passes without retaining the failure.

The isolated host probe may precede stable windows/sources. Product integration follows Sources 1–3 → native registry/owner → stable Code/Docs lifecycle → qualified Terminal manager/bridge/view → final native/packaged matrix. First-lot acceptance excludes Run version, transcript-to-Docs, AI, online account service and a public updater release. Missing qualifications remain written as open evidence; automated tests and document preparation are not evaluator approval.
