# Independent review — Code editor wrapper and isolated build seam

No unresolved finding remains in the captured structural-wrapper/build scope after the failed-open status and search-listener repairs. Final structural diagnostics passed 7/7 and actual build controls passed 4/4. These results are not native EditorView/rendering approval: this reviewer used explicit recording DOM/view doubles for wrapper controls. The actual Electron matrix belongs to the separate native reviewer. Production main/preload/Code-window activation and package admission remain outside this review.

## Wrapper boundary

The actual product module was loaded through a VM module linker with actual CodeMirror state, commands/history, search, language, installed language properties, patched Python parser, and the actual editor adapter. Only DOM elements and EditorView construction/rendering/update mechanics were replaced with explicit recording doubles. Their update method enforced the actual CM previous-state identity constraint; this tests callback/state logic, not layout, focus, paint, DOM input routing or browser update internals.

The structural controls covered one successful view per open, repeat-open refusal without another view, theme and wrap effects preserving adapter/view state identity, search-panel state opening without source writes, actual history command changes replayed through typed draft/commit receipts, literal CR/BOM/Unicode preservation, readonly and saving refusal of document changes, asynchronous persistence refusal retaining the complete optimistic local document, and dispose during pending open without resurrection. Saving/fencing changes the editable compartment; actual document changes still pass through adapter admission. No synchronous observer dispatch desynchronization was reproduced in these controls. Find/wrap remain available for ready readonly views; Save is source commit semantics and makes no linked Docs/project-manifest claim.

The final owned-root input listener produces a `change` event only for search-panel targets, uses the owning document's Event constructor, and is removed on disposal. A callback ownership/cleanup diagnostic checks those facts and ordinary code-input noninterception. It does not simulate native paste/Enter or claim the panel's browser behavior. Adapter/controller and sourceClient are dependency identities here; their separate reviews remain separate. This reviewer authored sourceClient and does not claim an independent client review.

## Preserved defects and corrections

**Failed opening announced Ready.** An actual wrapper/control failure returned `ACCESS_REFUSED` with no editor state while its status displayed `Ready`. The corrected typed-client diagnostic passed 5/6 and failed this assertion, 124.3555 ms, exit 1. The author repaired adapter load-error attribution and wrapper status: an unopened source shows its attributed failure; a refused replacement keeps the existing source visible. The unchanged six assertions then passed, 126.281 ms, on wrapper `d936b0e7…` / adapter `6645f2b4…`.

The first diagnostic scaffold had a separate fixture mistake: it returned TextModel.apply's raw receipt as though it were a typed source receipt, omitting independently derived source/hash fields. Its run passed 4/6 and failed history plus the status assertion, 138.847 ms. The fixture was corrected to supply the proper source identity and SHA-256 from the actual model text; the original scaffold/log remain preserved. That history failure is not a product finding.

**Search input listener had the wrong event scope.** Static inspection of actual installed CM bytes showed that `EditorView.domEventHandlers` attaches listeners to contentDOM and rejects bubbled events outside its content ancestry, while the stock search panel lives outside contentDOM. Its query fields commit on change/keyup; Enter keydown calls Find without first committing. This reviewer sent that concrete concern to the actual native reviewer, rather than treating the structural search-state test as a browser pass.

The separate [first native matrix report](C:/Claude/SIREN_WORK/portable/desktop/reviews/2026-10-03-code-editor-native-find-failure-review.md), SHA-256 `f952d7c1cf4307f6d67cf9edb205e9f425bf26f0e4f88bf52a918794b76273bb`, records all six cases failing immediate pasted-query/Enter. Compact-100k expected selection `[200041,200071]` but remained at `[200071,200071]`. Its wrapper was `d936b0e7…`, bundle `adc9afa1…`; Save/theme/wrap/reopen steps after Find were not reached. This is attributed native evidence read from that report, not a native run performed by this reviewer. The author moved the listener to the encompassing owned editor root and removed it on disposal, producing wrapper `1fdb622f…`. The native reviewer is separately assessing the unchanged functional oracle against that repaired bundle; these doubles do not issue that verdict.

## Actual isolated build

The build seam extracts only the hash-pinned local Python grammar from frozen R78, uses installed shared Lezer modules, and exports the editor/client browser facade. Two independent output directories with spaces produced identical bytes. A separate esbuild analysis using the same options produced those exact bytes and a metafile with precisely the fifteen admitted runtime packages, no external output imports, no embedded workspace path, and no sourcemap. It did not include auth/backend/build tools in the browser closure.

Every runtime package/version heading and complete admitted MIT notice was checked in both the emitted NOTICES file and the bundle banner, together with the baseline grammar notice. The build's own checks compare installed manifest version/license and actual available license-file hashes; the retained notice covers the package whose archive omits a separate file. This checks emitted notice retention against the admitted inventory, not independent archive SRI or legal analysis. The dev esbuild wrapper/platform binary is captured as a build tool, not counted among the browser's fifteen runtime packages.

Final bundle: **485,311 bytes**, SHA-256 `71c00ab24f7ad5d6d173bdd521f857f1efda7827d9b836f06143aa8a7d5dd661`. Patched module SHA-256 remains `594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589`. NOTICES SHA-256 remains `138512577189a66d7f5bad7be6617f0a076ad2610f5ec07c5bbc37247356a576`. A changed baseline is refused; actual frozen baseline bytes/hash stayed unchanged. VM evaluation checks bundle exports and invalid-container refusal only, without DOM rendering.

## Final evidence and identities

Working directory: `C:/Claude/SIREN_WORK/portable/desktop`; outer Node `v24.16.0`, Windows x64. Every esbuild execution used `require_escalated`, as authorized for the isolated build. The independent build worker calls esbuild.stop in its finally block; no Electron/native shell was launched by this reviewer.

- `node --experimental-vm-modules --test evidence/code-editor-wrapper-review/wrapper-controls.test.mjs`: **7/7 passed**, exit 0, **128.8835 ms**. Node's VM-module experimental warning is retained in the log.
- `node --test tests/code-editor-build.test.mjs evidence/code-editor-wrapper-review/build-controls.test.mjs`: **4/4 passed**, exit 0, **296.6509 ms**; two unchanged author build tests and two independent build controls.

Both runs had zero skipped/cancelled/todo cases. All **64/64** captured source, actual closure-module, installed manifest/license, frozen baseline, build-tool, and reviewer-control identities matched before/after the final runs. Prior initial build GREEN (4/4, 305.6701 ms), failed-open RED, status-repair GREEN (6/6, 126.281 ms; build 4/4, 296.7499 ms), and their artifacts remain separately attributed. Initial bundle `af2a957d…` was 485,042 bytes; the status-only repair bundle `adc9afa1…` was 485,269 bytes. Initial five printed primary source/test identities matched their later captured reads, but the initial runs did not have the final 64-file start/end manifest.

| File/artifact | SHA-256 |
| --- | --- |
| Final `src/ui/code/editor.js` | `1fdb622f657fa901c49e075127dfc11d31229d98693409721f914468404c71d2` |
| `build/code-editor.mjs` | `86d7ef62e9a9185d170a16976cb8231c4d92d9131486dac6cf3d3338e92d9a98` |
| `tests/code-editor-build.test.mjs` | `a085e09dff67044594879c20c1183816b66d50455e92935e4119b13f2ea73844` |
| Actual adapter dependency | `6645f2b481199d3f5ffe46d2d0665da428c79c198efbc302e19b435575d68fbd` |
| Actual client dependency | `1bfb2282189f09286f0256b8284fb8eb54bb980b00481e2eaf67ed8f1540c8a2` |
| Final structural controls | `bf2ceca794e796b0cbb8f19070b73a840eeadffbe38e23ca2e315a1f864952ba` |
| Independent build controls | `e92e9f4a3c45ff1f69083e90ca51862091eed8d4017ad405502e1fd1a99ea649` |
| Precise failed-open RED log | `c754cc06a3ea9d1ca32146a72fddc47d35d4e6e1b0c3a151ce482311d66e74cf` |
| Final structural log | `7fdd04c66656628a44428f4a39e6dfb0f3855f256f4bb9b192616c12d7bc9123` |
| Final build log | `93f80bfcc97dd6bbe7d871bbfc7b32154dc4d9bfc1fa5c415e9e740ef7cc47ed` |
| Final start identities | `ed0d6558ead53c04df019a2a299e343d6407c14bce79b88948f50767b777d97e` |
| Final end identities | `c06945cfa295a82c0d7fd9a1b1b499bf79b9c2d5438daa919adbef4372f8ee51` |

Ignored evidence resides under `desktop/evidence/code-editor-wrapper-review/`. Existing structural assertions were preserved through repairs; the recording fixture subsequently gained standard removeEventListener/defaultView APIs required by the repaired production code, plus a separate listener-ownership assertion. No tracked source/original test/dependency edits, commit, or full-suite run were made here. Rendered highlighting, native clipboard/find/key events, actual process cleanup, interaction latency and memory peaks are the separate native probe's scope. Earlier full-suite/native/package results do not qualify later changed source automatically.
