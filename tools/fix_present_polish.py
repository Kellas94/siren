# -*- coding: utf-8 -*-
"""fix_present_polish.py — the design-critique pass on PRESENT AUTHORING.

Four changes, all found by the critique of the driven build:

  P1  Delete/Backspace in Build removed the current slide with NO confirmation,
      while the chip's × asked first. Same act, two answers — and the silent one
      is the one a hand finds by accident in front of a client. Both now go
      through one helper, mapRequestDeleteView().

  P2  The ＋ Add menu was one flat monospace list: "Diagram · Diagram 2" sat
      beside "Title slide" with nothing saying one puts an existing chart in the
      deck and the other makes a new slide. openStructureMenu grows ONE line —
      a row whose third tuple entry is the string 'heading' renders as a quiet
      section label instead of a dead button — and the two plain-English menus
      (＋ Add, and the toolbar's Present menu) opt into `.is-plain`: the app's UI
      font instead of the structure editor's monospace.

  P3  Every card chip in the deck strip read "Aa", so a picture slide, a table
      and a title were indistinguishable in the one place you reorder them. The
      chip now carries the kind's own glyph, and a picture card shows the
      picture.

  P4  The Build hint was a five-clause run-on. It now says the three things a
      first-timer needs, in the order they need them.

Usage: python fix_present_polish.py <target.html>
Anchor-guarded: every anchor must appear exactly once or nothing is written.
Atomic write. Refuses the live file in Downloads.
"""
import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new):
    EDITS.append((name, old, new))


# --------------------------------------------------------------- P1: one confirm
# The chip's × handler becomes a two-line call; the confirmation itself moves into
# mapRequestDeleteView so the keyboard path cannot diverge from it again.
edit('P1 chip delete uses the shared helper', '''          drop.addEventListener('click', event => {
            event.stopPropagation();
            if (state.map.route.length <= 1) { showToast('A route needs at least one view.', 'error'); return; }
            requestConfirmation({
              title: 'Remove this stop from the route?',
              message: `“${name}” will no longer be part of the presentation route. There is no undo for this.`,
              confirmText: 'Remove stop',
              action: () => { mapRouteIndex = index; mapDeleteView(); showToast('Stop removed from the route.', 'success'); }
            });
          });''', '''          drop.addEventListener('click', event => {
            event.stopPropagation();
            mapRequestDeleteView(index);
          });''')

edit('P1 the helper itself', '''      /* The first deliberate edit makes the deck the author's. From then on
         mapSeedRoute stops appending new diagrams behind their back and the
         walkthrough deck counts only what the route walks. */
      function mapMarkCurated() {''', '''      /* Removing a slide is the one irreversible edit in Build, so it asks — from
         the chip's × and from the Delete key alike. They used to disagree: the
         key deleted silently, which is exactly the hand that slips in front of a
         client. One helper, one answer. */
      function mapRequestDeleteView(index) {
        const route = (state.map && state.map.route) || [];
        const at = Number.isInteger(index) ? index : mapRouteIndex;
        if (!route[at]) return;
        if (route.length <= 1) { showToast('A route needs at least one view.', 'error'); return; }
        const name = mapViewLabel(route[at]);
        requestConfirmation({
          title: 'Remove this slide from the presentation?',
          message: `“${name}” will no longer be part of it. There is no undo for this.`,
          confirmText: 'Remove slide',
          action: () => { mapRouteIndex = at; mapDeleteView(); showToast('Slide removed.', 'success'); }
        });
      }

      /* The first deliberate edit makes the deck the author's. From then on
         mapSeedRoute stops appending new diagrams behind their back and the
         walkthrough deck counts only what the route walks. */
      function mapMarkCurated() {''')

edit('P1 the Delete key asks too', '''        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (mapRecording || mapBuilding) { mapDeleteView(); return true; }
          return false;
        }''', '''        if (event.key === 'Delete' || event.key === 'Backspace') {
          // Same act as the chip's ×, so the same question.
          if (mapRecording || mapBuilding) { mapRequestDeleteView(mapRouteIndex); return true; }
          return false;
        }''')

# ------------------------------------------------- P2: headings in structure menus
edit('P2 openStructureMenu learns a heading row', '''        options.forEach(([value, label, disabled]) => {
          const item = document.createElement('button');''', '''        options.forEach(([value, label, disabled]) => {
          // A row marked 'heading' is a section label, not an action that happens to
          // be unavailable: a list a non-coder reads needs to say what its groups
          // are without pretending they are buttons.
          if (disabled === 'heading') {
            const head = document.createElement('div');
            head.className = 'struct-menu-heading';
            head.setAttribute('role', 'presentation');
            head.textContent = label;
            menu.appendChild(head);
            return;
          }
          const item = document.createElement('button');''')

edit('P2 heading and plain-menu styles', '''    .struct-menu-item:disabled { opacity: .45; cursor: default; }''', '''    .struct-menu-item:disabled { opacity: .45; cursor: default; }
    .struct-menu-heading {
      padding: 8px 10px 3px;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: var(--subtle);
      pointer-events: none;
    }
    .struct-menu-heading:first-child { padding-top: 3px; }
    /* Two of these menus are not structure editing at all — they are the plain
       English questions "what shall I add?" and "what shall I present?". They wear
       the app's own UI font and a roomier row so they read as choices, not code. */
    .struct-menu.is-plain .struct-menu-item {
      font-family: inherit;
      font-size: 13.5px;
      line-height: 1.45;
      padding: 7px 12px;
      white-space: normal;
    }
    .struct-menu.is-plain { min-width: 248px; }''')

# ---------------------------------------------------- P2b: the ＋ Add menu grouped
edit('P2b Add menu groups', '''        state.diagrams.forEach(diagram => {
          if (walked.has(diagram.id) || options.length >= 8) return;
          options.push([`diagram:${diagram.id}`, `▤  Diagram · ${diagram.name || diagram.diagramTitle || 'Diagram'}`]);
        });
        // Documents already linked to the diagram in view come first: that is the
        // two-click path from a written workpaper to a slide.
        (state.workpapers || []).forEach(doc => {
          if (!(doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `📄  Document · ${doc.title}`]);
        });
        options.push(
          ['title', '❖  Title slide'],
          ['section', '❖  Section break'],
          ['text', '¶  Text — headings and bullets'],
          ['table', '▦  Table'],
          ['image', '🖼  Picture…'],
          ['embed', '▶  Video link…']
        );
        if (diagramId) options.push(['facts', '⌗  Facts about the blocks in view']);
        (state.workpapers || []).forEach(doc => {
          if ((doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `📄  Document · ${doc.title}`]);
        });
        openStructureMenu(anchorEl, options.slice(0, 18), '', value => {''', '''        const diagramRows = [];
        state.diagrams.forEach(diagram => {
          if (walked.has(diagram.id) || diagramRows.length >= 8) return;
          diagramRows.push([`diagram:${diagram.id}`, `▤  ${diagram.name || diagram.diagramTitle || 'Diagram'}`]);
        });
        if (diagramRows.length) {
          options.push(['', 'A diagram not in the deck yet', 'heading']);
          diagramRows.forEach(row => options.push(row));
        }
        options.push(['', 'A new slide', 'heading']);
        options.push(
          ['title', '❖  Title slide'],
          ['section', '❖  Section break'],
          ['text', '¶  Text — headings and bullets'],
          ['table', '▦  Table'],
          ['image', '🖼  Picture…'],
          ['embed', '▶  Video link…']
        );
        // Documents already linked to the diagram in view come first: that is the
        // two-click path from a written workpaper to a slide.
        const docRows = [];
        (state.workpapers || []).forEach(doc => {
          if (!(doc.links || []).some(link => link.diagramId === diagramId)) return;
          docRows.push([`doc:${doc.id}`, `📄  ${doc.title}`]);
        });
        (state.workpapers || []).forEach(doc => {
          if ((doc.links || []).some(link => link.diagramId === diagramId)) return;
          docRows.push([`doc:${doc.id}`, `📄  ${doc.title}`]);
        });
        if (diagramId || docRows.length) options.push(['', 'From what you have written', 'heading']);
        if (diagramId) options.push(['facts', '⌗  Facts about the blocks in view']);
        docRows.forEach(row => options.push(row));
        openStructureMenu(anchorEl, options.slice(0, 22), '', value => {''')

edit('P2c the Add menu is a plain-English menu', '''          } else {
            mapAddCard(value);
          }
        });
      }

      /* A diagram stop is the ＋ Add twin of mapCaptureView''', '''          } else {
            mapAddCard(value);
          }
        });
        if (structureMenuEl) structureMenuEl.classList.add('is-plain');
      }

      /* A diagram stop is the ＋ Add twin of mapCaptureView''')

edit('P2d the Present menu is plain English too', '''          if (choice === 'build' && typeof mapSetBuild === 'function' && !el.presentOverlay.hidden) mapSetBuild(true);
        });
      }''', '''          if (choice === 'build' && typeof mapSetBuild === 'function' && !el.presentOverlay.hidden) mapSetBuild(true);
        });
        if (structureMenuEl) structureMenuEl.classList.add('is-plain');
      }''')

# ------------------------------------------------------- P3: chips say what they are
edit('P3 card chips carry their kind', '''          thumb.textContent = card && card.kind === 'doc' ? '▤' : card && card.kind === 'facts' ? '≣' : 'Aa';
          return thumb;''', '''          // The strip is where the deck is reordered, so each chip has to say what
          // it is: a picture card shows its picture, every other kind shows the
          // glyph the card editor's own rail uses for it.
          const asset = card && card.kind === 'image' ? mapAssetGet(card.assetId) : null;
          if (asset) {
            const image = document.createElement('img');
            image.src = mapAssetDataUrl(asset);
            image.alt = '';
            thumb.appendChild(image);
            return thumb;
          }
          const entry = card ? MAP_CARD_KINDS.find(row => row[0] === card.kind) : null;
          thumb.textContent = entry ? entry[2] : 'Aa';
          return thumb;''')

# ------------------------------------------------- P5: the caret says it can build
# On a brand-new workspace of one diagram, a plain "Present" press presents that
# chart - correct, and the whole point of solo mode. But then this caret is the only
# door to the deck builder, and its tooltip did not admit that building was behind
# it. Now the hover text and the screen-reader name both say so.
edit('P5 the caret admits it builds',
     'aria-label="Choose what to present" title="Present just this diagram, or the whole workspace"',
     'aria-label="Choose what to present, or build the presentation" '
     'title="Present just this diagram, present the whole workspace, or build the presentation"')

# ----------------------------------------------------------------- P4: the hint
edit('P4 a hint a first-timer can finish reading', '''        mapSetHint(mapBuilding
          ? '＋ adds a slide · move the camera and press Space to keep a view · drag a chip (or Shift+←/→) to reorder · B or Done when finished'
          : MAP_RESTING_HINT);''', '''        // Three things, in the order a first-timer needs them. The Build bar's own
        // buttons carry the rest in their tooltips.
        mapSetHint(mapBuilding
          ? '＋ Add a slide · drag the chips to reorder · Done when the deck is right'
          : MAP_RESTING_HINT);''')


def main():
    if len(sys.argv) != 2:
        print('usage: python fix_present_polish.py <target.html>')
        return 2
    path = sys.argv[1]
    if not os.path.isfile(path):
        print('ABORT: target does not exist: ' + path)
        return 2
    if os.path.normcase(os.path.abspath(path)).endswith(
            os.path.normcase(os.path.join('downloads', 't_industries_siren_v1.html'))):
        print('ABORT: refusing to patch the live file in Downloads - patch a copy')
        return 2
    with io.open(path, 'r', encoding='utf-8', newline='') as handle:
        src = handle.read()
    if 'function mapRequestDeleteView' in src:
        print('OK: polish already applied to %s - nothing to do.' % path)
        return 0
    if 'function mapOpenAddMenu' not in src:
        print('ABORT: present authoring is not installed in this file yet')
        return 2
    problems = []
    for name, old, _new in EDITS:
        count = src.count(old)
        if count != 1:
            problems.append('%s: anchor found %d times (need exactly 1)' % (name, count))
    if problems:
        print('ABORT - nothing written. Anchor drift:')
        for problem in problems:
            print('  ' + problem)
        return 1
    out = src
    for _name, old, new in EDITS:
        out = out.replace(old, new, 1)
    directory = os.path.dirname(os.path.abspath(path)) or '.'
    fd, tmp = tempfile.mkstemp(dir=directory, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
            handle.write(out)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print('OK: %d critique fixes applied to %s' % (len(EDITS), path))
    return 0


if __name__ == '__main__':
    sys.exit(main())
