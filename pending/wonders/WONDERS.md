# wonders — a theme, stopped mid-way on purpose

The owner's brief: the human record, inspired by the Civilization games and their wonders, from
before the common era to the present. Work stopped here by his instruction, to wait for Codex.

**Nothing is applied. No preset, no CSS block, no patch to any application file.**

## What is done — the palettes, measured

Read as ONE palette rather than a gradient through six eras: lapis night as the ground the wonders
stood against, limestone as the built thing, bronze as the joinery, gold leaf as the emphasis.
The owner then asked for a day mode as well, so papyrus carries the light scheme.

| token | night | day |
|---|---|---|
| `canvasBg` | `#101d33` | `#e9dfc6` |
| `text` | `#f2ead9` | `#3b2f1e` |
| `muted` | `#c3b79c` | `#6d5c42` |
| `nodeFill` | `#e6dcc3` | `#fbf6ea` |
| `nodeText` | `#221c14` | `#2a2118` |
| `nodeBorder` | `#8d6a3c` | `#7a5628` |
| `nodeAccent` | `#c9a227` | `#d8b23f` |
| `nodeAccentBorder` | `#f0d67a` | `#8a6412` |
| `line` | `#b08a52` | `#8d6a3c` |
| `edgeLabel` | `#0c1626` | `#e4d9bd` |
| phosphor (chrome only) | `#6fe3d0` | `#0a6d60` |

Night: block label 12.37:1, title 14.09:1, decision label 6.98:1, connector 5.30:1, block edge 3.42:1.
Day: block label 14.65:1, title 9.83:1, decision label 7.79:1, connector 3.72:1, block edge 4.97:1.

Evidence: `wonders_pair.html` (both, side by side), `wonders_pair.png`, `contrast.py`.

## Three things established while building it — do not re-derive

**1. The phosphor cannot be a property of a block.** The first draft drew one node with a phosphor
border as "the modern era". A preset applies to every node equally — SIREN has no per-node theme
mechanism — so that was an invented capability. The phosphor lives in the CHROME instead: selection
ring, drag handles, active tab. The record is ancient; the instrument reading it is not.

**2. Light themes are defined by their border, not their fill.** A "block against canvas" floor of
3.0 is wrong for a light scheme. Measured on the shipped themes: light 1.07, paper 1.01, kpmg 1.11,
zen 1.10, ukiyoe 1.04, kintsugi 1.01. The day palette is 1.23 — the best of the group. The real
defect that comparison exposed was the *border*: mine was 3.19:1, the weakest of the group against
kpmg's 11.30. Now 4.97:1.

**3. SIREN has no mechanism for one theme with two modes.** All 37 themes declare a single
`color-scheme` in CSS — 11 light, 24 dark (35 declare one). There is no pairing, so there is no
"kintsugi at night". `wonders` therefore ships as **two presets** until something pairs them, and a
day/night switch inside one theme is new machinery that the theme gallery would naturally carry.

## What is NOT done

- **The scene.** `wonders_scene.html` holds a first draft: a horizon of silhouettes drifting right
  to left, the era changing as they pass (pyramid, ziggurat, temple, aqueduct, cathedral, dome,
  foundry, mast, dish, rack), on the rule the codebase already states for Aurora — *burn at the
  edges, leave the middle calm* — so silhouettes fade exactly where the diagram sits, and one
  crossing takes 90 seconds. **It has never been run.** It also carries a known bug: a garbled
  colour stop, `'#132banner'.slice(0,7)`, left in the sky gradient.
- No `themePresets` entries. No `[data-theme="wonders"]` CSS block for the application chrome —
  which is the largest part of what a theme is here, and none of it is written.
- No `AMBIENT_SCENES` entry and no `--ambient-blur` override.

## Two decisions already taken by the owner

- **"Soften" stays attenuation, not a stop.** It applies a per-theme blur (8px on Kintsugi to 22px
  on Art Deco, over a 14px default) and does not halt motion. So the scene has to be calm at source,
  not calm only when softened.
- **The theme is not blocked by the menu cap.** An earlier note claimed it was; that overstated the
  dependency. Both themes land behind the cap automatically, because the cap patch marks only the
  eight and a new theme carries no `data-theme-quick`.
