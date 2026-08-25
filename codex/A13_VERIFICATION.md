# A13 — direct and group-wrapped edge waypoint verification

Status: independently reproduced, fixed on a disposable post-C7 copy, then applied to the reviewed application.

- Searchable location: `function selectedEdgeVisiblePath()`.
- Baseline failure: on the default seven-block diagram, preview clicks for both D→C and C→G left `No custom waypoints`, kept waypoint mode active and left Undo disabled. D→C's first matching `[data-edge-key]` is the path itself, while C→G's visible Mermaid paths use CSS stroke without a `stroke` attribute; the old lookup returned `null` in both cases.
- Patch: `patches/A13_fix_direct_edge_waypoint.py`; SHA-256 `38C0C08CA8C7CD2F6CA8121BCA4823370A8CBB53C125DB46F9ABE7887675125F`.
- Post-C7 baseline SHA-256 `578C1392DC038519F4055D347C72C28296936060EFE8E411DFA7078B136C0A45`; applied/final result `EB47D55F5D1CBAD32298BE441C62D05246453BFA1B4DFC5941D5DF2D11124B5D`.
- Real UI after the fix: both edges added `Waypoint 1`, enabled Undo, exited waypoint mode and rerendered a route containing the clicked intermediate `L` point. Chromium reported zero errors/warnings. Screenshot rendered and inspected: `output/playwright/A13_current_post_C7_waypoints.png`.
- `syncheck.py` found one inline script and `node --check exit 0`; reapplication stopped at `expected 1 occurrence, found 0` and left the final hash unchanged. The patch has no Present/Map/deck/card/ambient anchor.
