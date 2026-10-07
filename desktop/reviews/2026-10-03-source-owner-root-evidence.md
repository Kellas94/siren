# Source owner foundation — root evidence

Author: root implementer, 3 October 2026. These are implementer-run checks, not independent approval or release admission.

WindowRegistry now captures actual native sender/frame identity in private grants. Cloned IDs cannot mint grants. WorkspaceCoordinator serializes bounded source intents through the existing SourceRepository, with a native access guard at durable publication, per-entity receipt subscriptions and pause/drain. It does not yet coordinate Docs/Diagram intents or renderer-local queues, and is not installed in production main/preload. Code/Docs production windows remain shells.

Focused source/Home/window checks passed 110/110, exit0, 6820.2638ms (`evidence/window-owner-focused.log`). The prior frozen 465/465 suite predates this batch.

Actual Electron probe `tests/native/source-owner.mjs`, final evidence `evidence/source-owner/2026-10-03T08-48-36.916Z`: COMPLETE, exit0, four case groups, three real Code windows, eighteen captured inputs unchanged, remaining windows0. Two windows share source A, one source B. Native IPC proves distinct-source bytes, same-source conflict and operation deduplication, scoped notifications without text, foreign-entity refusal, admission pause with actual in-flight drain, explicit source commit and unchanged independent Docs snapshot. Early native epoch revocation during held writing refuses publication, retains A version3 and exact confirmed bytes, and produces no late notification. This is a forced adverse revocation probe, not a graceful all-view Lock or interactive CodeMirror/physical-monitor test.

Native result SHA-256 `6e5dff424fd9618d6bb4999e2424fb7c7fbbf01e8295a3ed941f03162d2346c9`; outer `88b0839b633a76b7f826b2d5441e7c179cc90345cf071c8646036bfc0e918a59`; prepared `452d976b8f290ecfe82ee2198c000484d83d4e2fc0e7361ccd9b45f742f5f1b4`. Read-only native PID census found no remaining owned processes43552/39404/10404.

Preserved adverse runs: 08:42:15.732Z timed out after awaiting an executeJavaScript promise on a destroyed renderer; no final native PASS. 08:46:23.171Z completed three groups then failed `Object has been destroyed` from accessing webContents after destruction. The probe now captures webContents before destruction, awaits the native owner receipt/drain and records an unreturned retired-frame promise as `retiredFrame:true`, never as successful delivery. Disk, rejection and notification assertions are retained. The completed two-window run08:46:58.169Z is superseded only for coverage by the three-window run, not rewritten.

Explicit Docs linking, native domain document versions, view flush barriers, Home Continue/Open/Create, lightweight startup and package/physical monitor qualification remain open.
