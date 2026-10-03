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
