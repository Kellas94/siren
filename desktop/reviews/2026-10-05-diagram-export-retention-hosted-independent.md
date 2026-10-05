# Independent actual hosted retention review — native proof only

Author: `/root/workspace_surface_review`. Date: 2026-10-05. Scope: retained originals from GitHub Actions run 37364770356 and the actual native Diagram export upload after the canonical workflow correction. This reviewer independently read/recomputed artifact bytes, receipts, inputs and original decoded logs; this reviewer did not execute the remote jobs, launch Electron, rerun native probes, modify captured product inputs or qualify a package/release.

**Verdict: actual native Diagram export retention is demonstrated. Copied-package Diagram export retention is NOT_EXECUTED and unqualified. The first package probe remains ADVERSE; there is no whole-hosted PASS.** The original artifact receipt's COMPLETE6 denotes successful collection of six ZIPs, not successful application or CI execution.

## Original archive integrity

I recalculated the size and SHA-256 of every original ZIP, parsed each central directory, decompressed every ordinary entry in memory and compared it with its actual retained expansion. Every byte matches; the complete expanded path sets also match the original entry sets, with no extra/missing entry, duplicate path or symbolic-link substitution. The six archives contain 277 files in total.

| Original artifact | ID | ZIP bytes | Files | ZIP SHA-256 |
| --- | ---: | ---: | ---: | --- |
| launcher-development-evidence | 11368810505 | 245,108 | 6 | `e0413077e604d995c4696ce6b684187edfa512db7c771eed4a7e04dc72b30435` |
| desktop-native-sources-evidence | 11368741164 | 1,712,837 | 72 | `b5cdfc59cfe252c7528ca09a94c63d38194712d318fd9322f64e31dd5325b02f` |
| desktop-native-desktop-evidence | 11368676463 | 4,051,382 | 103 | `1ecb60ca7224fc7dd3cdb36c4e2580729d6df37ab873e7e26d650f7f0f6ae830` |
| desktop-native-diagrams-evidence | 11368331522 | 2,817,319 | 86 | `7d11de7f59d05aa82b1ccc71d736b28767fb226559817521d762b864deadfd84` |
| desktop-packaged-evidence | 11367519981 | 104,318 | 7 | `d94dba6db5a3b9f079dd0247a059e07bb764e7ff32ba382a0bc63c960d3d348a` |
| desktop-development-evidence | 11367324521 | 51,623 | 3 | `c225af315b1eaa17ab304cbfe346304f1b7eb6d25e177d9f901dd1d686d457d6` |

Source paths are `evidence/workspace-dock/ci37364770356-<artifact>.zip` and `ci37364770356-expanded-<artifact>`. Collection receipt `ci37364770356-original-artifact-receipt.json` has SHA-256 `2ef23d42e1287a8da8896f719d8e83bfa7d45b4df8e68a6ee34de5b25d9378a7`. The root partial/adverse receipt `reviews/2026-10-05-diagram-export-retention-hosted-adverse-receipt.json` has SHA-256 `1c901420fa38c6cbc747509ad178b8ff509f641fd64f6bec732892d0b2b7a8ff` at inspection. Its queued/null run/gate fields are a collection-time status snapshot, not a new successful final conclusion independently queried here.

## Native execution receipts and exact source snapshot

The three actual group results are COMPLETE, ok true, no failures/changed inputs, and have exactly 20 desktop, 17 sources and 15 diagrams children. Every child exit is zero with null signal. I compared each ordered child list against the original exported `nativeGroups` recipe; the order and names match exactly, without omissions, repetitions or substitution.

I separately parsed the actual child-dispatch JSON lines in original decoded job logs and compared them with each group's result array. All 52 dispatch/exit records match exactly; each log includes its matching COMPLETE group summary and actual synthetic checkout `ce84709981a5e28ea59231dd88e78b7704c6a3c2`.

| Group | Original job | Group-result SHA-256 | Decoded original log SHA-256 |
| --- | ---: | --- | --- |
| desktop | 111951225091 | `9edc83420a37560f4d0be4b367c6b0a7259be57bc6bd9d92bffda5b008989d97` | `9488e9cdef8f6272e0c3bf9e21c25ca008ca980d4cdf7f32b511ee5ac1e159e8` |
| sources | 111951225242 | `c232dc6784fe3179cffa56a7b8b10a4d4c8218cbc6d2a19db9f22ceac4ae6eeb` | `f1c707ae117575f3d8ffa539922f376699f1cdde0433711de1611da05accfaa6` |
| diagrams | 111951225124 | `4a1b6c3c7c0b6e926169cc77f3a943c72076b83fd7fc4dd1b1cd761431571b2c` | `ff8324e3899ad3801f9597a12ec2dc92900d5a1674f422a0e69624cdecfa4f72` |

All 58 group captured-input entries (22/19/17) exactly match both their after-maps and recomputed SHA-256 values of committed Git blob bytes at local canonical counterpart `404131150ee9a32c4bad7bb56a0866cbc6ccccdc`. This commit's correspondence with remote head `1575b58ba9ef0e54fd010a9601215419aeec1d41` was independently established in the separate canonical review. The group captures cover their runner/workflow/probe lists; they do not constitute a complete capture of all product dependencies for every child.

The retained workflow capture is `66c372292128617f1f3f21110f8dd45d56677ef025ab508c54ff515655e1da04` and runner is `84734fa99cf07f6799d9a41bf17eba62ed4fa7543d4ea9e6bce0225563f63db7`. These are the original workflow/runner hashes, not a result inferred from current local edited source. The current stderr hardening is a later source lot and is not covered by this hosted execution.

## Actual Diagram export retention

The original native-diagrams ZIP contains all four required evidence files at `evidence/diagram-export/2026-10-05T19-53-42.056Z/`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| result.json | 4,792 | `f10a63345daefd5719a5dd284a63e09cf65e26cbb8ed4fbbc0b607329d131011` |
| electron.log | 4,146 | `226646ddaa3024f2b09224132171fb28072a3f5df2b431c492229708eb82d38d` |
| svg-light.png | 35,331 | `96a17a45fcffe727f2b54685e34b59aace0ece7eeeb8eab325736d53b8fe2313` |
| svg-dark.png | 38,752 | `e58fa95974acd70bd2596f4fb74e105dee7cde447ca8f239a5f7387829c5f5a8` |

The original result is COMPLETE, lineCount 100,000, five original cases all ok, inputsUnchanged true. Its cases cover saved readonly light/dark SVG export, dirty/stale export refusal, refused Lock rollback and shared Lock cleanup/preservation. The log contains the expected deliberately refused Lock path followed by successful preparation; its refusal diagnostics must not be relabeled as an unexpected failure when the original oracle explicitly exercises that path.

I independently verified all 16 export captured-input entries against their complete after-map. Fourteen tracked inputs also exactly match committed canonical-404 blob bytes, including the unchanged original export probe SHA-256 `eeec83bb9c88c316adbea5fd9a1f9868b8bdc4c660f1d96f3ba7bbc5b07691f5`. The two generated HTML inputs are ignored build outputs, absent from Git: their raw current local bytes exactly match the hosted hashes `203ca794b97cd8b92d28dd86f948034b8327ca6912e39c8b031f4ce1460832a9` and `97f124a740c19e906392a9af4f911a8916791d474c6df055118450c8185c2acc`. I corrected my verification method to treat those generated files separately after a read-only Git lookup correctly refused their nonexistent Git paths; this is a verifier-method adjustment, not a product change or adverse test relabeling.

This directly demonstrates native result/log/PNG retention by the corrected workflow. It does not independently reconstruct the exported SVG file contents from ZIP artifacts or repeat the original native oracle. The original result explicitly excludes Explorer opening in the unattended fixture. Physical interaction, exhaustive export/privacy behavior and release readiness remain outside this review.

## Preserved package failure and pending scope

The actual package ZIP is byte-identical to the earlier first-package ZIP reviewed separately. Its only original application result has `completed:false`, bootstrap readonly and the original zero-output QUERY_FAILED/SIGTERM diagnostic. The five other files include original logs/failure state/events/screenshot; BUILD-IDENTITY is also retained. No later package native command ran, and there is no packaged Diagram export result/log/PNG to qualify. Expected 21 native executions/102 cases plus original portable completion are not manufactured from recipe definitions.

The historical run 37360932464 retains its actual missing-export retention gap and success statuses. The newer failure does not supply the old missing files or erase that finding. Prior process-identity failure evidence also remains adverse. The separate local stderr interpretation correction and later full-suite receipts cannot retroactively change this original hosted package result or prove the zero-output cancellation cause.

This report qualifies actual native upload only. It does not claim copied-package export retention, complete hosted success, current local hardening execution on hosted CI, independent remote execution, a new application byte qualification, Task4 completion or release approval.
