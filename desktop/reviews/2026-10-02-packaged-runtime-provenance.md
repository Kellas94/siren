# Independent packaged command/runtime provenance — 2026-10-02

Author: `/root/review_native_launcher`. Supplements the frozen firstpaint-packaged addendum without changing its outcomes. No additional package execution was performed for this provenance check.

All five executions used `tools.exec_command`, default PowerShell, working directory `C:\Claude\SIREN_WORK\portable\desktop`, `sandbox_permissions=require_escalated`, and initial yield_time_ms=10000. No environment variables, PATH, shell binary or explicit Node executable were overridden.

| Evidence timestamp | Exact command | Outcome |
| --- | --- | --- |
| 18-17-59.752Z | `node tests/native/packaged.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43` | exit 1 |
| 18-19-58.325Z | `node tests/native/packaged.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43` | exit 1 |
| 18-21-46.158Z | `node evidence/packaged-trace-independent-2026-10-02/probe.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43 2>&1 \| Tee-Object -FilePath evidence/packaged-trace-independent-2026-10-02/trace.log; exit $LASTEXITCODE` | exit 0 |
| 18-22-34.610Z | `node tests/native/packaged.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43` | exit 1 |
| 18-24-47.846Z | `node evidence/packaged-error-stage-independent-2026-10-02/probe.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43` | exit 0 |

All original failure outputs identify Node.js v24.16.0. After those executions I independently checked `Get-Command node -All` and `node -p` in both ordinary and require_escalated boundaries. Both resolved first to `C:\Program Files\nodejs\node.exe`, v24.16.0, with the expected desktop working directory. The bundled Node v24.19.0 was second in resolution order. Successful probes did not separately receipt process.execPath, so their exact historical executable path is inferred from the identical command boundary and current resolution rather than directly captured.

Test entry/helper module URLs differed between original and evidence executions. The first diagnostic additionally logged stage names through a PowerShell Tee pipeline. The second diagnostic did not use a pipeline or success-time logging; its helper only assigned the pending expression in memory and augmented an existing timeout error. Its separately inspected diff contained no altered deadlines, waits, input, parser, authorization or assertion behavior. Original and both copied probe hashes were identical: `856447dce1b8044a0380316ae6433a0c5c4eb4266a8b26a67ca7d2f7e5a851e6`.

Current helper hashes: original `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`; stage-log helper `bf70cef7d40c25ce6abf4f6dbe39cbff1593480ef52430a4975e68311ea4952e`; error-only helper `ed160dfc1da94de0064aac0cdc2a115782a890029d0012197da4c388a0436813`.

No command/cwd/permission or observed Node-version difference explains the failures. Module location and timing differences remain possible influences; neither is established as the cause. The existing driver queues Runtime/Page events but the original failure reporter does not retain that queue, and its pending-command map is not rejected on WebSocket close. This is a diagnostic gap, not proof that context/socket loss occurred. The three original timeouts remain unresolved.
