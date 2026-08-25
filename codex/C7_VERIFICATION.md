# C7 — dead code and unreachable state verification

Status: verified on a disposable post-C6 copy, then applied to the reviewed application.

- Inventory and conservative evidence: `DEAD_CODE_INVENTORY.md`.
- Patch: `patches/C7_remove_confirmed_dead_code.py`; SHA-256 `F29A06AA19F0E536C942E930650ACBB613942C9B2B96F6CB0932017369CF342D`.
- Baseline SHA-256 `7697D1AC10934EF9179CDD2A70D022B684AC7E910F559848DE1B557C44B93A70`; C7-only result `578C1392DC038519F4055D347C72C28296936060EFE8E411DFA7078B136C0A45`.
- The exact-count, atomic patch removed 5,751 characters: four declaration-only wrappers, six internally unused ids, the nonexistent `wpNewType` state, and obsolete CSS groups. It retained `#exportDataGroup` after the workspace QA runner proved external reach.
- `syncheck.py` found one inline script and `node --check exit 0`; reapplication stopped at the first guard and did not change the hash.
- Real-app Chromium verification completed with zero console/page errors. Agent Spec creation, R1 release capture, one-document PDF, node comments, waypoint-mode entry, Advanced settings, read-only mode and the retained export group all remained live. Six screenshots in `output/playwright/c7/` were rendered and inspected.
- Actual waypoint creation was deliberately excluded from the C7 claim because verification exposed a pre-existing editor defect. That defect was independently fixed and verified by `patches/A13_fix_direct_edge_waypoint.py`.
