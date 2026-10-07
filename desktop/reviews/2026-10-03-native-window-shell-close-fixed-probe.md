# Independent native shell close-fixed probe

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Authorization: one execution of the current unchanged `desktop/tests/native/window-shells.mjs` through the unchanged `drive.mjs`, after source/unit close-fix review. No product, probe, or driver edits; no retry. This is a native development-runtime experiment, **not release admission or production package qualification**.

**Actual result: the unchanged probe completed successfully, Node exit 0.** The probe opened two Docs and two Code native shells, verified role caller metadata and isolated preload/DOM privacy, rejected forged scope and unsupported source version, completed the workspace-initiated native Docs close and refused subsequent focus of that closed view, and completed all-shell Lock with null locked bootstrap and no remaining role targets. The original and migrated fixture disk snapshots remained equal to their pre-run values. The final owned application close completed normally.

These are the assertions already in the unchanged probe; its oracle and internal timeouts were preserved. Code/Docs shells remain data-free shells. This run does not establish shared editor contents/edits, terminal ownership, Audience/presenter implementation, physical multi-monitor behavior, renderer heap confidentiality, or native self-initiated close/veto scenarios. The successful close here is initiated by the workspace, rather than the role's self-close button. The self-close authority fix has separate source/unit evidence.

I launched `node tests/native/window-shells.mjs` once from `C:/Claude/SIREN_WORK/portable/desktop` under the explicitly authorized escalated execution. The launch wrapper observed Node PID **28624**, then its direct owned Electron child PID **40020** with the exact verified executable `C:/Claude/SIREN_WORK/portable/desktop/node_modules/electron/dist/electron.exe` and creation time `2026-10-03T00:09:54.2362060Z`. The installed Electron distribution is **44.5.1**. Its witnessed executable SHA-256 is `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. The wrapper retained PID, parent PID, executable path, and creation time for exact-identity cleanup; no process-name/global cleanup was used. The owned Electron process had already exited when the wrapper completed, so no external force-stop occurred. A subsequent exact-PID inspection found PID 40020 absent. The native driver's own normal cleanup implementation was unchanged.

Actual result directory: `desktop/evidence/native-window-shells-2026-10-03T00-09-54.000Z/`. Its `result.json` has `completed=true`, the original scope description, and probe SHA-256 `382c7bc43e875f6875155ca55b65487defacb7ed710475fb9436fb27669a5b51`. Native stderr is empty; Electron's retained log contains its owned DevTools endpoint. I sent the actual outcome and input comparison immediately to `/root` before authoring this report.

## Input identity witness

The independent read-only witness under ignored `desktop/evidence/native-window-shell-close-fixed-review/` captured **61 input files before and after** native execution. It follows relative static and literal dynamic imports from main and the native probe, with explicit native preload seeds, and includes the renderer source/build inputs, baseline, all generated renderer files, package/lock files, probe/driver, and Electron executable/version/package metadata. Both captures contain identical path/size/SHA-256 entries: `stable=true`, zero changed entries, zero removed entries. The snapshot documents which source inputs were witnessed; it is not a trace of executed statements or a hash of every installed external dependency file.

**Explicitly excluded isolated work:** `desktop/src/sources/ipc.mjs` and `desktop/src/ui/code/source-client.js`. They are separately owned agent work, not imported by this current main/probe/renderer import boundary; the witness refuses either appearing in its import closure, and checks that the generated application does not reference `source-client.js`. No SourcesIPC/sourceclient integration result is claimed. Other unimported modules are likewise outside the live closure. The probe itself does import the existing repository/migration/recovery source implementations for its owned fixture; those source files are included.

Selected unchanged identities from the complete snapshots:

| Input | SHA-256 |
| --- | --- |
| `desktop/src/main.mjs` | `19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0` |
| `desktop/src/windows/registry.mjs` | `bf5138cf8ba028ede0b02722eece85e9185d4f1cf34c243e80e2bc3d8f8b670d` |
| `desktop/src/windows/ipc.mjs` | `d0b094e6cdc9804c97db6457e539bb9f36fdefdc9f94443dd50abd19c006cfd2` |
| `desktop/src/windows/factory.mjs` | `3cbdf1e52f0512a94af6148a6b531892fe6a439c3726ada46562c4e1d835437d` |
| `desktop/src/windows/preload.cjs` | `a9c8efbdd81c4a9c55964530211be2ca819beb439d3283f4634a9ab45f38871b` |
| `desktop/src/protocol.mjs` | `2e9494bc36a63557fd921ed79d2284d6e6452a6f998ed5350e3f342c686538b3` |
| `desktop/tests/native/window-shells.mjs` | `382c7bc43e875f6875155ca55b65487defacb7ed710475fb9436fb27669a5b51` |
| `desktop/tests/native/drive.mjs` | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |
| `desktop/package.json` | `8316eb72347f332e2fc055b8c5d3f4bbe22dfd69c4614f915c03a91b29ecb18d` |
| `desktop/package-lock.json` | `6c377e1ceae9a50b9598813d7d19bd7f6ca52ba8bf1b853210dbbc6d40843cd5` |
| `desktop/baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `desktop/generated/app.html` | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| `desktop/generated/windows/code.html` | `bd4cd24dac119d2841b65daf9f6422b412aa17ef19d4c6900a5a14285e71f477` |
| `desktop/generated/windows/docs.html` | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |

The complete 61-entry snapshots retain individual hashes for the imported account, project, recovery, Sources repository/manifest/migration/metrics/model/recovery, updates, and windows modules, the remaining source/build renderer inputs, and generated metadata.

## Retained evidence identities

Paths below are under `desktop/evidence/`.

| Evidence | SHA-256 |
| --- | --- |
| `native-window-shell-close-fixed-review/inputs-before.json` | `c3fd6fd157d703862131d05653b0c1fc09c3f043cf910c5353b3b566e5978caf` |
| `native-window-shell-close-fixed-review/inputs-after.json` | `dde63ef9784b306799e23c4bbae0c329ceeb3fcdeeecedf00e1b629602d8890c` |
| `native-window-shell-close-fixed-review/comparison.json` | `fe0c1689896aa6bb5fb7ca63374e0017f2ca13d625827fa19e84747314b065a9` |
| `native-window-shell-close-fixed-review/witness.mjs` | `fcd029951a566dc5514571c77d73f146c9d22381cca5990882809b21204f9d6c` |
| `native-window-shell-close-fixed-review/launcher-start.json` | `cea38749fd122215350ca43f60946e3c8a28ef0ffab49060ca4cce78422251db` |
| `native-window-shell-close-fixed-review/launcher-result.json` | `18912447a4393451fa5304fc633cfbe2aa878414eefb1f30f6e75f7f2972008f` |
| `native-window-shell-close-fixed-review/owned-electron-processes.json` | `ed72d42eabf7de1d7b0f11bfd526640dbaab0757246b6c545aa10434ebea652c` |
| `native-window-shell-close-fixed-review/probe.stdout.log` | `caa5284c914517f30b8b22b32dc394ea5a9542401e708927a7fb9d4a5b9292bd` |
| `native-window-shell-close-fixed-review/probe.stderr.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `native-window-shells-2026-10-03T00-09-54.000Z/result.json` | `dabe7bba78a0e2ca1bae325a87f6e8c3111cf49f9921313288fc86cfde9804c2` |
| `native-window-shells-2026-10-03T00-09-54.000Z/electron.log` | `f217aaf5f700a7c303f201d5bc9d1c075cac8995fcf3c6d6167e4f6195581a43` |

The earlier inconclusive observation, successful causal callback observation of the old bug, and failed source-fix assertions remain preserved in their own evidence/reports. This later successful native harness run does not erase those failures or widen the qualified scope.
