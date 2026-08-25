# SIREN Round 10 — closing the round 9 tail

Read `ROUND8_METHOD.md` first; the method is unchanged. The base has moved:

```
codex/FROZEN_R10_BASE.html
8,582,897 bytes
SHA-256  BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB
```

That is round 9 plus four patches applied on top of it: two theme patches, one that stops a trailing
non-breaking space reaching storage, and one that widens a Guided gate. Two of those four touch code
you worked in, so read the section at the end before you start.

**This round is small on purpose.** Three jobs, all found by driving your round 9 build with real
input. The point is to leave nothing open from round 9 rather than to start anything new — somebody
else is working in the editor mode row at the same time, which is why the split below is drawn where
it is.

---

## AS — `/` then Backspace then `/` again leaves you with `//` and no menu

Your Backspace fix works and is verified: the menu closes and the `/` comes back with the caret after
it. But it made Backspace the advertised way out of a menu opened by accident, and the obvious next
move fails.

Measured on your build and on the base, byte-identical, so this is pre-existing — **but it is newly
reachable, because nothing previously invited a person to press Backspace here**:

```
type "/"            menu opens
press Backspace     menu closes, paragraph reads "/", caret after it     <- your fix, correct
type "/" again      paragraph reads "//", no menu
```

The cause is in code common to both builds: the editor's own guard

```js
if (editor.textContent.trim() || editor.querySelector('img, table, li')) return;
```

sees the restored `/` and refuses to open the inserter, because the paragraph is no longer empty.

**Done means** the second `/` opens the menu on a paragraph whose only content is the marker,
**and** a slash typed mid-sentence still does not (`Sample 12/2026` must stay text), **and** a bare
`/` on a genuinely empty paragraph still opens it. The middle one is the trap: relaxing the guard to
"is the content only slashes" is not the same as "is this a marker".

---

## AT — half of the Docs submenu still opens far from the click

AP fixed three rows and the handback's sentence covers all of them. Measured, only three moved:

| row | where it opens at click x=360 / 520 / 980 / 1200 |
|---|---|
| `A block above…` | 360 / 520 / 980 / 1184 — follows the click |
| `A block below…` | follows the click |
| the gap's `Insert a block here…` | follows the click |
| **`⇄ Turn into…`** | **352 / 352 / 352 / 352** — identical to the old build |
| **`⚑ Mark as purpose, boundaries…`** | **352 flat**, and 122 at 1280, 22 at 900 |

So two of the four second-level rows still open roughly 600px from the pointer. `openWorkpaperAddMenu`
gained the point; the other two builders did not.

**Done means** all four rows open adjacent to the click, from a paragraph, from the gap between
blocks and from blank page space, at several x positions **including under 300** — that low-x
measurement is what separates a real fix from one that only looks right against the right-edge clamp
at `innerWidth - menuWidth - 8`. The keyboard route must still anchor on the focused element.

---

## AU — one reordering that fixes two menu defects

AR's containment works: on the ship build, zero of 62 opened menus violate the viewport on any side
across widths 240–1440. But it introduced two failures, and both are the same bug on two axes.

`const scrollable = menu.scrollHeight > menu.clientHeight + 1` is computed immediately after
`appendChild`, **thirteen lines before** the width squeeze. Narrowing a wrapping `.is-plain` menu
makes it taller, so the flag is measured against a height that no longer exists.

The consequences, measured:

- **A row disappears silently.** At 240×420 the Docs page menu hides its last row with nothing on
  screen and nothing in the accessibility tree to say so — the announcement this project added in
  round 8 does not fire, because the flag was computed before the squeeze made it true.
- **Text is cut.** At 240/248/256 the Present ⋯ menu squeezes to 224px; `⤓ Export the deck as
  PowerPoint (.pptx)` loses 65.2px of glyphs and the file type is simply gone from the rendered
  picture. At 300 the old build lost nothing and the new one loses a closing bracket.

**Move the `scrollable` computation to after the squeeze.** That is the whole job. Then re-measure
both: the announcement must fire when a row is genuinely hidden, and no menu may cut a glyph at
240, 248, 256, 300 or 320.

**State the materiality honestly in both directions.** Every loss here lives below 320 CSS px, which
is the WCAG reflow floor and is reached in practice at 400% zoom rather than on any shipping phone.
It is worth fixing and it is not worth overstating.

---

## What is being worked on at the same time, and why you are not in it

The editor mode row — the Visual / Code buttons and the builder panel behind them — is being
rewritten in parallel, because measured on 20 diagram types the builder can edit 3, one has its own
editor, and **16 open a panel of ten controls that cannot change anything**.

Nothing in your three jobs touches that surface. Keep it that way: if a fix seems to want
`visualModeButton`, `visualModePanel`, `applyEditorMode` or the mode routing, stop and say so in the
handback rather than reaching into it.

## Four patches landed on top of your round 9 — two are in your code

- **A trailing non-breaking space no longer reaches storage.** Your AN resumes a paragraph as
  `editor.innerHTML = '/&nbsp;'` and your comment explains why: contenteditable collapses a trailing
  ordinary space and `.wp-text` does not preserve whitespace. That reasoning is right. What was
  wrong is what it left behind — measured, `/` space then a word normalises correctly, but `/` space
  then *stopping* stored the literal entity permanently, so the paragraph never matched a search for
  what was on screen while the string `nbsp` did. Normalisation now happens at both persistence
  boundaries, `wpBoundEditedHtml` and `sanitizeWorkpaperHtml`. Your caret behaviour is untouched.
- **The Guided gate now covers everything above the declaration**, not only the front matter. Your AQ
  correctly re-enabled body rows on documents with a leading blank line, and that re-enabled a row
  that had only ever been protected by accident: the blank line between the closing `---` and
  `flowchart TD` offered `Insert block below`, which wrote a node above the declaration and left the
  app saying *"The first line must name the diagram type."* That gate was mine and it was too narrow;
  your fix exposed it rather than caused it. It now reads "at or before the declaration".

If either of those anchors is in your way, report the drift rather than working around it.
