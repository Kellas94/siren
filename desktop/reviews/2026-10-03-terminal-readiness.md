# Terminal implementation readiness

Date: 3 October 2026. Author: `/root/terminal_contract`. Read-only runtime/research inspection plus Terminal design/plan preparation. No product source/dependency changes, installation, native shell probe, commits or evaluator approval were performed by this agent.

Documents: [design](../../docs/superpowers/specs/2026-10-03-siren-terminal-design.md), [plan](../../docs/superpowers/plans/2026-10-03-siren-terminal.md). The user's real-shell implementation-with-agents instruction and Lock policy are preserved; there is no new permission request.

| Boundary | Observed state | Required next evidence |
| --- | --- | --- |
| Main/IPC/preload | Single BrowserWindow, exact app URL/main-frame gate, no registered caller epoch or Terminal methods | Stable native registry/coordinator; typed terminal-role access before product shell |
| Source authority | Approved Sources plan; virtual sources are not directories | Stable SourceRepository/manifest receipts, explicit cwd grants |
| Lock | Existing PIN transition drains main renderer/writes | Close terminal input synchronously before drain; destroy data views, keep host running/ring draining |
| Runtime | Inventory reports Electron 44.5.1 x64/Node 24.21.0; build Node differs | Actual utility host modules/napi ABI, OS build, addon load/build hashes |
| Candidate dependencies | Research observes node-pty 1.1.0, xterm 6.0.0, fit 0.11.0, search 0.16.0, declared MIT | Actual installed graph/integrities/native/helper/notice inventory; no admission yet |
| Process cleanup | Existing process helper reads PID/path/start time; it is not a family lifetime guard | Demonstrated owner/host-loss containment and console-detached child cleanup |
| Packaging | Positive source allowlist, ASAR receipt; no Terminal native/unpacked contract | Native/helper relative-path allowlist, unpack placement and complete hash-bound release graph |

Primary source inspection found that pinned [node-pty v1.1.0 Windows agent](https://raw.githubusercontent.com/microsoft/node-pty/v1.1.0/src/windowsPtyAgent.ts) still contains winpty fallback, checks ConPTY at build >=18309, and falls back to the shell PID after its console-list discovery timeout. Current upstream main differs and must not be substituted as pinned-artifact evidence. The pinned ConPTY setup and internal helper-fork path need actual Electron utilityProcess startup testing; a load test under local build Node is insufficient. The candidate OS-inbox ConPTY selection does not by itself prove detached-family or abrupt-crash cleanup.

The design therefore chooses a separate host, bounded native raw-output rings, main-mediated credit/control lanes, generation-bound input and display-only replay. Dock uses its own registered terminal-role WebContentsView; detachment uses a terminal BrowserWindow. It specifies a proposed small main-only native Job guard with held host/session process handles, kill-on-close/non-breakaway Jobs and native host/root-exit monitors, with session adoption before any input grant. Its actual implementation, assignment/inheritance and cleanup have not been established here. No numeric ABI, native performance, physical multi-monitor result, complete native license obligation or clean process-family result is claimed.

First implementation excludes automatic source execution, Run version, full disk transcript capture/Docs persistence, AI, online account backend and public signed updater release. Those exclusions do not prevent authorized Source/native-window work or the isolated Terminal probe. Missing candidate evidence is a technical admission condition, not a request to reapprove the user's chosen behavior.
