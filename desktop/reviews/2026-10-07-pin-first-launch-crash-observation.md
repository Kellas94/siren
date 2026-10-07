# First-launch PIN after forced termination: open observation

Status: **OPEN — failure observed; root cause unconfirmed.**

Author: `/root/disk_inventory`, delegated read-only evidence inspection, 2026-10-07. This is an owner-side investigation report, not independent product approval. No application was launched, no process was changed, and no source, protected profile file, original result, or earlier qualification was modified during this investigation.

## Finding

One retained native fixture could not unlock its existing PIN after the executor force-terminated its first application session and restarted the same owned Data directory. Its PIN ciphertext remains present, but its profile has no `Local State` or `Preferences`. Two subsequent fixtures using a graceful application close have both profile files and show successful PIN unlock after restart.

This is evidence of a crash/restart reliability follow-up. It does **not** establish that encryption-key loss caused the failure, or that graceful close fixes crash recovery. No recovery, reset, or product fix is claimed here.

## Original runtime evidence

Evidence base: `C:/Claude/SIREN_WORK/portable/desktop/evidence/source-bundle-import-native/`. Each directory below retains its original `result.json` and `owned-data`.

| Fixture directory | Original overall status | What its retained result establishes |
| --- | --- | --- |
| `2026-10-06T21-04-25.723Z` | ADVERSE | First two cases passed: exact large-source bundle import/checkpoint, then imported Code and linked Docs. Restart failed at `Owned fixture PIN unlock must acknowledge`. Observed PIN: configured=true, pinLength=null, unlocked=false, available=true, blocked=true, retryAfterMs=0. |
| `2026-10-06T21-05-11.586Z` | ADVERSE | First two cases passed. Restart observed PIN configured=true, pinLength=4, unlocked=true, available=true, blocked=false, retryAfterMs=0. A later Home assertion incorrectly required `bootstrap.snapshot.schema===2`; its failure remains retained. |
| `2026-10-06T21-06-28.428Z` | ADVERSE | Three cases passed, including `Common Lock destroys satellites and restart reopens completed source import`. PIN was unlocked. A later legacy-view assertion failed; this result is not an overall pass. |

The forced-close versus graceful-close sequence is the executing coordinator's account, supported by inspection of the current driver and corrected fixture. It was not independently replayed in this investigation. The current driver `tests/native/drive.mjs:143` closes its inspector connection and calls `child.kill()` if the child is still alive; it does not itself request the application's graceful close. The corrected fixture requests `window.sirenDesktop.requestClose()` and waits for exit before closing the driver.

Original result identities, SHA-256:

| Fixture time | Bytes | SHA-256 of original result.json |
| --- | ---: | --- |
| 21-04-25.723Z | 5,567 | `caa143992c359747ee107544875dd92dccec72055581c561c4a7dd64a01f4634` |
| 21-05-11.586Z | 5,450 | `8a64ab0e0fc4730d2ad357d9419623dee04274188d0754d9e06ac7a322bf30b9` |
| 21-06-28.428Z | 9,664 | `4b866ca95182c5de14fb38dd7573c6ca6a98dc7c961234c4d35b276cd27a652b` |

The first two originals record the same `src/main.mjs` input SHA-256, `1107a877064de2d81a1abeaee6c90e7b6a85a84859bba53c445387aebdbb73c8`, and different fixture hashes. The third records changed main input `ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1`. These are separate fixtures, not a controlled repeat of one unchanged profile/build. Their input maps do not explicitly capture `local-pin.mjs` or the driver hash.

## Protected profile metadata only

Only file existence, length, timestamps and SHA-256 were inspected for these protected files. Their bytes were not decoded or printed. Paths in this table are relative to each fixture's `owned-data` directory.

| Fixture time | File | Exists | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| 21-04-25.723Z | `Access/local-pin.bin` | yes | 222 | `8113eb7e5ad7a7fb28169aa6d151b2549ab90b6b82f3d4539172cbfc5cdcfb99` |
| 21-04-25.723Z | `Local State` | no | — | — |
| 21-04-25.723Z | `Preferences` | no | — | — |
| 21-05-11.586Z | `Access/local-pin.bin` | yes | 222 | `4ddfd6d14db0a1551fc0a2f66427ebc2e7f3148e34f2bfb65fe75bcda04056e9` |
| 21-05-11.586Z | `Local State` | yes | 490 | `8ad14c0a686327e355bbcec804cf4110af7083ba41f74ad7a2e3d516fae1692e` |
| 21-05-11.586Z | `Preferences` | yes | 57 | `be4b8924ab38e8acf350e6e3b9f1f63a1a94952d8002759acd6946c4d5d0b5de` |
| 21-06-28.428Z | `Access/local-pin.bin` | yes | 222 | `1156e6a142eb71607af96643da8011f3a0cb0dc616a3c593c361c6dc09d04d73` |
| 21-06-28.428Z | `Local State` | yes | 490 | `2db73984a5405d0e55b09e3ea2bdee2ebebb1e3e9d8dcb25a6a7153d0472bc77` |
| 21-06-28.428Z | `Preferences` | yes | 57 | `be4b8924ab38e8acf350e6e3b9f1f63a1a94952d8002759acd6946c4d5d0b5de` |

Different encrypted-record hashes across independent fixtures do not prove corruption: setup uses a randomized salt, and successful unlock persists the record again. No before-termination versus after-restart hash pair for the same profile is retained in these observations. File modification times are not proof of the instant when a profile key became durable.

## Source interpretation and limits

Current inspected Electron dependency: **44.5.1**. Current application source sets `userData` to the owned Data root before `app.whenReady()` on the ordinary successful path (`src/main.mjs:93`), and awaits PIN initialization at line 124.

`src/account/local-pin.mjs:56` reads the owned record, checks encryption availability, calls `safeStorage.decryptString`, parses JSON and validates the record. Its catch collapses multiple read/path/decrypt/parse/validation failures into a broken, locked state without retaining a sanitized failure category. After initialization, the observed combination available=true, retryAfterMs=0, pinLength=null and blocked=true is consistent with this broken-storage path rather than a wrong-PIN cooldown. It cannot identify which boundary failed.

PIN persistence calls `safeStorage.encryptString` and then `atomicWrite` (`local-pin.mjs:107`). The latter syncs the temporary file, renames it and checks exact readback (`src/projects/atomic.mjs:17-28`). This protects the PIN file write in the application code; it does not demonstrate coordinated durability of Electron's separate profile encryption state. Current main close handling joins pending writes, retires views, flushes layout and records a clean close before closing the window (`src/main.mjs:1105-1135`).

Inspected current source SHA-256 identities:

- `src/account/local-pin.mjs`: `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7`.
- `src/main.mjs`: `ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1`.
- `src/projects/atomic.mjs`: `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4`.
- `tests/native/drive.mjs`: `897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca`.

The local Electron API declarations describe safeStorage encryption/decryption but do not establish the native Windows key persistence implementation. No Electron/Chromium C++ implementation or remote source was examined. No protected `Local State` fields were inspected. Therefore **“first-launch termination lost profile key material” remains a plausible hypothesis**, supported by the file-presence correlation, not a proven diagnosis. Other load/read/decrypt/validation failures remain unresolved.

## Required follow-up, not performed here

Keep the crash observation open independently of the import harness corrections. A controlled reproduction should use fresh owned profiles and an unchanged captured build, compare first-session forced termination with graceful close, and retain sanitized storage-failure categories plus existence/length/hash observations before termination and after restart. Establish the native safeStorage key persistence boundary before selecting a fix. Do not reset an existing PIN record merely to make the fixture pass.

The original adverse results, ciphertext records, profile files and prior successful PIN qualification remain preserved. A later successful graceful restart does not erase the failed forced-restart observation.
