# Diagram pan harness recorder — independent narrow recheck

Author: `/root/diagram_history_final_review`, 2026-10-07. Actual extracted-harness probes with controlled transport/DOM stand-ins; no native/GUI/product execution, build, source/test edits or release verdict.

Corrected `tests/native/diagram-pan-release.mjs` SHA-256 `aa0b265582f8ba11e4ffba5992c0320df44dea99cab79a744c6769e999280f47` was verified before and after my probe, unchanged. The original review `f10feb8b82bed90fba3907a56b9ecabe5ff94a503c433ed3174812c8f2496a4c` and original harness `5ecee7…` remain separate and unchanged.

The original evidence-retention finding is addressed in this captured correction. Actual page receipts are appended before all overflow/transform/event-order/coordinate assertions. Recording is limited to 32 entries with a dropped counter; dropped must be zero. Listener removal runs in finally, and cleanup errors explicitly force ADVERSE in outer finally before result serialization and exit-code selection. No endpoint or original pan oracle is relaxed.

I executed the actual extracted scenario and outer-finally code for six cases:

| Controlled case | Retained receipts | Cleanup attempts | Serialized verdict / exit |
| --- | --- | --- | --- |
| Wrong transform | 1 | 1 | ADVERSE / 1 |
| Wrong event order | 1 | 1 | ADVERSE / 1 |
| Dropped-event overflow | 1 | 1 | ADVERSE / 1 |
| Cleanup rejection after otherwise correct scenario | 1 | 1 | ADVERSE / 1 |
| Input transport rejection before receipt read | 0 | 1 | ADVERSE / 1 |
| Successful control | 1 | 1 | COMPLETE / 0 |

The transport-rejection case legitimately has no read receipt to retain. Its failure and cleanup still propagate to ADVERSE. Separately, executing the actual recorder expression with 100 controlled events retained exactly 32, reported 68 dropped and removed all three registered listeners. Recorded fields remain event type, coordinates and pointer ID, with no source/private field text.

Evidence: `evidence/diagram-pan-harness-independent/recheck-probe.mjs`, `recheck.log`, `recheck-result.json`. Two initial reviewer-probe setup failures are retained separately: a missing brace and cross-realm array comparison in the VM fixture. Both were corrected only in the independent probe; neither is a product/harness failure or counted as a successful check. The final probe preserves the harness's actual assertions and creates response arrays in its execution realm, matching normal transport deserialization.

This recheck establishes the controlled recorder/error-path behavior. It does not qualify actual event delivery, native rendering or package execution, and does not establish the cause of either historical hosted pan failure. The catch-only original-preview geometry amendment remains the separate `c0945ed1…` reviewed in the original report.
