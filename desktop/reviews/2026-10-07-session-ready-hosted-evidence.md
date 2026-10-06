# Session readiness — final original hosted evidence retained

Author: `/root/disk_inventory`, acting as owner evidence-retention agent. **This is not an independent product approval.** No source, build, test, GUI, package, branch, main, release or cleanup operation was performed by this agent.

Original GitHub run [37528726783](https://github.com/Kellas94/siren/actions/runs/37528726783) is **completed / success**, with all nine jobs completed successfully. The original final run/jobs/artifact API responses, actual integration commit responses, five decoded job logs and five original desktop artifact ZIPs are retained at:

`C:/Claude/SIREN_WORK/portable/desktop/evidence/workspace-surface/ci37528726783`

The machine-readable receipt is `C:/Claude/SIREN_WORK/portable/desktop/reviews/2026-10-07-session-ready-hosted-receipt.json`.

## Exact admitted integration

- Canonical feature commit: `63e03994b6e13a88911a61d387d8afc33035baf9`.
- Canonical and actual integration tree: `d5cd608cfbd4842db6cf531380d991dfa8943eda`.
- Actual checked-out integration commit: `b213e2606520ab7be34e8f8e985901fa80e3e478`, present in all five retained original job logs.
- Integration parents, read from the actual Git commit API: unchanged main `1e5472dde446657e2dbb155868e28e033c6c9c92` followed by the canonical feature commit above. The live main ref still matched that main commit during retention.
- Associated local product commit: `59081e36f00629d6da4c0d474efe5dcb21f1312b`; synced local checkpoint: `708cf2cab7e941fc0c5285c4f57e0e43d4b14e4a`.

This verifies the tested integration identity and ancestry. It does not claim byte identity between hosted Windows checkout artifacts and a local package, whose newline/build inputs can differ.

## Results from original logs and retained artifact contents

- **1,161 distinct unit-suite tests passed:** three admitted native identity tests followed by 1,158 remaining unit tests; all fail counts are zero. The early IO probe runs one suite member separately and is excluded from the distinct total. The extracted original `ci-native-identity.log` and `ci-units.log` agree with the original complete job log.
- **60 original native probe processes passed:** desktop 20, sources 20, diagrams 20. Each original group artifact records COMPLETE, zero/non-signalled exits, no failed probes and unchanged captured input hashes. The actual child and final log records agree with these retained group files.
- **28 copied workspace module probes / 145 named cases completed** in the packaged job. Each original module result is retained and matched to its original log outcome. Additional production packaged-core and shell checks completed separately; they are not invented as extra numbered module cases.
- The original packaged core result is completed and agrees with the original BUILD identity: source integration `b213e2606520ab7be34e8f8e985901fa80e3e478`, app archive **53,811,435 bytes**, SHA256 `6db6124aded61085f9de2b5396f64f555be8292a904c5abeafecda17a5d97e07`. The BUILD explicitly remains `development-preview` and `releaseAdmitted: false`.

Detailed original-path/hash summaries are in `unit-counts.json`, `native-group-summaries.json` and `package-probe-summaries.json` in the retention directory.

## Original ZIP identities

All five ZIPs were downloaded as original GitHub bytes, checked against the API-reported size and SHA256 digest, and retained unchanged. They contain **533 inert extracted files** in total. Extraction accepts only bounded JSON/PNG/log/text files, rejects unsafe paths, links and duplicates, and executes no artifact code.

| Artifact | Bytes | SHA256 | Inert files |
| --- | ---: | --- | ---: |
| desktop-native-diagrams-evidence | 7,467,326 | `74cc63f6fd16e38457b30bf17cc64540b2d30f1fd7c6c24f935db2eca150025e` | 146 |
| desktop-packaged-evidence | 9,604,675 | `1061da822257d9acf06f1b63beaf072885c4a2a2387338730c24cf7ca022c9b1` | 191 |
| desktop-development-evidence | 57,595 | `b43068c1ab1019aa901b0afb940aee8a885a268cd035a08c4ca95d8b4526c942` | 5 |
| desktop-native-sources-evidence | 3,215,450 | `b5be5dc5f4a6273d049cd0a65600ce077e501b9d1ae0d3bf429ca1daca3bd65f` | 86 |
| desktop-native-desktop-evidence | 4,317,164 | `c82d61bb6a8775ee80072aa1b45c46b132bc2857129d0b98aef6344e7143b6ff` | 105 |

API/log transport files use UTF-8/LF JSON wrappers. Their `originalDecodedContent` strings preserve the exact connector-decoded original contents, including original CRLF/BOM characters. These wrappers do not replace the exact retained binary ZIPs. No signed download URL was printed or retained in metadata files.

## Provenance and limits

Earlier hosted-adverse records and separately authored reviewer reports were not overwritten or relabelled. This successful run is a later original completed run, rather than a retrospective rewrite of the earlier failed run.

The first owner retention-helper pass refused to finalize because its path selector picked a module result instead of the packaged-core result. The adverse observation is retained in `retention-check-adverse.txt`; the selector was corrected to the exact immediate `packaged-*` directory. Existing unit/native summaries were accepted only when their full serialized bytes matched exactly. This was a retention-selection error, not an original hosted test failure. No hosted-final review receipt was emitted until all checks passed.

This record attests actual final GitHub evidence and retention. It does not assert independent product approval, a production release, a merge, configured accounts/updates, clean-PC validation, or qualification of later development changes.
