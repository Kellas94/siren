# Terminal pure foundation qualification — 7 October 2026

Author: /root. Current source and tests are qualified within the pure Node component scope. Native shell execution remains **NOT_ADMITTED**. This is an owner report; the independent review retains its real author and separate bytes.

Implemented a default-closed serial input ledger with current project/window/epoch leases, whole Unicode paste budgets, bounded pending metadata, 256 retained receipts and no ambiguous replay; bounded output credits with delivery-boundary ACK validation; native-callback policy that independently requires writable execution authority. Lock revokes new and queued input while leaving the already delivered write untouched. Its receipt explicitly reports hostAcknowledged:false.

The original independent P2 found a real defect: known host failure left active input unsettled. A permanent regression first reproduced it RED; the repair settles active and duplicate requests immediately and makes late accepted/rejected ACKs inert. A separate owner regression reproduced missing writable authority despite normal mode; the policy now requires explicit canExecute authority. All original adverse evidence is preserved. The fresh independent reviewer closed the P2 on current captured bytes, not retrospectively on the adverse version.

Final focused tests: **40/40 PASS** (17 existing and 23 new). Final full suite: **1610/1610 PASS** (4 identity plus 1606 units), no failure/cancellation/skip. 644 captured inputs remained unchanged throughout the run and were rechecked against disk before this report. The previous 1601-pass run predates the repaired host-loss case and does not qualify the final bytes.

Independent /root/terminal_foundation_review: 23/23 scoped tests and 10/10 separately authored adversarial probes, including a 30000-operation independent credit oracle. Exact report hashes and source identities are in the JSON companion; review findings and limitations are preserved without rewriting.

Component stress: eight sessions produced **512 MiB**, retained **32 MiB** total ring history and peaked at **2 MiB** outstanding output credits, with 80 explicit gaps. One owner sample observed RSS 185982976 bytes and 621 ms; these are Node component observations, not shell/renderer performance limits. Empty input queues and one-byte output frames have independent count bounds of 256 per session/attachment.

No main/preload/registry/native host, dependency, package, installed-app or UI changes are included. No real Terminal, debugger or Flows delivery is claimed. Actual child containment/Stop, atomic startup ownership, native toolchain and bridge/xterm integration remain open under the approved plan. See the independent readiness report and docs/research/2026-10-07-terminal-atomic-ownership.md.

Full-suite receipt: evidence/workspace-surface/terminal-state-full-suite-2026-10-07T12-21-28.353Z/result.json. Independent report: reviews/2026-10-07-terminal-foundation-independent.json.
