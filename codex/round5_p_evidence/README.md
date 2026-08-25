# Round 5 · Job P · independent read-only probe

Base: `FROZEN_1_66_0.html`, SHA-256
`B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`.

## Corrected favicon diagnosis

The shipped inline SVG is not an all-square predecessor. It contains one square,
one circle and one diamond and its geometry exactly matches
`05_siren_app_icon_light.svg` after the source asset's intrinsic width and height
attributes are removed.

It nevertheless does not decode. Its hexadecimal colours contain unescaped `#`
characters inside the data URL. Chromium treats the first one as the URL fragment
delimiter; the fragment is 922 characters and the image data before it is an
incomplete SVG. `Image.decode()` rejects it and reports a natural size of 0 × 0.

`brand/ico/favicon.ico` is the canonical fallback. Its 16, 32, 48, 64 and 256 px
PNG frames match the corresponding official `05_siren_app_icon_light` PNGs byte
for byte.

## Adaptive favicon measurement

`probe_favicon.mjs` loads the untouched real app through localhost, replaces only
the live DOM favicon link, and rasterises a fully percent-encoded adaptive SVG at
16 × 16 under Chromium light and dark colour schemes. The SVG uses the exact
`07_siren_favicon_light.svg` geometry with CSS colour variables and an internal
`prefers-color-scheme: dark` rule.

Results are in `favicon-probe-report.json`:

- the SVG is 999 bytes before encoding and its data URL is 1,540 characters;
- it decodes to 64 × 64 in both schemes under the application's existing CSP;
- each 16 px raster has total channel difference 0 from the corresponding official
  07-light or 08-dark SVG raster;
- no page exception, console warning or console error was observed.

The screenshots show the native 16 px image and the same 16 × 16 raster enlarged
without smoothing. The three-line silhouette is legible; the individual terminal
shapes merge at that size, matching the brand guide's warning.

WebKit is not installed in this environment, so Safari execution is deliberately
not claimed. The proposed compatibility stack is the official ICO first, adaptive
SVG second, letting browsers that reject SVG favicons retain the ICO.

## Proposed application-window title policy

Specific content comes first:

- one diagram: `<diagram> — <workspace> — SIREN`;
- several diagrams, single view: `<diagram> · <index> of <total> — <workspace> — SIREN`;
- all-previews board: `All <total> diagrams — <workspace> — SIREN`;
- Docs: `<document title | reference | Untitled document> — Docs — <workspace> — SIREN`;
- solo presentation: `<diagram> — Present — <workspace> — SIREN`;
- presentation map: `<current view | Map> — Present map — <workspace> — SIREN`;
- deck authoring: `<workspace> — Deck builder — SIREN`;
- truly blank/fallback state: `Untitled diagram — <workspace> — SIREN`.

The shipped first boot already gives the visible diagram the generated name
`Diagram 1`; the tab should repeat that visible identity rather than call the same
object untitled. `Untitled diagram` is the defensive fallback for a genuinely empty
or legacy name.

Use a custom `fileBaseName` as the workspace label, displaying underscores as
spaces. While that value is still the generic default, use the local HTML basename
when meaningful so live, release and prototype copies remain distinguishable;
otherwise use `v<APP_VERSION>`.

Append ` •` to the primary label while a local save is pending and ` ⚠` while a
save is failed or paused. Remove it after a confirmed save. This keeps the useful
prefix first while still surfacing unsaved state.

## Minimal non-protected seam

Add the title computation and a narrow observer immediately before the unique
`function scheduleSave()` anchor. Initialise it at the unique pair
`applyMultiPreviewMode(state.multiPreview, false);` / `bindEvents();`, and call its
save-state setter at the start of the unique `function setSaveState(mode, reason)`.

Observe only the cached nodes that can change identity: hidden attributes on Docs,
Present, Map, Build, multi-preview and the Docs inner pane; Docs' editor label; and
text changes on the active diagram, diagram count, presentation title and map view
name. Filter one document-level input listener to `wpTitle` and `fileBaseName`.
Do not observe the body or preview subtree and do not edit protected mode functions.

Recommended head metadata: official ICO data URL, the tested adaptive SVG data URL,
an official 256 px app-icon PNG data URL for `apple-touch-icon`, and
`theme-color="#071B33"`. Keep CSP unchanged.
