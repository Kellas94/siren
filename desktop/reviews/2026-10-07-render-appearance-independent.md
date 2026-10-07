# Independent render appearance review — 7 October 2026

Author: /root/terminal_foundation_review. **Original review identified two concrete P2 defects. Both are independently closed within the captured current pure-adapter scope.** No generic native/UI/package qualification is granted.

Scope: src/appearance/render.mjs; diagram style/vector/window adapters; presentation card/public-render/window adapters; build/diagram-style.mjs; main.mjs nativeRenderAppearance and the two native job adapters; the three requested tests, plus inherited diagram-style.test.mjs for source-colour regressions. I read the shared shell and hidden-render boundaries only to clarify responsibilities and avoid reporting intentional hidden legacy controls as a defect.

## P2 RENDER-APPEARANCE-01 — imported Mermaid surface overwritten

On the original appearance source, layout inserted the application palette canvasBg unconditionally. configureMermaidSource retained the source-declared background #123456, but the final SVG background became KPMG white #ffffff. The public PNG initially painted the application canvas background too. This lost imported-source colour priority and could disagree with the preview.

I independently reproduced the SVG overwrite with exact original adapter strings: Mermaid chosen background **#123456**, exported rectangle **#ffffff**. To recover the original source after ROOT's concurrent edit, I reversed only the surface correction **in memory**, then required both reconstructed SHA-256 hashes to equal the initially recorded review-read hashes before executing anything: vector ff9c5caed017e103e5bdfa7648ca4beba5b57e42e4789dd5a6e7fc98326fe4de; style 62edcd6d1d57c5933b41ff288dabcc72e70524f13ac3f8a2baaead22070c55a7. The suggested Git HEAD was older source (d18ae509 / d211adf0), so it was not attributed as matching this original appearance review. The first attempt to use that older code refused the newer descriptor as expected; no false original runtime success was retained.

**Current recheck: closed within pure-adapter scope.** Final style provenance now carries surfaceBackground, vector passes it to layout, public PNG paints it over the full canvas before drawing the SVG, and the preview callback applies it to the viewport. The exact current vector/public adapters independently produced source SVG background #123456 and canvas fill order #ffffff → #123456 → drawImage. Input source was unchanged. Mermaid parsing, DOM and rasterization were simulated; actual native pixel/preview parity is ROOT's separate qualification.

## P2 RENDER-APPEARANCE-02 — invalid colour accepted by intermediate correction

Intermediate style hash cbeb25fde303fa7ad943adf0c67ba28d67501a4082545ee9c45d1ca19e1bd5f5 admitted notacolour, #12345 and #1234567 as non-null surfaceBackground values. Those are not valid CSS colours, so the helper did not establish the claimed validated surface. This could let SVG invalid-fill fallback and Canvas rejected-fill retention disagree. Resource URL and inherit already refused; this was a colour-validity defect, not an injection finding.

**Current recheck: closed within pure-adapter scope.** Exact hex3/4/6/8 grammar now passes; hex5/7, unknown names, malformed functions, contextual values and resource forms refuse in nonbrowser fallback. The actual browser path delegates accepted shapes to CSS.supports('color', value). A separately controlled CSS authority probe confirmed unknown names can be refused and valid red/rgb values retained. This proves delegation and fallback logic, not Chromium's engine itself.

## Current independently executed validation

Initial requested tests passed 11/11 on the first source. After owner corrections, the requested three files plus inherited diagram-style.test.mjs independently passed **18/18**, exit 0. Current final identities were then captured before and after the own probes; all fourteen tracked source/test/baseline inputs were identical. Presenter and surface follow-ups used the same captured identities; final report write revalidated them again.

**Eleven reviewer-authored current probes passed**, including 156 public section/title/text/table calls across all 39 themes with the opposite simulated OS mode, the exact extracted native appearance helper, source-versus-sidecar priority, strict descriptor/colour boundaries and Presenter concurrency:

| Independent probe | Observation |
| --- | --- |
| all39 descriptors/configs and source-owned versus sidecar node colours | {"namedThemes":39,"sourceStyledNodeProtected":true,"unstyledSidecarNodeApplied":true} |
| descriptor refuses accessor/unknown/extra/inconsistent fields and returned config mutation cannot persist | {"getterCalls":0,"contractMutation":false} |
| corrected colour grammar refuses malformed names/hex/resources/context while valid hex survives | {"mode":"Nonbrowser exact-hex fallback","results":[{"value":"#123","surface":"#123"},{"value":"#1234","surface":"#1234"},{"value":"#123456","surface":"#123456"},{"value":"#12345678","surface":"#12345678"},{"value":"#12345","surface":null},{"value":"#1234567","surface":null},{"value":"notacolour","surface":null},{"value":"inherit","surface":null},{"value":"currentcolor","surface":null},{"value":"url(https://outside.invalid)","surface":null},{"value":"rgb(,,)","surface":null},{"value":"red","surface":null}]} |
| browser colour authority hook is consulted; rejected colours cannot become surfaces | {"simulatedCSS":true,"calls":[["color","red"],["color","notacolour"],["color","rgb(10,20,30)"]]} |
| all39 public section/title/text/table card palettes ignore opposite OS | {"themes":39,"casesPerTheme":4,"publicRenderCalls":156} |
| exact native appearance helper re-reads store and refuses after await retirement | {"storeReads":4,"postAwaitRetirementRefused":true,"invalidPreferenceFallback":true,"otherFailureRefused":true,"scope":"Exact helper with simulated native store/Theme/scope"} |
| Presenter100-event burst coalesces into latest slide; Lock retires pending appearance | {"appearanceEvents":100,"navigationsIncludingInitial":3,"latestSlide":"second","LockFollowups":0} |
| Failed appearance signature and invalid events produce zero automatic retries | {"failedNavigations":1,"duplicateEvents":50,"retries":0} |
| Pagehide retires render and pending theme work without another native request | {"navigations":2,"pagehideFollowups":0} |
| Lock while image decode is pending prevents late public publication | {"latePublicFrames":0,"privateNotesAfterLock":"","navigations":2} |
| Current exact vector and public PNG adapters retain source surface and letterbox together | {"MermaidChosenBackground":"#123456","SVGBackground":"#123456","PNGCanvasFillOrder":["#ffffff","#123456","drawImage"],"inputUnchanged":true,"scope":"Exact source adapters; simulated Mermaid parsing, DOM, SVG raster image and canvas; no native/pixel claim"} |

The native helper reads native appearance per job, checks current scope before and after its await, resolves System from nativeTheme, matches chrome's invalid-preference fallback and refuses other read failures. Main's two render adapters override the supplied render descriptor with that native result and recheck scope before creating the render utility. These checks were read directly; the extracted helper was exercised independently with controlled authorities.

Presenter tests used an independently authored fixture around the actual window source: 100 appearance events while a different slide's navigation was pending resulted in one follow-up using the newly selected slide; repeated failed signatures did not retry; Lock and pagehide retired pending theme work; Lock during delayed image decoding produced no late public frame or private notes. A first combined runner had incorrect reviewer palette rows {theme,mode} instead of the actual {id,mode}; it stopped at the Presenter assertion, was corrected, and was never reported as a product finding. The final successful follow-up retained matching begin/end hashes.

## Original read identities

These twelve hashes were captured at initial read. Concurrent owner corrections mean this first manifest is **not** the current recheck manifest.

| File | SHA-256 |
| --- | --- |
| `src/appearance/render.mjs` | `dcd90d9ee70bc9f5724e452c4b67a8ab5873c4a142c2f84419b22258e120d87f` |
| `src/ui/diagram/style.js` | `62edcd6d1d57c5933b41ff288dabcc72e70524f13ac3f8a2baaead22070c55a7` |
| `src/ui/diagram/vector.js` | `ff9c5caed017e103e5bdfa7648ca4beba5b57e42e4789dd5a6e7fc98326fe4de` |
| `src/ui/windows/diagram.js` | `7e71a0c42e5e5a0a97a98438f7eb8e1bead566c4e33eb906b23401e9ff78e210` |
| `src/ui/presentation/cards.js` | `afe6e9e67134b240cd719b1b5321a6cfd27e0a7c9f157e44296ed28038421a14` |
| `src/ui/presentation/render.js` | `77d98d3a5512b7da901fd39b4e18793769d6d7a966f577cbcb6b0c05f6cf58e6` |
| `src/ui/presentation/window.js` | `08e5428eb237b15db3ad3e930dd2c382c370572f25f622550e53857fa7f24eef` |
| `build/diagram-style.mjs` | `c87a0963edcc484e9c9b260c7885f0e1338b799a3512b90e622358da42fc5e8e` |
| `src/main.mjs` | `77ce71e5eeb207b80b391fcbcbeadcc475c6cee141024713cb45401260c43275` |
| `tests/render-appearance.test.mjs` | `59b1bc33736c273e4ff8d8d6b52c33b200eff8a15e86fd95e2aef0644db0e909` |
| `tests/public-render-appearance.test.mjs` | `80c2c7fad5d904f6b6a190aa7ccb378f9a4748c95b7351b9a85de280030903fa` |
| `tests/presentation-ui.test.mjs` | `7412b97afa3c023afc4d5ddf4354f9319ab02b32e3df5546fb4301ca5870f646` |

## Final recheck identities

Every hash below matched before/after the current probes, before/after the Presenter and surface follow-ups, and at report completion.

| File | SHA-256 |
| --- | --- |
| `src/appearance/render.mjs` | `dcd90d9ee70bc9f5724e452c4b67a8ab5873c4a142c2f84419b22258e120d87f` |
| `src/ui/diagram/style.js` | `0b124b24ca424565b5c8fe824017abcb175cf73380cf2496219517acb1f525eb` |
| `src/ui/diagram/vector.js` | `0f402e50c48b72619b0a5ee17a988c559326cab963bd61332df5e765caf368a7` |
| `src/ui/windows/diagram.js` | `f688a36b1cfb129a81fc0eda00480c2ff887fc362a1623da8a2489b647de5dd1` |
| `src/ui/presentation/cards.js` | `afe6e9e67134b240cd719b1b5321a6cfd27e0a7c9f157e44296ed28038421a14` |
| `src/ui/presentation/render.js` | `f1a4ee4d7f9a07d9e2a3a3d670c6b28060062b09620c9fe346f06253f02c0ca3` |
| `src/ui/presentation/window.js` | `c92acdef3514271b426a294bdad45d6acec62e69f19305d269d8fae6cc5ca24d` |
| `build/diagram-style.mjs` | `c87a0963edcc484e9c9b260c7885f0e1338b799a3512b90e622358da42fc5e8e` |
| `src/main.mjs` | `77ce71e5eeb207b80b391fcbcbeadcc475c6cee141024713cb45401260c43275` |
| `tests/render-appearance.test.mjs` | `59b1bc33736c273e4ff8d8d6b52c33b200eff8a15e86fd95e2aef0644db0e909` |
| `tests/public-render-appearance.test.mjs` | `80c2c7fad5d904f6b6a190aa7ccb378f9a4748c95b7351b9a85de280030903fa` |
| `tests/presentation-ui.test.mjs` | `d34e97af15d2fcd8f22c4139d5a55b8f5a3db38095492d021faaba26fe8df260` |
| `tests/diagram-style.test.mjs` | `489e9c8dd7b4a7005b75c1c4ca2768c53176f817acb8d53f486d7f6224bcdff8` |
| `baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |

## Limits

- No reviewer Electron, real browser CSS engine, native application/IPC, GPU/font/raster/pixel, physical display, package, copied package or release execution.
- All Mermaid parser/DB calls in reviewer probes are controlled mocks; actual Mermaid import/theme behaviour requires ROOT native evidence. The existing frozen helper was read and tests executed.
- CSS.supports hook was probed with a simulated authority. Exact hex syntax was independently checked without a browser. Actual Chromium interpretation is not claimed.
- nativeRenderAppearance was extracted exactly and tested with simulated native store/nativeTheme/scope; native main integration and end-to-end appearance selection remain owner proof.
- Hidden utility lifetime and full-application Lock are outside these renderer VM tests. Controlled Presenter serial/cover states establish local stale-result refusal only.
- ROOT concurrently corrected the sources after the first read. Original and intermediate adverse results are preserved separately; only final frozen begin/end manifests support the current narrow recheck verdict.
- Reviewer changed only the two report files. No source/test edits, dependency installs, downloads, native executions, packaging or full-suite run.

The companion JSON preserves the original overwrite, intermediate malformed-colour observation, initial/current manifests, exact observed probe results, final test counts and explicit limitations. ROOT's actual Electron evidence and full-suite evidence remain separately authored and are not adopted by this review without their own assessment.
