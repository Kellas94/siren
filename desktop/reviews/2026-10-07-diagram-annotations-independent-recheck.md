# Diagram Inspector/Filters — independent narrow recheck

Author: Codex independent reviewer `/root/diagram_history_final_review`.
Date: 2026-10-07. Scope: original Task3 R1/R2, textarea startup correction, revised native oracles and retained owner-executed receipts. This is a separate report; it does not revise the original review or certify release.

## Conclusion

The concrete R1 coverage-disclosure defect is corrected in the inspected snapshot. R2's missing native dimming oracle is corrected in the current harness and supported by the retained root-executed COMPLETE8 receipt. The textarea startup correction also survives an independently executed reproduction against the retained original and current modules. No new Important defect emerged from this narrow recheck.

I personally ran the four scoped Node test files (36 passed, zero failed/skipped), a separate VM/receipt probe, and a separate System.Xml export probe. I did **not** execute GUI/native, build, packaging, hosted CI, or the full suite. Tasks1/2 metadata validation was not re-reviewed. COMPLETE8 below is root execution evidence that I inspected and rehashed, not my own native execution.

## Findings rechecked

**R1 — upstream cap:** the real `styleTargets` adapter still deliberately admits at most 250 semantic IDs. The controller now marks coverage limited at `targets.length >= 250`, which is conservative because the adapter does not expose the original total. My separate actual-adapter → actual-controller probe used 249, 250 and 251 nodes. It admitted 249/250/250, displayed the limit notice only for 250/251, and refused selection of excluded N250 in the 251-node case. This removes the original silent truncation without inventing a total. A diagram containing exactly 250 nodes gets the conservative limit notice as intended.

**Startup correction:** the retained passive native event is a nested `Target.receivedMessageFromTarget` carrying `Runtime.exceptionThrown`: `TypeError: Cannot set property type of #<HTMLTextAreaElement> which has only a getter`. The corrected module assigns `type='text'` only to the input branch, leaving Evidence's textarea untouched. Using the current fixture with a getter-only textarea, my probe reproduced the exception from the preserved original module, then mounted the corrected actual module and submitted exact `First\nȘ😀 second` text. Root's retained `textarea-red.log` shows this same concrete getter-only failure; `coverage-red.log` separately shows the original missing limited notice. These retained RED logs are root evidence, not tests I claim to have executed originally.

**R2 — actual native projection oracle:** inspected the diff against the byte-preserved original harness. The revised harness reads computed opacity, ancestor-multiplied effective opacity, display, visibility, fill and dimensions for A/B/C plus the actual connecting edge paths. It requires nonempty edges and positive visible baseline node geometry, verifies selected/nonselected effects, requires exact unchanged edge metrics, checks the all-matching and Reset states against the baseline, and retains exact SVG/source/history/project checks. My probe executed the actual extracted `dimmed` assertion function against the recorded before/Owner/zero-match states; it also verified that replacing the filtered observations with unchanged baseline values throws, and that dimming a connecting edge throws. Thus the new assertion cannot pass merely because a counter changed. In the actual receipt, Owner filtering dims A/C to 0.16 while B stays 1; zero matches dims all three; both edges remain 1 and Reset equals the baseline.

The new native metric coverage is specific to the recorded flow fixture. It is not exhaustive native qualification of every supported SVG shape, nested group or imported opacity combination. The separate state-window case tests local facet independence, not all these projection metrics again.

**ADVERSE4 export assertion correction:** the original harness searched raw XML substrings; legitimate split tspan rows and XML escaping make that an unsuitable text-label oracle. I independently loaded the retained SVG from both ADVERSE4 and COMPLETE8 using System.Xml with XmlResolver disabled. Both files have the identical SHA-256 `8cb8b57261e60e8075db423ecc98ce2b74648a38eba033251f5513119e4e29f2`. In each, all three complete raw label substring searches return false, while XML text/outer-row extraction yields exactly `['Început Ș😀', 'Decizie & context', 'Final literal']`. The revised harness compares that exact array, including the full middle label, and retains private annotation/notes exclusion, live projection exclusion and exact project/source assertions. This is a demonstrated oracle correction; the original adverse receipt remains adverse and preserved.

## Actual executions and evidence

My scoped command, run from `desktop`:

`node --test tests/diagram-annotations.test.mjs tests/diagram-annotations-window.test.mjs tests/diagram-walkthrough.test.mjs tests/diagram-session.test.mjs`

Result: 36/36 passed, zero failures or skips. Separate commands: `node evidence/diagram-annotations-independent/recheck-probe.mjs` and `& evidence/diagram-annotations-independent/recheck-export.ps1`; both completed without assertion failure. They write only reviewer-owned evidence.

The inspected root native receipt is `evidence/diagram-annotations-native/2026-10-07T02-47-31.275Z/result.json`, SHA-256 `3b97477f8b91a8fa81b7bf92201b46c1386c719ece15d3d6cc69c750caace15c`: COMPLETE, 8 cases, `changedInputs: []`. I compared its before/after maps and independently rehashed **all 591 recorded inputs against the files at my probe execution, completed 02:52:17 UTC**; no difference at that time. The eight cases cover readonly Inspector, actual local filters, separate state-window facets, pending/Apply/history, explicit Save/export, pending Style focus plus theme, stale peer CAS refusal, and final common Lock. This report does not expand the receipt's coverage or claim full-suite success.

After that probe, parent notified me of a separate package allowlist correction following a full-suite failure. `scripts/package.mjs` has filesystem modification time 02:52:24 UTC, later than my 591-input probe. That later correction is outside this review and is not covered by the earlier native receipt or my all-input match. My nine scoped review inputs were independently recaptured at 02:52:35 UTC without changes. I did not inspect or validate package correction behavior and do not claim native qualification of the later package state.

Original preserved evidence:

- First ADVERSE0: `evidence/diagram-annotations-native/2026-10-07T02-41-35.388Z/result.json`, SHA-256 `f1aaa43c1c5e37747657a343efd220d714a77e913d3888124f0362aefc9f9d47`.
- Passive startup exception: `evidence/diagram-annotations-native/2026-10-07T02-42-58.857Z/attach-observation.json`, SHA-256 `f10b43b016ae2041b7e9c33ce3269b5c76ed1e61247a4a23e7529d5f0d146864`.
- ADVERSE4: `evidence/diagram-annotations-native/2026-10-07T02-46-22.502Z/result.json`, SHA-256 `dba03817d7c4020062ad7e48f10a9419d7d7273e3304721a19d0b6f36e03068f`.
- Root RED/GREEN records and original modules/harnesses: `evidence/workspace-surface/annotations-native-startup-correction/`.

My evidence in `evidence/diagram-annotations-independent/`:

| File | SHA-256 |
|---|---|
| recheck-scoped-tests.log | 751a5f4727c357c85ba5e81337822d9ffe4accf25f529e56266fb8d9d551a465 |
| recheck-probe.mjs | 6daaa73234817ff407a3ad8bdd96b2a7290346394076643d5345ed095715f893 |
| recheck-probe.log | 137362a3d049d95de0feb12d2dc9f95e34604884275f376007f247c2a3eb6a29 |
| recheck-export.ps1 | 2f612f8e87bc4ceb69fec7351ee64d260e6d34131c116d671c6307215bafe265 |
| recheck-export.log | 928da10406fc52c713d767bc055e38f4b9342716129037b79fe95a80c903cf39 |

## Frozen review inputs

`recheck-inputs-before.json` and `recheck-inputs-after.json` retain the nine-file maps; all nine hashes below are identical before and after my executions. Generated Diagram was separately rehashed and also matches the 591-entry native receipt: `781303141695a95dd64e95281b917fd410c483cfb8d94e8a74f6d197a850e2d9`.

| Path | SHA-256 before = after |
|---|---|
| src/ui/diagram/annotations.js | 8eeaa5b2a8101606e2924d2af19fe8ff82610cd4d1e83cffdb897c868cddeac1 |
| src/ui/diagram/style.js | c8e6c2c2bb598e513e844ac526113efa1fa639a3ca84ba663895a09b243d04e4 |
| src/ui/windows/diagram.js | fbc7b0da4bea0ce02ebe19903dd4cf6521c9fd093821f9ed7bba71e30d605fbf |
| src/ui/diagram/window.html | dbc5f16a49c159cff4ccef60cf3c04743825ab1766411674c14715719395bc7c |
| build/diagram-window.mjs | 21ebf8ca538a8076332a866cc090e023a890ce64c93f655a64e3c80c863422bf |
| tests/diagram-annotations.test.mjs | 8ac77ed911ff6b4ab60574b0899a2513fa4c749a41df1d5fd4bcb131967d880c |
| tests/diagram-annotations-window.test.mjs | c970b027ed09f88de520906d8b8c41875b58f1b2d45b4d37624eef13e23887c3 |
| tests/native/diagram-annotations.mjs | 9901ae39f6785f2f754e8854db09d84ad1f8697da73348387c292700abd937dc |
| reviews/2026-10-07-diagram-annotations-independent-review.md | 209414e0d3571db24eb1608851128dcb77cb35ef282f7b96fb6effce178da183 |

No product, test, harness, generated file or original report was edited by this recheck. Historical unrelated native/hosted failures are not closed by it.
