# C7 dead code and unreachable state — final inventory

Status: **verified and applied**. Revalidated after C6 against the baseline
`SIREN_v1.35.0_for_codex.html` at SHA-256
`7697D1AC10934EF9179CDD2A70D022B684AC7E910F559848DE1B557C44B93A70`
(3,546,775 bytes), verified on a disposable copy, then applied to produce the
C7-only checkpoint `578C1392DC038519F4055D347C72C28296936060EFE8E411DFA7078B136C0A45`.
The patch deliberately fails if a new caller or reference has appeared.

## Method and reachability boundary

- Scanned all 1,429 named `function` declarations, all 850 literal HTML ids, and
  all 1,067 class-selector tokens in the main stylesheet.
- Counts below are case-sensitive, identifier-bounded counts over the complete
  single-file application, not `rg` substring guesses. HTML attributes, string
  literals and generated-export templates are therefore included.
- The four function candidates live inside the application's closed IIFE. The
  full-file scan also found no `eval`, `new Function`, inline `on...=` handler,
  or `setAttribute('on...')` escape hatch that could resolve a declaration-only
  lexical name indirectly.
- For CSS, “outside 0” means zero exact token occurrences anywhere outside the
  first/main `<style>` element, including HTML, JavaScript, export templates and
  later embedded styles.
- Present, Map, the card editor, presenter/audience surfaces and ambient code
  were excluded before triage. Scanner hits in those territories were neither
  inspected for removal nor included in the candidate.

## Confirmed removal candidates

### 1. Unreachable named functions

| Searchable declaration | Whole-file name tokens | Reachability evidence | Replacement path |
|---|---:|---|---|
| `function nextDiagramName()` | 1 | Declaration only. `addDiagram()` now computes a position-based `Diagram N` inline; duplicate flows call `uniqueDiagramName(...)`. | Delete the obsolete helper. |
| `function agentOperationalCanon(doc)` | 1 | Declaration only. Release capture computes parts once and calls `agentOperationalCanonFromParts(parts)` directly. | Delete the wrapper; retain the `FromParts` implementation. |
| `function buildAgentReleaseSnapshot(doc)` | 1 | Declaration only. The live release path calls `buildAgentReleaseSnapshotFromParts(parts)` directly. | Delete the wrapper; retain the async `FromParts` implementation. |
| `function printActiveWorkpaperPdf()` | 1 | Declaration only. `exportActiveWorkpaperAs(format)` handles `pdf` by calling `printWorkpapersToPdf([doc])`; batch export has its own live call. | Delete the superseded wrapper. |

Post-C5 revalidation confirmed that C4's provenance work and C5's document-PPTX
writer did not add a caller to either agent wrapper. The patch still asserts a
token count of exactly one immediately before each deletion. A count of two is a
hard stop, not permission to “update” the patch.

### 2. `wpNewType`: an absent element and unreachable state

Searchable anchors: `'wpNewType','wpReviewButton'`,
`const startNewWorkpaper = (pickedType) =>`, and
`value => { if (el.wpNewType)`.

- Literal `id="wpNewType"` declarations: **0**.
- Element-cache entries: **1**.
- Whole-file exact tokens: **6**, all confined to the cache, its explanatory
  comment and two defensive branches.
- Comparing the complete `cacheElements()` id list with literal HTML ids found
  only this missing id in owned territory. The other missing-cache results were
  Map ids and were excluded.

There is also a concrete behavior trap in the dead fallback. The empty-state
button registers `startNewWorkpaper` directly as its click listener, so
`pickedType` is a truthy `Event`. `normalizeWorkpaperType(Event)` returns
`narrative`, which means “Create the first workpaper” creates a Narrative even
though the fallback/default is documented as Agent spec. The candidate removes
the cache and branches, accepts menu values only when `typeof pickedType ===
'string'`, and otherwise passes `agent-spec`. This small type guard is required
to remove the unreachable state without preserving the click-Event bug.

### 3. Literal ids with no internal consumer

Each token below occurs exactly once in the complete file: its own `id="..."`
attribute. Each has zero element-cache, CSS, script, ARIA/`for`, fragment or
export references. The candidate removes only the id attribute; it does not
remove the element or its live class names.

| Literal id | Searchable element context |
|---|---|
| `editorScroll` | `<div class="pane-scroll" id="editorScroll">` |
| `advancedToolsCard` | `<details class="card advanced-tools-card" id="advancedToolsCard">` |
| `subflowHint` | `<p class="field-hint" id="subflowHint">` |
| `diagramStage` | `<div class="diagram-stage" id="diagramStage">` |
| `inspectorDocsPanel` | `<details class="inspector-comments" id="inspectorDocsPanel">` |
| `exportWorkspaceGroup` | `<details class="export-group" id="exportWorkspaceGroup">` |

Reachability caveat: a single-file scan cannot reveal selectors used by external
automation or a saved `#fragment` bookmark. A project-wide recheck found one
real example: `qa/c5_export_scoped_docs_ui.js` opens `#exportDataGroup` before
driving the scoped PPTX download. `exportDataGroup` is therefore retained and
classified as externally reached, even though its token occurs only once inside
the application file. No external caller/reference was found for the seven ids
remaining above. If DOM-selector compatibility beyond the checked project files
is a product contract, retain all seven harmless ids as well.

### 4. Obsolete editor/Docs CSS naming layer

Every token in these groups has **0 occurrences outside the main stylesheet**.
The number in parentheses is its total occurrence count inside that stylesheet.
The candidate deletes only the exact rules containing these tokens.

- Old workflow/inspector names: `advanced-tools-grid` (1),
  `advanced-tool-card` (3), `compact-grid` (1), `tool-actions` (1),
  `subflow-list-note` (1), `inspector-extra` (2), and
  `inspector-extra-body` (1). Live markup instead uses names such as
  `advanced-tools-body`, `advanced-tool-grid`, `metadata-panel`, and
  `inspector-comments`.
- Superseded comment-item names: `comment-item` (3), `comment-item-head` (3),
  `comment-item-actions` (1), `comment-compose` (2), and
  `comment-badge-html` (1). The live renderer/markup uses `comment-card`,
  `comment-composer`, and the SVG `t-comment-badge` path.
- Removed comments-manager and semantic-diff surface: `comments-toolbar-button`
  (1), `comments-manager-toolbar` (2), `comments-manager-list` (1),
  `comments-manager-row` (4), `semantic-diff` (1), `semantic-diff-section` (2),
  `semantic-diff-list` (1), and `semantic-diff-row` (4).
- Superseded waypoint names: `edge-waypoint-list` (1), `edge-waypoint-row` (3),
  `t-waypoint-layer` (1), and `t-waypoint-handle` (3). The live editor builds
  `waypoint-list` / `waypoint-row`; no code creates either `t-waypoint-*` class.
- Typo duplicate: `read-only-banner` (2). The actual element and live rules use
  `readonly-banner` (without the extra hyphen).

These rules are grouped under the searchable comment
`/* v17 workflow extensions ------------------------------------------------ */`.
No selector beginning `present-` or `map-`, no theme scene selector, and no
ambient selector is part of the candidate.

## Flagged, not removed

- A wider CSS scan found selector-only generic/theme hooks including
  `modal-sheet`, `segment-button`, `preview-shell`, `tab-button`,
  `legend-shape-btn`, and `desktop-only`. They also have no current outside-style
  token, but they sit in shared theme selector lists and could be intentional
  extension hooks. The value of deleting individual comma-list clauses is tiny,
  so they stay.
- Several low-count ids are SVG paint/filter ids or accessible-title/dialog ids.
  A count of two can be exactly correct (`id` plus `url(#...)`, `aria-labelledby`
  or `for`), so none were inferred dead from a low count alone.
- Functions with a declaration plus one reference were retained. One reference
  may be a real keyboard-only registration, a callback passed by name, or an
  export-only path; count two is not dead-code evidence.
- Class names that look generated (`t-*`) were retained unless the complete
  exact-token scan and the current renderer's constructed class names both
  ruled them out. String-fragment construction remains a general caveat for a
  static CSS scan.

## Patch and verification status

Candidate: `patches/C7_remove_confirmed_dead_code.py`.

- Uses exact-count anchors for every replacement.
- Adds semantic preconditions: function token must still equal 1, each unused id
  token must still equal 1, `wpNewType` must still have no real element, and
  every CSS token must still have zero use outside the main stylesheet.
- Writes to a sibling temporary file and commits with `os.replace` only after
  all assertions pass.
- Supports `--check`, which performs the complete transformation and all
  assertions in memory without writing.

Verification performed on the post-C6 baseline above:

```text
C7 dry-run passed ...; candidate removes 5751 characters
```

The application HTML hash was unchanged after the dry-run. The patch was not
applied to the main file. It was applied only to
`output/C7_final_test.html` (SHA-256
`578C1392DC038519F4055D347C72C28296936060EFE8E411DFA7078B136C0A45`),
then checked with the repository syntax checker:

```text
script blocks: 1 chars: 2731845
node --check exit 0
```

`output/playwright/c7/c7_ui_verify.js` drove that complete application over
HTTP in a fresh Chromium context. It finished with zero console errors and zero
page errors. Confirmed through the application's own UI:

- “Create the first workpaper” created `agent-spec`, not Narrative.
- Agent release capture produced an R1 draft, proving the retained `FromParts`
  canon/snapshot route remains live after wrapper deletion.
- Single-document PDF opened one `.doc-sheet`, kept the document title, and
  invoked `window.print()`.
- A node comment rendered with the live `comment-card` solid border/background.
- The connector waypoint panel retained its live `waypoint-list` grid and could
  enter and cancel waypoint mode. Committing a point is not claimed: the
  pre-existing `selectedEdgeVisiblePath()` defect found during this run is
  tracked separately and was not folded into C7.
- Advanced settings remained open and laid out at 462 × 737 CSS px after its
  unused id and obsolete selectors were removed.
- A copied read-only link, opened and confirmed in an independent context,
  displayed the live fixed `readonly-banner` with the expected message.
- `#exportDataGroup` remained present for `qa/c5_export_scoped_docs_ui.js`.

Six screenshots in `output/playwright/c7/` were rendered and visually inspected:
the Docs/release panel, PDF page, node comment inspector, waypoint mode, Advanced
settings, and read-only view all painted without a C7-related layout break. At
the end of the C7 subtask the main application still had SHA-256
`7697D1AC10934EF9179CDD2A70D022B684AC7E910F559848DE1B557C44B93A70`.
The parent review then applied this exact patch: the C7-only checkpoint is
`checkpoints/C7_dead_code_verified.html`, SHA-256
`578C1392DC038519F4055D347C72C28296936060EFE8E411DFA7078B136C0A45`.
`syncheck.py` again returned `node --check exit 0`; a reapplication stopped at
the first `wpNewType` guard and left that hash unchanged. The later A13 editor
waypoint patch is independent of this inventory.
