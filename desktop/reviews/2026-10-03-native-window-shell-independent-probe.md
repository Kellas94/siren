# Independent native window shell probe — first attempt

The authorized, unchanged probe was invoked exactly once and exited 1 before launching Electron. This is a fixture setup failure, with **no native coverage** from this attempt. It is not evidence of a product failure or a native PASS. No product, probe, timeout, delay, or assertion was changed by this reviewer; no retry was made.

## Invocation and failure

- Command: `node tests/native/window-shells.mjs`, working directory `C:/Claude/SIREN_WORK/portable/desktop`, using the approved `require_escalated` execution path.
- Node: `v24.16.0`.
- Invocation started `2026-10-02T23:39:37.3412484Z`; returned `2026-10-02T23:39:37.4343652Z`; exit code 1.
- `ProjectStore.createProject` at probe line 18 rejected with `ENOENT`, syscall `lstat`, path `C:/Claude/SIREN_WORK/portable/desktop/evidence/native-window-shells-2026-10-02T23-39-37.404Z/owned-data`.
- The probe creates the evidence directory at line 15 but never creates its `owned-data` child before constructing the stores and calling `createProject`. `ProjectStore.projectsRoot` calls `ownedDirectory(this.root)`; its existing ownership check correctly requires a real, existing root. The failure occurred before fixture creation, migration, the probe's `try` block, or `launchDesktop`. Consequently this probe generated neither its own `result.json` nor `electron.log`.

The intended 2 Code + 2 Docs native shells, isolated preload and privacy checks, forged-key/stale-version refusals, close/revocation, all-shell Lock/null bootstrap, and exact original/migrated snapshot comparisons were all **unreached**. No disk snapshots existed to compare. The root coordinator was informed of the missing fixture root and retains responsibility for a separately authorized corrected probe; this report records only the failed first invocation.

## Frozen identities

Before and after manifests contain all 83 enumerated source, build, generated, native-test, package/lock, and baseline files with byte lengths and SHA-256 hashes. Every enumerated identity matched across this invocation. Start capture: `2026-10-02T23:39:14.2624141Z`.

| File | SHA-256 |
| --- | --- |
| `src/main.mjs` | `19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0` |
| `generated/app.html` | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| `generated/windows/code.html` | `bd4cd24dac119d2841b65daf9f6422b412aa17ef19d4c6900a5a14285e71f477` |
| `generated/windows/docs.html` | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |
| `tests/native/window-shells.mjs` | `a4dd333bd4fbf50425021583b5ab9aa7518cc512f6b58aa0cc5efae2c348d332` |
| `tests/native/drive.mjs` | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |
| `src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `package.json` | `8316eb72347f332e2fc055b8c5d3f4bbe22dfd69c4614f915c03a91b29ecb18d` |

The on-disk intended executable was `C:/Claude/SIREN_WORK/portable/desktop/node_modules/electron/dist/electron.exe`, file version `44.5.1`, 245,726,208 bytes. This attempt did not observe an Electron runtime or `process.versions`; file metadata alone does not qualify runtime behavior.

## Process ownership and evidence

Read-only `Win32_Process` inventories immediately before and after the invocation filtered the exact workspace Electron executable path. Both contained zero processes. No Electron launch was reached, and no process was killed by the reviewer. There was therefore no owned runtime family to clean up or qualify. This is not a claim about unrelated Electron processes or future descendant cleanup.

All evidence below is ignored under `desktop/evidence/native-window-shell-independent-probe/`:

| Artifact | SHA-256 |
| --- | --- |
| `probe.log` (complete stderr/output, 951 bytes) | `1b88a4e99680b4e3868def831888edfa5afb79a2fe05541eacfb053b929d7be3` |
| `run.json` | `b29a1b55347bd72b1f78a2a621acca093f56d970e5dab971c29ef1afb5b60332` |
| `start-identities.json` | `7359c58f9e6974d20c4db8c2368df4dc601006730da518f1eff7a68cfc8b2e96` |
| `end-identities.json` | `24f15259c73acdbf8c849e30bb9cf4402331a0bcc0c1d8f18d1b6f6c669e0fe0` |
| `identity-comparison.json` | `629efe75471d71de7e90d31ffa1ecf495639f2c65cba5d2af3ba0b378077f268` |
| `processes-before.json` | `4dad8fa5232af8c53d71bfcf7943dab70be9ab5203e91a242f790bec97131087` |
| `processes-after.json` | `bad7d0d982ec2645e1b76d99998863af1b623bd1a9398a1b1c046ce00955b66e` |

## Unaffected static review

The reviewer read the actual frozen probe/driver and the current main integration, factory, role preload, entry script, protocol resolver, project-root ownership check, and generated build receipt. Static inspection remains consistent with the earlier independent data-free entrypoint review: only exact Code/Docs role URLs are admitted; shells start hidden, use sandbox/context isolation without node integration, expose the five narrow window commands and payload-free readiness callback, and contain no full-project bootstrap or content transport. Main supplies verified snapshot-derived entity IDs and checks optional Code versions, rechecks registered callers before showing a shell, tracks hidden pending factories for retirement, and refuses acknowledgement if destruction cannot be confirmed. The Lock path gates window requests through its transition state and retires native views before acknowledging local PIN lock.

These are source observations, not native results. No further focused/full suite, native experiment, generated rebuild, or product mutation was performed during this task. Actual window admission, native preload isolation, lifecycle behavior, PIN reload/null snapshot, disk retention, and process cleanup await a successful real probe. Editor transport, Task 3 dirty-view coordination, physical monitors, presentation, packaged runtime, and Terminal remain outside this attempt's scope.
