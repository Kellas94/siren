# Diagram layout parity: static review

Author: `/root/catalogue_view`. Scope: static source comparison and recommendations only. **No tests, build, GUI or runtime approval.**

Inspected source commit: `fee26e64ff165375ed7e9a4cff4dfb8b0c7e34f1`; metadata HEAD at inspection: `0b213f0f2556ef45c2dd962bb64c9f98b37b7ca2`. Parent identified CI 37609861403 as active; this review did not fetch, alter or qualify it. Input hashes and exact non-executed library excerpts are in the companion JSON.

## Principal result

The Standard/ELK control from the HTML is missing from native Diagram. More importantly, **the frozen Mermaid bundle defaults to ELK**, while the old HTML explicitly supplied Standard/dagre unless ELK was chosen. Adding a selector that silently defaults existing native diagrams to Standard would change their configured geometry.

The native preview and saved SVG share styling logic, and Present reuses the SVG renderer. Their configuration and finite data projections still need to be unified before restoring layout controls.

## Findings

| ID | Finding | Source evidence | Implication |
| --- | --- | --- | --- |
| LAYOUT-S01 | Native engine selector and editable preference missing | R78:21870–21876,26922,39823–39838; native window/style view; diagram.js:80–89; vector.js:32–37 | Old Look bar had Standard and included offline ELK, saved on change. Native render configurations omit layout. |
| LAYOUT-S02 | Current absent-layout behavior inherits ELK | R78:15668 global and state defaults; diagram.mjs:6–21; bundled fallback:16616 | Preserve absent metadata through an Auto/source choice. Configured ELK is not proof that every family uses that engine. |
| LAYOUT-S03 | Workspace engine and diagram spacing not consumed by native renderer | R78:29029–29055,36033–36134,39823–39838; style.js:8–16; draft.js:12,36–64; domain.mjs:17 | Old engine is workspace-scoped; density/spacing are per-diagram. Main preserves layout, but native render/draft does not restore those controls or use spacing metadata. |
| LAYOUT-S04 | Present projection omits layout and any new engine field | presentation-deck.mjs:10,48–51; presentation/render.js:28–40; presentation-render.mjs:9–11 | Updating vector.js alone will leave Present with missing settings. Add only a finite validated render preference to the projection. |
| LAYOUT-S05 | Named palettes become generic dark/default; Present uses system mode | shell.js:47–58; diagram.js:62–63,87,121–124; vector.js:35–37; presentation/render.js:28,36 | Chrome changes palette, diagrams do not receive its named variables. A forced application dark/light theme can disagree with hidden Present rendering. |
| LAYOUT-S06 | Old engine capability seed is historical | R78:41703–41770,41995–42000 | Use as discovery guidance; do not present it as current native effectiveness evidence. |

Legacy engine capability seed is live for **flowchart, swimlane, ishikawa, class, state, ER and requirement**. The HTML can remeasure dead pairs at idle. Neither the historical bit nor the presence of an ELK loader proves current geometry changes for a given native family.

Legacy Apply/Reset are spacing controls, not engine controls. Alignment/routing UI controls were already removed in that HTML; its comments explicitly describe them as seed-only. They should not be advertised as omitted working controls on that basis.

## Actual source precedence

This is a static interpretation of the frozen bundle, not newly executed examples:

1. Mermaid processes YAML frontmatter, then init/initialize directives. The preprocessor deep-merges directive config after frontmatter (`fl(s.config,l.directive)`), so the later directive wins the same conflicting property.
2. Source configuration is added after initialize/site configuration. Mermaid removes secured keys; native secure lists do **not** include layout.
3. For theme/look/layout, the bundle resolves a diagram-scoped key before the global key within the selected source layer. Source settings precede initialize/UI settings, which precede defaults.
4. This is not a flat last-write rule. A frontmatter `config.flowchart.layout` and directive global `layout` are different paths; the scoped source value can win.
5. Bundled default global layout and state layout are ELK. A renderer family using registered-layout resolution may instead fall back to dagre for an unknown/unregistered request. Requested configuration alone does not establish the engine that produced the drawing.

The JSON records excerpts for the actual bundled default, source merge, deep merge, scope/layer resolution and registered-loader fallback. No external documentation or newer Mermaid version was substituted.

## Recommended implementation boundary

Restore one compact **Layout** control beside preview controls or inside a single Look disclosure. Offer **Auto/source**, **Standard**, **ELK**. Keep absent metadata unchanged, and explain a source-owned layout instead of silently replacing it. Only show an effectiveness claim after that family/engine pair is qualified.

Use one finite render-policy helper for preview, SVG and Present. Choose one diagram-local scalar engine contract; validate it in renderer draft, history/reset, main typed patch and import paths, and include it in the finite Present projection. Do not hide a new arbitrary field inside the existing layout object without changing its sanitizer. Preserve the legacy workspace preference; avoid automatic bulk migration.

Keep the existing `configureMermaidSource` colour and font provenance path. Explicit source themes, themeVariables, inline styles and classDef declarations retain precedence. Changing layout must not strip YAML/init, rewrite exact source or disable those protections. Theme defaults should fill only unspecified appearance values.

Named theme rendering also needs a finite resolved palette/mode policy. Main can resolve the actual application preference and provide the same values to export and Present; the hidden Present renderer should not independently choose the OS mode when SIREN has a forced preference. Keep saved version/hash checks, public/private data boundaries and offline CSP.

## Qualification still required after implementation

Test conflicting YAML/init global and scoped values; no-source Auto/Standard/ELK; the historical seven families and unsupported controls; dense nested diagrams; actual engine effectiveness; Save/history/Lock and pending-field interactions; exact saved SVG/Present settings; source colours and fonts under named themes. Existing 28-source render coverage alone does not qualify all engine pairs.

No performance, geometry, colour fidelity or native UI claim is made here. Only this new review and JSON were written; this reviewer did not modify qualified product inputs.

Final readback at 10:56 UTC found concurrent changes in build/diagram-style.mjs, style.js, draft.js, domain.mjs and presentation-deck.mjs while ROOT began the approved extension. The JSON preserves both inspected and later hashes. These preflight findings describe the earlier versions and do not qualify that ongoing implementation.
