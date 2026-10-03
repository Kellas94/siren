# Independent development package native review

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Scope: read-only inspection and one authorized unchanged `tests/native/packaged.mjs` execution on the exact development package below, through unchanged `drive.mjs`. No packaging, runtime, probe, driver, oracle, or timeout edits; no native retry. **This is a successful narrow development package experiment, not production/release admission.**

**Actual outcome: completed=true, Node exit 0.** The fresh packaged run passed the complete pre-restore-original preservation assertion after the reviewed no-op repair. It also passed the existing real pointer/keyboard editor save, exact native snapshot/hash/readback, initial recovered revision/checkpoint, Unicode closed-folder copy and PIN relock/unlock, and damaged-journal native read-only assertions. Earlier failed package/probe results remain historical failures; this successful fresh result does not rewrite or relabel them.

## Exact input and module identities

The inspected original is `desktop/dist/development-50b03524-aa9b-49bc-b7dc-abb8bc92347d/`, declaring `kind=development-preview`, `releaseAdmitted=false`, and source commit **`40ce7938feeca39873d971bfbe50a57d9b62a253`**. That declared commit was used for every Git comparison, rather than a later HEAD containing isolated SourcesIPC/client work.

| Input | SHA-256 |
| --- | --- |
| `App/versions/0.1.0/resources/app.asar` | `d797b6da2af5c4606102d2c1ed39f909d19d0605b5d37f2fda4aa734ad33db44` |
| `App/versions/0.1.0/SIREN.exe` | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Packaged/current generated application | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| Packaged/current Code role entry | `bd4cd24dac119d2841b65daf9f6422b412aa17ef19d4c6900a5a14285e71f477` |
| Packaged/current Docs role entry | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |
| `desktop/tests/native/packaged.mjs` | `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541` |
| `desktop/tests/native/drive.mjs` | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |

Before and after the native run, independent inspection of all **41 packaged `src` runtime modules** established: package bytes equal actual working bytes; package and working bytes equal the declared Git commit's corresponding module after CRLF→LF normalization. Raw hashes of all three versions and each comparison result are retained per module. This distinguishes actual packaged/working bytes from Git's normalized bytes. The five packaged renderer/package files (`package.json`, generated app/build metadata, Code and Docs entries) also equal their actual working files byte-for-byte.

The independent witness captured **58 relevant live/probe/build/source inputs** and the original package's complete **83-entry inventory** (ordinary files plus directories) before and after. `liveStable=true`, `packageStable=true`, `moduleProofsStable=true`; the path/size/hash inventory and per-module comparisons did not change. The entire ASAR digest witnesses its installed dependency contents, though the live-source witness is an import closure rather than a trace of executed statements. The receipt identifies Electron **44.5.1**; the unchanged runtime executable digest matches the previously witnessed installed Electron distribution.

The witness explicitly excludes unimported `src/sources/ipc.mjs` and `src/ui/code/source-client.js` and verifies they are absent from both the captured import closure and package archive. The later isolated Sources contracts commit does not alter this package's declared source identity or prove live integration. Existing Sources repository/recovery modules imported by the package/probe remain included. Unimported terminal contracts/output modules are also outside this runtime qualification.

A preliminary run of my new read-only witness failed because I passed normalized forward-slash entry names to the Windows ASAR extractor. I corrected only my ignored inspection script to use native path separators before any native launch. This was an inspection-tool error, not a package/probe failure or native retry.

## Fresh native save and recovery result

The authorized command was `node tests/native/packaged.mjs dist/development-50b03524-aa9b-49bc-b7dc-abb8bc92347d`, from `desktop/`. Its unchanged probe copied the exact package into owned Unicode fixtures and executed those verified copies. Result directory: **`desktop/evidence/packaged-2026-10-03T00-19-53.393Z/`**.

The locked package exposed null snapshot, refused a known-project save with `PIN_REQUIRED`, withheld Node's `require`, and ignored development CLI data/project overrides. Genuine fixture PIN setup/unlock admitted baseline workspace editing. The production pointer/keyboard editor save flushed through the acknowledged renderer/native queue, advancing revision **1→2** with JSON SHA-256 **`4c3fc28b74539c7eb1388ac5ba855fdde9340471ace3c5c69cdfb90f64663ef2`**. The probe checked the complete serialized bag, active diagram/source, native selected revision bytes, hash, and matching saved recovery checkpoint.

At the explicitly drained pre-restore boundary, the complete original was revision **3**, SHA-256 **`c674f364380d3a625300c5dbb840ae508e26b376226af432c9037e0e4ba97a1d`**. The selected checkpoint remained revision **2**, with the earlier acknowledged SHA. Recovery created a distinct project whose immutable initial revision was **1** with exactly the selected checkpoint JSON/SHA; the initial native bootstrap, initial disk revision, and saved checkpoint agreed. The probe's complete-object equality assertions preserved the **revision-3 pre-restore original**, rather than incorrectly assuming the original still had the earlier revision-2 pointer after intervening activity. Read-only inspection of the retained boundary evidence independently confirms these revision/hash distinctions and bootstrap/initial-revision equality.

After a normal clean-close journal acknowledgement, the unchanged probe compared the entire closed first fixture and its Unicode copy: **205 inventory entries**, identical names and bytes. The copied package relocked, genuine PIN unlock resumed the recovered project, and the complete original remained preserved. In the third owned fixture, a deliberately damaged session journal imposed native read-only mode after a correct PIN; a save was refused with `ACCESS_REFUSED`, and original/recovered snapshots stayed unchanged. Unconfigured updates remained explicit.

These results exercise the baseline workspace editor save/recovery path. They do **not** establish large Sources2 capacity, shared native Code/Docs editor content or edits, full native Windows feature completion, terminal ownership/execution, physical multi-monitor behavior, launcher/apply, clean-PC portability, online activation, CI identity, or production admission. The packaged probe does not open the native Code/Docs shells; their module/renderer inclusion is witnessed here, while their earlier development-runtime behavior is documented separately.

## Owned processes and cleanup

One unchanged probe execution deliberately performs its existing three package launches; these are not retries. Node PID **19700** owned the following native PIDs:

| Fixture | Native PID | Observed executable suffix |
| --- | ---: | --- |
| `Pachet-Știință-1` | 23848 | `App/versions/0.1.0/SIREN.exe` |
| `Mutat-Știință-2` | 15232 | `App/versions/0.1.0/SIREN.exe` |
| `Siguranță-readonly-3` | 29268 | `App/versions/0.1.0/SIREN.exe` |

For each, the external witness recorded exact executable path, parent PID, creation time, runtime digest, and adjacent ASAR digest. All matched the exact original package hashes above. The launch wrapper recorded actual Node exit **0**, three owned native processes, and `already-exited` for all three. Subsequent exact-PID checks found all absent. No external force-stop occurred; the original native driver's own cleanup stayed unchanged. No process-name/global cleanup or unrelated PID action was used. I sent the fresh success and immutable-input comparison immediately to `/root`.

## Evidence identities

Files below are under `desktop/evidence/`.

| Evidence | SHA-256 |
| --- | --- |
| `native-windows-package-independent-review/inputs-before.json` | `f6428b394687b524004589f399caef47e32aafca4bc47a4afbe2c834a89f7e09` |
| `native-windows-package-independent-review/inputs-after.json` | `7e2efe958d825196187fb76d4ed4206a34158aeeabe6c5eb5244bfface0885f0` |
| `native-windows-package-independent-review/comparison.json` | `fd787cabf96c6fa60562620c26e02b55b40fe47a0a127393ffecc762ee88e4fb` |
| `native-windows-package-independent-review/witness.mjs` | `2ddfdd12c4140190375ee4d0f3fdfe62c6d50b18d9af5cfcea8bcda792272430` |
| `native-windows-package-independent-review/launcher-start.json` | `61954a493acafc73049ace33f4bc0f2921a39b32d91173aa9724f245f6ba8a6c` |
| `native-windows-package-independent-review/launcher-result.json` | `dd9135979a855998b5337b1e026d58764a5e56acd8929a645c6e4288c9e959d6` |
| `native-windows-package-independent-review/owned-native-processes.json` | `56e1288279d114bdd3c2177967bfed453f3e7ef6049fdd89d03661481b9989cd` |
| `native-windows-package-independent-review/probe.stdout.log` | `b2b338585e6a7cc4a0c36894785808733a354c0e4da8e92ec9e138faa3ffc72b` |
| `native-windows-package-independent-review/probe.stderr.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `packaged-2026-10-03T00-19-53.393Z/result.json` | `1202df494b81b9b7f53a0351938e1a78f455e83ae554a892811fb65abe858c44` |
| `packaged-2026-10-03T00-19-53.393Z/save-diagnostic.json` | `30f0b3896221a8bb96bd468c0624b9f622ff2bf21e0e5815d1c8899e5186d1c4` |
| `packaged-2026-10-03T00-19-53.393Z/restore-boundary.json` | `acc209ea12ae3062bb8a8cf6249050b20a6425bb7c3f39e8709abe7471bbb59c` |
| `packaged-2026-10-03T00-19-53.393Z/recovered-at-restore.json` | `600c71cd911840d4b715c4516c7905b38697c3621d785e3dcbfbad11ba4fab22` |
| `packaged-2026-10-03T00-19-53.393Z/recovered-initial-revision.json` | `c4c95b6a6b9d0b6782f49f2e85f6749be6b217be058ebb662cccfabc4dd832bde` |
| `packaged-2026-10-03T00-19-53.393Z/folder-copy.json` | `b7017541028cb087d25da055dadde866beb1825a850ee78adb6d4453925c2973` |
| `packaged-2026-10-03T00-19-53.393Z/electron.log` | `ee303f2003efc1838ea7dd7955db0c7b0670b17dddab2d3f25d4dd88ca1f0a65` |
| `packaged-2026-10-03T00-19-53.393Z/packaged-desktop.png` | `9a6745dd862d686da91949b4e7d36e03fe7fe5d5bf29ee9e3e52ce88c8827b3b` |
| `packaged-2026-10-03T00-19-53.393Z/packaged-recovery.png` | `a30e47b8e63bd2c6b6c59c4688a2d3e3ea8f35e019f1360b8fa87b7292b77a7d` |

The successful result is confined to the measured commit/package/module identities and unchanged oracle above. No publication, remote update, CI run, release certificate, or deployment was performed or inferred.
