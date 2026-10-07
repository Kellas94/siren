# Independent scoped review — retained hosted Close/Quit qualification

Author: Codex independent reviewer `/root/workspace_surface_review`. Hosted executor: GitHub Actions. Artifact retrieval, decoding and root receipt author: `/root`.

Date: 2026-10-05. Reviewed run `37360932464`, branch head `7bfc6da5920f1807ae12fb9cff04824a538304a2`, actual logged synthetic PR checkout `282f7c9bcdef4345b3c25f0787822f2a9e152944` over main `1e5472dde446657e2dbb155868e28e033c6c9c92`. Local source HEAD at review start: `9e6853cd9ce63c3ef7ec75cc9566909962adcb55`. These identities are distinct. Root's retained connector metadata records the run and all **9 jobs completed/success**. Independent artifact/log checks below support the named native/package/unit executions. **One P2 artifact-retention gap requires a workflow correction. The original successful run remains successful with that evidence limitation.**

I performed only read-only local artifact, ZIP, JSON, Git and decoded-log checks and authored this new report. I did not launch Electron, execute tests remotely or locally, refetch GitHub/network metadata, alter source/tests/workflow/generated/helpers/original artifacts/logs or modify prior reports. Job conclusions are attributed to the retained root connector metadata, not a fresh independent remote query. No execution is attributed to this reviewer.

## Finding: P2 — retain Diagram Export evidence in every upload set

The reviewed workflow SHA-256 `c608c1b66dc8057f94e0b0b315f31bd02f7e23a6d451711bdbdb6761938dc120` explicitly invokes `tests/native/diagram-export.mjs --package ... --300k`, but all three artifact upload sets omit `desktop/evidence/diagram-export/*/result.json`, its logs and screenshots. The actual package job log reports Diagram Export at `2026-10-05T19-10-52.009Z` **COMPLETE, 5 cases**. The uploaded package ZIP has no Diagram Export directory/result/log/screenshots. Every ZIP entry matches the expanded files, so this is a retention omission rather than extraction drift.

Concrete reproduction: compare package log `ci37360932464-original-job-111935235143.log` (21 native COMPLETE summaries / 102 native cases plus original portable) with the actual `desktop-packaged-evidence` ZIP (20 native result JSONs / 97 native cases plus original portable). The absent five cases are exactly Diagram Export. Retain the three explicit result/log/png patterns in all three upload sets and require each set in a meaningful registration regression. Do not reconstruct a missing original JSON, rerun and relabel this historical observation, or turn its successful job conclusion into a failed test. The missing record limits independent structured-result/input inspection of that one execution.

Root acknowledged this finding and began a separate retention correction while this review was ongoing. This report assesses the old hosted workflow hash above. A changed local workflow does not retroactively qualify these old artifact contents; follow-up review belongs to a separate lot.

## Actual artifacts independently checked

I read all six original ZIPs, checked exact byte lengths/SHA-256 against their retained artifact receipt, parsed each central/local ZIP entry and compared every uncompressed ordinary file with the actual expanded counterpart. **377 files matched exactly across all six ZIPs**. No file was downloaded again or extracted/rewritten by this reviewer. Receipt run/head metadata is consistent with the named run/head; artifact presence alone was not treated as a successful verdict.

| Artifact / ID | Bytes | SHA-256 | Expanded files checked |
| --- | --- | --- | --- |
| native sources / `11367501003` | 1,715,570 | `7e55d00dfe0165d54582d8764353885f05345054edadca955776d106b47beb63` | 72 |
| native desktop / `11367237163` | 4,033,788 | `be2a151d352b79405eb80dd8fe395c6b50128dc09f44eaf9e401acd6b5c4dd2e` | 103 |
| launcher development / `11366532279` | 245,105 | `cba53c59af3753f1e941a8b14cf84854a0863a755c4a057624e15d7c0a0a0a24` | 6 |
| desktop development / `11366447812` | 51,608 | `6b87d34e76a0f7dd546a2177e1e397a05b4b3656bd3c431808561135156b9994` | 3 |
| native diagrams / `11366408793` | 2,739,688 | `52008f4144113e2f6070e6ead870e75d081f8d97f76edc75a2f1230ebd821cc8` | 82 |
| packaged / `11366408524` | 3,626,602 | `b8093883c5f2425ec6ff36abe57c7ea8ad654f69743b3d88cbef850c19bb9475` | 111 |

Locations: `desktop/evidence/workspace-dock/ci37360932464-<artifact-name>.zip` and `ci37360932464-expanded-<artifact-name>`. The original artifact receipt is `ci37360932464-original-artifact-receipt.json`.

## Native groups and unit/package counts

I checked the actual native group receipts against imported original group definitions: **20 desktop / 17 sources / 15 diagrams**, exact child order, all 52 child exits 0/null signal/no error, COMPLETE/ok true, empty failed/changed-input lists. Their **58 captured input entries** (22/19/17, counted across groups) equal their after maps and exact corresponding local committed Git blob hashes. Some local checkout bytes have CRLF while hosted blobs have LF; I did not call those raw files byte-identical. Source-group Close/Quit and modern role-privacy are included in the original ordered group. This is receipt/identity validation, not exhaustive re-review of every child oracle.

| Actual native receipt | SHA-256 |
| --- | --- |
| desktop `native-verification/desktop.json` | `524a4a0e503baf423547d31b05b2af7fbee47ec0d016ee0519bc3ac07a31256b` |
| sources `native-verification/sources.json` | `f47f66e1c696ab7b76b84a3825122891f724f5e1312aede11c57de7fb5ca2796` |
| diagrams `native-verification/diagrams.json` | `655dcfa24ec5c9a7d0664cdb12acc19f9c468225aebc3cd5628448c8b31f464e` |

The package log independently sums to **22 executions: 21 native groups / 102 native cases and one original portable flow**. The artifact independently contains **21 result JSONs: 20 native groups / 97 cases and one completed portable flow**, with the export gap above. All 97 retained native case flags are true and their statuses COMPLETE. I checked all actual result hashes against the root receipt. The 20 native results record 395 before-input entries. Eighteen results retain equal before/after maps; `docs-structured` and `home-documents` instead record empty `changedInputs` and do not retain an after map. Their reported stability is preserved as a different evidence class; no after map was invented. Fourteen raw local/hosted source/generated paths differ only through CRLF/LF; `generated/build.json` additionally reflects the hosted renderer hash, so this is not a blanket exact-local-byte claim for all hosted inputs.

The actual unit/protocol log records **2 process-identity tests + 1050 other tests = 1052**, all passed, with zero fail/cancel/skip/todo; its separate earlier guarded-IO command records **1 test**, also passed. It is not 1053 unit/protocol tests. I independently parsed these three count blocks and checked all five saved decoded job-log files exactly equal their retained connector JSON content, then compared each length/hash against the root receipt. All read-only checks completed with exit 0 after accommodating the original result schemas and explicit retention gap rather than suppressing them.

| Decoded original job log | SHA-256 |
| --- | --- |
| unit/protocol `111935235185` | `b28242d16ef9865e4c534dfaea2db1c9a9fbf44324647bc1f997e9cb6a9490d3` |
| package `111935235143` | `5144dd9e77c3d5381b975a5a9ee48295c31cc1ce59b439611dd4bb8c5e2406fc` |
| native desktop `111937537860` | `4594bafca7b795192a3c5658c75f9f7501a1e50e457367fbf84b6a828a50fbd8` |
| native diagrams `111937537861` | `ebd089614d3471161f5d34cef0dc72bf9a25f34f1298247f2222ac27d140ca47` |
| native sources `111937537983` | `16a2038435321cd051daafd7ef22d7f14b8363834f95f6189bf0863e20066b36` |

## Hosted package identity and limits

The actual retained hosted BUILD-IDENTITY names the synthetic checkout and a distinct hosted ASAR: **53,568,014 bytes**, SHA-256 `54d896061f332e3e2c851f28be258f7331733584aed3161078af6549cd69a945`. Runtime remains **245,726,208 bytes**, SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. Hosted renderer SHA `85e9a4dd9a905e0a028c11623ca23f1954e5f745a651c058778820bd97e7171b` equals the LF-normalized local generated HTML hash; local raw renderer/archive identities remain distinct. The retained renderer metadata differs from local only in that renderer hash. Original portable result records completed true, the unchanged original probe hash `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24`, and archive/runtime/source matching the hosted identity.

The uploaded artifacts retain receipts/logs/screenshots and BUILD-IDENTITY, **not the actual hosted ASAR/EXE or every copied package directory**. This report therefore independently validates their retained identities and test results; it does not repeat the prior local 243-file ASAR byte qualification on unseen hosted archives. Release admission remains false. Original six-case Presentation executes in hosted package and native-diagrams scope; the separate controlled domain report's one-Audience final Lock limit is not silently broadened.

## Previous identity failure preserved

I recaptured the original failed run `37355828768` sources ZIP SHA-256 `bad1834dfd610f123b1a5f589212c13a5a62e189fb0dc54edad65be22cc86ae1`, unchanged from the prior independently reviewed snapshot. Its first source-read result at `2026-10-05T18-32-15.030Z` remains ADVERSE with zero cases, SHA-256 `4bdc5b227f219a707495a4266f8e44ea3e82acc3c1cb518b25f0fc16ce25357c`; its actual Electron log SHA-256 is `ff5d675f2741f6d30d3e8884e350891a2d16cd887f477509b860fe1b8e912557`. The log still records process identity QUERY_FAILED/killed/SIGTERM/zero-output behavior. No old log/result/script was rewritten or relabeled by this review.

The new run's controlled identity-deadline artifact records a bounded 6-second delayed query succeeding, two 12-second delays cancelled at the same 10-second deadline, an actual Unicode child identity and unknown-to-readonly diagnostics. Together with successful current source-read, this supplies a successful current observation and bounded fail-closed behavior. It does **not** identify the cause of the previous cancellation, prove a permanent reliability fix, or justify accepting unknown identity. No provider reliability fix is inferred merely from a green rerun.

The root hosted receipt reviewed is `reviews/2026-10-05-window-close-keys-hosted-receipt.json`, SHA-256 `9dbcfb22f21040b6bf2730951111ab433b38226a24b6c793a02c0a91619a82f5`. I checked its nine named job conclusions structurally against the supplied metadata and independently checked its six artifacts, three group receipts, 21 package results and five logs against actual retained bytes. No fresh independent query of the four jobs without saved decoded logs was made. This is narrow hosted evidence review with an open retention finding, not whole Task 4 completion, PR merge approval, physical-keyboard/monitor/clean-machine/account/update qualification, exhaustive privacy or production release admission.
