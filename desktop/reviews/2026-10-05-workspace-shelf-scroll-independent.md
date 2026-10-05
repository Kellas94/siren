# Independent narrow review — shelf scroll clearance

Author: Codex independent review agent `/root/workspace_surface_review`, separate from implementation/native execution author `/root`.

Date: 2026-10-05. Observed local HEAD: `ba64c566383bee1065bb7eb1a1a8357f8ecea6ed`. Reviewed uncommitted product diff: two added lines in `desktop/src/ui/windows/shelf.css` (comment and conditional 56px root scroll padding). **No actionable finding identified within this narrow correction/oracle review.** This is not full-suite, hosted-CI, package or release requalification.

I inspected source, original retained hosted artifacts, and root's controlled native results; independently rehashed inputs/results and checked before/after equality. I did not execute Electron or a native probe, run broad tests, edit product/tests/build/evidence scripts, alter prior reports, or commit. Only this new report was written.

## Exact source and oracle hashes

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`; SHA-256.

| File | Hash |
| --- | --- |
| `src/ui/windows/shelf.css` | `cda1428a6a6a8b616ef1ff8b7f994d35a2674d937e5e1d02d6269a87b69e3ec3` |
| `src/ui/windows/shelf.js` | `24e5f34c9ff2ac5edfc5802c7a3b1e4bc21064816c88ecbf193a90979d8c3edb` |
| `src/ui/workspace/workspace.css` | `35361459260c12b24d3ee4717112c68364674f3ee960f8ca024fe4420147a7d8` |
| `tests/native/source-analysis.mjs` | `29a5d05d7cc702b240f4a67caa4195310766dcc57c8dee2bbd68f124be5b47b5` |
| `tests/native/drive.mjs` | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| `tests/native/attach-page.mjs` | `026e108019a2560a2f79b1488f9dcefdd0c01426946cbb42424c522647124770` |
| `evidence/workspace-dock/shelf-scroll-probe.mjs` | `ec6c05f4c364609277406b01fd465cc553fa826e61bbc91e764af16ce00e7f7a` |
| `generated/home.html` | `a065b75199c9bdfb7caa2a0ba53470888afb124590a0c2832a47eebf48e9f29c` |
| `generated/app.html` | `339937e217ae4cdb8cc74674d2e2d48624addf6ae0bf5c4fd1640358e038cc29` |

## Concrete failure and unchanged original oracle

The original retained hosted package artifact under `evidence/workspace-dock/ci37352432832-original-package-adverse/evidence/source-analysis/2026-10-05T17-59-51.468Z/result.json` is ADVERSE. Its first three source-analysis cases succeeded, then the final Lock case refused with `Occluded control: #homeLock by nativeWindowShelf`. This is an actual hit-test failure, not a successful run or a waived assertion.

The current source-analysis, driver and satellite-helper SHA-256 values exactly match that original artifact's captured input/after hashes. The driver still scrolls the requested control using `scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})`, measures its center, requires `elementFromPoint` to be the control/descendant, and throws on an occluded hit before dispatching pointer events. The original source-analysis Lock/null-snapshot/no-satellites/exact-project/source assertions remain unchanged. No oracle was weakened to repair the failure.

Original ZIP SHA-256: `2b311d665fae5286eade8175277778a6242c5a609dd947d73282813aedc906f2`. Original job-log SHA-256: `5ccc85cb0adda2a3171922978107fc87d8e6119356dcf05c50a1c4b683b82e3d`. Original adverse result SHA-256: `1f66a36b050f8f8bf9141bfd4935fd4769fbfa0123484debec456138a9f946e9`. I inspected those files directly. The reported hosted commit abbreviation `da039dc3` is not a locally resolvable object, so I do not claim an independent Git diff against that object; artifact oracle hashes provide the comparison above.

## Correction and controlled repro evidence

The shelf is a fixed 48px bar. Body top padding reserves initial document layout space but does not reserve the viewport's scroll-reveal area. The added rule is:

```css
html:has(body.native-shelf-open){scroll-padding-top:56px}
```

It applies while the shelf-open body class is present and reserves space when the root scroll container reveals a control. It does not change the bar's height, hit-test admission, JavaScript, authority, Lock semantics or timeout. Existing Home focus styling uses a 3px outline with 4px offset; the 56px reservation includes that clearance as well as the 48px shelf.

Root's new ignored probe uses actual Home DOM/CSS and the unchanged driver. It explicitly creates a Code satellite so the shelf is visible, sets instrumented 1280px-wide CSS viewports with heights 500/720 and light/dark media, scrolls to the bottom, applies the same nearest-scroll request to Lock, checks actual hit-testing and requires the entire control top to be at or below the shelf bottom. It then uses the unchanged driver's actual pointer click and checks locked mode, null snapshot, no satellite target, and exact project. This is a controlled CSS-viewport repro, not physical-monitor-size qualification.

| Root-owned result under `evidence/workspace-dock` | Observed outcome | Result SHA-256 |
| --- | --- | --- |
| `shelf-scroll-2026-10-05T18-07-03.918Z` | ADVERSE; no padding; Lock top -0.5px, shelf bottom 48px, hit false | `e3d47ed6caba1b853687b0cf452e8e78abde1484440e25472538841a667f3fb2` |
| `shelf-scroll-2026-10-05T18-07-46.788Z` | ADVERSE; 48px padding; hit true but Lock top 47.5px still overlaps shelf | `62a7a4a230ab0eb132528f2559a11d46db2a737b9d47dbdd6ba63b0aadc8115c` |
| `shelf-scroll-2026-10-05T18-08-31.338Z` | COMPLETE four cases; 56px padding; Lock top 55.5px, shelf bottom 48px, hit true in all cases; `lockPointerQualified:true` | `97c7b2ef91ffee6cf99af321e6a56d06f0fb7659ff6cf499bd4b75e125403c7c` |

I independently checked that all three receipts captured the identical probe and driver hashes and had zero input/after drift. All five captured inputs in the final receipt also match current files. The unchanged geometry assertion refused the partial 0.5px overlap rather than using a tolerance. At the observed final 55.5px control top, the existing seven pixels of Home outline/offset would start at 48.5px, below the bar; that is a geometry inference from the measured position and source styling, not independent visual focus-ring testing.

## Qualification limits

The corrected root scroll reservation addresses the reproduced compact-viewport occlusion without changing the oracle. The root-owned four-case controlled native receipt qualifies its stated instrumented Home scope. A larger-screen local analysis success does not negate the retained hosted adverse or establish hosted recovery. Previous 1047-test and package evidence on the prior CSS remains historical; new full-suite/package/hosted qualification is not claimed by this report.

This review does not certify every viewport, nested scroll container, text zoom, display scale, keyboard focus route, hotplug, packaged launch, or the entire Task 4/release. Root's unrelated old `window-shells` assertion remains ADVERSE; its separate diagnostic is not treated here as an original-test PASS. All five earlier reports authored by this reviewer were rehashed and remained unchanged, including initial integration `389432fe…`, follow-up `203f0ae0…`, and package review `06a799be…`. This scoped evidence review is not user release approval.
