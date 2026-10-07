# Independent palette/title alignment source review

Author: `/root/workspace_surface_review`. Date: 2026-10-06. Snapshot: uncommitted palette/title alignment patch over HEAD `169035cef57153771fc05b46d09e4274e4f457f3`, with exact raw hashes below. Previous c97 and context/shelf source/package reports remain unchanged and historical.

**Verdict: no blocking source finding identified in this bounded patch.** This report qualifies my source, generated-CSP and focused-unit checks. Final whole-suite, actual native and copied-package qualification remain separate; I did not execute Electron, the full suite, native probes or a package build.

## Independent checks and findings

I inspected the complete patch and surrounding Home CSS, native identity helper, Docs draft/update/render paths, generated builders and changed native assertions. I independently executed:

```text
node --test tests/native-view-identity.test.mjs tests/docs-draft.test.mjs tests/home-window-labels.test.mjs tests/window-views.test.mjs
```

Actual own result: 29/29 pass, zero fail/cancel/skip/todo, 407.898 ms. This is distinct from the coordinator's focused 24-test execution and pending whole suite.

The new Docs editor input/textarea selectors apply the existing SIREN surface, text and border tokens instead of the old hard-coded gray fallback. They target the actual editor container, not unrelated content or renderer grants. They introduce no resources, scripts or new rendering authority. The shared CSS is appended after module CSS, and its body/role selector specificity overrides the old editor fallback. Actual light/dark computed colors and pointer use remain runtime evidence to inspect separately.

Home primary text is now white on its existing accent fill. For an already selected project without continuation, New project becomes secondary; the actual create action, mode guard, IDs and availability remain unchanged. Continue and truly empty Home behavior retain their existing branches. I found no unintended navigation or automatic project mutation.

The in-app heading now has a consistent explicit role prefix for Code, Docs and Diagrams. Native OS document-title format is unchanged. The identity helper still bounds the name to 120 characters, repairs Unicode and strips control/bidi overrides, and assigns literal text. The updated unit assertion bounds the name portion after the exact `Diagrams · ` prefix rather than incorrectly treating the prefix as part of the 120-character name allowance. Reset still clears entity metadata. Presenter/Audience identity, projection and privacy boundaries are unchanged.

Docs `updateState` reuses the same single pre-existing `draft.getDocument().title` read for native identity and its own direct child h1. It adds no second whole-document read, extra IPC, peer access or save. The h1 is assigned with `textContent`, with the existing Untitled fallback. The update remains behind the existing draft/disposed and pause guards. Local unsaved title can therefore match its actual input/header while disk persistence continues through the existing explicit save and coordinated Close/Lock mechanisms. Independent draft tests still cover exact entity hash acknowledgements, conflict retention, prepare/save and rollback. This source review does not substitute for actual editor typing/selection/layout observation.

Changed native tests retain their original exact document/reference/hash/version and whole-project/source preservation assertions. Docs/source-read heading assertions now expect the exact role prefix; they do not discard identity checks. Workspace dock adds genuine local rename header/body-h1 equality, computed input light/dark background assertions and PNG captures, and captures the newly relevant sources. Original draft/history/docking/save/Lock oracles and waits/deadlines are unchanged. These added checks were inspected as code, not executed by me.

## Actual generated CSP and budget

I parsed all seven actual generated HTML files with parse5, inspected their decoded CSP, matched every actual inline script body to its admitted SHA-256 in `script-src`, refused external script sources and unsafe-inline/eval script allowances, and compiled all 17 script bodies with `vm.Script`. All passed. Script counts remain Home4/app4/Code2/Docs2/Diagram3/Presenter1/Audience1. Shared style ingestion still excludes style-breakout, imports and URL resources.

Home is actually 65,224 bytes, below 65,536 by 312 bytes. This is a current pass with little remaining budget; subsequent shared chrome or Home additions require another actual generated-byte check. No inference is made that future additions fit.

| Actual generated entry | Bytes | SHA-256 |
| --- | ---: | --- |
| `generated/home.html` | 65224 | `fd947fa329af87605ecdbdf092f101d3a0e665a9813a327cb0fdc8860d875964` |
| `generated/app.html` | 13702917 | `63b473dd4aa00d661e6c16ac528e84839fa131fa075597035372bf14a1648c9b` |
| `generated/windows/code.html` | 549961 | `4d0e1065744897ac2f903c825bd083ccd68d08352dbc3398561e8c90cb1459ee` |
| `generated/windows/docs.html` | 61437 | `9c14ce12154400ac4eb1401d19a08d8047b47591c653d0c6f8d3b10df65181e0` |
| `generated/windows/diagram.html` | 7308753 | `0ef6a39fd17b9bb268607c4517c5946f641da18465612df513be2db008b18984` |
| `generated/windows/presenter.html` | 16755 | `bc1bae7203406e27577f31e56ad5de422b730d916ac38583c0a2fc3f8b5c0900` |
| `generated/windows/audience.html` | 16238 | `18120eb0276146c0380ba78e7324628f62f93109255d99c2c6689df42328d237` |

## Raw inspected patch hashes

| Path under desktop | SHA-256 |
| --- | --- |
| `src/ui/shared/chrome.css` | `2894dfe46e18646ac0eff4ff75f7811a921801a6b545e11618bb3955c6f74f0d` |
| `src/ui/windows/docs.js` | `ee281d4b94265304da79bad1479ab69008664ae9399c2c069fa7a65afc6370b4` |
| `src/ui/windows/identity.js` | `d3eb6239bece47e5715f39f1dba5581039ff99e64a0660bb653a1d261d0cef22` |
| `src/ui/workspace/home.js` | `b2c6bfa990589b0136d9db7b3f8ed4ecdd4eabaa26f9cdc07ec352a1e02ac600` |
| `tests/native-view-identity.test.mjs` | `07ef8512f693faab4ffd0d5a83ad97670c2176cc665a5dbe6d4bcf990740acd2` |
| `tests/native/docs-edit.mjs` | `1fdd32b4ef59fe1e9bdf54cf922c2b64e585d08744d9776f95fc69bb7a41f41e` |
| `tests/native/docs-sources.mjs` | `9e06e784216d5cc463256587b97d979db2722cf2fab0bfb9cd3c059843e2b75d` |
| `tests/native/source-read.mjs` | `8076d6aa695c8a06a0449b83889fde112a70ef0d60673f6ee689e2274177c8cd` |
| `tests/native/workspace-dock.mjs` | `0a8cba5cba941b14735f60091bc655e50d49694b502f723ae6c90003c9f60f57` |

No new security/CSP/privacy or persistence blocker was identified. This remains partial UI alignment, not whole-app consistency, global palette synchronization, accessibility/contrast certification, every narrow/maximal-title layout, physical-display, package, hosted, release or complete Task4/6 admission. The coordinator's frozen full/native executions were pending at this review cutoff and require separately attributed receipt/image review once complete. Historical source/package qualifications do not carry over automatically to this patch.
