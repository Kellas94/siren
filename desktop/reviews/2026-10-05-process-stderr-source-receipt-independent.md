# Independent source-receipt verification — stderr refusal lot

Author: `/root/workspace_surface_review`. Date: 2026-10-05. Scope: read-only recapture of the root source receipt, frozen full-suite inputs/log and five original native source-probe receipts after the demonstrated stderr-to-false-missing correction. This reviewer did not execute those full/native runs or launch Electron. No prior report or captured product file was edited. A forthcoming package remains a separate qualification lot.

**Verdict: the root receipt is supported by the actual retained source results and exact current captured inputs.** This verifies the stated local source evidence; it does not prove a permanent fix for the zero-output hosted cancellation, complete hosted success, a new package's bytes or release/whole-plan approval.

Root receipt `reviews/2026-10-05-process-stderr-root-source-receipt.json` has SHA-256 `c4731f419acff9625ac8b1493c43715a526f23bc64d23ddf601c45d1bb13a592`. Its complete-scoped-source designation is consistent with its explicit exclusion of hosted cancellation diagnosis and pending package/hosted qualification.

## Frozen suite

I read the actual result at `evidence/workspace-surface/full-suite-2026-10-05T19-54-16.084Z/result.json`, SHA-256 `5bb7701ce77b6183951e5dff64a8f2db7dd4faf2f09fcda4f2e5b31396798741`, and recomputed the exact original `output.log` SHA-256 `b3ead93df0320cdd2846a2c64cc9055f75a7ff449f2162f24619a99916c40a42`. Both match the receipt/result identities. The actual result is COMPLETE, exit zero/null signal, changedInputs empty. The actual final log summary is tests/pass 1,053, fail/cancel/skip/todo zero, duration 188,703.3451 ms.

I rehashed every one of the 419 captured current files. Every hash equals both the before-map and after-map; map cardinalities are both 419, with no mismatch. This qualifies the captured source/test/build-script inputs. It is not a reconstruction of unlisted dependencies or an independently executed full suite.

## Five original native probes

The sequential native aggregate `evidence/process-native-qualification/2026-10-05T19-58-51.524Z/result.json` has SHA-256 `d05ba4f0480b029c82f6e191b3b4b4f254bc6f0fce9781d7769ac8be500e11ae`, matching the receipt. It is COMPLETE and contains exactly the five expected ordered children, all exit zero/null signal. I recaptured all ten aggregate inputs, matching current/before/after bytes exactly. The reviewed helper (`evidence/workspace-dock/run-process-native-qualification.mjs`, SHA-256 `89247ff65083519867a181d6cc9bf95aed2b6eec21ef61a9693cfcff4db96b7c`) launches the original script paths directly, records each actual exit/log and refuses COMPLETE on failure, omitted child or input change. It does not replace an original oracle or retry a failed child.

I recalculated each actual child log hash, matched it with the aggregate and root receipt, resolved the result directory from that log's final original summary, and directly read the corresponding result:

| Probe | Actual original result | Result SHA-256 |
| --- | --- | --- |
| shell, 19:58:51.605 | completed true, four checks | `bce16831cd09b5c63e0127ccda7583d57926bcdfd6b0b27cb3b280c184b6dca6` |
| local-pin, 19:58:59.375 | completed true; original PIN/cooldown/restart fields retained | `f12acd5f76fdcac102beedc829b967e190ace49a595be7c872b339d2646f3b1a` |
| home-recovery, 19:59:58.168 | COMPLETE, three cases | `776117bc396b76985e72f78cfbc4a0b05f7a2eb03224fb3d1a75ae3605ca4dba` |
| window-close-keys, 20:00:05.549 | COMPLETE, four cases | `3c42aeaac2ee4c266600a97c0106e35a882af696429674c86c225fc86ebe8bd9` |
| diagram-export, 20:00:12.307 | COMPLETE, five cases, 100,000 lines | `3863d5fc06368ff668f451b01a29cf387fdac45894873138f374bc45bb5fe5cf` |

The home-recovery/close/export result captures contain 9/14/16 entries respectively. All 39 current hashes equal their before/after maps, with no extra after-map entry. The five PIN sourceHashes also match current files; that schema does not provide an equivalent after-map. Shell has no comparable per-result capture map. These differences in original result schemas remain explicit; the aggregate ten-entry fence must not be described as an exhaustive per-child dependency capture.

## Source identity and limits

The actual changed provider remains SHA-256 `1f550636541ff7eda3ebe3cb01eb2833a84303a6bae80268f990e217c50a02e9`; main is `ecb49919db6af95538cd52aa104d5f908310e51680df9c9b353ba98ff7232d2e`; new regression test is `c0065bff72426638768b253a6634567f05a153d8e0626884ca2a6edcdf78d78c`. These match the independently reviewed correction and the current suite/native captures. My separate report `2026-10-05-process-identity-adverse-unicode-independent.md` already records my own focused 9/9 execution and controlled actual-journal COMPLETE4; those are not counted again as newly executed tests here.

The source receipt's original controlled module-refusal RED, corrected GREEN and Unicode-capacity result identities match the independently recaptured evidence recorded in that separate report. The hosted 37364770356 first-package result remains adverse on an earlier canonical source snapshot. Its native export upload alone is independently qualified by `2026-10-05-diagram-export-retention-hosted-independent.md`. Neither this later local full suite nor these five local native probes changes that historical package outcome or establishes why its PowerShell query produced no bytes before SIGTERM.

New package identity, exact ASAR closed file-set/source bytes, original copied-package probe inputs/oracles and actual copy archive/executable identities require a separate report after the package exists. No such qualification is made here.
