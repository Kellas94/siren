# SIREN Code debugger — research and proposed scope

Date: 7 October 2026. Author: /root. User request: add a debugger beside the project Terminal/Code so code can be reviewed and understood. This records the new requirement and a concrete proposal. It is not an implemented feature, an installed dependency or a runtime qualification.

## Recommendation and evidence

Put **Debug inside ⌘ Code**, using a resizable lower pane shared with Terminal and a collapsible Variables sidebar. Keep the main navigation unchanged. Start with Python and use Microsoft's **debugpy** through the **Debug Adapter Protocol (DAP)**, rather than implementing a Python debugger. DAP lets the same UI support future adapters without putting language-specific process APIs in the renderer. The official overview documents breakpoints, stack frames, variables, execution controls and stdin/stdout adapter transport. [DAP overview](https://microsoft.github.io/debug-adapter-protocol/overview.html), [debugpy](https://github.com/microsoft/debugpy).

The official latest-release link resolved to **v1.8.22** during this research; it is a candidate version, not a new dependency pin. The top-level debugpy license is MIT. Its packaging declares vendored components and a ThirdPartyNotices file; the exact candidate artifact, embedded notices, interpreter requirements, hashes and Windows behavior still need inventory/review before bundling. Fetching the notice at guessed root/tag paths did not succeed; no complete transitive-license clearance is claimed. [Release](https://github.com/microsoft/debugpy/releases/tag/v1.8.22), [License](https://github.com/microsoft/debugpy/blob/main/LICENSE), [Packaging](https://github.com/microsoft/debugpy/blob/main/setup.py).

Current SIREN package.json contains the CodeMirror Python grammar, not a Python interpreter/debugger. The approved Terminal design explicitly requires a separately selected working directory and interpreter invocation. Terminal pure contracts exist, but xterm/node-pty are not installed in the inspected product manifest and the real-shell integration is still open. A debugger must build on qualified process ownership and explicit execution; this research does not claim Terminal is shipped.

## User experience

- **Debug** explicitly starts the selected script version. Clicking a gutter line sets/removes a breakpoint; show whether the adapter verified it and the actual accepted line.
- A small toolbar provides Continue/Pause, Next line, Enter function, Leave function and Stop, with tooltips and shortcuts scoped to the active Code window.
- Highlight the currently paused source line. Variables show bounded Before/After values; call stack, watches and conditional breakpoints sit behind an Advanced disclosure.
- Terminal shows program output/input; Debug shows execution state, errors and variables. Both use the existing themes, resize/detach/restore patterns and common window shelf.
- Link a stopped frame to the exact Code source/version and its existing structural diagram when mapping is known. Structural diagrams remain distinct from observed execution; unmapped frames stay visibly unmapped.
- Save a review checkpoint to Docs only explicitly: source/version/hash, interpreter/adapter versions, inputs chosen for that run, stop/exception and selected observations. Never label one execution as proof that all branches or code are correct.

Prefer a first version with ordinary breakpoints, step controls, locals, stack and exception navigation. Conditional expressions, arbitrary evaluation, multiple debug sessions, subprocess attach, remote attach, profiling and time-travel debugging are later scope. A variable inspector can invoke user-defined representation methods in some runtimes; it must not be described as universally side-effect-free.

## Integration and lifecycle

Native authority owns the selected interpreter, project directory, session/process identity and an immutable runnable snapshot. A Docs code block may be virtual and incomplete: explicitly choose a runnable entry file/module and confirm the materialized version before execution; never run the internal source blob or an unsaved editor buffer implicitly. Editing while paused creates a later draft, not a silent change to the running snapshot. Importing or browsing code never executes it or installs packages.

Own the adapter as a separate local process with bounded DAP framing, request correlation, timeouts, cancellation and paged variables/stack. Start with stdio adapter transport and locally owned launch; no public debugger listener or arbitrary process injection. Interactive stdin needs the real Terminal owner and DAP runInTerminal integration; it cannot be simulated by a read-only output console. Main checks project/PIN/role/epoch/session for every command and delivery; renderer receives no generic spawn/socket API or application credentials.

Preserve the user's Lock policy: fence new execution/debug/terminal commands and remove variable/source/output views before Lock completes. Lock itself sends no pause, continue, step or terminate. A running target continues according to its existing execution and breakpoints; an already paused target stays paused until authorized action after Unlock. Do not auto-resume, replay commands or restart a crashed target. Retain only bounded native state and reattach with fresh authority after Unlock. Quit/update/project change must handle owned debug processes consistently with the qualified Terminal lifecycle.

## Implementation sequence and acceptance

1. Qualify the existing Terminal/process-owner foundation; define typed debugger/session/source-snapshot contracts and pending-command/Lock behavior.
2. Isolated Python/debugpy probe with exact interpreter/artifact inventory; real breakpoint verification, stepping, stack/locals and exception cases. No production button before actual execution works.
3. Integrate themed Code controls and bounded Debug pane; connect real Terminal I/O and exact source-to-frame mapping.
4. Native desktop and separate portable-copy tests: Unicode paths, loops/recursion, asynchronous code, large source without full-buffer copying, large variable collections, breakpoint changes, stale versions/windows, Lock during running/paused/input, adapter crash and owned cleanup. Record actual limits; source line count alone is not a debugger performance guarantee.

This proposal extends the approved Terminal work; it does not replace the current defect and UI-parity work. Design details and adapter admission remain to be qualified before implementation is reported complete.
