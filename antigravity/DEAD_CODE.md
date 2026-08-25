# Dead Code Inventory: `FROZEN_1_66_0.html`

**Base file evaluated:** `C:\Claude\SIREN\codex\FROZEN_1_66_0.html` (8,438,995 bytes, SHA-256 `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`)
**Exclusions:** Vendored Mermaid 11.16.1 bundle excluded (from `<script id="embedded-mermaid">` near line 14582 up to the application script start at line 21415).

---

## 1. UI that can never be seen
Elements present in the markup that no state makes visible. 

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| `#diagramTypeChip` (Type indicator chip) | HTML: ~18989<br>JS: `updateDiagramTypeChip()` | **Runtime & Source:** HTML contains `hidden` and `aria-hidden="true"`. JavaScript actively updates its `dataset.state` and `title` on every render, but no code ever calls `hidden = false` or `removeAttribute('hidden')`. It always measures 0x0 with a null `offsetParent`. | Would display the current diagram type (e.g., "Flowchart") and provide tooltip descriptions of available features. |
| `#direction` ("Advanced direction" select) | HTML: ~9568<br>JS: `handleDirectionChange()` | **Runtime & Source:** The `<select>` element itself is wired up correctly and manipulated in JS. However, its immediate parent is `<div hidden>`. The parent is never unhidden in any state (0x0, `offsetParent` is null). | Would allow users to manually pick diagram flow direction (TD, LR, etc.) from a dropdown in the Style card. |
| `#directionHint` (Helper text for direction) | HTML: ~9574 | **Runtime & Source:** Resides inside the same permanently `<div hidden>` parent as `#direction`. | Would explain the direction control's purpose or state "Not available for [type]" to the user. |

## 2. Controls that are visible but can never act
Buttons or fields that are rendered to the screen but are structurally prevented from functioning.

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| *None definitively proven* | N/A | I was unable to definitively prove any visible control is permanently inert across all 19 diagram types and modes without exhaustive runtime coverage. | N/A |

## 3. State that is stored and never used
Data structures that are written, sanitized, and exported, but ignored by the active rendering logic.

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| `layout.alignment` | JS: `parseSource()`, `effectiveLayout()` | **Runtime & Source:** Parsed from user input and written to the Excel export. However, in the `renderDiagram` execution path for Mermaid, it is never passed to Mermaid's configuration (unlike `density` which becomes `padding`, or `routing` which becomes `curve`). It is only consumed by `layoutFallbackNodes()` which is the offline fallback renderer. | Would align node groups (Start/Center/End) in the live Mermaid visualization. |

## 4. Functions never reached
Functions declared in the IIFE but seemingly never invoked.

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| *None definitively proven* | N/A | Given the heavy reliance on string dispatch and UI delegation, static analysis is insufficient to prove a function is completely dead, and my automated Playwright coverage timed out when exercising complex states. | N/A |

## 5. CSS that matches nothing
Style selectors that exist in the payload but target no elements.

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| *None definitively proven* | N/A | Proving a CSS rule is dead requires capturing all dynamic DOM states (e.g., all 19 diagram types, print media queries, presentation overlays). My automated CSS coverage harness could not successfully snapshot every state to prove permanent non-matching. | N/A |

## 6. Two things doing one job
Redundant controls or logic paths where one is unused or unreachable.

| What | Where (Line + Function) | How it was proved dead | Expected behaviour if alive |
| :--- | :--- | :--- | :--- |
| Flow direction controls | HTML: ~9568 (Style card)<br>JS: `handleDirectionChange()` | **Source & Runtime:** The exact same state (`model.direction`) is controlled by three distinct UI elements: 1. The main toolbar visual direction buttons. 2. `#visualDirection` in the builder panel. 3. `#direction` in the Style card. The third one (`#direction`) is trapped inside the hidden div, making it an unreachable duplicate of the first two. | A single, unified source of truth for flow direction accessible to the user. |

---

### Suspected, not proven

The following items are highly suspected to be dead or unused, but could not be definitively proven with the current runtime tooling:

*   **Various CSS Rules:** The application contains hundreds of CSS rules. It is highly likely that rules targeting specific sub-states of diagram types (e.g., deep `.cluster` styling for deprecated diagram types) are dead, but proving this requires exhaustive mapping of Mermaid's SVG output.
*   **Edge Waypoint Logic:** Variables tracking `edgeWaypointMode` and functions like `startEdgeWaypointMode` are present. While `Waypoints` are written to the `.siren` export and loaded, Mermaid's standard rendering does not natively support custom waypoint injection. SIREN appears to manually rewrite the SVG `<path d="...">` via `routePathD` after Mermaid renders. Whether this path is perfectly reachable across all browser environments without breaking remains suspected.
*   **Invisible Modal Dialogs (`#reviewDialog`, `#rulesDialog`)**: These exist in the DOM as `<dialog>` elements and are frequently hidden. Without triggering the exact specific conditions (e.g. entering a read-only document review state), they appear dead. They are not listed in Table 1 because it is suspected they *can* be seen in specific states I could not force.

### What looked dead and is not

*   **`metadata.frequency` / `metadata.system` / `metadata.evidence`:** At first glance, these fields appear to be "state that is stored and never used" because they are not passed to Mermaid. However, runtime analysis shows they are actively consumed by the Application UI. They populate the `MAP_CHIP_FIELDS` in the Presentation map, drive the filters in `el.filterPanelBody`, and are used extensively in the Workpaper (e.g., `wp-image-evidence`). They do not draw *inside* the diagram, but they absolutely act on the application layer.
*   **`layout.routing`:** Might look dead because Mermaid does not take a `routing` parameter. However, it is dynamically translated into the `curve` parameter (e.g. 'orthogonal' -> 'step') and actively passed to the Mermaid configuration.
*   **`#renderStateChip` / `#diskFileChip`:** These chips have the `hidden` attribute in their HTML declaration, making them look permanently dead like `#diagramTypeChip`. However, unlike the type chip, these *are* actively unhidden by JavaScript manipulating their `hidden` property during file operations and rendering, meaning they are fully alive.
