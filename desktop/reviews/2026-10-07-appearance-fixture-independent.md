# Independent appearance-fixture review — 7 October 2026

Author: /root/terminal_foundation_review. **The captured fixture corrections preserve existing assertions and the focused Node tests pass 28/28. Actual native workspace qualification remains pending.**

I compared the eight requested fixture files with Git base 3aa96580d6e773e1232157e1ca12a098ca5e5615, read the modified fixture context, independently ran the seven pure Node test files, audited assertion preservation, and compiled browser-expression syntax without executing a browser. I wrote only this report and its JSON companion.

## Changes and non-weakening assessment

The seven pure-test changes add missing current dependencies rather than replace assertions or bypass code:

- Diagram pan/annotation/walkthrough fixtures import the actual createRenderAppearanceContract and supply it under SirenNativeDiagramStyle.appearance. Their legacy theme element now begins with the real HTML default system.
- Placement and security fixtures supply documentElement.dataset and the system theme default. The security fixture still builds the actual style adapter and asserts strict security policy, protected keys and finite renderer budgets after the intentionally refused render.
- Layout integration supplies Mermaid API getConfig().themeVariables.background, which current surface provenance needs for an explicit source theme. Existing layout/source ownership assertions are unchanged. A fixed mock colour is a fixture dependency and is not actual Mermaid background evidence.
- Native-window integration supplies the real appearance-contract factory and a controlled nativeTheme preference in its extracted-main VM, so the new main helper can initialize. Existing ownership, grant, retirement, cleanup and failure assertions still execute.

I audited every original assertion-bearing line as an exact string with multiplicity and checked the Git diff for removed assertion lines: **zero original assertion lines removed or changed across all eight files**. Original pure test declarations remain 28; all original test names/behaviour assertions in the inspected diffs remain intact. There are 184 original assert calls and 189 current calls; the five additional calls are all in the native workspace fixture.

The native workspace additions bind four appearance source hashes and add explicit KPMG unstyled-node fill and viewport background assertions. The new Presenter scenario requires a higher public sequence, unchanged deck version, changed public image and exact unchanged persisted project. A second switch back to dark requires another higher sequence. These are additive assertions; none replace prior source/project integrity, native navigation, shared preference or Lock checks.

## Independent checks

Command: node --test tests/diagram-pan-release.test.mjs tests/diagram-annotations-window.test.mjs tests/diagram-walkthrough-window.test.mjs tests/diagram-placement-ready.test.mjs tests/diagram-security-config.test.mjs tests/diagram-layout-integration.test.mjs tests/native-window-integration.test.mjs

**28 tests passed, 0 failed, exit 0**, duration 234.6054 ms. The pre-run eight fixture hashes captured by this reviewer match the later audit begin/end manifest and final report check. All fourteen previous appearance-review input identities still match the earlier report; no product change is inferred from this fixture repair.

I also compiled **50 complete native evaluate/waitFor expressions**, including representative expansion of the two new sequence waits. This confirms the captured quote repair produces syntactically valid expressions. It does not prove DOM selection, navigation admission, rendering or actual Electron behaviour.

## Captured native run is still incomplete

At native workspace fixture hash 359360527b48af58426e914606759223795cccd20975734d21935a4b8bcf0b93, ROOT reports six native cases passed, including the newly asserted Diagram B fill/background. The next new Presenter appearance scenario attempted a Home theme click while common navigation was still hidden/occluded after opening Presenter. ROOT retained that adverse run and plans to add the existing workspace-admission and visible/non-inert navigation wait after the concurrent full-suite identity capture ends.

This native progression is **ROOT-reported**, not independently executed by this reviewer. The fixture currently lacks an admission wait between that Presenter readiness check and its new Home-theme click; it cannot receive a completed native qualification verdict here. An amended fixture and actual rerun need their own captured-byte addendum. This limitation does not invalidate the independently passing 28 pure checks or justify removing the new native assertions.

## Current hashes and preservation counts

| File | Assert calls, base → current | Test declarations | Current SHA-256 |
| --- | ---: | ---: | --- |
| `tests/diagram-pan-release.test.mjs` | 7 → 7 | 5 → 5 | `1002ad0e1cbfab46ac6f85b3307308ed5f2f714eba40c3bec2f97ed9268d8843` |
| `tests/diagram-annotations-window.test.mjs` | 30 → 30 | 5 → 5 | `2a063a7fff02878b6fbe75a158f3a48d81e69ec9daf1c9b447e2c37d010d5d2b` |
| `tests/diagram-walkthrough-window.test.mjs` | 25 → 25 | 3 → 3 | `d30d077b26cd9e3b9f10b8e042d3e46c0d9ebc2304e45e206179404c61bf146e` |
| `tests/diagram-placement-ready.test.mjs` | 13 → 13 | 3 → 3 | `aa53e3535a76e2b85665e05c2ca235308b12b18e49b4c116c1f027996d994ca9` |
| `tests/diagram-security-config.test.mjs` | 7 → 7 | 1 → 1 | `9b199adf0a6923e053fa29c39782a3f6cf832eac01db25016bc51198362b471a` |
| `tests/diagram-layout-integration.test.mjs` | 25 → 25 | 3 → 3 | `0adbdd1a720f1329e426ff64ffceb390543d292772edef42d8ae0b23d5268b99` |
| `tests/native-window-integration.test.mjs` | 54 → 54 | 8 → 8 | `127a0484f875880841174612dd59719010d3673b6063e8a58b24995b32637598` |
| `tests/native/workspace-appearance.mjs` | 23 → 28 | 0 → 0 | `359360527b48af58426e914606759223795cccd20975734d21935a4b8bcf0b93` |

| File | Base blob SHA-256 |
| --- | --- |
| `tests/diagram-pan-release.test.mjs` | `ea0dc4b6ba6e2eb0f6757b19d8db7277b6676fe9c49f8c859d65bb28d891abf2` |
| `tests/diagram-annotations-window.test.mjs` | `c970b027ed09f88de520906d8b8c41875b58f1b2d45b4d37624eef13e23887c3` |
| `tests/diagram-walkthrough-window.test.mjs` | `21699cfe3ce92308c2f08691a913c9859e18c4c384a3db079dc63c34f3bf2629` |
| `tests/diagram-placement-ready.test.mjs` | `86dc0194ef5b92813ff71ef0889512f595c8b10fc6791703b046d48ba635375d` |
| `tests/diagram-security-config.test.mjs` | `5c9fb8733a8b4606dead6196959dc4b26f091396d9b340755a57c8088723a817` |
| `tests/diagram-layout-integration.test.mjs` | `43dd142b6c97eebc8912bf8677c0772c30a58d1871cdf7ce6960bd710fcbbedb` |
| `tests/native-window-integration.test.mjs` | `1df53319a03676e925e29e95339d7ae50ba41bd8de17fc0b8f055b6195330a00` |
| `tests/native/workspace-appearance.mjs` | `5adf29daddc20fae8a1f99540d5d3dc4a10a8dd16909544f0cd9edb13e81c9f4` |

The JSON preserves the full eight-file begin/end/final manifest, base hashes, assertion counts, added assertion lines, compiled-expression identities, prior fourteen-file comparison, focused test result and pending native status.

## Limits

- Static assertion-line preservation and unchanged test names support non-weakening for these exact edits; full native coverage is not inferred.
- Mermaid layout getConfig mock supplies a finite surface read needed by current style helper. Existing layout assertions remain verbatim, but this mock is not real Mermaid background qualification.
- Actual createRenderAppearanceContract is imported into VM fixtures; browser DOM system defaults and nativeTheme are controlled test inputs, not native authority proof.
- The previous full-suite failure count and native progression are ROOT-reported only; reviewer ran only the focused28 checks.
- No dependency installs, downloads, GUI, Electron, runtime process, packaging, release or full-suite execution by reviewer.
- Only the two reviewer report files are written; all scoped fixtures and the14 previous reviewed inputs remain unchanged during this audit.
