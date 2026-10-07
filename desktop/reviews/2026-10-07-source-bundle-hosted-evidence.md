# Source-bundle hosted qualification — FINAL failure retained

Author: `/root/disk_inventory`, owner evidence retention, 2026-10-07 local date. **This is not independent product approval.** Original GitHub run [37534183640](https://github.com/Kellas94/siren/actions/runs/37534183640) is **completed / failure**, attempt 1, updated 2026-10-06 21:41:51 UTC. No rerun, cancel, push, application launch or product/workflow modification was performed for this retention.

## Identity and final job outcomes

Live GitHub metadata verifies canonical commit `11ff847bafc3b5a2caa1a3b06ea9fa8d08cf962e`, tree `aef6828ac3ecf4611a3541ff104e06bde234b122`. Actual integration commit `f725c18254443873d343b3c6ae41a156a3f374f7` has that same tree and ordered parents `1e5472dde446657e2dbb155868e28e033c6c9c92` plus the canonical commit. Main remained `1e5472dde446657e2dbb155868e28e033c6c9c92` at retention.

All nine jobs are final: six success, three failure. Unit, launcher, scope and all three native groups succeeded. Windows packaged workspaces failed; Desktop qualification and SIREN merge qualification failed as aggregators. The packaged failure is not relabeled by the successful jobs.

## Actual packaged import passed; later Diagram fixture failed

The original hosted **300,000-line source-bundle import** result is COMPLETE with four acknowledged cases and unchanged inputs. It reports 7,088,891 source bytes and 9,454,085 bundle bytes. Its assertions cover exact independent source copy/checkpoint, imported Code/linked Docs identities, common Lock/restart and legacy Open/import into another independent copy.

Original result: `evidence/workspace-surface/ci37534183640/desktop-packaged-evidence-original/evidence/source-bundle-import-native/2026-10-06T21-31-09.840Z/result.json`, SHA-256 `7e8e77192f43c2596a511e4da26a4ac5efff21458de19fe303cc254c4a6a4f51`.

Its captured fixture-script SHA-256 is `130452c72648288f4068da20ade3a8f851eb24d5f35c15a549e510dd538d0aff`; source-bundle parser SHA-256 is `df8c9ff13a91cbb6769dba8faa90b7512d4fd62715d26da8c88345a1e960839f`; frozen import-validator entry SHA-256 is `0f63785b4cc88658c5a0c248ccfbcf5096c048ac6a5921b5964222b5e467b81f`. Uploaded evidence contains the native acknowledgement result, not the raw source/export bundle. No independent raw-source digest or retained raw-source-byte inspection is invented.

The later packaged **diagram-edit** result is ADVERSE after two recorded successful cases, with unchanged inputs, at:

`UI condition not met: (async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.length>8})()`

Original result: `.../desktop-packaged-evidence-original/evidence/diagram-edit/2026-10-06T21-34-44.068Z/result.json`. Its diagnostics show five rendered Diagram views, three read only and two saved/editable; they do not include a complete registry listing. Therefore this retention cannot determine a fixture-oracle defect versus product timing/behavior. No PIN cause is attributed. Later packaged probes were not reached and are not counted as passed.

The same run's development Diagram group has a distinct **100,000-line** diagram-edit result COMPLETE/4 cases, unchanged inputs (`2026-10-06T21-36-14.303Z`). That is separate scope from the failed 300k packaged case. The coordinator also reported a later local 300k packaged COMPLETE/4 replay; that later local result is not part of hosted counts and does not establish a cause or fix of the original hosted timeout.

## Honest counts

- **1,220 unique unit tests:** three identity tests plus 1,217 remaining tests, zero failures. Raw job TAP totals are 1 + 3 + 1,217 = 1,221 because the early one-test IO probe repeats a test included in the remaining suite; it is not counted twice.
- **60 native development probes:** desktop 20, sources 20 and diagrams 20, all exit 0/COMPLETE, no changed captured inputs.
- **13 retained packaged module probes:** 12 COMPLETE and one ADVERSE. Complete modules contain 61 cases; the adverse Diagram module records two passed cases before failure, giving 63 recorded cases. These 63 do not establish package qualification. Core packaged and shell startup probes also completed; they are recorded separately because their results do not publish comparable case counts.

## Original package identity

Retained BUILD-IDENTITY identifies the actual integration source `f725c18254443873d343b3c6ae41a156a3f374f7`, Electron 44.5.1 and app.asar **53,851,621 B**, SHA-256 `3f09fb5c60290ef4107db6036c9237118f1933540dbff459af9a488a80fd1a25`. All retained packaged module receipts agree with this identity. This is the original build receipt and tested package identity; the uploaded evidence ZIP does not include app.asar bytes for an independent local rehash.

BUILD explicitly retains `releaseAdmitted:false`, `inventoryQualified:false`, `launcherQualified:false`, account/update configuration false. This is a development preview, not a published release.

## Original artifacts and logs retained

All files are under `C:/Claude/SIREN_WORK/portable/desktop/evidence/workspace-surface/ci37534183640/`. Each original ZIP's exact length and SHA-256 match GitHub's artifact metadata. Total: **20,858,823 B across five original ZIPs**, with **454** bounded inert extracted JSON/PNG/log/text files. Each extraction has a per-file length/SHA-256 inventory. No downloaded code was executed.

| Artifact | ID | Original ZIP bytes | SHA-256 |
| --- | ---: | ---: | --- |
| desktop-development-evidence | 11445711459 | 60,418 | `84e28144c46ce51bb0d34a8be2f149c8cf0f826fb09800d23cf661aaf8678968` |
| desktop-packaged-evidence | 11445801523 | 5,804,636 | `0c02640d74fe65ed06261f3b75438e81e4ea0bc4f16d0a262dd7faf17f212579` |
| desktop-native-desktop-evidence | 11446361771 | 4,313,847 | `7b6317813c4c2f602406b22f8901fb9064b0acd05c411bf6176926b2d6c1bfd2` |
| desktop-native-sources-evidence | 11446092284 | 3,214,879 | `e71d340ba0ed94035d1cf13b91841663de5efd0947bd2383eece287159034979` |
| desktop-native-diagrams-evidence | 11445562704 | 7,465,043 | `b4069de117a53869450a0a22c1632c85e749aea7e73b31750c860e8f05c744f5` |

Final run/jobs/artifacts/canonical/integration/main API payloads and all five original desktop job logs are retained. Logs are the connector's original **decoded character content** inside JSON wrappers, preserving BOM/CRLF as string values; wrapper byte hashes, decoded UTF-8 hashes and lengths are recorded in `reviews/2026-10-07-source-bundle-hosted-receipt.json`. They are not claimed as the original HTTP log-download bytes. No signed download URL is retained in the reports.

The first artifact download attempted under the restricted token failed; approved external execution retained the exact same ZIP with unchanged digest/oracles. No ACL or sandbox setting was altered. The earlier successful run 37528726783 and all previous adverse evidence remain untouched. The unresolved original packaged Diagram timeout requires separate diagnosis; this FINAL run is not ready for an all-pass qualification claim.
