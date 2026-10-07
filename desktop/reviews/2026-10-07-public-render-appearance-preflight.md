# Public render appearance — independent static preflight

Author: /root/catalogue_view. Scope: delegated read-only analysis. **This is not a runtime, packaged, or release approval.** No application module, test, GUI, build, or downloaded program was executed. Only source text and file identities were read; the two files of this report are the only writes.

The original source was captured at 2026-10-07T12:30:59.429Z. Rehash at 2026-10-07T12:38:17.027Z detected owner implementation changes in src/ui/diagram/style.js, src/ui/diagram/vector.js, src/ui/presentation/render.js, build/diagram-style.mjs. Findings below belong to the captured pre-repair bytes, whose hashes are retained in the JSON. They do not evaluate the newly edited versions. The Presenter controller and preload were read and captured separately at the latter time.

## Concrete losses

**AP1 / P2 — named graph palettes collapse to light/dark.** shared/shell.js keeps the selected named ID in dataset/CSS and siren-appearance, but assigns theme.mode to the hidden diagramTheme field. Diagram preview then supplies dark/default to Mermaid; vector utility does the same. Consequently preview itself does not yet provide the full named graph palette. It would be misleading to describe this solely as an export-versus-correct-preview defect. The frozen baseline has 39 graph presets, separate from the ten chrome tokens extracted by build/appearance.mjs.

**AP2 / P2 — Present ignores forced native mode.** presentation/render.js:29 reads matchMedia in its hidden utility, independent of the SIREN preference. Main passes no resolved appearance in that job. A forced light application on a dark OS can therefore render dark public slides. Diagram SVG export already transports resolved light/dark from the visible Diagram controller, so this particular mode transport loss is not present in the SVG path.

**AP3 / P2 — separate hardcoded surfaces.** Vector title and background, presentation cards and section headings, and preview viewport use different fixed or chrome colours. A shared Mermaid fallback alone will not align them. The viewport currently uses --siren-panel, whereas the legacy graph preset has its own canvasBg. Explicit source background must remain protected rather than being covered by an unconditional native rectangle.

**AP4 / P2 — cached current presentation does not update.** presentation/window.js has no siren-appearance listener. Resolving main appearance per job fixes later navigations but does not refresh the current Presenter/Audience frame on a theme change.

## Compatible contract and repair

Existing native appearance is schema 1 with one accepted theme ID or system, bounded to 1 KiB on disk. There are 39 named IDs. Main IPC accepts only the finite request, checks registered role/lease and native Lock state, and never grants Audience the shell appearance API. Appearance is an application preference, not diagram source, deck version, or project content.

The owner-proposed src/appearance/render.mjs is an appropriate minimal shared contract: exact graph presets and mode, a finite {theme,mode} descriptor, and CSS-safe colours. Resolve store plus nativeTheme in main, and snapshot once per private rendering job. Preview can use the accepted named dataset ID. Inject the graph fallback into the existing Style.prepare path used by both renderer utilities. Use the same capsule for canvas, title, section and card fallback surfaces; preserve layout configuration as a separate concern.

Keep the original configureMermaidSource implementation. Mermaid owns frontmatter/init parsing. Explicit source theme removes native fallback themeVariables; variable deltas and semantic node/edge styles retain per-property ownership. Do not replace this with regex parsing, lock theme keys as secure configuration, copy the legacy buildMermaidConfig wholesale, or apply a native CSS recolour after the source-aware helper. Source fonts and explicit colours/themes/backgrounds must continue to win.

## Exact minimal Presenter refresh hook

Add one presenter-only siren-appearance listener. Validate the finite descriptor and deduplicate by **theme plus mode**; same-mode named changes and system mode changes both matter. The event requests refresh, but main remains the authority for the rendering descriptor.

Keep one pending revision/dirty bit, not a queue. When idle, clear it before calling existing navigate(state.slideId), allowing the current sequence increment and cancellation contract to perform the work. Resolve state.slideId at drain time. A user navigation that completes while a theme is pending should refresh the newly selected slide, not a captured earlier slide.

Drain after every owner of busy: navigate, refreshDeck, openAudience and editDeck, and after connecting becomes null in connect.finally. Do not drain while connecting. Before initial navigation consume any earlier pending change because that initial job already captures current main appearance; retain changes arriving during the job for one later attempt. Guard every drain by current serial, covered, readiness/state and pending revision.

onPrepare clears pending and increments the existing serial; it must not schedule new work. onResume reconnect already performs a fresh initial navigation. Remove the event listener on pagehide. A failed refresh consumes its one attempt; no recursive automatic retry is appropriate. A new accepted appearance event may request another attempt. Keep project bytes, deckVersion, notes and Audience IPC unchanged.

Idle coalescing gives eventual parity, but can allow a previously started old-palette frame to publish before the replacement. If the required guarantee is no old-palette publication after acceptance, retire that render using existing sequence/cancellation scope. Do not infer that stricter property from a dirty bit alone.

## Verification to require after implementation

The inspected existing harnesses prove narrower things. workspace-appearance exercises chrome/persistence/Lock, not utility colours. diagram-vector-app checks actual imported node colour and sidecar protection but only light/dark. presentation-render-app checks image dimensions/labels, cancellation and other public boundaries; its imported-colour case does **not** assert computed fill or a pixel colour. The layout harness checks semantic geometry and some explicit source styles, not the named-theme/opposite-OS matrix.

Require pure finite-table tests for all 39 presets and descriptor rejection, then actual runtime witnesses for same-mode pairs (KPMG/Paper and Matrix/Navy), forced mode opposite observed OS mode, and computed semantic colours/background/title across preview, SVG and Present. Compare semantic values rather than raw raster bytes. Test imported style/classDef, explicit frontmatter/init theme/themeVariables, source background and font-only declarations; uncoloured nodes should inherit the selected fallback. Assert Presenter refresh changes public image sequence while deckVersion/project hashes remain unchanged, coalesces busy events, and ignores post-Lock callbacks.

Use isolated Electron nativeTheme configuration for the mode witness rather than modifying Windows globally. Record actual families and presets executed; table coverage of 39 presets does not imply 39 actual runtime renderings. Preserve strict SVG sanitization, resource/CSP ownership checks, cancellation, utility destruction and private/public separation. Requalify generated CSP and copied package identities after repair. Older copied-package evidence remains evidence for its earlier captured snapshot.

