# Source foundation package: native qualification incomplete

Author `/root`, 3 October 2026 Europe/Bucharest. This records actual root execution; it is not an independent evaluator verdict.

Source commit `1e11a47327bfd012af122816aebc45d48bb3d4bf`, development package `desktop/dist/development-27a258e2-d38f-481e-ac6c-9d3c52e4751d`. Actual archive is 14,353,503 bytes, SHA256 `11b8ce4e4c281e50a262c7457af9d53280f6077a5105ba5ed2765066e6ee5539`; renderer SHA256 `fce4cf13ec180acd7823e2dcc597ea6e0c699b40d80b2ea369556a3bf170cfa0`; unchanged Electron executable SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. `evidence/source-foundation-package-bytes.json` confirms the ten inspected actual ASAR modules match committed sources and the emitted renderer. This establishes bytes, not functional qualification.

The unchanged packaged probe SHA256 `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541` **FAILED**, exit 1. Original evidence is `evidence/packaged-2026-10-02T22-18-48.253Z`. Operation 14 was the first post-unlock renderer-reload wait in `unlockDesktop`. `Runtime.evaluate` timed out at the existing 20-second command deadline. The event log contains original contexts and loading start, without a new committed navigation/default context. Further state observation also timed out. There is no save diagnostic: the probe had not reached save/restore or package movement. Do not describe this as CI26's later post-restore save failure or as evidence that selection quiescence caused it.

The preceding stable-source Node suite is independently recorded as 185/185 passed in `2026-10-03-source-task3-evidence.md`. That suite deliberately excluded the then-unintegrated WindowRegistry tests. It does not replace this native failure. No whole-product native PASS, release admission, clean-PC portability, physical multiple-monitor coverage or historical CI26 fix is claimed.

## Causal investigation, still inconclusive

Read-only review by `/root/recovery_diagnostics` found the driver, preload, protocol and PIN UI unchanged across previous native passes and similar older reload timeouts. Its message records a hypothesis of CDP evaluation/context-swap timing; it is not proof of root cause.

Two separately owned diagnostic copies used the exact same archive with a loopback main inspector. At `evidence/package-unlock-diagnostic-2026-10-02T22-27-10.796Z` a one-second observation delay preceded the same renderer condition; at `...22-28-08.999Z` observation was immediate. Both observed the new unlocked renderer. Their attempted inspector dynamic imports returned `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`: the replies establish inspector responsiveness, **not successful native window-state snapshots**. Neither altered-timing diagnostic retroactively qualifies the original probe. The generated diagnostic source and original results are preserved.

A separate two-case control at `evidence/package-reload-boundary-2026-10-02T22-30-34.047Z` removed inspector flags and compared immediate polling with observation only after a committed navigation/new default context. Both began with `document.readyState='loading'`; both completed: immediate 110 ms, context-boundary 31 ms including 30 ms for the boundary. Both outcomes remain visible. This matrix did not reproduce the original timeout and cannot establish its cause. No delay, enlarged timeout, relaxed assertion or application runtime fix was introduced on its basis. No unchanged full probe was rerun until PASS.

All diagnostic copies contain synthetic project/PIN fixtures only. Root verified no executable under the three exact diagnostic-copy roots remained via a read-only native process census. The original failing run's separate census also found none. This is scoped owned-process cleanup, not terminal descendant lifetime qualification.

Next native qualification needs a causal observation of the failing reload boundary or an independently justified transport correction, followed by the actual package assertions against a committed source identity. Until then preserve the failure and keep development package admission false.
