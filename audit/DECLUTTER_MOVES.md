# SIREN — what should leave the walls

**One move list, reconciled from five surface audits, re-verified against the shipping file.**

---

## 0. Provenance

| | |
|---|---|
| Source | `C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html` |
| Bytes | **3,971,254** |
| md5 | `5a5e94c8f1e33587e1f877e28eff3068` |
| sha256 | `6422575a753597b5e982ce342f2378652493b74b4521905043628de0df99aaa7` |
| Snapshot | `…/scratchpad/recon/app.html` (identical md5, re-verified at end) |
| Served on | **port 8391** — mine; none of the 13 contested ports |
| Served `Content-Length` | **3971254** = disk bytes; served body re-hashes to the same md5 |
| Live file written to | **never** |

All five surface audits measured this same byte-identical file, so their numbers and mine are directly comparable.

Boot on a fresh profile required dismissing `.tour-card` **and** a `#confirmDialog` ("Recover unsaved work?") that is not a tour and not mentioned in the brief — an agent that dismisses only the tour will measure through a modal and every control will fail its hit test.

Measurements at **1440×900** and **1280×800** via CDP, mouse parked, nothing focused. "Clickable" is always `document.elementFromPoint` at the control's own centre, never `element.click()`. Screenshots read: `recon/out/w1440/rest.png`, `recon/out/red1440/board_collapsed.png`, `recon/out/pl1440/map.png`, `recon/out/shell_after_palette_popout.png`.

---

## 1. Verification — what did not survive

I re-checked every control the five audits proposed to move. **Ten claims failed or needed downgrading. Four moves were dropped.**

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | PRESENT: `.map-tile-open` → HOVER, "current tile excepted, so exactly one pill is always legible" | **DROPPED** | At the map's opening state `.map-tile.is-route-target` is on **0 tiles** (measured; stop 1 is "The whole map", which owns no tile). The exception only fires from stop 2 (`routeTarget: 0 → 1` after one `#mapNextButton`). As specified the move leaves **zero** visible Present pills at the exact moment a client first sees the map — recreating the fault the CSS comment at line 11553 was written to fix. |
| 2 | PRESENT: "`exportSpeakerNotes` bound only at 18904" | **WRONG** | Two bindings: 18904 (`#presentExportNotesButton`) and **19037** (`#exportSpeakerNotesButton`, the "Speaker notes" button in the Export dialog, line 16116). Palette query `Speaker notes` → **found**. The move survives and is *safer* than claimed, but the stated rationale ("one home for all three exports") is wrong — there were already two homes. |
| 3 | PRESENT: "the List rendering already carries no `×`" | **WRONG** | List view has the same buttons at `opacity: 0; pointer-events: none` until `:hover`/`:focus-within` (CSS 12542–12545). The precedent for hiding them is real; the claim as written is not. |
| 4 | PRESENT: `.map-route-drop` → HOVER | **DOWNGRADED** | `tabIndex = -1` measured (line 63809), and the CSS comment at 12419 records a **deliberate prior decision** to move these *from* hover *to* visible-at-rest ("visible before the pointer arrives, and it asks first"). Reverting a documented decision is the owner's call, not an audit's. |
| 5 | SHELL: `#diagramMoreButton` → RIGHT-CLICK | **BLOCKED → STAYS** | `requestRemoveActiveDiagram()` has **exactly one call site** (line 18027, inside this button's own menu). Worse than SHELL stated: the button's palette entry is *harvested from the button itself* ("Duplicate, rename or remove this diagram"), so deleting the button deletes the palette entry too. Remove would have **zero** routes. |
| 6 | BOARD: moving folder Rename/Delete to a `⋯` "gives the verb its first second route" | **WRONG** | A JS-built `⋯` with no `id` is not harvested. Palette query `Delete folder` → **0 results** (measured). The `⋯` *is* a valid visible home (Rule 2 satisfied), but it is not a palette route. |
| 7 | DOCS: doc head wraps to two lines at 1440 | **PARTLY WRONG** | With a fresh agent spec the head is **one line** at 1440 (distinct y: 65/67/70). It wraps at **1280** (`#wpChangesButton`, `#wpReleasesButton`, `#wpDocMenuButton` at y=116, agent strip pushed 144→185). The two-lines→one benefit is **guaranteed at 1280, conditional at 1440** (needs a long title or a `(1)` change badge). |
| 8 | EDITOR: `#popOutEditorButton` → OVERFLOW | **DOWNGRADED → defer** | It is the only mover on that bar. A new `⋯` costs one control, so the move is **net zero at rest**. An overflow only pays when it absorbs ≥2 controls. |
| 9 | DOCS: `#wpFilter` → OVERFLOW | **DOWNGRADED → defer** | Same net-zero problem: no existing topbar menu to absorb it, and `#wpDocMenuButton` is document-scoped while the filter is register-scoped — the wrong home. |
| 10 | BOARD: "seven collapsed projects = seven red Delete buttons" | **CONFIRMED** | My own 6-folder seed → **6** `Delete folder` + **6** `Rename`, all in viewport, all hit-testable, at **both** 1440×900 and 1280×800. Plus the ragged Unfiled row (no actions, so its toggle stretches). |

**Dropped: 4** — the map tile pills outright, and three demoted to "defer" (pop-out, `#wpFilter`, and `#diagramMoreButton` reverted to STAYS).

### Two findings that change the shape of the whole exercise

**(a) Hidden buttons stay in the command palette, and their entries fire.**
`buildCommandRegistry` (line 25566) harvests `document.querySelectorAll('button[id]')` with **no visibility filter**, and runs `button.click()`. I proved this end-to-end: with the editor in Visual mode `#popOutEditorButton` measures **0×0**, yet the palette still lists "⧉ Pop out", and clicking that entry **opened the pop-out** (`editorPopout` → `display: grid`, `hidden: false`).

*Consequence:* **any OVERFLOW move of a labelled `button[id]` keeps its palette route automatically.** This is why Rule 2 turns out to be cheap here — see §2.

**(b) `.header-actions` is already `display: none` at ≤900px** (line 11058; measured at 820×1180: theme / guide / import / versions / export all **0×0**, `.mobile-nav` `display: grid`). **The four header moves have zero tablet impact.** They are desktop-only changes.

---

## 2. Rule 2 enforced — every second route checked live

Right-click does not exist anywhere in SIREN today: `contextmenu` **0**, `pointerType` **0**, `touchstart` **0**, `maxTouchPoints` **0**. Every right-click menu is a brand-new surface with zero installed-base expectation, so it can never be a control's only home.

I opened the palette (`#findDiagramButton`, the only pointer route) and typed each string into the running app.

| Move | Named second route | Live palette query | Holds? |
|---|---|---|---|
| `#themeMenuButton` → header ⋯ | palette + 37 curated `Theme:` | `Dark` → **`Dark⌄`** + `Theme: Dark` | yes |
| `#guideButton` → header ⋯ | palette | `Guide` → **`?Guide`** | yes |
| `#importButton` → header ⋯ | palette | `Import` → **`↥Import`** | yes |
| `#versionsButton` → header ⋯ | palette | `Restore points` → **`◷Restore points`** | yes |
| Folder `Rename` → row ⋯ | the ⋯ itself (visible, touchable) | `Delete folder` → **0 results** | yes *(menu, not palette)* |
| Folder `Delete folder` → row ⋯ | the ⋯ itself + `requestConfirmation` | `Delete folder` → **0 results** | yes *(menu, not palette)* |
| Card `Open` → GONE | thumbnail `role="button"`, `tabindex="0"`, `aria-label="Open X in the full preview"` — all measured live | n/a | yes |
| `#wpType` → `#wpDocMenuButton` | type still shown on the register row | `<select>` — never harvested | yes *(menu)* |
| `#wpChangesButton` → `#wpDocMenuButton` | palette + per-block `.wp-change-chip` | `Changes` → **`◷ Changes`** | yes |
| `#wpReleasesButton` → `#wpDocMenuButton` | palette + agent-strip `Release` chip | `Releases` → **`⛿ Releases`** | yes |
| `#mapBuildButton` → map ⋯ | `E` key + Present caret menu | `Build` → **`✎ Build`** | yes |
| `#presentKeysButton` → map ⋯ | `?` key + resting hint pill | `Keyboard shortcuts` → **`Keyboard shortcuts (?)`** | yes |
| `#presentExportNotesButton` → `#presentMoreButton` | Export dialog's own "Speaker notes" | `Speaker notes` → **found** | yes |
| `#diagramMoreButton` → RIGHT-CLICK | palette "Remove diagram" | **0 results** | **NO — BLOCKED** |

### How many moves need a palette entry first? **One.**

Only `#diagramMoreButton` carries the prerequisite `add('Remove diagram', 'Diagram', requestRemoveActiveDiagram)` near line 25607. Every other move either keeps a palette entry automatically (finding (a)) or lands in a visible menu that is itself a legitimate home.

**So the command palette is *not* the real first task — and I want to be plain about that, because the brief invited the opposite conclusion.** The palette is already good enough for this move list.

It does have a structural blind spot that will bite *future* moves: it harvests `button[id]` only, so **79 `<select>`s, 44 text inputs, 24 checkboxes and 133 id-less buttons can never appear in it**. Any future move of a dropdown or a JS-built button needs a curated entry written by hand. That is a constraint on the next pass, not a blocker on this one.

### Touch — the app is a tablet app today

| Probe | Result |
|---|---|
| `@media (max-width: 900px)` | ~60 declarations; measured true at 820px |
| `.header-actions` at ≤900px | `display: none` (measured 0×0) |
| `.mobile-nav` at 820px | `display: grid` |
| Touch target growth | `#diagramMoreButton` 33×32 → **44×44**; `#workpapersButton` 65×38 → 65×**44** |
| iPad **landscape** (1024px) | falls on the **desktop** side of the breakpoint — 32px targets on a finger |
| `@media (pointer: coarse)` | 1 rule; `touch-action: none` at 4 sites |

**Right-click-only is a dead end here, and so is hover-only.** Every HOVER verdict below must fire on `:hover`, `:focus-within` **and** be unconditionally visible under `@media (hover: none)`. The app already owns this idiom: `.wp-block:hover .wp-block-tools, .wp-block:focus-within .wp-block-tools` (line 10362).

---

## 3. The numbers

**Counting rule, stated so it can be checked:** a control is "at rest" if it is visible with the mouse parked and nothing focused — non-zero box, inside the viewport, not clipped out of a scroll container, not inside a closed `<details>` or an unopened menu. I count **chrome** and exclude content-navigation (diagram tabs, register rows, map-tile titles, card thumbnails, block cards). Scenario: a realistic 13-diagram / 6-project audit workspace.

> **A correction to my own method, in case anyone re-runs it.** A **closed `<details>`** still reports laid-out rects for its children in Chrome. The editor's "Advanced settings" card (h=44 collapsed) has a body of h=693 whose 20 controls all return real boxes at real coordinates. They are not painted — `elementFromPoint` correctly returns the visual builder on top. Counting them inflates the editor by 20. My first pass made this mistake; the numbers below exclude them.

| Surface | Scope counted | Rest **today** 1440×900 | Rest **after** 1440×900 | Cut | Rest **today** 1280×800 | Rest **after** 1280×800 | Cut |
|---|---|---|---|---|---|---|---|
| **Board** (6 projects collapsed) | board bar + group headers | **29** | **16** | **−45%** | **29** | **16** | **−45%** |
| **Present** (map) | map bar + stop strip + tile pills | **36** | **27** | **−25%** | **34** | **26** | **−24%** |
| **Shell** | header + workspace-bar actions | **12** | **9** | **−25%** | **12** | **9** | **−25%** |
| **Docs** (agent spec, 1 register row) | topbar + register + head + agent + links + toolbar | **34** | **31** | **−9%** | **34** | **31** | **−9%** |
| **Editor** (docked, Code mode) | mode bar + code layout bar | **10** | **10** | **0%** | **10** | **10** | **0%** |
| **All five** | | **121** | **93** | **−23%** | **119** | **92** | **−23%** |

Two sub-numbers are worth quoting instead, because they are where the change is actually felt:

- **Docs document head: 8 → 5 (−37%)**, and at 1280 it collapses from **two lines to one**, lifting the agent strip 41px and the first heading with it.
- **Board group header: 4 controls per project → 3**, and the **6 red `Delete folder` buttons at rest → 0**.

**Editor is 0% and that is the honest answer.** Its only proposed mover needs a new `⋯` to live in, which costs exactly what it saves. The EDITOR audit's own conclusion — "the best-behaved surface in my scope" — is correct, and the right thing to do to it is nothing.

---

## 4. The ranked move list

Ordered by quiet bought per hour of work.

### 1. Folder `Rename` + `Delete folder` → a per-row `⋯` on the group header

| | |
|---|---|
| **Controls** | `button.btn.ghost.compact` "Rename", `button.btn.danger.compact` "Delete folder" — one pair **per project, forever** |
| **Where it goes** | A new `⋯` in the existing `.multi-preview-group-actions` div, built with `openStructureMenu(anchor, [['rename','Rename…'],['delete','Delete folder']], '', cb)` |
| **Right-click target** | The **group header row** — `.multi-preview-group-head` (the whole row, not just the toggle) |
| **Second route** | The `⋯` itself: visible, keyboard-reachable, 44×44 on tablet. *Not* the palette (`Delete folder` → 0 results). Recommend also adding curated `Rename project` / `Delete project` entries, but the move does not depend on it |
| **Touches** | `createWorkspacePreviewGroup` (line **21217**); the block at **21257–21271**; `renameWorkspaceFolder` (20773), `deleteWorkspaceFolder` (20791) — **call these unchanged**; `requestConfirmation` stays exactly as at 20795 |
| **Search strings** | `multi-preview-group-actions`, `'Delete folder'`, `'Rename'`, `deleteWorkspaceFolder`, `openStructureMenu` |
| **Effort** | **Low** — ~15 lines in one function, existing primitive, no new CSS |
| **Risk** | **Low.** Confirm dialog untouched. Give the Unfiled row an empty 33px slot so its toggle stops stretching to 824px |
| **Buys** | 12 controls gone at both widths, 6 of them danger-red. The worst frequency-to-prominence inversion measured anywhere in the app |

### 2. Board card `Open` button → **GONE**

| | |
|---|---|
| **Control** | `button.btn.secondary` "Open" in `.multi-preview-head`, one per card |
| **Where it goes** | Nowhere. The thumbnail already is the button |
| **Second route** | Measured on the live card: `.multi-preview-canvas` has `role="button"`, `tabindex="0"`, `aria-label="Open IOP in the full preview"`, a click handler and Enter/Space. Both pointer and keyboard survive |
| **Touches** | Card head construction near line **21484**; delete the `@container (max-width: 300px) { .multi-preview-head > .btn { display: none } }` rule at **9483** with it |
| **Effort** | **Very low** |
| **Risk** | **Low.** *Lost:* a labelled button at 1–2 columns. The container query at 9483 is the app's own written admission that the thumbnail suffices ("the whole thumbnail already opens the diagram"); this move just stops that being true at only some widths |
| **Buys** | −1 per visible card, and removes a control that exists at some widths and not others |

### 3. `#wpType` + `#wpChangesButton` + `#wpReleasesButton` → `#wpDocMenuButton` (⋯)

| | |
|---|---|
| **Where it goes** | The **already-existing** `⋯` at line **18478** — no new button, so this is a straight −3 |
| **Right-click target** | The **document head** `.wp-doc-head`, and the **register row** `button.wp-list-item` for document-scoped actions |
| **Second routes** | `Changes` → palette `◷ Changes`. `Releases` → palette `⛿ Releases` **and** the agent strip's `Release` chip, which stays. `wpType` is a `<select>`, never in the palette, so the ⋯ is its home; the type stays *displayed* on the register row ("WP-001 · Agent spec") |
| **Touches** | `openStructureMenu(el.wpDocMenuButton, …)` at **18478**; `#wpType` / `#wpChangesButton` / `#wpReleasesButton` markup |
| **Effort** | **Low–medium** — three items into an existing menu; `#wpType` needs a menu-row equivalent of a select |
| **Risk** | **Medium.** *Lost:* the aggregate change count at rest. Mitigation already in the app: `.wp-block.is-changed` paints a warning border and each changed block carries its own `button.wp-change-chip` (57×18) |
| **Buys** | Head **8 → 5**; at 1280 the head goes **two lines → one** and the agent strip rises 41px. Also kills half of the `#wpFilter`/`#wpType` twin-dropdown confusion — two unlabelled selects, identical chrome, one letter apart, opposite meanings |

### 4. `#mapBuildButton` + `#presentKeysButton` → the map `⋯` cluster

| | |
|---|---|
| **Where it goes** | `#mapMoreButton`'s existing cluster (`.map-authoring`, `.map-bar[data-more="on"]`) — already holds ▤ Notes, ⧉ Presenter view, ⤢. Measured `data-more: null` at rest, so the cluster is closed and has room |
| **Right-click target** | The **map plane** `#mapPlane` for Build; `?` needs none |
| **Second routes** | Build: `E` key + Present caret menu "Build the presentation…" (line 59168) + palette `✎ Build`. Keys: `?` key (handled first in `handlePresentationKeydown`, 69672) + palette `Keyboard shortcuts (?)` + the resting hint pill already reads "? keyboard shortcuts" (visible in `map.png`) |
| **Touches** | `#mapBar` markup, `.map-authoring` |
| **Effort** | **Low** |
| **Risk** | **Very low.** Both are provably zero-frequency *during* a presentation, which is the only thing this bar is for |
| **Buys** | Map bar **7 → 5**. This bar is on screen in front of a client for the whole talk |

### 5. Four header buttons → a header `⋯`

| | |
|---|---|
| **Controls** | `#themeMenuButton`, `#guideButton`, `#importButton`, `#versionsButton` |
| **Where it goes** | One new `⋯` in `.header-actions`, built with `openStructureMenu` |
| **Right-click target** | None — this is pure overflow |
| **Second route** | All four verified live in the palette, and finding (a) guarantees the entries survive being hidden |
| **Touches** | `.header-actions` markup; the `≤1640px` `span.optional` rules at **11026 / 11035**; the `#versionsButton` exemption |
| **Effort** | **Medium** — new button + menu wiring |
| **Risk** | **Low–medium.** `#versionsButton` is the strongest single case in the app: the **rarest** control on the surface and also the **largest** (133×46 at 1440, 103×46 at 1280), the only one breaking the 36px baseline, and the only one exempted from the word-hiding rule — so it keeps two words and wraps to two lines. **Zero tablet impact**: `.header-actions` is already `display: none` at ≤900px |
| **Buys** | Header 7 → 4 (net −3 after the ⋯). Removes the two-line control from a one-line bar |

### 6. `#presentExportNotesButton` → `#presentMoreButton`

| | |
|---|---|
| **Where it goes** | The `⋯` menu that already carries "Export the deck as slides (PDF)" and "…as PowerPoint (.pptx)" |
| **Second route** | The Export dialog's own **"Speaker notes"** button (line 16116) — same function, `exportSpeakerNotes` — **and** the palette |
| **Touches** | `el.presentExportNotesButton` binding at **18904**; `exportSpeakerNotes` (61615) unchanged |
| **Effort** | **Very low** |
| **Risk** | **Very low.** It is the one control in a panel titled "Playback & **live tools**" that is not a live tool, and it already has two other homes |
| **Buys** | −1 in the Studio; all deck exports finally in one menu |

### 7. Board selection ticks → HOVER

| | |
|---|---|
| **Controls** | `input.multi-preview-tick` on group headers and cards (15×15 in a 24×24 `label.multi-preview-tick-hit`) |
| **Where it goes** | Stays in place at `opacity: 0`; reserved space already exists (`flex: 0 0 auto`), so nothing shifts |
| **Reveal on** | `:hover`, `:focus-within`, **and `[data-selected="true"]`** so a ticked card stays looking ticked |
| **Carve-out** | **Unconditionally visible under `@media (max-width: 900px)` and `@media (hover: none)`** — no hover on a finger, and touch users already depend on the card `⋯` "Move to project" because card reorder is HTML5 drag-only with no touch path |
| **Effort** | **Low** (CSS) |
| **Risk** | **Medium — the move I am least sure of.** See §7 |
| **Buys** | −7 at rest on the collapsed board |

### 8. `.map-route-drop` (`×` on stop chips) → HOVER — **conditional, owner's call**

| | |
|---|---|
| **Where it goes** | `opacity: 0` until `.map-route-item:hover, :focus-within`; the chip is fixed-width so nothing shifts. The list-view rule at **12542–12545** is the exact template |
| **Second route** | `Delete` / `Backspace` on the focused stop (line **63902**) — this works, because `.map-route-item` carries a roving `tabindex` (measured: `0` on current, `-1` on others), so `:focus-within` *will* fire even though the `×` itself is `tabIndex = -1` |
| **Why conditional** | The CSS comment at **12419** records a deliberate earlier decision to make these visible at rest ("visible before the pointer arrives, and it asks first"). This move **reverts a documented decision** and needs a `@media (hover: none)` carve-out or touch loses stop-removal entirely |
| **Effort** | **Very low** (CSS) |
| **Risk** | **Medium-high** — not technically, but as a reversal |
| **Buys** | −7 at 1440 / −6 at 1280, in front of a client |

### Deferred — do not do these yet

| Move | Why deferred |
|---|---|
| `#popOutEditorButton` → OVERFLOW | Net **zero**: sole mover on its bar, a new `⋯` costs what it saves. Revisit if a second candidate appears |
| `#wpFilter` → OVERFLOW | Net **zero**: no existing topbar menu, and the document `⋯` is the wrong scope |
| `#diagramMoreButton` → RIGHT-CLICK | **Blocked.** See §5 |
| `.map-tile-open` → HOVER | **Dropped.** See §7 and §8 |

---

## 5. The one blocked move, spelled out for the right-click workflow

`#diagramMoreButton` is the most natural right-click candidate in the app — its three items (`Duplicate`, `Rename…`, `Remove diagram`) literally *are* a diagram's context menu, built at line **18020**.

**It cannot move today.**

- `requestRemoveActiveDiagram()` has **exactly one call site**: line **18027**, inside this button's own menu.
- Its palette entry is *harvested from the button itself* (title → "Duplicate, rename or remove this diagram"). Delete the button and the palette entry goes with it.
- Palette query `Remove diagram` returns **only** that harvested entry. There is no keyboard shortcut.

**Prerequisite (mandatory):** add `add('Remove diagram', 'Diagram', requestRemoveActiveDiagram)` to `buildCommandRegistry` near line **25607**, beside the existing curated `Duplicate diagram` / `Rename diagram`. Until that ships, the verdict is **STAYS**.

**When it is unblocked**, for the parallel workflow:

- **Right-click targets:** the diagram tab `#diagramTabs button.diagram-tab`, and the workspace card `.multi-preview-card` (which already carries its own `⋯` select with Duplicate / Rename / Export PNG / Move / Delete).
- **Touch carve-out:** keep the button rendered at ≤900px — measured **44×44** at 820px, and it is the only tap route to those three actions.

---

## 6. DO NOT MOVE

The most useful section here. Each of these looks like clutter and is not.

| Control | Why it must stay |
|---|---|
| `#undoButton` / `#redoButton` | Highest-frequency controls in the editor. A non-coder undoes constantly and will not learn Ctrl+Z |
| `#undoHistoryButton` (▾) | Used ~once a session — but it is the **recovery** affordance. Hiding a safety net to save 38px inverts the frequency rule: the moment you need it you are already panicking. *(Its bare `▾` reads as belonging to Redo — a **labelling** defect, not a placement one)* |
| `#exportButton` | The terminal act of the whole workflow; an auditor exports a walkthrough repeatedly as it changes |
| `#findDiagramButton` | **The only pointer route into the command palette** (verified: its handler calls `openCommandPalette()` and pre-fills `"Go to: "`). It is the door to 313 commands. Hiding it strands every mouse-only user from every second route in this document |
| `#addDiagramButton` | Hiding "new" is the classic decluttering mistake |
| `#multiPreviewButton` | A stateful view toggle whose pressed state must be visible to get back out of it |
| `#wpListToggleButton` | Same: a state toggle. Hidden in a menu, the collapsed state reads as breakage |
| `#wpNewButton` | The one obvious primary action of the register |
| `#multiPreviewSearch` | With 14–40 walkthroughs the board exists to find one. This is why you came |
| `#multiPreviewViewButton` | It **is** the overflow — it already folds four `<select>`s into one menu |
| `#workspaceNewFolderButton` | The only *create* verb on the board, and selection-aware. At the 24-folder ceiling it self-disables **in place** rather than vanishing, which is right |
| `select.multi-preview-menu` (card ⋯) | Already the overflow, and the **only** route to single-diagram delete and Export PNG (palette query `Export PNG` → **0 results**). It is also what legitimises a card right-click menu |
| `#presentNextButton` | The highest-frequency control in the app, and correctly the only filled button |
| `#presentToolSelect` | **The only door in the entire app** to laser / spotlight / pen / arrow — no key, no bar button, no menu row |
| `#presentZoomInButton` / `#presentZoomOutButton` | Bound to `-`/`+` and the wheel — but on touch there is no wheel and no keyboard, so these are the **only** zoom route |
| 8 × `details.present-panel > summary` | Hiding a disclosure control is incoherent |
| `#mapNextButton` / `#mapPrevButton` / `#mapHomeButton` / `#mapExitButton` | All pressed live, under question-pressure, in front of a client |
| `#wpSearch`, `#wpOwner`, `#wpTitle`, `#wpReviewButton`, `#wpCommentsButton` | Read every time even when clicked rarely — status readouts first, buttons second |
| `#copyButton` (Copy code) | 1–3× per diagram; Ctrl+C on a selection is **not** equivalent — this copies the whole source |
| `#visualModeButton` / `#codeModeButton`, `#textModeButton` / `#structureModeButton` | Two mode switches for one question, 155px apart — a real design smell, but **merging them is a redesign, not a relocation**. Both pairs stay |
| Diagram tabs, register rows, map tiles, card thumbnails | Navigation content, not chrome |

---

## 7. Be adversarial: moves I am not confident about

A decluttering pass that hides a frequently-used control has made the app worse while looking better in a screenshot. Three of mine could do that.

**7 — Board selection ticks → HOVER. Lowest confidence.**
A tick is a *selection*, not an action, and selection is bursty: near-zero while reading, heavy during a filing session. If the owner's real pattern is "open the board in order to file things", the ticks are frequent and I have hidden the entry point to Move / Compare / batch Delete. My `[data-selected="true"]` carve-out protects the *ticked* state but not the *first* tick — which is the one you have to find.
*What would settle it:* instrument `change` on `input.multi-preview-tick` and `click` on `#workspaceMoveButton` for two weeks of real use. If ticks-per-board-session exceeds ~3, revert to visible-at-rest. Cheaper proxy: watch the owner file one real engagement and count.

**8 — `.map-route-drop` → HOVER. Reverses a documented decision.**
Someone already fought this exact battle and wrote the conclusion into the source at line 12419. I can show the `×` is zero-frequency *during* a presentation, but the strip is also used while *building* one — and `.map-route.is-building .map-route-drop { opacity: 1 }` (line 12328) already covers that case, which is evidence the author thought it through. I would not ship this without the owner reading that comment.
*What would settle it:* ask the owner directly — does he ever drop a stop from the strip outside Build mode?

**2 — Board card `Open` → GONE. Confident, but name the loss.**
Discoverability of "the picture is a button" rests entirely on `cursor: pointer` and the `aria-label`. There is no visible affordance on the thumbnail itself.
*What would settle it:* one non-coder, board open, asked to open a diagram, watched. If they hunt, add a hover-only "Open" overlay on the canvas instead of a permanent button.

**1 and 5 I am confident about.** 1 because the frequency-to-prominence inversion is measured, extreme, and repeats per row forever. 5 because all four palette routes are verified, the tablet impact is provably zero, and `#versionsButton` is simultaneously the rarest and the largest control on its bar.

---

## 8. What this audit could not settle

| Open question | What would settle it |
|---|---|
| **Real frequencies.** Every estimate here is reasoned from an auditor's workflow, not observed. The whole ranking rests on them | A fortnight of anonymous counters on `click` for ~20 named controls, written to IndexedDB. Cheap, offline, nothing leaves the machine |
| **Does the map need one visible Present pill at rest?** The dropped sibling of move 4 hinges on this, and `is-route-target` is empty at stop 1 | Decide the rule: except `.map-tile:first-child`, or except the tile under the camera, or keep all 13. Then the tile-pill move becomes safe and buys a further −12 (Present map 27 → 15, **−58%**). **This is the single largest uncaptured win in the document** |
| **Whether `#wpFilter` / `#wpType` should merge rather than move.** Five unlabelled selects in one visual family sit within 220px on the Docs surface | A design decision, out of scope under Rule 5 |
| **Two dead-surface defects neither I nor the move list can fix.** While the pop-out is open, **0 of 13** docked editor controls are clickable; while Docs is open, the header and editor stay in the DOM and the tab order underneath the overlay (I measured both) | Not a placement problem — but the right-click workflow **must** know: any `contextmenu` bound to the docked editor pane is unreachable whenever the pop-out or Docs is open |
| **Guided-mode line reorder/delete has no working desktop route at all.** `.struct-line-actions` is painted over the preview pane; palette queries `Move this line` / `Delete this line` → **0 results** (I re-confirmed both) | A bug to fix, not a control to move — but it is the strongest *addition* case for a right-click menu anywhere in the app |
| **Effort estimates.** Mine are read from call sites, not from doing the work | The implementer's first hour on move 1 |

---

## 9. The one move to do first

### Folder `Rename` + `Delete folder` → a per-row `⋯`

Because it is simultaneously the **biggest measured win**, the **cheapest**, and the **least contested**:

- **Biggest.** 12 controls leave at both widths — 6 of them the loudest colour in the app. The board goes **29 → 16 (−45%)**, the largest cut on any surface. `board_collapsed.png` shows a full-height wall of red with no other coloured control on screen.
- **Cheapest.** ~15 lines inside one function (`createWorkspacePreviewGroup`, line 21217), using a primitive the app already ships and already uses for exactly this shape of menu (`openStructureMenu`, line 22548). No new CSS, no new concepts.
- **Least contested.** It is the clearest frequency-to-prominence inversion measured anywhere: an action taken once or twice in a workspace's entire life, wearing danger-red, repeated once per project, on every board render — the exact inverse of diagram delete, which the app already correctly buries one layer inside a card `⋯`.
- **No Rule 2 debt.** The `⋯` is itself a visible, keyboard-reachable, 44×44-on-tablet home. Nothing has to ship first.
- **Rule 4 satisfied for free.** `deleteWorkspaceFolder` keeps `requestConfirmation` untouched — title `Delete <name>?`, confirm text `Delete folder`, message "*n* diagrams will be moved to Unfiled. No diagram will be deleted."

Do this one, look at the board, and the case for 2 and 3 will make itself.

---

## 10. Addendum — the file moved while I was auditing it

The parallel right-click workflow **shipped during this audit**. I re-checked every verdict against the new bytes before publishing.

| | At my snapshot | Live file at hand-off |
|---|---|---|
| Bytes | 3,971,254 | **3,995,539** (+24,285) |
| md5 | `5a5e94c8f1e33587e1f877e28eff3068` | `8fd5e01a617b1c3d69bbfbf51bd45dfe` |
| `contextmenu` handlers | **0** | **4** |
| `pointerType` checks | 0 | **still 0** |
| Curated palette commands | 37 | **still 37** |

**Nothing in this document is invalidated.** Every control I move still exists; the counts in §3 were measured on the byte-identical file all five surface audits used, so they remain internally consistent.

**What the parallel agent built:** a real dispatcher, `handleAppContextMenu` → `buildContextMenu(target)`, routing to Present, Docs, the diagram canvas (blocks, edges, clusters) and **board cards**. It correctly refuses to hijack the browser's own menu on `textarea`, inputs, `[contenteditable]`, links and author-placed images (`NATIVE_MENU_SELECTOR`) — which is exactly the restraint the EDITOR audit asked for on `textarea#source`.

**Three things that follow, and they matter to whoever picks this up:**

1. **My move 1's right-click target does not exist yet.** `.multi-preview-group-head` appears in the new file only as a class name (line 21234), never as a `closest()` target. There is **no group-header context menu**. Move 1 is still an addition the right-click workflow has to make, not something already covered.
2. **My move 5's blocker is unchanged.** `add('Remove diagram'` → **0 matches**; `requestRemoveActiveDiagram()` still has **exactly one call site** (line 18032). There is still **no diagram-tab context menu**. `#diagramMoreButton` remains **STAYS**.
3. **The board card `⋯` select is now doubly load-bearing.** `buildBoardCardContextMenu` mirrors it (Rename / Duplicate / Export PNG / Move / Delete), so the select is the discoverable second route that legitimises the new card right-click menu. Its **DO NOT MOVE** verdict is now stronger, not weaker.

**Re-anchored line numbers against the live file** (they all shifted; use these, not the ones in §4):

| Anchor | Old | **New** |
|---|---|---|
| `createWorkspacePreviewGroup` (move 1) | 21217 | **21227** |
| `remove.textContent = 'Delete folder'` (move 1) | 21267 | **21278** |
| `renameWorkspaceFolder` | 20773 | **20783** |
| `deleteWorkspaceFolder` (keeps its confirm) | 20791 | **20801** |
| `openStructureMenu` | 22548 | **22561** |
| `openStructureMenu(el.wpDocMenuButton` (move 3) | 18478 | **18483** |
| `el.presentExportNotesButton` binding (move 6) | 18904 | **18909** |
| `buildCommandRegistry` | 25566 | **25935** |
| `add('Rename diagram'` — insert `Remove diagram` beside it | 25607 | **25975** |
| `requestRemoveActiveDiagram` definition | 20440 | **20450** |

Anyone re-measuring should re-snapshot first: this file is being edited live, and three of the five surface audits would now be quoting stale line numbers.

---

*Measurements came from a byte-verified copy (md5 `5a5e94c8f1e33587e1f877e28eff3068`) served on port 8391, `Content-Length` asserted equal to disk bytes before the first claim and re-asserted at the end. The live file was never written to.*
