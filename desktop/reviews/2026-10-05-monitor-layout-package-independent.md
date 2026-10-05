# Independent scoped evidence and package identity review

Author: `/root/monitor_layout_review`, separate reviewer agent. Date: 2026-10-05. Scope: monitor chooser, stable layout memory, final readbacks, source/package evidence and exact identities. No product or test files were edited, and no GUI, native probe, or full test suite was rerun for this review.

**Conclusion:** No concrete blocker was established for the explicitly qualified monitor/layout lot. The retained evidence and its executable assertions support the limited results below. This is an independent source/evidence/byte-identity review, **not independent execution of the root agent's tests**, hosted-CI approval, public-release approval, or whole Task 6 admission.

## Independently verified identities

Read-only Git commands established local HEAD `45f6dc4d49873110fb62cfca07b9902fae5bc8eb` and a clean tracked working tree before adding this report. Live read-only GitHub GETs established feature branch `feature/portable-foundation-2026-10-02` at `0dec7274ed9811dbe38d44e9e16eb822d5221f5b`, sole parent `f5b76aa6d085e5a8dbc487a4ea3f5366849f41b2`, tree `962772806dfa72c820c4e4a0bfa6694485242534` (untruncated, 1,428 tree entries). Ten scoped product/package/test Git blobs, including main, layout, layout-memory, factory, Home, package whitelist and both native probe files, matched the local HEAD blobs exactly. Main remained `1e5472dde446657e2dbb155868e28e033c6c9c92`. This does not verify a hosted workflow result.

The reviewer read and hashed the actual development files under `dist/development-a943aa2e-4af1-44ac-9d52-4958dab10cf6/App/versions/0.1.0`:

- `resources/app.asar`: **53,529,925 bytes**, SHA256 `d364396bfdb747998b454395dc87e9924c2f62a53ca4b8c28078f268015b0699`.
- `SIREN.exe`: **245,726,208 bytes**, SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`, consistent with the retained unchanged Electron 44.5.1 runtime identity.
- Independently extracted and compared **241/241 application files** against current source/generated/production-dependency inputs. The ASAR enumeration contained exactly those 241 files, with no extra or missing file and no byte mismatch. This verification used read-only ASAR APIs; it did not execute the receipt-writing root verifier.
- Independently hashed the actual Unicode-directory monitor probe copy at `evidence/monitor-memory/2026-10-05T00-08-36.077Z/Pachet-Știință-Monitoare`: both its archive and runtime matched the development package exactly.

The build identifies its source as the local HEAD above and `releaseAdmitted:false`; inventory/launcher/account/update configuration admission flags remain false. Those limitations are preserved rather than inferred away from passing probes.

## Root-executed evidence reviewed

The full source log decodes **1,010 tests, 1,010 passes, zero failures/skips/cancellations/todos**. The reviewer inspected its recorded result and recomputed its hash; this is not a reviewer-executed full suite.

All six source-group logs and all eight package-runner child logs matched their separately recorded SHA256 values. Their final result files report COMPLETE/completed outcomes with the declared cases, rather than exit codes alone. The reviewer independently recomputed all **429 source input captures** and **430 package input captures**; every current byte hash matched the recorded before/after value, with no declared changed input. Before/after package archive identities also match the actual hash above.

Source groups: monitor-memory 3, Window focus/recovery 9, Home guide/library 4, Docs edit 4, source linking 4 and Presenter/Audience 6. Large-source arguments are retained for the applicable Docs/source/Presenter groups; Python code is not executed by these qualification probes.

The eight package-runner children are correctly separated into **five actual package probes** (original package/recovery/PIN/Unicode-copy, Window input/recovery, monitor/restart, Presenter/Audience and source linking) and **three development probes** (Access screen, controlled toast characterization and Home guide/library). The latter three are not promoted to actual package qualification. The toast result explicitly retains its deliberate negative control and states that it is observer characterization, not a product-repair verdict.

The final monitor trace `2026-10-05T00-08-36.077Z` records two actual display work areas, including a negative-coordinate display. The inspected probe invokes the genuine native menu item's callback and captures its radio choices through PID-checked main-process instrumentation; it does **not** physically click the menu. Its readbacks show the selected Code on the chosen actual display, its duplicate still maximized, and exact before/after-restart normal geometry for both Code windows and the imported uppercase/underscore Docs window with fullscreen retained. The first-process log records coordinated prepare, write-join, retirement, journal and final close; the subsequent process readbacks establish a genuine clean restart within the recorded fixture. The probe's explicit project/source equality, opaque metadata, and all-view Lock assertions remain present in the inspected source.

The reviewer independently inspected the copied fixture's actual layout JSON: schema 1, four entries, **786 bytes**, only `main` or hashed finite slot identities, with the retained independent maximized/fullscreen/normal geometries. The trace explicitly leaves physical monitor removal and physical mixed-DPI qualification false.

## Corrections and source/readback assessment

The final source preserves the previously established entity-alphabet correction and the placement-memory suspension/finalization boundary. Temporary fullscreen/unmaximize transitions are fenced from persistent capture; successful finalization follows settled geometry/mode readbacks, while cancellation retains previous stable metadata and does not restore a retired native handle. Main supplies this placement-memory adapter. Factory windows remain hidden until native admission/show, and the memory module is included in the finite runtime whitelist.

The later actual-native readback correction distinguishes current ordinary-window DIP bounds from Electron's cached normal bounds, stages cross-display position and size separately, and establishes bounded completion before restoring presentation mode. Final mode readbacks compare the captured native normal rectangle while persistent normal metadata receives the completed placement rectangle. The native trace contains actual asynchronous move/resize observations; the recorded narrow claim is containment/identity/restart restoration, not proof of all physical scaling transitions. No additional concrete correctness/security/lifecycle blocker was established in the inspected final changes.

The original independent report remains byte-identical, SHA256 `e8b39318724641ccc1188b806c91fe11c6ab26201b239889133bfdf14f310f06`. Ten earlier monitor-result directories still retain ADVERSE outcomes, followed by the separate successful source and package results. Neither the earlier findings nor those failures were overwritten or converted into pre-existing approvals.

## Evidence hashes and explicit remaining limits

SHA256 values recomputed by this reviewer:

| Retained evidence | SHA256 |
| --- | --- |
| `monitor-memory-qualified-full-tests.log` | `ad66f3304b8db6a3bd6a7dcb284058f730dc3e89c166dfe5c09351b9560e4a81` |
| `monitor-memory-source-probes-result.json` | `e1fd70e077c7e76107f7f5411aed3b5ebd7b49076b49a16f35047fd948bcd1e5` |
| `monitor-memory-package-build.json` | `b57df69f95807271a5843bb9bd2f7d58a4d76aa6892047e02f95ca4d83dda048` |
| `monitor-memory-package-probes-result.json` | `c16758871674acaf1ac9d2d0c458f41f337cae07335242bf57bffdfeae99b8b7` |
| `monitor-memory-package-byte-receipt.json` | `6e23979fb3d72ebfe715f731483fd08932a84cebce4c9b17706b7b940788f306` |
| Final monitor `result.json` | `c6ef4028170f3ed05b612199373f4c9ec96bc3cab53029b11460d55c63aa92a3` |

This review does not qualify physical menu/keyboard input, unplug, changing OS DPI settings, arbitrary hardware topologies, clean-PC/launcher behavior, online accounts/activation, signed updater deployment, public release, main merge or all unfinished native-workspace work. Hosted CI remains a separately observed evidence class. Those remaining scopes prevent a whole Task 6 or whole-feature PASS claim.
