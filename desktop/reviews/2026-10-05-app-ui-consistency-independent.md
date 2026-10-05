# SIREN application UI consistency: independent static review

Author: /root/workspace_surface_review. Captured 2026-10-05T20:43:31.879Z. This is a new independently authored design/source assessment of the current working tree, distinct from the Diagram docking functional review and historical source/package/hosted qualification.

Scope: approved written Home/native-workspaces specifications; selected legacy R78 theme tokens, theme chooser and shared chrome; desktop adapter; Home; native Code/Docs/Diagram templates and controllers; Presenter/Audience templates/controllers; shelf; relevant builders. The legacy file has many additional themed feature surfaces; this is not an exhaustive audit of every legacy dialog or decorative variant. I read source and recaptured bytes; I made no product, test, build or helper changes, ran no Electron, and inspected no fresh native screenshots. Appearance, occlusion, actual focus and contrast are therefore not visually verified.

## Approved direction and existing constraints

The approved 3 October Home specification explicitly requires the existing SIREN theme and a compact common topbar with Home, project context, module navigation, honest save state, Find, window shelf and Settings/Lock. The approved native-workspaces specification calls for stable project/save/search placement and a named window list with minimized/dirty state. Frozen R78 must remain unchanged; desktop build/adapter seams are the authorized extraction point. The earlier research proposal informs this review but does not replace the approved specification.

## Concrete static inconsistencies

Priority labels below describe UI/design gaps, not a claim that they bypass security.

1. **P2 — The application has separate palette systems.** R78 light is explicitly Warm Light: app background #f4efe7, panel #fffdf8, ink #2f2924 and primary #9a4c2e (baseline lines 89 onward). Home instead declares #f6f7fb/#fff/#202735/#174fc5 in workspace.css:1. Native Code/Docs, Diagram and presentation declare #f7f8fc/#20283a with blue #648dff focus in their templates. Their dark palettes differ too: legacy #0a0f16/#111923, Home #151619/#202227, native #171719/#26282f and Code editor #181c24/#232936. These are actual source differences, not a screenshot judgement. The named legacy palette cannot reach those hardcoded styles.

2. **P2 — Theme selection and ownership differ across modules.** R78 exposes Dark/Warm Light and named families through themePreset/themeMenuButton (baseline:20999); Code, Docs and Diagram expose only System/Light/Dark. Their per-window select defaults to System and updates their own document/editor. Home Settings (home.js:156) contains PIN, updates and guide, with no appearance control. Presenter/Audience have no application theme control, use OS color-scheme and do not consume the selected legacy theme. R78 applyTheme mutates legacy state.theme; that state is not a safe reason to broadcast a project envelope to satellites. Diagram currently uses its appearance selector both for chrome and Mermaid rendering; a common application preference needs an explicit distinction from preview/deck appearance and imported node colours.

3. **P2 — Common context/navigation remains fragmented.** Home topbar shows SIREN/Home plus Settings/Lock (home.js:165); project information is in content. The legacy adapter adds a bottom Desktop bar (desktop.css:1) in addition to legacy navigation and the new top shelf. Native Code/Docs/Diagram headers have entity/theme/edit/refresh/transfer/close controls, but no visible Home/project/module context bar. Presenter has playback controls, Audience its public display controls. Native menu/keyboard routes already provide common actions; these should be retained while pointer discovery is made consistent, rather than adding another independently implemented routing system. A common shell must not imply Audience should receive private project names, lists or save states.

4. **P2 — The shelf does not identify the user's entities.** shelf.js:24 builds Code/Docs/Diagrams plus a role-local sequence number; titles contain an entity ID and placement. surfaceRecords/dock metadata has no bounded entity label or explicit dirty/minimized state. Removing an earlier row can renumber remaining peers. The identity helper already shows sanitized own entity name/version/read-only/unsaved in titles, but the common shelf cannot display those names. This falls short of the approved named restore list and makes identical-role windows hard to distinguish. Any added shelf labels must be native-derived, bounded and authorized; private text/source snippets must never become labels or Audience payloads.

5. **P2 — Compact layout rules are inconsistent and need actual capture.** Home changes its card columns at 850px but its topbar/tool row has no equivalent overflow plan. Docs reserves 180px outline plus 24px gap and 56px article padding; Diagram reserves a minimum 210px source plus divider; Code Structure reserves at least 240px plus 16px gap. Presenter alone has a specific 700px compact rule. These widths are present in source, so a narrow window/200% zoom has materially different usable space per module. I have not established actual clipping. Adopt a common compact toolbar overflow rule and role-specific collapsible outline/source/analysis controls, preserving all commands and exact editor state. Do not solve this by hiding Save/Lock/Close or by recreating the renderer.

6. **P2 — Reduced-motion and focus treatment diverge.** Home has a reduced-motion rule removing animations/transitions; native Docs explicitly sets documentContent scroll-behavior:smooth (build/windows.mjs:36) without a reduced-motion override in its generated style sources. Focus outlines differ: Home 3px/4px offset, Code/Docs 3px/3px, Diagram 2px/2px, presentation 3px/2px, shelf 2px/1px, plus hardcoded colours instead of a shared focus token. Shared reduced-motion/focus/scroll-margin rules should include form fields, summary controls, split handles and menus. Preserve the existing shelf 56px scroll padding and 48px reserved native geometry; a visual change cannot silently alter those ownership/layout contracts.

7. **P3 — Control density and surfaces are independently tuned.** Native main padding is 18px, Home topbar/content use 24–40px spacing and legacy uses its own header-height/radius/input-min-height tokens. Code editor buttons are styled inline (editor.js:52), with a 7px radius; native headers use 10px, presentation 8px and Home 9px. Legacy defines shared input height 38px and radii 9/12/16/22px, but new native controls hardcode separate values. Font stacks request Inter but Code toolbar/status separately request system-ui, while editor text is Consolas; typography should share UI metrics while keeping monospace code and presentation authoring distinctions. No claim about which fonts are actually installed/loaded is made.

8. **P3 — Equivalent lifecycle actions use different language and feedback.** Code says Open latest separately / Replace with latest; Docs says Open saved separately / Reload; Diagram says Open saved separately / Reload saved. Presentation says Close while editing windows say Close window. Diagram transfer refusal is primarily button dataset/title, whereas Code/Docs entry writes a visible status. Use common action/notice semantics and a visible role=status failure affordance; retain source-versus-document-versus-diagram save semantics and the existing native drain/refusal behavior. Code source save must not be relabeled as a Docs/project save, and stale reload still needs its explicit local-discard confirmation.

## Minimal shared foundation

Begin with a small static desktop-owned theme token module and shared CSS, consumed by Home, legacy adapter and dedicated native builders. Map the existing legacy palettes into semantic application background/panel/input/ink/muted/border/accent/focus/status/shadow tokens, UI font/line-height, spacing, radius and control height. Use a bounded palette identifier and explicitly validated variant settings; do not drop named themes or silently replace Warm Light with blue. Decorative animations, special wallpaper and module-specific syntax/slide rendering can remain optional role-specific layers. Extract from the frozen baseline through a checked build seam; do not modify R78 or duplicate its entire renderer in each native window.

Add only small presentational components: compact entity/context header, button/select/input/focus rules, toolbar group, status/conflict notice, disclosure/dialog and window-tab affordances. Preserve existing IDs, accessible names where contracts require them, event ownership and native methods. Common styling does not require a common content store or preload. Role policy determines which controls exist: Home/legacy handle project-level actions; Code/Docs/Diagram show their authorized entity and working state; Presenter keeps notes/playback secondary tools; Audience receives only public content and minimal display/exit controls. Fullscreen Audience intentionally hides chrome. Never recolour/filter the delivered public slide image merely because the application's shell theme changed.

A consistent application preference can be stored separately from project content and propagated as a finite, data-free theme receipt. That is a distinct contract change requiring actual sender/frame/role/epoch checks, pre-unlock data-free defaults and a safe Audience subset. Existing satellite preloads must not gain Home bootstrap, project snapshots, arbitrary paths or settings objects to obtain a colour. If the initial phase can use static tokens and existing per-view controls, ship that smaller layer first; do not present a new global theme synchronization API as already available.

Use one shared visual context layout with per-role omissions, rather than one identical private-data toolbar everywhere. Bind a visible Return to workspace action to the existing coordinated native focus/navigation contract through a finite authorized route; do not let a satellite call arbitrary workspace navigation or copy the whole legacy module. Keep native titlebars, minimize/maximize/Alt+Tab, menu shortcuts, transfer buttons, dirty barriers and keyboard ownership. Replace redundant bars only after every existing action has an accessible replacement; moving controls alone is reversible, but removing a recovery or save route is not part of cosmetic cleanup.

Keep costs bounded: CSS tokens and a small appearance subscription should replace duplicated styles; no full-project polling, repeated Mermaid build, imported full R78 document, new unbounded per-view timers, remote fonts or network dependencies. Theme changes should not dispose/recreate editor state or alter source/draft/undo/selection/deck version; CodeMirror uses its existing compartment reconfiguration. Retain strict generated script hashes, local resource allowlists, tag-boundary checks and package-byte receipts. A shared stylesheet is not justification to weaken script CSP.

## Verification needed before visual approval

Fresh root-owned screenshots are pending and have not been viewed by me. Capture the same declared theme and desktop viewport for Home, legacy, detached/attached Code/Docs/Diagram, Presenter and public Audience; include narrow windows and 200% zoom, light/dark, representative named palettes and reduced motion. Use real keyboard focus/pointer hit tests on overflowing toolbar actions and preserved shelf scroll geometry. Record actual content bounds and active role/theme, not only outer-window dimensions. Keep public slides/notes screenshots separated so privacy is testable.

Functional proof must separately retain exact draft/source/project bytes, Undo/Redo and selection across appearance/reparenting; readonly/stale/caller refusal; Close/Lock/Quit coordination; public frame identity and absence of notes/project data in Audience; and startup content hiding before PIN. Measure startup/memory and inactive renderer work for any shared controller. A good-looking screenshot does not qualify these contracts, and the current Diagram fixture/full-suite status does not qualify a future UI rewrite.

## Raw-byte source snapshot

| File | Bytes | SHA256 |
| --- | ---: | --- |
| docs/superpowers/specs/2026-10-03-siren-home-diagrams-design.md | 10909 | da66a8480ea5ec3fbf534b594e81053de63f961e2c702f5104028dcbf5706884 |
| docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md | 9831 | be5231d84dd3c120c0f658c7e3fb5e720cec11241a309c6912c2c32ebde67f32 |
| docs/research/2026-10-03-siren-home-navigation.md | 10114 | e62059adf84d22433edb52a9b2af1523c3eeb5945b37f9e6d4cf337dbfc5039b |
| desktop/baseline/R78.html | 13626609 | 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4 |
| desktop/build/renderer.mjs | 23634 | 18568c61299531d1ecda92be67373a46d2ef740428709cf7c36167fb9429899b |
| desktop/build/workspace.mjs | 2540 | 779c7280d80addf24bc31c6f2b33d222e8658af7876fc19f01dcd201ae3d7a4c |
| desktop/build/windows.mjs | 17520 | 5cb3fad98d0c39b55b1476f50770550160fdf92388e80bc819ec885a84899b52 |
| desktop/build/diagram-window.mjs | 3083 | b505bc570309b0cbb10a2603e3a01da65f33566256ffb90b453daa3ddf3b27ca |
| desktop/build/presentation-windows.mjs | 4510 | 8c112bff7067543fe81a9c8dd0d25ba45590a65433ce4a21dd71ec8f4b7b62c7 |
| desktop/src/ui/desktop.css | 11409 | 97e61f032fba1c8ef584b3faf4a4bf0ed970579ca2329473dab2a4ee4357ee04 |
| desktop/src/ui/desktop.js | 26592 | e524dd33ec1a7ca7fb8299f6630d7efc8069d2114c3a27bc5e40351455171139 |
| desktop/src/ui/workspace/workspace.css | 8916 | 35361459260c12b24d3ee4717112c68364674f3ee960f8ca024fe4420147a7d8 |
| desktop/src/ui/workspace/home.js | 34459 | 5b1259c7b23425485ff84e0eea61db8d1235832a4d40e3ef3233bd35bb22f7ad |
| desktop/src/ui/windows/shelf.css | 1395 | cda1428a6a6a8b616ef1ff8b7f994d35a2674d937e5e1d02d6269a87b69e3ec3 |
| desktop/src/ui/windows/shelf.js | 3158 | 7e48b4dacbd46e9e86e2519721ab1eba94c5a1171b4877ee12caa9402b6a966b |
| desktop/src/ui/windows/identity.js | 1290 | d5c5cf1de109bb28ddc843e6deff7dd566b3275d750ef44477fcab8149af0f9d |
| desktop/src/ui/windows/entry.js | 2729 | 1d4bde2a474524c0bf05a7c8da70f72643984b917d017ff7f4031408ee085b66 |
| desktop/src/ui/windows/code.js | 11324 | 1f69c89abe84b5ab9a747c2282ef6ae26434f33db08d401510abc8612966b526 |
| desktop/src/ui/windows/docs.js | 24078 | 99a1fb6686b47ae41692f88aaa1e040e4fc7695cbd108bd128a45cd833addb3b |
| desktop/src/ui/windows/diagram.js | 18824 | bacfb9915777617b14bb0f950203ec3193f3f93dde7f3f4338297f16d5612bd8 |
| desktop/src/ui/windows/diagram-transfer.js | 2075 | a2740f4b41d4103a2b3f4473df8eb372521a9f4458a890a1f258ba3e860f8422 |
| desktop/src/ui/code/editor.js | 10026 | 066f574853d1881f2754fc2f4b8509f3104f595f9df31a468c4f0a0d0edb6261 |
| desktop/src/ui/diagram/window.html | 6894 | 5dc3ebf1f73df0d80d6012f628647969af28e674e3c5c5a29a610bfccd9a0575 |
| desktop/src/ui/diagram/guided.css | 1367 | 7728dfe39025fcd58f833957e99d100b0f87762a523384005ec2f4574c12b62a |
| desktop/src/ui/presentation/window.css | 540 | 8fe6aaf0d964353231a7677f8cfa24d9799eb721e2574cde56efe457c08e5fb4 |
| desktop/src/ui/presentation/window.js | 8138 | 116e4bbaa5966fcbbd7e94b630a202098368a1644ea7ab7f86359a3d95dc81db |
