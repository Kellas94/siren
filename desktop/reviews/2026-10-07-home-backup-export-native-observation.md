# Home saved-backup native regression observation

Author, harness author and actual executor: `/root/media_batch_review`.
This is scoped runtime evidence from an independently authored regression,
not independent approval of the entire application or a release.

## Execution and immutable receipt

Executed once, after root granted the exclusive GUI slot and confirmed renderer
v3, using the existing development Electron application and a fresh owned data
directory. The approved normal Windows token was used because restricted-token
Electron startup previously refused its installation-directory access. Electron's
sandbox remained enabled. No installed application or existing user profile was used.

- Harness: `tests/native/home-backup-export.mjs`, SHA256
  `8128dc7ab8dd188c1ae3bc77587ab7b146d51dd83230dde8ceecf2d18f961834`.
- Actual receipt:
  `evidence/home-backup-export-native/2026-10-06T22-30-38.657Z/result.json`, SHA256
  `b1ccb8f0334add5079394ebb475a6d087f211b37ef204fbbb8ed27b1a241cffe`.
- UTC execution: `2026-10-06T22:30:38.658Z`–`2026-10-06T22:30:42.283Z`.
- Owned application PID: `21384`. Actual graceful close and driver process-exit
  receipt completed before the native slot was released.
- Result: `COMPLETE`, four observed cases, `changedInputs: []` across 532
  captured files. Full before/after identities are retained in the actual receipt.
  Captured inputs include all files under `src`, `build`, `generated`, `tests`,
  `baseline`, package manifests and the actual Electron executable.

The first execution is retained; this was not a retry after an adverse outcome.
The separate earlier global-suite adverse result belongs to root's qualification
and is neither explained nor replaced by this native observation.

## Observed behavior

1. Invoked the actual native menu item's `click` callback for **Export saved
   backup…**, which dispatched the product command through the actual Home
   handler, preload, IPC, exporter, source repository and atomic writer. The saved
   file exactly matched the real `RecoveryStore.exportSourceSnapshot` output.
   The actual backup parser recovered the exact snapshot, metadata, reference,
   provenance and source bytes. The saved revision was 2.
2. Dispatched actual `WebContents.sendInputEvent` keyDown/keyUp with Ctrl+Alt+E.
   The real Home handler displayed **Backup export cancelled.** after the chooser
   cancellation. The output directory retained only the initial saved file and
   contained no pending stage.
3. Held one actual export destination request pending. A second request through
   the real Home bridge returned exactly `{ok:false,code:'EXPORT_BUSY'}` and did
   not create another destination chooser.
4. While the original chooser remained pending, invoked the actual **Lock SIREN**
   native menu command. The actual PIN state became locked. After genuine PIN
   unlock and Home reload, returned a destination to the original pending chooser.
   No revoked backup was created. A fresh native menu export then succeeded with
   exact bytes. The final output directory contained only `saved.siren-backup`
   and `fresh.siren-backup`, and the original saved project/checkpoint remained
   unchanged. Four total chooser calls completed; none remained pending.

The saved fixture contains 100,000 deterministic Python lines with UTF-8 BOM,
Romanian text, emoji and CRLF. Source size: **2,388,891 bytes**, SHA256
`176539d1f7d883c886e2db508f9946b96f64f00de6c9b608a01a72dd17a8d99c`.
Both exported bundles: **3,187,531 bytes**, SHA256
`039ffc01f0c8b77c16fec7388c3199d0d745420626646fbdec327effe5fa6d12`.

## Important input identities

| Input | SHA256 |
| --- | --- |
| `src/main.mjs` | `4e7d6a8a11562780af28275211b7d4b9c944d3520e8549d6a5265cc3c7337315` |
| `src/navigation/backup-export.mjs` | `2b814ae5380b0a3ed0a7768d08f76f53ba379222458f58a6a84c976371ae165b` |
| `src/preload.cjs` | `ce9012ef4e05826ea2bbbe26b2a03cb9accc5f06b7cca4c9c6d32c3160b9a8f2` |
| `src/ui/workspace/home.js` | `cb7d79a30febe80b4b10db5b19b20dfc97ac2c48cd00b633bf2515ff1136c48e` |
| `generated/home.html` | `1c0c2b1da33877eb09cfad881b6d99e98d3b59fa17a207d372ca3423e476ecff` |
| `generated/build.json` | `f73f41b3f78f44c886252d94530bc1fb1e4b4c4280045eca1805fb41860ee254` |
| Actual Electron executable | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

## Boundaries

Only `electron.dialog.showSaveDialog` was replaced, through the independently
PID-checked main inspector, to select/cancel/defer destinations under the owned
evidence directory. This explicitly does **not** qualify manual OS chooser
interaction. No IPC handler, export service, authority, PIN implementation,
crypto operation or storage writer was stubbed. The concurrency probe directly
called the real Home bridge; the main success, cancellation and post-Lock fresh
success used actual native command routing.

The primary export tests saved data only. No native dirty working-copy scenario,
native readonly mode, packaged application, physical multimonitor workflow,
power failure, disk-full fault, maximum-size claim or performance/fluidity claim
is established. The pending old renderer's result is not claimed as observed:
the observable revocation oracle is the absence of its output after unlock and
chooser release, followed by a successfully completed fresh export and exact
final directory/project/checkpoint checks. This test uses the native Lock menu,
so it does not separately qualify the recently corrected visible Home Lock button.
