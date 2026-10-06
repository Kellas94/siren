# Independent UI personality and controls audit — 2026-10-06

Author: /root/workspace_surface_review. Own work: read-only static source inspection, inspection of actual artifact images, local receipt/input/archive/runtime hash recapture. No reviewer Electron execution, product edits, rebuild, unit-test run or remote CI execution.

## Historical source and exact preview scope

Source: e27a7f26d6ff3033d3bea74aa9aa9949acbf3461; metadata HEAD 6c2792ad3dde19372cf85c70e6c81a4c2c6b00f3. Checkout was clean when first inspected. During report authoring the coordinator began a separate Classic theme-close race correction: build/appearance.mjs and generated/app.html changed, with test edits. This report remains anchored to the original e27 bytes and supplied captures, and does not review or qualify the new correction. The original builder hash below is the exact inspected/captured hash, not its later working-tree hash.

Preview: development-c593fd50-0a00-442b-a9a0-e0eabe130333. BUILD-IDENTITY.json names e27 and releaseAdmitted=false. I recalculated the actual ASAR SHA-256 e8ed4ea8f3c3ad72f08855cc1535a02c6e146bf35f95be66587b76b258519e05 and runtime SHA-256 49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa; both match the identity. This is identity checking, not an independent full archive/copy qualification.

**Conclusion: recognizable shared navigation and palette propagation, with incomplete original personality and control parity. This audit is not a review PASS.** No new control-access failure was independently demonstrated in these supplied images. Parent-reported full1087/native6/copied5 results are not my executions. CI37403029139 was reported in progress; no complete hosted verdict is made here.

## Concrete gaps and priorities

1. **Colour identity is restored more fully than original theme shape.** The original build/appearance.mjs extracts only ten colour fields. R78 Art Deco also defines radii 8/6/4/2px and its own shadows; Kawaii defines 26/20/16/12px. Native chrome instead uses fixed 12px panel and 9px button radii, with navigation buttons fixed at 8px. R78 Matrix/Synthwave shadows and glow are not extracted. The native KPMG images are coherent but do not demonstrate these other themes' personality. Studio retains its broader original CSS. This is a concrete static parity gap, not proof of a broken theme.

2. **Two appearance controls describe one application preference.** KPMG Code/Docs/Diagram screenshots show global “KPMG Blue” and local “Light” together. Local labels say “Code appearance”, “Document appearance” and “Diagram appearance”, while shell.js routes all three through the same application choose() operation. The tooltip explains the quick choice; the visible wording still suggests separate module appearance. Selecting Light replaces the named application theme. A single clearly labelled application theme control, or explicitly global quick controls with clear semantics, should replace the ambiguity without introducing another preference store or losing Studio's existing theme lifecycle.

3. **Control access at actual minimum size remains unqualified.** Native editor screenshots here are 944×575; factory permits a 480×320 minimum subject to initial normal bounds. Diagram combines a minimum 210px source column/divider, wrapping header and toolbar, status, and optional 220/240px scrolling panels. That creates substantial static layout pressure at short/narrow sizes. Docs has a scroll container, sticky history controls and an absolute Colour popup; the open popup is not captured. I do not infer clipping from static CSS alone. Actual hit targets and keyboard access must be measured at the allowed minimum. Attached source logic hides renderer navigation and reserves 54+48=102px in the host; there is no basis here to report duplicated attached navigation. These images do not qualify attached minimum-size access.

4. **Legacy/native hierarchy still accumulates.** The Studio image contains global navigation, shelf, original header, diagram tabs and original toolbar before the content. Home has global project context followed by its Home/project/action bar. These are visible hierarchy differences needing a common command layout, rather than another decorative toolbar. Keep Code, Docs and Diagram's content-specific controls while aligning context, appearance, save state and native window actions.

## What was actually inspected

I inventoried the requested folders before reading pixels, then viewed all 13 PNGs listed below. The appearance directory is workspace-appearance, not appearance. These are coordinator-owned native executions. On the initial recapture, every recorded before/after/current input pair matched: 33+27+27 pairs, including overlaps. At finalization the new unrelated correction changed two current appearance inputs; original before/after captures remained equal and their result bytes were unchanged. Consequently current working-tree freeze is not claimed.

| Root-owned result | Recorded count | Exact result SHA-256 |
| --- | --- | --- |
| evidence/docs-format/2026-10-06T02-19-28.334Z/result.json | COMPLETE / 5 cases / 33 input pairs | 6685314ee23338417f5954519032abd4f5f2763339f9215e99733eba9334f04d |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/result.json | COMPLETE / 8 cases / 27 input pairs | 5d234424c7508de53531c8aba82654d9a3021bd72016403fd322ba7913a98fc7 |
| evidence/diagram-style/2026-10-06T02-19-39.909Z/result.json | COMPLETE / 6 cases / 27 input pairs | 9946230400ce7d1c15eaecc0c0daabb7a4547ce4411ad43565a27ebe2dfa82c0 |

The images show Docs rich formatting and Diagram Text/Guided/Style controls at the captured size, true saved/working-copy status, and imported Mermaid colour retained in light/dark. Library navigation and Find are real dialogs. Appearance's eight recorded cases include navigation through a dirty-Docs save barrier and Lock; I did not replay these cases. Root result scopes explicitly exclude release/physical-monitor qualification.

There is no Presenter/Audience PNG in the supplied folders. I inspected their builder/controller/CSS only: Presenter gets private navigation; Audience does not, excludes private notes markup, and fullscreen hides its header/status. Preserve that distinction. No exhaustive privacy, every-theme, attached/minimum-size or whole-application visual qualification follows. The previous user HTML/Edge access refusal was respected: no rehosting, navigation or bypass; the comparison used trusted baseline/R78.html and our own generated artifacts.

## Recommended next coherent lot

**Shared R78 appearance metrics and one responsive command-chrome contract.** Extend the trusted-baseline token bridge with a small allowlisted set of original shape/shadow/accent metrics, then use it across navigation, Home and private native controls. Preserve imported diagram colours, syntax colouring and public presentation pixels under existing content authority. Normalize application context and appearance once. Give modules a responsive command strip that keeps real Save/Edit, Refresh, Attach/Detach and Close reachable with their current handlers and refusal/save barriers. Do not add placeholders, move private controls into Audience or widen IPC grants.

Acceptance: original Warm Light/KPMG/Matrix/Art Deco plus a rounded theme; detached and attached Code/Docs/Diagram; actual Presenter/Audience captures. At 480×320 and a normal viewport, pointer-hit-test and keyboard-use real primary actions, Docs Colour popup, Diagram Style/Build and transfer actions. Keep focused controls/status visible, then preserve draft/selection/undo/save/Lock. Include long names, reduced motion and theme changes in existing views. Use bounded local CSP assets; no remote fonts, arbitrary imported CSS or per-frame theme work. Broader feature parity remains a later, separately qualified task.

## Exact inspected static-file hashes (including targeted reads)

Original captured hashes are used where available; other unchanged inspected files were locally recaptured. The separate new race patch is excluded.

| File | SHA-256 |
| --- | --- |
| baseline/R78.html | 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4 |
| build/appearance.mjs | 8265798dd02420dc9af7eb9797ab0ba24bf42df266424909ccc47ca02104ea37 |
| build/windows.mjs | 4bb3bf0ef721fd1e1b5c520e8736e3a90b818c7af568f633133a77110ebaabd7 |
| build/presentation-windows.mjs | b9c6f86238cbe7c471f288659dde2b631df638f5bfce587fea2a8e8859b1305c |
| src/ui/shared/chrome.css | 5af3d82f0591e0d4257bf0d1796fa568567ab7ed4ffb92c6be4b3583cb5ef21b |
| src/ui/shared/shell.css | b2e5d085ec06177aef3a2c356d937bf265abaa6e7dc062b87dd8478eb813088b |
| src/ui/shared/shell.js | 003ec04e17893f59fdca0f8c8f68bd271584136c06bf21e3e316ea4dbc577357 |
| src/ui/shared/appearance-sync.js | 40f53437609345bdd7c4983a0cc9c03f6535e8fbd02126982318258b686be238 |
| src/appearance/contracts.mjs | 01d6d2dbce39b9b739e165cc73a15f36b40c1b7bdc032e78b34da559aa2ffc49 |
| src/windows/surface.mjs | f9932c6cfe52277c554e4d4df367d8fceccbb69df1a75a9f5c10596d25e9cc54 |
| src/windows/factory.mjs | 6e9ae972df36ed40c5ea0cdfd628db2dece21f7171d47684e53b9d493f82e3e3 |
| src/ui/presentation/window.js | 116e4bbaa5966fcbbd7e94b630a202098368a1644ea7ab7f86359a3d95dc81db |
| src/ui/presentation/window.css | 8fe6aaf0d964353231a7677f8cfa24d9799eb721e2574cde56efe457c08e5fb4 |
| src/ui/diagram/window.html | 5dc3ebf1f73df0d80d6012f628647969af28e674e3c5c5a29a610bfccd9a0575 |
| src/ui/docs/rich.js | e841370e6431b6ed080fbe668de18f43b9c48422620dabd3007b5635865899b6 |
| src/ui/docs/reader.js | 8398a0fad7121c608034ebe2543b27fb0f1f48f26c47ac55106eb8c6dc24ba16 |
| src/ui/workspace/home.js | 5dbf51ef13e76f9239e4a5ac6e3aada5878eafd1623220ada4840e14438a3eac |
| src/ui/workspace/guide.js | 4b575acad2d0fb4d1e80498add42a2043667414383b7aab53aa4a78815b80fa4 |

## PNG inventory — all visually inspected

| File | SHA-256 |
| --- | --- |
| evidence/docs-format/2026-10-06T02-19-28.334Z/docs-rich-workspace.png | 25ff5ba736637101cde4948b5c98724a5cf58fed4d81ad368048c470b22be40a |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/code-kpmg.png | 7da450e0559bb0adfc464e96e621f3c2395b52aed78a7709af2cb9b1bc390947 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/diagram-dark-imported-colour.png | 6d8aaca39b4f9eacb047955244075d79ed62f7a2550d846eae34b8757b9ca081 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/diagram-kpmg.png | 6211540aec084fdd530b00a570944b5173b08b57e22841c629c834595cd1b008 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/docs-kpmg.png | 6a3dfa2fb69414022d16c7adad0e43134bc6c2891419f836d6ce3a88c3d2d881 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/docs-library-after-native-navigation.png | 587368f22a3319720d12ab1eac718738b83a29a971c2f202338c4c526b9ed9e1 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/home-kpmg.png | 3480cb6101f86c647fcb372b2a8117c95f1e1eed09730db12f7117bd94d87304 |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/project-find.png | 4a1d31a60095832ce4e4affd7ac15fc14d90856742c357c0a747e296e6d332bb |
| evidence/workspace-appearance/2026-10-06T02-20-35.039Z/studio-shared-theme.png | bc083f6d261c85d1f72c86dde7ef9015babb7f0ec630cd857b18fd459b4937c5 |
| evidence/diagram-style/2026-10-06T02-19-39.909Z/guided-dark.png | 9a8200d8236ee155e0802280361e410089776792196a9c1c3c1664c4d54cc169 |
| evidence/diagram-style/2026-10-06T02-19-39.909Z/guided-light.png | 72b3ea189f4a901fa4fb29ddc5642befdd0444f2917606600edf30cd63aae97d |
| evidence/diagram-style/2026-10-06T02-19-39.909Z/styles-dark.png | 8e339ff36c41f969a73f7daca22946d0d3d900415d944f2c3b82b1747e2117e8 |
| evidence/diagram-style/2026-10-06T02-19-39.909Z/styles-light.png | d06ca3861b1a1c96dc851b6698a1bfde84e4463de4e9ab51943deb007f5de142 |
