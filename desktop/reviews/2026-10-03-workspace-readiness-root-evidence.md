# Initial workspace load boundary

Author: root implementation coordinator. This is implementation evidence, not independent approval.

The earlier immutable source-foundation package failed during unlock/reload while its initial document was still loading. The separate diagnostic review preserves that failure and a single gated control which completed the unchanged bootstrap condition. The blocking native stack remains unknown; neither control constitutes full package qualification.

The native setup/unlock services now wait for their actual main-frame load before invoking LocalPinAccess or acknowledging success. Native failure/crash/destruction/new navigation invalidates a pending continuation. A 10-second refused load leaves the PIN untouched and returns WORKSPACE_NOT_READY. PIN_BUSY is rechecked after waiting. No fixture secret is a product default.

Independent review reproduced a crash-between-finish-and-continuation defect in the initial helper. Root corrected it by retaining invalidation watchers until admission and added the exact adverse sequence. Original independent failure evidence remains separate.

Actual root focused run: 20/20 pass, 0 failed/skipped/cancelled, 585.2857 ms, Node v24.16.0. Log: desktop/evidence/workspace-readiness-integration-root.log. Scope: readiness helper, extracted actual main PIN services, desktop PIN IPC, prior independent PIN integration and package allowlist tests. No full suite or final native package outcome is claimed by this report. The package allowlist explicitly includes only the new readiness module; the frozen baseline remains unchanged.

## Actual package failure and measured correction

Commit c6fa8d39227d0784b423a8fc49e06ec2d753f76b package ASAR c40af4b4c52789449728a0785ccf335def3d11bbdf8b4d35089210bdda7423c5 FAILED the unchanged native probe at PIN setup. The separate independent observation confirmed that did-finish-load fired with isLoadingMainFrame true, followed by did-stop-loading with false; the first helper missed the latter event and refused after its unchanged 10-second deadline. Both failed runs and reports are preserved; no success is substituted.

Root wrote the exact finish-true/stop-false sequence as a test: actual RED 6 passed/1 failed with WORKSPACE_NOT_READY. The correction subscribes to did-stop-loading as another native readiness check while retaining the same crash/navigation invalidation latch and timeout. Root focused run then passed 21/21, 0 failed/skipped/cancelled, 585.4147 ms. Logs: workspace-readiness-stop-red.log and workspace-readiness-stop-green.log. New package qualification is still pending here.
