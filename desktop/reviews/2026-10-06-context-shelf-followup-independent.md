# Independent context/shelf correction follow-up

Author: `/root/workspace_surface_review`. Date: 2026-10-06. Scope: corrected uncommitted context/shelf source over `0bf2a453f95117881458ff4cc9523180994b0084`, identified by actual raw hashes below. This is a separate follow-up; the initial CHANGES REQUIRED report remains unchanged at SHA-256 `80a6352f92a8495aee2bec1db5a0d844df9372f51c3d5d70b50cf5b562369244`.

**Verdict: both initial P2 source reproductions resolved; no new blocking source finding identified. Runtime/package qualification remains pending in this report.** I did not launch Electron, run the full suite, build generated files or edit source/tests/helpers. The actual native geometry and whole-suite runs belong to the coordinator and were not independently qualified at this review cutoff.

## Independent reproductions and execution

I independently reran `node --test tests/home-window-labels.test.mjs tests/window-views.test.mjs`: 16/16 pass, zero fail/cancel/skip/todo, 280.9456 ms. These are my own focused results, separate from the root's 17 scoped tests.

I repeated the original exact long-title Node input: 120 `x` characters, version `9007199254740991`, Working copy and Unsaved. Actual result now has 174 characters and ends with the full ` · Unsaved`. The native suffix limit is 224, while saved Home title limits remain 160. The existing native identity helper bounds the name to 120 and uses safe-integer version/revision suffixes, so the genuine complete title fits this increased bounded projection. Prefix validation, Unicode repair and control/bidi stripping remain.

I repeated the original actual registry/surface modules with the unchanged fake-native fixture evaluated in memory. With the retained Code shell minimized, attachment succeeds, the view is drawn in an unminimized host, and `surfaceSummary` now returns `state: 'open'`. Setting the actual host minimized changes it to `state: 'minimized'`. The implementation now observes the bound workspace window when attached, and the owned shell when detached. It rejects missing/destroyed hosts and revalidates the view caller after the native observation. This establishes the source/mock correction; it is not my own Windows observation.

Shelf source separates the ellipsized `.native-shelf-name` from nonshrinking `.native-shelf-state` spans. It retains a full explicit `aria-label` and full literal title. The Unsaved suffix and minimized state therefore no longer depend on the name span's ellipsis. The 48px shelf, 56px reveal padding and existing action routes remain. Actual state geometry still requires the coordinator's final retained native result. This review does not claim screen-reader testing, extremely narrow viewport behavior, or a native run with both state badges and maximum-length Unicode labels.

## Generated CSP, budget and privacy

I parsed all seven actual generated HTML entries with parse5, checked every actual inline script against the decoded `script-src` hash list, rejected external script sources and unsafe-inline/eval script allowances, and compiled all 17 actual script bodies with `vm.Script`. All checks passed; script counts remain Home4, app4, Code2, Docs2, Diagram3, Presenter1, Audience1.

Actual Home is 65,146 bytes, below 65,536 by 390 bytes. That is a small remaining margin: future shared CSS or shelf additions need fresh generated-byte checks rather than assuming this budget remains available. This is not a current failure. Shared style ingestion still rejects closing style tags, imports and URL resources; no new script, IPC or caller grant was added by these corrections.

The prior authority review remains applicable: satellite summary title reads occur only after own-ID filtering; the captured caller is rechecked before return. Registry native/frame/epoch/policy validation bounds observations. Metadata and badges remain display-only, rendered through literal text. They do not authorize editing, identify an entity for saving, or confer peer access. Presenter/Audience authority/preloads and the coordinated save/Close/Lock machinery are unchanged by these fixes.

I inspected the native fixture diff. It adds an actual `.home-current` mounted/non-inert predicate before the new Home assertions, retains the original docking/draft/selection/native ownership/save/Lock oracles and existing waits/deadlines, and adds real minimized restore/state-span geometry assertions. The fixture's extra `codeFiles` seed names the same admitted source reference; it does not assign editor contents to satisfy an oracle. The original null-Home ADVERSE and separate diagnostic run remain distinct evidence. I do not relabel the initial failure or infer a universal timing cause from the predicate correction.

## Actual reviewed raw hashes

| Path under desktop | SHA-256 |
| --- | --- |
| `src/navigation/window-labels.mjs` | `fe3fe2883649b92fc62f751bad0f1a7c786d5777e0226636bab63e270db51f74` |
| `src/windows/registry.mjs` | `ca13906ea2e476616004b9faf803304760f426179ac1ba565fc2738830848ac5` |
| `src/windows/dock-ipc.mjs` | `d5939036488b304f21307f8a5c12a50ff1308462aaba9e68a355c8b245ab226f` |
| `src/ui/windows/shelf.js` | `9c1968d53128ce022a6f5c6fb2b58e53bb38c74db498abdd5c906708197ae3d8` |
| `src/ui/windows/shelf.css` | `c8e029663640a29b408bf3a2061b145e2c0ef07a503a65aaa5f1c73d41c6cb13` |
| `src/ui/workspace/home.js` | `4821442bde759c0e4d74c18554bdfa1622a07d04a12bff17013bad2605e79d43` |
| `src/ui/shared/chrome.css` | `4e3f1329febabe245ea963622c7d69e6a3afddfe67d91be93425b87c60285443` |
| `tests/home-window-labels.test.mjs` | `3f13dcbc819584f1b15131057cac2ffff211156652b33f15bd7075f305f33cc5` |
| `tests/window-views.test.mjs` | `134b1e86ccf90a626f8498e4a406cf4b735e607e2d516fbbb141e5cc435e6436` |
| `tests/native/workspace-dock.mjs` | `14f362e4d8c37b187c6190914d1be8986be3107ded0609e922470cc640c6194b` |

| Actual generated entry | Bytes | SHA-256 |
| --- | ---: | --- |
| `generated/home.html` | 65146 | `5fd4e979c0506a85e2bfcdc92004ca7f6e2b11f9ac3eea60a4135cbc4a4e6e91` |
| `generated/app.html` | 13702842 | `1b736c949cdba7aa2a7d25146436eac674ca21cfb489cf417b7770093877a82c` |
| `generated/windows/code.html` | 549905 | `1e41dae438dffd01cdd51f927c3545ee3e983b26cb439e1c5445f7445a311af6` |
| `generated/windows/docs.html` | 61266 | `1397ee939aa1a534c9261c6f6105d9aa6046c7463b0405dd17bfc35c546bfeec` |
| `generated/windows/diagram.html` | 7308697 | `8be21e0e7d518bdc30764face83194aa4ca224fdcfdadeb6aaa15a55bb0dfd00` |
| `generated/windows/presenter.html` | 16680 | `fa6fc9a1252ec7764dfed916318f5e27d4fa96a3a418ef9b0b0241f817099476` |
| `generated/windows/audience.html` | 16163 | `95c6c444744514ea28b2894cf36006e3f2f4bb76d16153a63eaca1d5ea5bf746` |

This is source/focused verification only. No final full-suite, native, copied-package, hosted, release, whole-app consistency, physical-display, assistive-technology or complete Task4 qualification is made. Any final runtime receipt needs separately attributed artifact review; earlier reports and adverse results remain immutable.
