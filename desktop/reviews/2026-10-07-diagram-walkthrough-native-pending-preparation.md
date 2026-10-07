# Walk through native harness — valid pending input extension, prepared only

Author: `/root/media_batch_review`, 2026-10-07. Root requested this extension before the first GUI execution because invalid input alone could mask a valid field's blur/change autocommit. This author changed only its own new `tests/native/diagram-walkthrough.mjs`. No product, build, workflow or existing test was changed; no GUI execution or runtime approval is claimed.

Original prepared harness SHA256 `ba9c8cdbe5069443fd022fdeaee31f7c84c72fbb323e0a322badbfac5588f022` and original prepared report `31d4bae4204b6f56f66a8911ddb47b1a72d1becb7efb22e8a58e7fce67681f76` were copied byte-exact to `evidence/workspace-surface/diagram-walkthrough-prepared-original/diagram-walkthrough-ba9c8cdb.mjs` and `prepared-report-31d4bae4.md` before modification. Both copied hashes were verified. The original report path remains unchanged.

New pre-execution harness SHA256 `246a5dcf1dddf67dbcd8277db85aa4700ac0283c2259c65bd014456d4cad9fdd`. Actual `node --check tests/native/diagram-walkthrough.mjs` succeeded, exit0. No runtime assertion has yet been observed.

In addition to the original invalid200/Guided invalid/Build pending coverage, the working-pending case now uses trusted text input for:

- Valid pending global font size20. Click Start, Next and Overview individually while the number field is active. After each actual pointer action, assert input20, exact active-element identity/selection where the browser supports selection, local source/dirty/version/hash/history, exact live SVG and entire selected project remain unchanged. Explicit Escape then restores the original absent size.
- Valid pending title `Valid pending context Ș😀`, with the same per-action field/focus/selection/source/history/SVG/project checks. Explicit Escape restores saved `Context Ș😀`.

These assertions are intentionally stronger than checking a final draft after an invalid field. A successful native run must demonstrate that browsing neither commits valid Style values nor steals editor focus. No input is forced back to the desired value by the harness. Existing invalid cases, expected source bytes, actual root-confirmed keyboard contract, finite timeouts, package support and all other original scenario oracles remain intact.

Scope remains eight planned native cases. First execution awaits root's fresh frozen build/explicit GUI slot. Any adverse outcome will be preserved separately, not silently corrected or retried. Syntax/preparation does not establish product success, export/runtime capacity, exhaustive themes, physical monitor UX, package/CI qualification or release approval.
