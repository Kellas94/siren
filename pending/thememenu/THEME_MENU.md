# Theme quick menu — capping 37 to 8

Working copy: `C:\Claude\SIREN\pending\thememenu\app.html`
Patch: `C:\Claude\SIREN\pending\thememenu\patch_theme_menu.py`
Pre-patch backup of the working copy: `C:\Claude\SIREN\pending\thememenu\app.html.pre`

The live app and `C:\Claude\SIREN\codex\FROZEN_R6_BASE.html` were **not** touched. Every line
number below refers to the pre-patch working copy.

---

## 1. What is there now — measured, not read

Driven in headless Chromium through Playwright, using the round-6 reference probe as the base
(`qa_exports\r6_probe_reference.js`, only the MEASURE block and the loop changed). Probes written
for this job, all on ports 984x so they do not collide:

| file | what it does |
| --- | --- |
| `probe_theme_menu.js` | inventory + a walk of all 37 themes (`--deep`) |
| `verify_theme_menu.js` | the seven-step acceptance run, A–G |
| `shot_theme_menu.js` | screenshots + the in-menu appearance bars |

Raw JSON: `before_1440_full.json`, `before_960.json`, `before_375.json`, `after_1440.json`,
`verify_theme_menu_1440.json`, `verify_theme_menu_960.json`, `verify_theme_menu_375.json`.

### 1.1 How many themes

**37**, not "roughly 36". Three lists carry the same 37 ids and all three agree:

* `#themeMenu` — 37 `.theme-menu-option[data-theme-value]` buttons (the quick menu)
* `#themePreset` — 37 `<option>`s, `aria-hidden="true" tabindex="-1"` (a state mirror, line 19005)
* `#themePresetMobile` — 37 `<option>`s, the phone route (line 19600)

All 37 applied correctly when driven: **`did NOT apply: none`**.

### 1.2 The menu today

Five groups, one flat scroll, a sticky jump rail on top:

| group (`aria-label`) | heading | count |
| --- | --- | --- |
| `Essentials themes` | ESSENTIALS | 5 |
| `Office themes` | OFFICE | 5 |
| `Japan Collection themes` | JAPAN COLLECTION | 8 |
| `Signature themes` | SIGNATURE | 15 |
| `Worlds themes` | WORLDS | 4 |

**Container** (line 19005):

```html
<div class="theme-menu" id="themeMenu" role="listbox" aria-label="Choose theme" hidden>
```

`hidden` here does **not** mean "never shown" — it is the closed state of a popup that
`setThemeMenuOpen()` toggles. Measured open, all 37 rows were reachable.

**Group wrapper** (line 19049):

```html
<div class="theme-menu-group" role="group" aria-label="Essentials themes">
  <span class="theme-menu-group-label">Essentials</span>
```

**One row** (line 19051), verbatim:

```html
<button class="theme-menu-option" type="button" role="option" data-theme-value="dark" aria-selected="false"><span class="theme-option-swatch" style="--swatch-a:#0a0f16;--swatch-b:#2563eb"></span><span>Dark</span><span class="theme-option-check">✓</span></button>
```

Layout CSS: `.theme-menu-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(196px, 1fr)); }`
(line 2433) — two columns at 520px wide, one when narrower.

### 1.3 It already does not fit

| viewport | menu box | scrollHeight | clientHeight | below the fold |
| --- | --- | --- | --- | --- |
| 1440 × 900 | 520 × 800 | 1061 | 798 | **263 px, ~6 rows** |
| 960 × 700 | 520 × 637 | 1061 | 635 | **426 px, ~11 rows** |

The sticky jump rail exists because of this. Its own CSS comment (line 3367) says so, and it is
already stale: *"36 options overflow every viewport this app runs on"* — there are 37.

### 1.4 There is no quick menu on a phone

At 375 × 812 the entire `#headerThemeControl` is gone: `@media (max-width: 900px) { .header-actions { display: none; } .mobile-theme-setting { display: block; } }` (lines 11909, 11927–11928).
Measured at 375: menu rect `0 × 0`, **0 of 37 rows reachable**, and the theme route is the native
`#themePresetMobile` select. **The cap is therefore a desktop-only change** — below 901px there is
nothing to cap.

Also measured at 375 **before any patch**: the page already overflows horizontally,
`documentElement.scrollWidth 381 / clientWidth 375`. Pre-existing; unchanged by this work.

### 1.5 How a theme is applied

`handleThemeMenuClick()` (line 38617) → `applyTheme(option.dataset.themeValue, true)` (line 68445).

`applyTheme(themeName, shouldRender)` falls back to `'dark'` for an unknown id, then sets
`state.theme`, `document.body.dataset.theme`, `el.themePreset.value`, `el.themePresetMobile.value`;
clears any variant inline palette; calls `applyAmbientSoft()`, `tuneThemeAccessibility()`,
`renderDiagramPaletteControls()`, `syncAmbientScene()`, `syncThemeMenu()`, `setThemeMenuOpen(false)`,
`scheduleSave()`; plays the arrival sequence for themes that have one; and schedules a re-render.

Keyboard and roving-tabindex all funnel through `themeMenuOptions()` (line 38536).

### 1.6 Does the app already distinguish "professional" from "artistic"? — Yes, three ways

**(a) The group names.** `Essentials` + `Office` (10 themes) versus `Japan Collection` +
`Signature` + `Worlds` (27). The app already named its own work set.

**(b) An animation glyph in the picker.** Lines 2466–2497 prefix `✦` (U+2726) to the name of
**27** themes via `.theme-menu-option[data-theme-value="…"] > span:nth-child(2)::before`. This is
a ready-made "this one moves" badge. Its comment says *"The seven themes that animate"* — stale by
twenty.

**(c) The runtime truth.** `AMBIENT_SCENES` (line 39063) and `themeIntroTimers` (line 68352) both
name the same **28** themes. Measured by applying every theme and reading `body[data-ambient]`:

* **ambient ON (28)** — oled, kpmg, cupertino, paper, blueprint, kintsugi, sakura, tokyo, anime,
  ukiyoe, zen, koi, shinkansen, matrix, artdeco, synthwave, cyberpunk, kawaii, aurora, grandhotel,
  abyss, spacerace, nosferatu, hacker, wasteland, observatory, grove, ie
* **ambient OFF (9)** — dark, light, navy, slate, solarized, forest, runeterra, neural, amber

**(b) and (c) disagree by exactly one: `kpmg` animates but carries no `✦`.** 27 marked, 28
animating. Visible in `shot_after_quick.png` — OLED Black, Cupertino Glass, Paper, Blueprint and
Art Deco carry the glyph, KPMG Blue does not. Whether that is deliberate (no sparkle on the brand)
or an oversight, I could not establish.

### 1.7 The blur map you asked about

`body[data-ambient-soft="on"][data-theme="…"]` at lines 12413–12422 names **9 themes**, not 28:

| blur | themes |
| --- | --- |
| 22 px | `artdeco` |
| 16 px | `abyss`, `spacerace`, `koi` |
| 12 px | `matrix`, `tokyo` |
| 8 px | `cupertino`, `kintsugi`, `sakura` |
| 14 px | everything else, from the unqualified `body[data-ambient-soft="on"]` default |

**This map is not the list of ambient themes.** It is a list of nine per-theme *overrides* on a
default that applies to all of them. Reading it as the ambient roster would have said 9 where the
answer is 28. The roster is `AMBIENT_SCENES` / `themeIntroTimers`, confirmed by driving the app.

### 1.8 Favourites and recently-used

**Neither exists.** `grep -i "favourite|favorite|recentTheme|themeRecent|recentlyUsed"` over the
whole 8.5 MB file returns nothing. There is no per-theme usage count, no history, no pinning, and
nothing in `state` that records which themes a person has used. So there is no usage evidence in
the app to base a cap on — the eight below are derived from structure, not from behaviour.

### 1.9 Per-theme measurements (all 37)

Canvas luminance from `--canvas-bg`; contrast is WCAG canvas-vs-`--node-text`.

| id | name | group | ambient | ✦ | lum | contrast |
| --- | --- | --- | --- | --- | --- | --- |
| dark | Dark | Essentials | – | – | 0.006 | 17.50 |
| light | Warm Light | Essentials | – | – | 0.983 | 14.12 |
| navy | Navy | Essentials | – | – | 0.009 | 16.56 |
| slate | Slate | Essentials | – | – | 0.011 | 16.34 |
| oled | OLED Black | Essentials | on | ✦ | 0.000 | **19.63** |
| kpmg | KPMG Blue | Office | on | – | 1.000 | 16.00 |
| cupertino | Cupertino Glass | Office | on | ✦ | (rgba) | (rgba) |
| paper | Paper | Office | on | ✦ | 0.959 | 12.52 |
| blueprint | Blueprint | Office | on | ✦ | 0.025 | 13.10 |
| solarized | Solarized | Office | – | – | 0.020 | 12.25 |
| kintsugi | Kintsugi | Japan | on | ✦ | 0.965 | 14.50 |
| sakura | Sakura | Japan | on | ✦ | 0.967 | 13.47 |
| tokyo | Tokyo Night | Japan | on | ✦ | 0.003 | 17.52 |
| anime | Anime Neon | Japan | on | ✦ | 0.008 | 16.32 |
| ukiyoe | Ukiyo-e | Japan | on | ✦ | 0.865 | 13.31 |
| zen | Zen Garden | Japan | on | ✦ | 0.855 | 14.35 |
| koi | Koi Pond | Japan | on | ✦ | 0.012 | 15.05 |
| shinkansen | Shinkansen | Japan | on | ✦ | 0.945 | 15.60 |
| matrix | Matrix OLED | Signature | on | ✦ | 0.000 | 19.29 |
| artdeco | Art Deco | Signature | on | ✦ | 0.004 | 16.62 |
| synthwave | Synthwave '84 | Signature | on | ✦ | 0.001 | 19.28 |
| cyberpunk | Cyberpunk | Signature | on | ✦ | 0.001 | **19.66** |
| kawaii | Kawaii | Signature | on | ✦ | 1.000 | **7.87** |
| aurora | Aurora Borealis | Signature | on | ✦ | 0.005 | 17.10 |
| grandhotel | Grand Hotel | Signature | on | ✦ | 0.939 | 13.51 |
| abyss | Abyss | Signature | on | ✦ | 0.006 | 16.63 |
| spacerace | Space Race | Signature | on | ✦ | 0.007 | 16.32 |
| nosferatu | Nosferatu | Signature | on | ✦ | 0.005 | 15.38 |
| hacker | Hacker Static | Signature | on | ✦ | 0.006 | 15.39 |
| wasteland | Wasteland Terminal | Signature | on | ✦ | 0.003 | 17.89 |
| observatory | Sol Observatory | Signature | on | ✦ | 0.002 | 17.06 |
| grove | Hero's Grove | Signature | on | ✦ | 0.005 | 17.07 |
| ie | Ie | Signature | on | ✦ | 0.950 | 14.67 |
| forest | Forest | Worlds | – | – | 0.006 | 17.95 |
| runeterra | Runeterra Gold | Worlds | – | – | 0.005 | 15.31 |
| neural | Neural Horizon | Worlds | – | – | 0.003 | 19.00 |
| amber | Amber Terminal | Worlds | – | – | 0.002 | 12.47 |

Cupertino's `--canvas-bg` is `rgba(250,251,253,.78)` and cannot be reduced to a single luminance;
its swatch and its day variant are light.

Light themes (lum > 0.4): 11 measurable + cupertino = **12 of 37**. Contrast range **7.87 – 19.66**;
every theme clears WCAG AAA for large text and all but Kawaii clear AAA for body text.

---

## 2. The reviewer's eight, checked against the app

| reviewer said | exists? | what it is actually called |
| --- | --- | --- |
| Dark | yes | `dark` — "Dark" |
| Light | yes | `light` — **"Warm Light"** |
| OLED | yes | `oled` — "OLED Black" |
| KPMG | yes | `kpmg` — "KPMG Blue" |
| Paper | yes | `paper` — "Paper" |
| Cupertino | yes | `cupertino` — "Cupertino Glass" |
| Art Deco | yes | `artdeco` — "Art Deco" |
| a high-contrast option | **no** | — |

**There is no high-contrast theme.** No theme id or display name contains "contrast". The only
high-contrast machinery in the file is `@media (forced-colors: active)` at line 2352, which honours
*Windows'* High Contrast mode across all themes — it is not something you can pick.

I did not invent one. Measured instead: the highest-contrast themes are Cyberpunk 19.66:1 and
**OLED Black 19.63:1**, and OLED Black is the neutral of the two. The high-contrast slot the review
asked for already exists under a different name and is already in the eight.

So the review names **seven** distinct existing themes, and the eighth slot was open.

---

## 3. The eight, and the signal behind each

**Rule used:** take the app's own work set — `Essentials` + `Office` = 10 — drop the members that
are measurably redundant, and give the remaining slot to the one produced theme the source itself
already treats as special.

The three dropped are the static darks that occupy the same cell as Dark on every axis measured
(dark, static, no variant, no brand, same luminance band): **Navy** 0.009, **Slate** 0.011,
**Solarized** 0.020, against Dark's 0.006.

| # | theme | signal used |
| --- | --- | --- |
| 1 | **Dark** | *existing grouping* + *ambient-vs-static*. `applyTheme()` falls back to it, so it is the app's own default, and it is one of only nine themes with no ambient scene. |
| 2 | **Warm Light** | *ambient-vs-static* + *light/dark coverage*. Measured: it is **the only light theme in the app with no ambient scene**. Every other light theme (kpmg, paper, kintsugi, sakura, ukiyoe, zen, shinkansen, kawaii, grandhotel, ie, cupertino) reports `data-ambient="on"`. Without it, "a plain light UI with nothing moving" has no answer in front of the cap. |
| 3 | **OLED Black** | *measured contrast*. 19.63:1, second of 37 and the highest among the neutrals; luminance 0.000. This is the review's high-contrast slot, resolved by measurement rather than invention. |
| 4 | **KPMG Blue** | *brand* + *the menu's own structure*. The only company theme; luminance 1.000; and its Day/Night bar `#kpmgFinishBar` is a child of this menu's rail — a theme whose controls live in the quick menu belongs in the quick menu. |
| 5 | **Cupertino Glass** | *the menu's own structure* + *light coverage*. The second of the three themes whose appearance bar (`#cupertinoFinishBar`, Day/Night × Blue/Green) is pinned in this rail. Office group. |
| 6 | **Paper** | *existing grouping* + *light coverage*. Office; luminance 0.959; the document look, which is what an export or a print wants. |
| 7 | **Blueprint** | *existing grouping*. Office; luminance 0.025 — the dark member of the work group, so Office is represented on both sides of the light/dark line. |
| 8 | **Art Deco** | *source-level special-casing* + the review's pick. `artdeco` is one of only two themes (with `matrix`) for which the source hand-writes a z-index/overflow escape hatch **for this menu specifically** (`body[data-theme="artdeco"] #themeMenu`, lines 14511–14525; `.header-theme-control { z-index: 720 }`, line 3005), and it carries the largest per-theme ambient blur in the map (22 px). It is also the only representative in front of the cap of the 27 themes the picker marks with `✦`, so the quick list is not a claim that SIREN has no artistic themes. |

**Coverage of the eight:** 4 light (Warm Light, KPMG Blue, Cupertino Glass, Paper) / 4 dark (Dark,
OLED Black, Blueprint, Art Deco). 2 static / 6 ambient. Contrast 12.52 – 19.63. Two of the three
in-menu appearance bars belong to members. Brand present. Default present.

**Where I depart from the review:** the review's list is seven existing themes plus a theme that
does not exist. I kept all seven and filled the eighth with Blueprint — i.e. I resolved
"high-contrast" to OLED Black (which the review already listed) and used the freed slot on the
remaining Office theme rather than leaving Office half-represented.

**The third appearance bar, `#kintsugiFinishBar`, belongs to Kintsugi, which is behind the cap.**
That still works: the bar is `hidden` unless Kintsugi is active, and selecting Kintsugi opens the
menu expanded (see §4), so the bar appears with its theme.

---

## 4. What the patch changes

`patch_theme_menu.py <file>` — argv[1], in place via `.tmp` + `os.replace`, prints input and
output SHA-256 and byte count, **no input SHA pinned**, and every one of the 20 replacements
asserts its anchor's occurrence count first.

**Anchor note worth keeping:** `data-theme-value="oled"` is **not** an anchor — it occurs twice,
because the `✦` marker CSS selects on the same attribute. The same is true for `cupertino`,
`paper`, `blueprint` and `artdeco`. The anchor used is
`role="option" data-theme-value="…" aria-selected="false"`, which occurs exactly once each.

| # | change |
| --- | --- |
| 1 | Adds `data-theme-quick` to the eight option buttons. Eight replacements. |
| 2 | `#themeMenu` gains `data-mode="quick"` **in the markup**, so the first paint is already capped even if the script has not run. |
| 3 | Adds `#themeMenuMoreButton` as the first pill in the sticky rail, `data-palette="skip"`, `aria-expanded`, `aria-controls="themeMenu"`. It is in the rail rather than at the foot of the list because the rail is the part that stays on screen while the list scrolls. |
| 4 | CSS: `.theme-menu[data-mode="quick"]` hides non-quick options, hides group labels and jump pills, forces one column, and kills the group dividers so the emptied Japan/Worlds groups do not leave rules across blank space. Plus `.theme-menu-more` styling, matching `.theme-menu-jump`. |
| 5 | Caches `themeMenuMoreButton` in `cacheElements()`. |
| 6 | Adds `themeMenuNavOptions()`, `themeMenuIsExpanded()`, `setThemeMenuExpanded()`, `themeMenuShouldExpandForActive()`. `themeMenuOptions()` is left returning **all 37** — `syncThemeMenu()` must tick and label the active theme whether or not it is one of the eight. |
| 7 | `positionThemeMenu()` width cap becomes mode-dependent: **312** quick, **520** expanded. Eight rows in one column at 520 wide is a wall with a list in it. |
| 8 | `setThemeMenuOpen(true)` picks the mode: if the active theme is not one of the eight, the menu opens expanded, so a person on Ukiyo-e never sees a menu of eight with no tick in it. |
| 9 | The three keyboard entry points use `themeMenuNavOptions()` instead of `themeMenuOptions()`, and the Tab-stop list adds the More button and filters out the `display:none` jump pills. A row you cannot see must not be an arrow stop. |
| 10 | `handleThemeMenuClick()` handles the More button, toggling the mode and resetting `scrollTop`. |

Nothing is deleted. All 37 option buttons stay in the DOM with unique `data-theme-value`s, so the
command palette's `document.querySelectorAll('.theme-menu-option')` harvest (line 34628) still
offers every theme by name. **A 38th theme lands behind the cap automatically**, because it will
not carry `data-theme-quick` — the "(29)" in the button text is counted from the DOM, never from a
literal.

Result on the working copy:

```
input  SHA-256 DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435
input  bytes   8528590
output SHA-256 A6DE948F2A96A2E20C14E06BFE17AFFFCD44B455307581ED1B033705C375305B
output bytes   8534024        (+5,434)
```

`python tools\syncheck.py pending\thememenu\app.html` → **2 script blocks, 7,535,482 chars,
`node --check` exit 0**.

Reproducibility: re-running the patch on a fresh copy of `app.html.pre` in a scratch directory
produced byte-identical output, SHA-256 `A6DE94…305B`, so the verified working copy is exactly
what this script does to that base and nothing else was hand-edited into it.

---

## 5. Verification — the numbers

### 5.1 Before / after

| measurement | before | after (quick) | after (expanded) |
| --- | --- | --- | --- |
| **1440 × 900** rows on screen | 37 | **8** | 37 |
| menu box | 520 × 800 | **312 × 410** | 520 × 800 |
| scrollHeight / clientHeight | 1061 / 798 | **408 / 408** | 1061 / 798 |
| vertical overflow | yes, 263 px hidden | **none** | yes (as before) |
| horizontal overflow | none | none | none |
| off right / left / bottom edge | no / no / no | no / no / no | no / no / no |
| page `scrollWidth/clientWidth` | 1440/1440 | 1440/1440 | 1440/1440 |
| **960 × 700** menu box | 520 × 637 | **312 × 410** | 520 × 637 |
| scrollHeight / clientHeight | 1061 / 635 | **408 / 408** | 1061 / 635 |
| **375 × 812** rows on screen | 0 (no quick menu at this width) | 0 | 0 |
| 375 page `scrollWidth/clientWidth` | **381 / 375** | **381 / 375** | — |

The 375 overflow is 6 px and is present **before** the patch. Not caused by this work, not fixed by
it.

### 5.2 The acceptance run (`verify_theme_menu.js`, 1440 × 900 and 960 × 700, both identical)

| step | result |
| --- | --- |
| A — open cold | `mode:"quick"`, 8 rows: `dark light oled kpmg cupertino paper blueprint artdeco`, box 312 × 410, `overflowsY:false`, `fitsOnScreen:true`, button reads `More themes… (29)`, tick on Dark and on screen |
| B — click a quick row (Paper) with the mouse | `bodyTheme:"paper"`, label `"Paper"`, menu closed |
| C1 — reopen while Paper is active | still `quick`, 8 rows, tick on Paper and on screen |
| C2 — click **More themes…** | `mode:"all"`, **37 of 37 on screen**, box back to 520 × 800, button now `Show fewer`, still `fitsOnScreen:true` |
| D — click Ukiyo-e, a theme from behind the cap, at its real rect **247 × 38** | `bodyTheme:"ukiyoe"`, `ambient:"on"`, label `"Ukiyo-e"` — applied, arrival sequence played |
| E — reopen while Ukiyo-e is active | opens **expanded**, tick on Ukiyo-e and on screen |
| F — `ArrowDown` × 11 from the button in quick mode | focus walk `light oled kpmg cupertino paper blueprint artdeco dark light oled kpmg` — **8 distinct**, wraps, never lands on a hidden row |
| G — every theme still addressable | 37 option buttons in the DOM, 37 in `#themePreset`, 37 in `#themePresetMobile` |
| X — errors | `pageErrors: []`, `consoleErrors: []` at 1440, 960 **and** 375 |

### 5.3 The comparable control, exercised in the same run

Before reporting the cap as working I exercised the mechanism it could have broken. The two
appearance bars that live *inside* this menu still work while it is capped
(`shot_theme_menu.js`): with KPMG Blue active and `mode:"quick"`, `#kpmgFinishBar` is visible
(`kpmgBar:true`, `cupertinoBar:false`, `kintsugiBar:false` — correct, only the active theme's bar
shows), and clicking its **Night** button gives `{"variant":"night","theme":"kpmg"}`.

### 5.4 Screenshots (looked at, not just captured)

* `shot_after_quick.png` — eight rows, `More themes… (29)` pill in the rail, soften toggle at the
  foot, tick on Dark. No ragged grid, no empty group headings, no dividers across blank space.
* `shot_after_all.png` — the original menu, unchanged, with `Show fewer` added as the first pill.
  This is also what the menu looked like before the patch.
* `shot_after_kpmg.png` — the capped menu with the KPMG Day/Night bar under the More pill.
* `shot_after_kpmg_night.png` — after Night.

---

## 6. What I did not do, and what I could not establish

**Not built — the gallery.** There is **no search field, no favourites and no recently-used list.**
The route to the other 29 is a plain reveal of the five existing groups behind one
`More themes… (29)` button, exactly the fallback the brief allowed. A search box, pinning, a
recents row and a grid gallery are all still outstanding. Favourites would need new persisted
state; SIREN has none today.

**Not changed — the phone.** Below 901 px the quick menu does not exist; `#themePresetMobile` still
offers all 37 in one native `<select>` with no cap. If the cap is meant to apply on phones, that is
a separate change.

**Not changed — the mirrors.** `#themePreset` (37, `aria-hidden`) and `#themePresetMobile` (37)
are untouched, as is the command palette. That is deliberate — they are how every theme stays
addressable — but it does mean the app now has one capped list and three uncapped ones.

**Not established — why KPMG Blue animates but carries no `✦`.** 27 themes are marked, 28 animate.
I found the discrepancy; I do not know whether it is intent or an oversight, and I did not change
it.

**Not established — which themes people actually use.** There is no usage data anywhere in the app.
"The handful they realistically use" is inferred from the app's own structure (its group names, its
ambient/static split, its brand theme, its contrast numbers) and from the outside review. It is not
evidence of behaviour, and the eight should be revisited when there is any.

**Not tested — anything but headless Chromium.** No Edge, Firefox, Safari, or a real GPU. No touch
input. Not tested in the 901–1180 px tablet band, where a third media query at line 11900 applies.

**Not verified against the real targets.** The anchors were counted only on this working copy. The
live app and `FROZEN_R6_BASE.html` are read-only to me and another engineer is measuring the base
right now, so I have not confirmed the anchors still occur exactly once there. Every anchor is
guarded by an assertion, so the patch will refuse rather than misfire — but "it will refuse" is not
the same as "it will apply".

**Known imperfection — ARIA.** `#themeMenuMoreButton` is a `<button>` inside a `role="listbox"`,
which is not strictly valid. It follows the existing house pattern: the five `.theme-menu-jump`
pills and the appearance bars are already buttons inside the same listbox. Fixing that properly
means restructuring the listbox and was out of scope.

**Known fragility.** The keyboard filter uses `offsetParent !== null` to mean "on screen".
`offsetParent` is also null for `position: fixed` elements; the option rows are statically
positioned so it is correct today, but a future change that makes a row fixed would silently drop
it out of arrow-key navigation.

**The patch is not idempotent.** Running it twice fails on the first assertion, by design.

**Stale comments left in place.** `.theme-menu-nav`'s "36 options" (line 3367) and the `✦` block's
"seven themes that animate" (line 2429) are both wrong and I did not correct them — they are
outside the anchors and belong to a separate tidy-up.
