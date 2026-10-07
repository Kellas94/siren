# Original hosted PIN candidate evidence — FINAL adverse

Author: `/root/disk_inventory`, owner evidence retention. This report is not an independent product approval or release admission. It records the actual original hosted run and retained bytes; no downloaded code was executed.

[Run 37539190289](https://github.com/Kellas94/siren/actions/runs/37539190289) finished with **failure**, updated `2026-10-06T22:26:35Z`. All nine jobs are final: six succeeded and three failed. The product and the test failure remain open for diagnosis.

## Verified source and integration

- Canonical candidate: `afd1728d2fdb7e132db0bb81fd204a5e116dc83a`.
- Canonical and actual integration tree: `3881ec00ee4abfc3d0b721af46c66df055b74139`.
- Actual integration: `32479e1390340ee255e80e72dd80cc98e4ab2189`.
- Ordered integration parents: unchanged main `1e5472dde446657e2dbb155868e28e033c6c9c92`, then the canonical candidate above.
- Original run references the reusable launcher and desktop workflows at that actual integration commit.

The run, all jobs, artifacts API, canonical/integration commits and main-ref API responses are retained under `evidence/workspace-surface/ci37539190289`. JSON API/log transport is UTF-8 through apply_patch and may use LF for the wrapper; the retained ZIP archives are exact downloaded bytes, verified against GitHub's size and SHA256 digest.

## Actual failure and unexecuted scope

The original `desktop / Windows native (desktop)` job `112529917750` failed in **Actual development renderer and protected storage**. Its native group attempted all twenty probes: nineteen returned zero; `guided-intro` returned one. The group is `ADVERSE`, with `failed: ["guided-intro"]` and no changed inputs.

The original guided-intro result has `completed: false`. Its first recorded assertion is **Owned fixture PIN setup must acknowledge**, at `tests/native/drive.mjs:42`, called by `tests/native/guided-intro.mjs:154`. The original log records this at `2026-10-06T22:22:26Z`. The result is retained at:

`evidence/workspace-surface/ci37539190289/desktop-native-desktop-evidence-original/evidence/guided-intro-2026-10-06T22-22-07.535Z/result.json`.

This establishes a failed setup acknowledgement in that fixture. These originals do not establish why setup was refused; no transient-failure, fixture-only or product-root-cause conclusion is invented.

The subsequent **Actual first-session PIN crash recovery** development step was **skipped** by GitHub after the native-group failure. No development PIN-crash aggregate or case receipts occur in that original artifact. Therefore the planned six hosted development crash cases are **NOT EXECUTED**, not successful. The desktop and overall merge aggregators failed because the selected scope was incomplete.

## Successful original scope

The unit job passed **1,242 unique tests**: three native-identity tests plus 1,239 other tests, with zero recorded failures. The raw job TAP counts are `1 + 3 + 1239 = 1243`; the early owned-read IO test is also in the later suite and is counted once in the unique total.

The sources and diagrams native groups each completed all twenty probes with zero failing return codes and no changed inputs. Across all three groups this is **59 successful / 60 attempted probes**, with the guided-intro failure retained above.

The original packaged job succeeded. It retained **29 complete module probes / 149 successful recorded module cases**, plus the separate shell and packaged core receipts, both `completed: true`. The copied-package PIN matrix is a separate scope from those 149 cases:

| Copied-package PIN case | Actual outcome |
| --- | --- |
| Setup, then abrupt owned-process close | COMPLETE; one restart; unlock acknowledged |
| Setup, Lock acknowledged, then abrupt owned-process close | COMPLETE; one restart; unlock acknowledged |
| Setup, Lock acknowledged, then graceful close | COMPLETE; one restart; unlock acknowledged |

All three used independent fresh private Data roots and copied the closed 78-file App/BUILD inventory. The originals report unchanged source package, copied executable/archive and all 24 captured harness inputs. Each records exact native PID/path/creation identity and matching expected executable/userData/sessionData, before and after restart. Each retains the same 232-byte protected PIN record hash across the first close/restart before unlock; the dedicated protection `Local State` exists at setup acknowledgement and restart (490 bytes in these cases). Each restarted locked with `configured: true`, `available: true`, `blocked: false`, and unlocked successfully. Final cleanup was graceful. No protected bytes or PIN values are included in this report.

The original hosted 300,000-line bundle-import result is `COMPLETE`, four cases successful, with unchanged inputs: recorded source bytes `7,088,891`, bundle bytes `9,454,085`, exact remapped Code/Docs identities, Lock/restart and independent legacy import. The uploaded evidence does not contain the raw imported source or exported bundle, so no independent raw-source digest is asserted.

The original packaged 300,000-line diagram-edit result also completed all four cases. That is a later successful observation. It does not change or explain the preserved original timeout in run `37534183640`, and is not presented as a causal fix for it.

## Exact original artifact retention

All five desktop ZIPs were downloaded, independently length/hash checked against original API metadata, then extracted inertly with bounded file/byte budgets and refusal of traversal, links and non-JSON/PNG/log/text entries. Total ZIP bytes: **24,791,070**. Total extracted files: **539**. Per-file length/SHA inventories and ZIP identity receipts accompany each archive.

| Original artifact | Bytes | SHA256 |
| --- | ---: | --- |
| desktop-development-evidence | 61,479 | `3a62a1be96ec6821c181371ec9be12baa081f170212dda024a73a303ef20ee23` |
| desktop-native-sources-evidence | 3,212,702 | `3677d45da083c856c8665064ee8da56822ce90d2bc2bf1c013b5126cd9d0fa31` |
| desktop-packaged-evidence | 9,632,851 | `2b236085c3e0782ce5ca7e7cee04008539d459fc6d5fa2c975f997261b419d4b` |
| desktop-native-desktop-evidence | 4,406,009 | `3f73707a0a16823f602570672a3cdfeee61bf1f018a846285f31b37d93875a4c` |
| desktop-native-diagrams-evidence | 7,478,029 | `25a0501b4d39767f9095998238180be2c5f314b70513dc566b2426cd029a9b5f` |

The five original decoded job logs (unit, package and each native group) are retained with wrapper and decoded UTF-8 content hashes. No signed download URLs are retained in the report or evidence metadata.

The original BUILD identity records development ASAR length `53,866,014`, SHA256 `981f5669d78f367f99e13ae354f5c923a75906469b9bdc189aa26660492d44ca`, source integration `32479e...`, and `releaseAdmitted: false`, `inventoryQualified: false`, `launcherQualified: false`. The uploaded artifact contains BUILD/behavior receipts rather than the raw ASAR; the ASAR hash is reported by those originals and is not falsely described as an independent local rehash of a retained ASAR.

Machine-readable observation and identities: [2026-10-07-pin-crash-hosted-evidence.json](C:/Claude/SIREN_WORK/portable/desktop/reviews/2026-10-07-pin-crash-hosted-evidence.json). Scope remains process termination on these runners, not power loss, OS reboot, other-user security, online accounts, clean-PC qualification or release approval. Prior adverse originals and earlier local qualifications remain distinct and untouched.
