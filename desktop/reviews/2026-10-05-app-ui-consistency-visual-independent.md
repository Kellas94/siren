# SIREN UI consistency: independent fresh-image addendum

Author: /root/workspace_surface_review. 2026-10-05T20:45:04.875Z. This new report supplements, without modifying, 2026-10-05-app-ui-consistency-independent.md (SHA256 d49bd736d79c12f1b7d6c29a1702fdeb1885a9dc29df272a6637866f980f17b8).

I actually viewed six root-owned PNGs through view_image, then independently recaptured each PNG and matched its SHA256 to the supplied result.json. I did not run Electron or capture these images. All six show 1104x715 content surfaces. This qualifies visual inspection of those six frames only, not all current controls, functional flows, accessibility or release. Original capture result SHA256: 5a102e76e9b06f86f97515e47f136e30fa7df224b45769d42fdd85b8627463ab.

## Visible observations

Home light has a widely spaced SIREN identity/context header, white rounded cards, cool blue primary action and a long page with a scrollbar. Detached Docs/Diagram instead have compact left entity headings and a dense right command row with no visible Home/project context control. Docs repeats the document title as a larger article heading; its content has generous left outline/article spacing. Diagram has a clear source/preview split and a second preview-tool row. These frames corroborate the different shell hierarchy and density described by static source.

Code dark and Presenter dark use a near-black outer shell; Code's editor toolbar/gutter has a separate slate palette, and its heading shows a generated source identifier. Presenter exposes playback/display/Audience/fullscreen controls and visibly separated PRIVATE PRESENTER NOTES. That distinction should remain after common shell styling. No Audience screenshot was viewed here, so I make no visual Audience privacy claim.

Legacy has the recognizable SIREN wordmark/version, dark navy layering, bordered command bands, Find/theme/Export, Docs/Code/Present navigation and a bottom Home/Windows/Desktop bar. Its captured mode is READONLY and its diagram zoom is 9%; preview nodes are tiny. This is a limited degraded reference for chrome/theme, not a full editor-state visual audit or a valid comparison of diagram zoom/layout. A common token layer can align Home and detached chrome with SIREN while leaving different role content and public slide rendering intact.

These mixed light/dark frames do not prove theme propagation or visual equivalence under the same selected named theme. No narrow-window/200%-zoom captures or pointer/focus exercise was inspected. Existing static compact-layout risks therefore remain unqualified visually.

## Brief shelf replay diagnosis

Read-only source inspection gives a concrete timing path: registry preparation/transition fences refuse surface access; shelf.js maps refused getShelf to an empty item list, paints the bar hidden and removes native-shelf-open. Home onResume restores Home content and body.inert but does not request immediate sirenNativeShelf.refresh(); the existing 1200ms poll repopulates the shelf after native authority becomes current. Thus !document.body.inert after Close is not a shelf-ready predicate. The new Diagram probe should wait for the exact registered reader tab to reappear and select it, then assert actual native drawn ownership before Refresh.

This is an inspected timing explanation, not an independent reproduction or a conclusion that every native failure is merely a fixture problem. If getShelf remains refused/empty after the barrier and repeated polls, inspect the actual primary grant/roster/seal result rather than extending deadlines or accepting an absent reader. The fresh Home screenshot has no shelf but is a fresh-start scene, so it cannot prove a post-Close replay defect. No source/helper changes were made.

## Inspected image identities

| Image | Bytes | SHA256 |
| --- | ---: | --- |
| 01-home-light.png | 68082 | 4055acbbcf1abe1791a6a420d5ba62500415e64a5cf8d02fe11ab45603293ee8 |
| 02-docs-light.png | 22629 | 0192b4905fa6172eb1963020ecd8c9daeda16e0cc351744a46e2aa102ceef4b7 |
| 02-diagram-light.png | 43764 | 3af02b1830b0cc59727f663f55c912fbfa4dd7900201c3a8913bf85564862159 |
| 02-code-dark.png | 29019 | c860e0ed03423affe8c82c8244195c0763981a1c36673d81500779d65495ee6b |
| 02-presenter-dark.png | 48429 | ff7e412ed3d85c61f0210a2096c589699ffd546b4570eb8da9e9b5a259c8bea2 |
| 03-legacy.png | 51421 | 531f6f2bd6e00101361eea3ca3f8f35501d0638d542a93b39346edc913dba453 |
