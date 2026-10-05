# Workspace surface foundation — implementer evidence

Author: root implementation agent. Date: 2026-10-05. This report is not an independent evaluator approval or a release gate.

The main-only primitive reparents one actual WebContentsView between its hidden native BaseWindow shell and the bound main window. Its Code editor/Docs draft, webContents/frame identity, selection and Code undo history remain in the same renderer. Secure native preferences remain forced. The production main/factory/preloads/UI still use the existing windows; this primitive is deliberately inactive until the async lifecycle and dock UI are integrated.

Retirement conceals/removes the sensitive view synchronously and confirms the actual renderer destroyed event and native shell destruction before success. Synchronous retirement refuses a surviving surface renderer. Async epoch/discard/close paths retain failures, fence admission, retry actual cleanup and refuse superseded epoch receipts. External native shell/renderer close and fallible native initialization retain concrete handles; a factory error cannot dispose a previously admitted owner. The package whitelist includes the imported source module.

## Current evidence

- Final frozen full suite: **1035/1035**, zero fail/skip/cancel/todo, native process exit 0; every captured src/build/scripts/tests/package/baseline input unchanged. Log SHA-256: 4e39c2eb190329ba9e58b1171bbf61e71776849db9ed0a8c0bae60c994aa8de7. Evidence: evidence/workspace-surface/full-suite-2026-10-05T16-41-40.836Z.
- Actual isolated Electron 44.5.1 foundation fixture: **6 complete cases**, two real Code editors and two real Docs draft models, 12 attach/detach cycles, exact text/selection/identity/native frame/caller role preservation, Code undo/redo, disk data invariance during movement, actual self-close and external shell-close fence, actual async all-surface destruction. Zero remaining native windows and unchanged inputs. Evidence: evidence/workspace-surface/2026-10-05T16-39-31.662Z. Docs uses its real draft model plus a fixture textarea, not the production Docs interface. No document save authority is granted by this fixture.
- Actual existing application native Window/menu/geometry/restore/main/Lock probe: **9 complete cases**, unchanged captured inputs and project/source bytes. Evidence: evidence/window-focus/2026-10-05T16-40-20.329Z. This checks the current production window path, not activation of the new surface.
- Separate independent review: initial P1/P2 findings were preserved, observed RED by root, repaired, then independently reprobed. Original report SHA-256 1ca01223e5d05452965d9735d0b856cad82c55c137f43480755a2bc41c2e88ed; follow-up bbe40e767c40adefd984a262505485475765c4a45a4bf81ea15cb827108678a2. The reviewers' actual scope/probes are in their own reports; root does not author their verdict.

## Adverse evidence retained

Initial direct BrowserWindow adoption refusal and BaseWindow shell-only destruction survived-renderer probe are retained under evidence/dock-adoption. The initial Base probe's status COMPLETE is insufficient: its destroyed.wcDestroyed=false is explicitly adverse cleanup evidence. Corrected prototype then waited for the real destroyed event before closure.

Initial native fixture 2026-10-05T16-29-31.038Z failed before its cases due to an incorrect fixture project JSON field. It is preserved; only that fixture field was repaired. Initial native five-case success 16-30-05.502Z and full1031 suite are historical pre-review-fix evidence, not qualification of the final source.

The older tests/native/window-shells.mjs run at evidence/native-window-shells-2026-10-05T16-33-58.087Z is ADVERSE at its role-privacy sentinel assertion (true versus false). Its later close/Lock assertions were not reached. Root does not claim a causal fix or relabel this run; the fresh current nine-case application probe is a separate scope.

## Next approved integration

Task4 remains open. Wire optional Code/Docs surface creation into the native factory with awaited failed-admission disposal; update all close, Lock, Quit and selection adapters to await the new retirement contract; route focus/geometry to the visible owner while preserving logical native grants. Add a restrained common dock/shelf and attach/detach UI without duplicate renderer/subscriptions/source copies. Qualify genuine dirty Code+Docs common save, failure/refusal and native close/Lock through that activated path, then actual committed development package and remote draft synchronization. No new guide command is claimed before it exists. Physical unplug/DPI settings, whole Task4/6 and production release remain unqualified. The installed app, main branch, remote feature and prior qualified development package remain unchanged by this local lot.
