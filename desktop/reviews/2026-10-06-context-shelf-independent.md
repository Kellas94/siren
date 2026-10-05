# Independent context/shelf source review

Author: `/root/workspace_surface_review`. Date: 2026-10-06. Snapshot: uncommitted context/shelf lot over HEAD `0bf2a453f95117881458ff4cc9523180994b0084`. This is a separate source review; previous c97 source/package reports remain immutable.

**Verdict: CHANGES REQUIRED for two display correctness issues below.** No new grant, source access, persistence or retirement bypass was identified in the inspected patch. Native execution and the frozen whole-suite run were pending at review time; neither is qualified by this report.

I read the changed product/tests and surrounding registry caller, surface ownership/focus, native identity and shelf CSS. I independently ran `node --test tests/home-window-labels.test.mjs tests/window-views.test.mjs` from desktop: 16/16 passed, zero fail/cancel/skip/todo, 287.6228 ms. These are my own focused unit results, distinct from the coordinator's 17 scoped tests. I also ran the two read-only Node probes described below. I did not run Electron or edit product, tests, build, evidence helpers or previous reports.

## Findings

### P2 — Entire-title truncation removes the unsaved state

`src/navigation/window-labels.mjs`, `surfaceWindowLabel`, applies the existing `name()` 160-character limit to the entire native title suffix, including version and working/unsaved state. A title legitimately produced by the existing identity helper with a 120-character name and a valid safe-integer version loses the end of `Unsaved`. My Node probe used:

```js
surfaceWindowLabel('code',
 'SIREN — ⌘ Code — '+'x'.repeat(120)+
 ' · v9007199254740991 · Working copy · Unsaved', 'owned');
```

The actual result ends ` · Working copy · Un`; `result.includes('Unsaved')` is false. This truncation also affects the full accessible button text and title, not merely painted overflow. Separately, shelf CSS limits each complete button to 200px and applies ellipsis to the whole label; ordinary long names can hide the state suffix visually. The patch's new state information should remain independently visible rather than disappear behind name length.

Keep the bounded literal identity name and a bounded display-state indicator separate. Preserve an honest complete accessible description. Neither native title nor parsed display state should be used to authorize a save, select an entity or grant write access. This finding does not assert that dirty state is lost from the actual editor or persistence model.

### P2 — An attached visible view can be labelled Minimized

`src/windows/registry.mjs`, `surfaceSummary`, always reads `entry.window.isMinimized()`. For a workspace surface this is the retained detached shell, which remains its identity owner after the actual view moves to the workspace. It is not necessarily the visible native parent.

I executed the actual registry/surface modules with the unchanged fake native fixture from `tests/window-views.test.mjs`, in memory without modifying that file. Set the Code shell minimized, then call `registry.attachView(codeId)` from the main context. Actual observations:

```json
{"attached":true,"placement":"attached","drawn":true,
 "shellMinimized":true,"hostMinimized":false,
 "summary":{"label":"⌘ Code · code_a","state":"minimized"}}
```

The shelf therefore reports Minimized for a visible attached view hosted by an unminimized workspace. Define attached-state semantics explicitly: derive displayed minimized state from the current owned native parent, or reserve the minimized marker for detached views. Keep the current grant/ownership checks around any native observation. This is a source/mock reproduction, not an independently observed Windows interaction. It does not establish a movement or save failure.

## Authority, lifecycle and UI observations

The patch limits `surfaceWindowLabel` to Code/Docs/Diagram and requires the exact expected role prefix; wrong prefixes fall back to an owned entity identifier. Names are bounded, Unicode-repaired and stripped of controls/bidi overrides. Shelf and Home use `textContent` and literal title values, so retained angle brackets are display text rather than executable markup.

`surfaceSummary` requires an actual registered workspace surface and validates live native handles, epoch, frame/URL and current policy before and after reading its native title/minimized observation. `invokeDock` filters satellite rows to own window ID before summary title reads and rechecks the captured caller after projection. The unit tests meaningfully exercise zero peer title reads, metadata-only output, getter refusal, policy revocation during title read, real working-source naming and restore behavior. The existing preliminary roster implementation can observe native minimized state for its roster before filtering; this report's isolation conclusion concerns the newly added title/summary projection, not an invented guarantee of zero native peer observations throughout the entire old roster path.

The label/state fields do not select native objects or change attach/detach/focus authority. No main save, Lock, selection, coordinated Close/Quit, epoch retirement, preload or presentation authority code was changed in this lot. Original captured caller and same-renderer movement checks remain the decision boundaries. I found no new persistence bypass in these display-only changes.

Home now shows the selected project name and CURRENT PROJECT hero when a project is selected without continuation. It preserves the existing Continue branch, recovery/mode guards and actual actions, and does not fabricate a saved continuation. Topbar ellipsis leaves tools nonshrinking. Fresh native proof of mounting, narrow layouts, long labels, focused state visibility and pointer/keyboard restore is still required; source assertions alone do not demonstrate those interactions.

The coordinator's first new native run at 21:19:33 was reported ADVERSE at a null Home element before cases. I do not relabel it, attribute its cause solely to mounting, or claim a later runtime pass. Likewise, the still-running frozen whole suite does not become current evidence from its existence. This report scopes only the inspected snapshot and independent focused checks.

## Actual raw hashes reviewed

| Path under desktop | SHA-256 |
| --- | --- |
| `src/navigation/window-labels.mjs` | `8ad1f5ab096ba7209a756b8fa5dde454c25c4dc9763af8ccbce476247d07e7a3` |
| `src/windows/registry.mjs` | `073d05197203ef48224f94ea5a8d4ae1a06377d3cebd4ca8b41e0c0af21ae937` |
| `src/windows/dock-ipc.mjs` | `d5939036488b304f21307f8a5c12a50ff1308462aaba9e68a355c8b245ab226f` |
| `src/ui/windows/shelf.js` | `120810e88d2fff5863aae588e26b165139ca7faf4a753d5c5261640638d5295e` |
| `src/ui/windows/shelf.css` | `cda1428a6a6a8b616ef1ff8b7f994d35a2674d937e5e1d02d6269a87b69e3ec3` |
| `src/ui/workspace/home.js` | `4821442bde759c0e4d74c18554bdfa1622a07d04a12bff17013bad2605e79d43` |
| `src/ui/shared/chrome.css` | `4e3f1329febabe245ea963622c7d69e6a3afddfe67d91be93425b87c60285443` |
| `tests/home-window-labels.test.mjs` | `e61c4090503c7b1ee2cd0deb4d116e15efd277a703c79ca3a684636eaeecc072` |
| `tests/window-views.test.mjs` | `a160d6d9e9989c5e28b22d7a1458a297b8fae8ba3c40e0f884fb83f3782784eb` |
| `tests/native/workspace-dock.mjs` | `e3a68bf98a25fd935a3553791862907a43fa28435aece76782c94a7a04e0ae4c` |

No complete UI, package, release, hosted, physical-monitor, assistive-technology or Task4 admission is made. Follow-up fixes need a separate reviewed snapshot and preserved RED/GREEN evidence; this initial report must remain unchanged.
