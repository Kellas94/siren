# Shared desktop UI foundation: independent patch review

Author: /root/workspace_surface_review. Captured 2026-10-05T20:56:35.067Z. Verdict: **CHANGES REQUIRED**, one concrete P2 theme-mapping defect. This is the first bounded CSS/build foundation candidate, read-only reviewed during the root full-suite freeze. No product/test/build/helper edit, Electron execution, screenshot capture or remote execution was performed by me. Existing reports remain unchanged.

## Finding

**P2 — Classic theme aliases target the wrong element (src/ui/shared/chrome.css:4).** The new mapping is :root[data-theme], but actual generated/app.html has html with lang/data-desktop-locked only, and body with data-theme=dark. R78 applyTheme assigns document.body.dataset.theme at baseline line 80566; generated source retains that assignment and has no documentElement.dataset.theme assignment. I independently parsed the generated DOM with parse5 to verify the attribute placement. The alias selector therefore never matches the legacy theme. Shared shelf styles now consume --siren-panel/ink/accent from the generic light-dark defaults instead of the selected named palette. Changing a legacy theme to Matrix, Art Deco or another palette leaves the new common shelf on the generic palette; a Warm Light choice against a different OS scheme is also not safely mapped.

Fix the mapping on body[data-theme], where the real theme tokens and variant overrides are owned and resolved. Merely matching the root via :has(body[data-theme]) would still alias variables at the wrong ancestor. Preserve the frozen baseline and do this in the desktop CSS/build layer. Confirm real selected body tokens drive shared chrome with a named theme and Warm Light, including variant settings, instead of testing only the default dark capture. This is a static proven selector mismatch; I did not execute a theme-switch repro in Electron.

## Divider check and reviewed boundaries

The suspected generic button padding does **not** override the Diagram separator: #diagramDivider has stronger ID specificity and preserves padding:0, border:0, transparent background, cursor and 6px radius. The new generic min-height:32px matches because the separator has no competing min-height rule; this is normally below its stretched panel height. I do not report the padding suspicion as a defect or claim a narrow-window hit-test result. A specific separator exemption can make the intent clearer, but is not a substitute for checking the actual cascade.

readDesktopChrome reads only local CSS and refuses style closing tags, @import and url(...). The helper introduces no scripts, remote resources, preload methods, IPC, grant changes, project state or subscriptions. Builders append the style through existing checked entrypoint seams. CodeMirror surrounding background/gutter/ink now use semantic variables with existing light/dark fallback values; syntax colours and editing/history/lifecycle code are unchanged. Presentation public image data and frame APIs are unchanged. CSS affects application chrome; the Presenter public slide container can change background/border, but there is no image filter or image-payload transformation. Audience permission/payload isolation remains separate and unchanged; I viewed no Audience image.

## Actual independent generated checks

I read all seven generated documents and found exactly one raw current shared CSS inclusion in each: Home, legacy app, Code, Docs, Diagram, Presenter and Audience. CSS is 4553 bytes. Home is 64232 bytes, 1304 bytes below the enforced 65536-byte ceiling. This meets the current budget but leaves limited headroom for further shared additions. I did not run a build.

All 17 actual inline scripts across these documents compiled with vm.Script and had matching SHA256/base64 CSP entries. Legacy app has four scripts; a first simple tag regex found only two because some have attributes, so I corrected the inspection using parse5 before concluding. Existing strict script hashes/default-src/base/form/object restrictions remain; presentation retains only its existing data-image allowance. No unsafe-inline script allowance was introduced. CSS style allowance is unchanged. This is read-only artifact verification, not packaged-byte qualification.

## Actual visual inspection

I viewed seven root-owned fresh PNGs, independently recaptured each hash and matched result.json. Home light, Code light/dark, Docs light, Diagram light and Presenter dark visibly use the warmer light/navy dark surfaces and a more coherent border/header/panel treatment. At the captured 1104x715 size, the visible readonly controls, source/preview split and Code syntax are present. Presenter retains its separate private notes. Root geometry records sample documentElement styles; native root backgrounds still show old template values while the actual styled body paints the new palette, so those recorded root values should not be mistaken for a failed body theme application.

Legacy remains a READONLY/9%-zoom capture, useful only as a limited chrome reference. No named-theme switch, Audience frame, attached versus detached post-style interaction, narrow/200%-zoom layout, computed contrast, actual keyboard focus or separator drag was inspected. The palette foundation visibly improves consistency but does not close the earlier common context/navigation, theme synchronization, shelf identity and responsive-control gaps.

## Open independent qualification boundaries

The root Diagram Refresh diagnostic is still ADVERSE: its actual native read returns saved version 2 while UI remains version 1/inert=false after four successful cases. This report does not reclassify that as a fixture-only issue or qualify native Diagram docking/Lock. The CSS change does not resolve it. The earlier full-suite sandbox/esbuild temporary-access failure and current elevated full run also remain separate; this report claims no full-suite, package, hosted, release or whole-app completion. Theme mapping must be fixed after the freeze and recaptured for a separate follow-up.

## Exact source/generated raw bytes

| File | Bytes | SHA256 |
| --- | ---: | --- |
| desktop/src/ui/shared/chrome.css | 4570 | ee31a9bab146f96cf14f575af1ecde18d1d4ddcf345448d8a1ddb45ff0038a37 |
| desktop/build/chrome.mjs | 355 | 9b0b1d3b134c77c88fb4bab586ea96f2a4a9de8b44c163bec1b9e124cf1572c7 |
| desktop/build/renderer.mjs | 23713 | 3eefaff4a01f0f44a02ac98a6b387045a6a8e27712956b2e815deb1dbb60405d |
| desktop/build/workspace.mjs | 2630 | 2eb5da46fd3e1df800aa967d918943287d7d2a07f63a1164efece771ac59b40d |
| desktop/build/windows.mjs | 17675 | 095e6b5a8ae30980a39778a88b7e1a7670afe1c524b1b4331146cec8f31054b3 |
| desktop/build/diagram-window.mjs | 3210 | 7d1bd912733003da3cc05f8dde5fa6c9d184d8765df9d17529a0d71198dcb23d |
| desktop/build/presentation-windows.mjs | 4589 | c730ba67ccfb6c4d1e890d5b88e8138e41fd60ca109855e03d4025762c1d86d6 |
| desktop/src/ui/code/editor.js | 10162 | 2df7e910a360df15310693248969a5682b9b1ddfba8fa2507f3aee4079e5819e |
| desktop/src/ui/diagram/window.html | 6894 | 5dc3ebf1f73df0d80d6012f628647969af28e674e3c5c5a29a610bfccd9a0575 |
| desktop/src/ui/windows/diagram.js | 18824 | bacfb9915777617b14bb0f950203ec3193f3f93dde7f3f4338297f16d5612bd8 |
| desktop/generated/home.html | 64249 | 1c1e19fed417ca1e602bbb286dfca9116cda286440162c6444d2da3384538018 |
| desktop/generated/app.html | 13702096 | cb6c79fc785bf896171113b501a2eab7322b2ebaea6dbf3eedef4e5bbc441544 |
| desktop/generated/windows/code.html | 549774 | 271d6e37ddc10367f6b392d789da307c13ee5ea70393b6d005f3983850bb8bae |
| desktop/generated/windows/docs.html | 61135 | 6aa4cbf87c38f80d3d03808da7dc40a5b1cc86fe13f737a55b92a4a586ab5a9b |
| desktop/generated/windows/diagram.html | 7308566 | c89baa4fc077fde34ce0452c8cf6f45f625b3dd0680a0146f31876e75eb72a6d |
| desktop/generated/windows/presenter.html | 16549 | 69ddf1ea1f71e94c4f5f6ec389d8dbe9e81b4d131eab25e26af9029a380419ff |
| desktop/generated/windows/audience.html | 16032 | 9c1063c7a18cbde05503d0ddec2ac0e9190ab45f52457116c953060505074122 |

## Viewed image identities

Root capture result SHA256: 284f2a3dfb8325fdc031933e63ec4ada9fbb9952c38bceb03d0cde32f59fc724. Native execution/capture author is /root; viewing and hash checks are mine.

| Image | SHA256 |
| --- | --- |
| 01-home-light.png | 37084d904094d8b72ad598af93cae73dc27eead459364c7b6bf1370c4acd58a5 |
| 02-code-light.png | 907041abb05298c9c4b347b23a6c91499635e8e5ec1f3d41c900ef199d83cc02 |
| 02-code-dark.png | 4b99577bcd87f9dd2057c70bdc5ed0e04a6b64392f3114fb68a74deca90df83b |
| 02-docs-light.png | 2041ceeaa8e8495b7ab0a1f3373fd4efd089e611100d170b32e4f5d16b8ab2c0 |
| 02-diagram-light.png | 324639fba9cc51cc463b09086a788ffc0b083e9495ad97cfc1922315e621cc98 |
| 02-presenter-dark.png | 79f3663c693b47f71fe2cfa0062eb8ef79cc5fd68afe5d4e4a4d7f54386ce79a |
| 03-legacy.png | 531f6f2bd6e00101361eea3ca3f8f35501d0638d542a93b39346edc913dba453 |
