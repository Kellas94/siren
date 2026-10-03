# SIREN desktop entry, navigation and decluttering

Date: 3 October 2026. Author: /root. **Design proposal informed by a completed fresh current-flow audit; Home and the new native Diagram role are not implemented or approved.** Existing source/native-workspace implementation continues. The user has previously authorized choosing suitable UI details and independently verifying them.

## Intended result

After the opening sequence and genuine PIN unlock, the application opens a calm Home surface. The user can **Continue work**, choose a local project, or enter **Diagrams, Docs, Code or Present**. Going Home remains possible from every module. Continue restores the selected project and recognisable working location, without discarding drafts or replaying commands. Diagrams also needs an actual detachable workspace for other monitors.

The requested desktop focus, existing SIREN themes, private local projects, native source authority, explicit Save to Docs and all-window Lock policy remain constraints. AI stays hidden without configuration and is developed last. A source grammar is not a Python runtime. Terminal remains unavailable until its native process-family owner is qualified.

## Current interfaces and fresh visual findings

The existing desktop adapter appends a separate `Desktop…` bar and project/settings/recovery dialog to the legacy module UI. Frozen R78 has independent Docs/Code/Present entry functions and many contextual controls. The source editor now has a separate modular EditorView/build seam but is not activated in the production main renderer. Registry roles currently cover workspace, Docs, Code, Presenter and Audience; **Diagrams is not an admitted native role**. The baseline remains frozen; future changes belong to desktop adapters and dedicated entrypoints.

The independently authored [fresh native flow audit](../../desktop/reviews/2026-10-03-home-native-diagrams-flow-audit.md) inspected ten stable captures of the actual development application. It confirms direct entry into a starter diagram, inconsistent module navigation and a Desktop dialog that mixes project/Lock actions with maintenance. Useful Docs/Code empty states should be retained. The first transient capture and original observer failure are preserved; the capture helper completed its output but exited 1 after its lingering PTY was stopped. This is visual audit evidence, not a functional test PASS. Physical multi-monitor, light theme, 200% zoom and native editor behavior were not qualified by that audit. Older reports provide context only.

## Recommended direction and alternatives

**Home plus one consistent top context bar** is the recommended direction. Home provides discovery and resumption; the compact bar keeps project identity, the current module and shared actions available during work. Contextual editing controls stay inside their module. This preserves canvas space and avoids a second navigation system in Docs or Code.

A persistent expanded sidebar would offer more visible destinations but consume width needed by source/map splits and diagrams. A command-palette-only application would be quiet but would retain the discovery problem the user describes. A compact optional sidebar can be reconsidered after the topbar is tested; neither alternative is needed to deliver Home.

## Home structure

1. A modest SIREN identity and current project selector, using the existing theme and typography.
2. One prominent **Continue work** card: project name, module, selected document/source/diagram and genuine saved/draft/recovery status. No invented timestamp or success badge.
3. A short recent-project list with explicit **Open / import** and **Create project** actions. Missing, damaged and read-only projects are distinguished; damaged originals are preserved.
4. Four restrained task entries: **Diagrams**, **Docs**, **Code**, **Present**, with one sentence explaining their purpose. A selected project supplies context; an empty state asks the user to choose/create a project rather than silently creating or overwriting one.
5. Settings, Help and Lock as secondary common actions. Signed-update checks remain in Settings. Recovery appears prominently when relevant, with details under disclosure.

The opening animation plays according to the existing lifecycle. Returning Home never replays it. PIN and locked backgrounds use only synthetic illustrations; real recent-project names, source text and screenshots appear only after native unlock. Reduced-motion mode avoids mandatory animation delays.

## Shared and contextual controls

| Area | Keep visible | Put in contextual disclosure |
| --- | --- | --- |
| Common topbar | Home, project identity/selector, current module/navigation, honest save state, Find, window shelf, Settings/Lock | Recovery details, update/download status, diagnostic export, less frequent project operations |
| Diagrams | Selected diagram, Build/Mermaid including Guided, canvas tools, undo/redo, focused export/present entry | Templates, detailed styling/layout, advanced renderer settings and export formats |
| Docs | Document list, selected document, writing/formatting, source links | Governance, release/provenance/reference fields and optional knowledge metadata |
| Code | Source tabs/explorer, editor/search, structure/explanation, source-save state | Parser/theme/wrap details, comparison controls and advanced analysis settings |
| Present | Selected deck/slide, playback/navigation, presenter/audience actions | Authored appearance, timing and sequence settings; notes never enter Audience payloads |

Keep one route to global project actions. Remove redundant navigation only after its replacement works by pointer, keyboard and command search. Do not remove Guided/Mermaid, vector export, Code return paths or native window restoration merely to make a screenshot cleaner. Minimized views belong in one named window shelf, not competing floating pills.

## Continue work: durable identity, not another workspace copy

Store a small, separately validated UI location: project ID, module, selected entity IDs, immutable source version/hash when applicable, cursor/scroll location and versioned window-layout metadata. It contains no source text, PIN, account tokens, API keys or entire workspace bags. Navigation preferences do not advance a project's content revision or create recovery checkpoints by themselves.

Native authority revalidates the project, source/entity and current permissions before opening anything. Missing documents, collected source versions or unavailable displays fall back to the project overview with an understandable reason. A dirty private draft is restored through verified recovery identity, not overwritten by the current saved source. Merely returning Home does not discard, save-to-Docs, stop Terminal or destroy work.

Project selection, Quit, Lock and native detachment consume the approved coordinator and dirty-view barriers. Continue cannot bypass a failed flush or safety read-only state. Reopening old windows uses fresh grants after unlock; old window/frame/epoch authority is never revived. Physical mixed-DPI/monitor behavior remains a separate qualification.

## Startup and scalability boundary

A cosmetic overlay above an eagerly initialized legacy diagram workspace would still load/render the whole project and would not solve entry latency. Prefer a lightweight workspace entry/router with metadata-only Home bootstrap. Load the chosen module lazily and request only its relevant sources/entities. Keep one native domain owner rather than instantiating independent full legacy project copies in each window.

This changes startup/router and registry entry assumptions, so it needs explicit interface work and tests alongside the source/native-workspace plans. The exact split between a new Home entry and a minimal workspace router will be decided from the fresh audit and current bootstrap dependencies; this proposal does not silently admit a new URL or role.

## Diagrams on other monitors

Add a dedicated native Diagram view backed by a verified diagram reference. Its editable Build/Mermaid/Guided controls and preview share the native diagram domain owner. Apply diagram-specific typed intents with revision checks; never save a stale full project envelope from a satellite. Minimize/maximize/move/resize use actual Windows titlebar behavior. A diagram can attach back without changing its content or private edit identity.

The view receives only required diagram state, not all Docs/source/PIN data. Lock covers and drains it before revoking/destroying the window, just like other data views. The selected native role/URL, protocol/preload/package allowlists, domain grants, keyboard routing, window shelf and recovery must all be updated together. Opening an extra full legacy application window is not a substitute for this boundary.

## Proposed delivery and acceptance

1. Finish source-backed editor qualification and shared source/domain contracts already underway.
2. Use the fresh UX audit to freeze the Home/context-bar design and a focused implementation plan.
3. Implement the lightweight entry/router, metadata-only project list and resumable-location persistence; test initial entry, empty/missing/read-only/recovered states and unchanged content revisions.
4. Integrate common navigation/window shelf with coordinated dirty-view transitions; verify returning from every module without losing private text or stealing editor shortcuts.
5. Add native Diagrams through the same source/domain-owner pattern, then test simultaneous Diagram/Docs/Code/Present, Save/Lock/Quit/crash/reattach and actual package identities.

Acceptance includes fresh light/dark screenshots at declared desktop sizes, keyboard/focus and 200% zoom checks, reduced-motion entry, Find navigation to the actual entity, exact source/diagram/doc bytes after transitions, no application flash before PIN, and measured startup/memory rather than cosmetic-only claims. Physical multi-monitor tests are named separately when unavailable. No main merge or public release is implied.
