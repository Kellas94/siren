# Home continuation, commands and bounded libraries — implementer evidence

Written by the implementing coordinator on 3 October 2026 UTC. This is implementation evidence, not an independent review or release approval.

Continue now verifies the chosen project and exact Code version/hash or Docs entity before retiring the previous project. Cross-project completion uses the actual durable-selection receipt; copied metadata and Lock cannot promote a stale Home request. Actual native Code and Docs windows open after selection while both complete project snapshots remain unchanged. Cross-project Diagram routing, cursor/layout restoration and editable native sources remain open.

Home now has compact Settings, PIN settings, Check for updates and Quick guide dialogs. Update status is honest about the unconfigured feed; download/install authority is not added. Native primary-window shortcuts dispatch finite commands once, prevent menu/page duplication and suppress auto-repeat. Lock remains available while a library dialog is open. Code/Docs libraries load 64 filtered metadata rows at a time, bounded by the existing 4096-item catalog limit. Readonly import is disabled and chooser cancellation is not reported as an error.

## Verification and retained failures

- Frozen unit run `evidence/home-continuation-qualified-suite-result.json`: 673/673 passed, exit 0, no skips/cancellations/todos, captured inputs unchanged, 21:00:24.408–21:03:59.533 UTC. Log SHA256 `666e3199a9410231782202bb9358507aad01f4fe5b8ef78a93893458c53d94fe`.
- `evidence/source-read/2026-10-03T21-08-21.229Z`: COMPLETE, 11 groups in the simulated 1007×654 hosted viewport. Actual production Home, selected 300k-line Code, exact Docs, cross-project Continue, preparation and Lock passed; exact project/source invariants remain asserted. This is not physical monitor/DPI qualification.
- `evidence/home-library/2026-10-03T21-01-40.512Z`: COMPLETE, four groups. Settings, Updates, Guide, real native input, 64→128→130 metadata rows and Lock with an open library passed. The fixture uses a PID-checked owned Electron main inspector and real WebContents input; it does not claim physical OS keyboard coverage or expose a product test API.
- `evidence/guided-intro-2026-10-03T21-06-30.061Z`: completed actual Guided save and animated/reduced-motion replay, `flashConfirmed:false`, application hidden before intro, actual App after PIN.
- `evidence/local-pin-2026-10-03T21-06-43.989Z`: completed actual PIN change/restart/cooldown and readonly refusals.

The last three native fixture changes follow the frozen unit run: pointer controls scroll into view before the original exact hit test, Home navigation reproduces the hosted short viewport, and the Guided first-paint observer inserts its initial blank frame only once per window. Product/runtime and unit bytes did not change after that frozen run. The later native runs qualify these fixture changes separately.

Original CI45 Desktop run `37152262154` on remote `8f29b881f758a50c1ae04edf3185408db46ee6b4` remains FAILED; package was skipped. Its original artifact `11285190863` is retained at `evidence/ci45/artifact.zip`, SHA256 `c6abc02b6ddb1cc643ac1bbc7b02799ef993672b0dbfe912a3769634e4188826`. The short viewport left controls outside the hit area; the Guided observer also injected blank navigation on subsequent real entry changes. Corrections preserve exact hit/visibility checks and product navigation guards. Local reruns are not a hosted CI approval.

Earlier local cross-project probe `20-43-08.236` retained its off-viewport failure. Two CDP keyboard attempts `20-51-35.752` and `20-54-23.961` retained zero-group adverse results: CDP input did not qualify Electron's native shortcut delivery. The subsequent fixture explicitly uses real WebContents input. No adverse artifact is relabeled PASS.

Generated Home SHA256 is `717164c29872b85cd8934c809a6af997074517cf5dd564352f695c67406b76cc`, 53,649 bytes, three inline scripts. Existing App/Code/Docs entries remain unchanged in this batch. No installed user application or data was replaced. Public release, production accounts, update application, writable native editors, Diagram/Presenter/Terminal and physical-monitor qualification remain open. The one-time Git graph is frozen.

## Subsequent committed package and hosted observation

Local source commit `ec5d15517437277ff4482d14baff860d67e70c48` was built at `dist/development-1dfe0aaf-0827-49bb-a1a2-81225cc38d55`. Its archive SHA256 is `e272a7204943a825d7f4ccb71f826f337c48c38e8803a8b94ee6a4541cc22afd` (31,313,123 bytes); unchanged runtime SHA256 is `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. Actual package probe `evidence/packaged-2026-10-03T21-17-08.723Z` completed exact original/recovered-copy checks, native save/CAS, Quit, complete Unicode folder copying and restart/PIN, readonly damaged-journal and unconfigured Updates. Probe SHA256 remained `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24`.

Private remote `bc20e4990780d5bbe2a52b59c1d75846b0442bc8`, tree `c619d722fd16ae08c40b109c32d0e7f857e75546`, contains 21 exact changed Git blobs and preserves 1,086 others (1,107 total). Ref/commit/tree/PR head and unchanged main were checked; PR2 stays draft/open/unmerged. Desktop CI46 `37154741567` completed SUCCESS on that exact remote head, observed at 21:51 UTC. This qualifies the preceding Home batch, not subsequent uncommitted native-edit development. Original CI45 failure remains retained.
