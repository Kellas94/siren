# -*- coding: utf-8 -*-
"""
fix_present_cardsindiagram.py  —  python fix_present_cardsindiagram.py <target.html>

TWO THINGS THE OWNER ASKED FOR, inside Present and nowhere else.

1. "sa poti sa pui in cadrul modului de prezentare de diagrame, ferestre de
   prezentare" — content slides INSIDE a diagram's walkthrough.

   What was already there, plainly: diagram.presentation.sequence held entries of
   four types, node | overview | section | chapter, and `section` DID render a
   full-screen plate between two steps (#presentSectionCard). But that plate is a
   TITLE PLATE and nothing more — an eyebrow, a heading and one line of grey
   subtitle, none of it authored except the heading. The real card model — eight
   kinds, a rich body, tables, pictures, video links, documents, block facts, an
   editor dialog with a live "THE EXPORTED SLIDE" preview and a slide renderer
   that lands in the PDF — lived on the MAP and only on the Map.

   So this is the extension the brief asked about, not a parallel model: a fifth
   entry type, `card`, that CARRIES a map card record sanitised by the very same
   sanitizeMapCard. One card model, one editor, one slide renderer, one exporter,
   two places to put a card.

2. Text colour in cards, reusing the Docs machinery: WP_TEXT_COLOURS /
   WP_TEXT_HIGHLIGHTS applied by applyWorkpaperTextClass as sanitised CLASSES.
   The card body editor is already a `.wp-text` field running the same
   sanitizeWorkpaperHtml, so the classes already survived the sanitiser and the
   round trip — what was missing was a way to apply them and, more seriously, a
   slide renderer that honoured them. A colour that shows on screen and vanishes
   in the export is worse than no colour, so each class is MEASURED off a live
   probe span and written into the SVG as its literal rgb().

Anchor-guarded, atomic, aborts without writing on any drift.
"""

import sys, os, io, hashlib

EDITS = []


def say(line):
    """A Windows console is cp1252; an abort report must never die printing itself."""
    try:
        print(line)
    except UnicodeEncodeError:
        enc = (getattr(sys.stdout, "encoding", None) or "ascii")
        print(line.encode(enc, "replace").decode(enc, "replace"))


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# ---------------------------------------------------------------- 1. CSS ----

edit(
    "css: the walkthrough card stage",
    """    .present-section-card p { margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
""",
    """    .present-section-card p { margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
    /* A content slide inside a diagram walkthrough is not a plate floating over the
       picture — it IS the slide, so the diagram behind it steps aside while it is up.
       What it shows is literally mapCardSlideSvg: the same drawing the deck export
       rasterises, at projector size, so the room and the PDF cannot disagree. */
    .present-card-stage {
      position: absolute;
      inset: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--canvas-bg);
      pointer-events: none;
    }
    .present-card-stage[hidden] { display: none !important; }
    .present-card-stage img { max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; }
    .present-stage-shell.is-card-slide > .present-stage,
    .present-stage-shell.is-card-slide > .present-minimap { visibility: hidden; }
""",
)

edit(
    "css: palette colour survives the card body's own b/h rules",
    """    .map-card .map-card-digest { white-space: pre-wrap; }
""",
    """    .map-card .map-card-digest { white-space: pre-wrap; }
    /* Colour in a card is the Docs palette — wp-c-* / wp-hl-* classes, never inline
       style. The b/strong/h1-h3 rules above set a colour of their own and outrank a
       coloured span's inherited one, so a bold coloured word came out plain black.
       One rule, higher specificity, hands the colour back. */
    .map-card .map-card-body [class*="wp-c-"] b,
    .map-card .map-card-body [class*="wp-c-"] strong,
    .map-card .map-card-body [class*="wp-c-"] h1,
    .map-card .map-card-body [class*="wp-c-"] h2,
    .map-card .map-card-body [class*="wp-c-"] h3 { color: inherit; }
""",
)

# --------------------------------------------------------------- 2. HTML ----

edit(
    "html: card stage element on the presentation stage",
    """          <div class="present-section-card" id="presentSectionCard" hidden><p class="eyebrow" id="presentSectionKind">Overview</p><h2 id="presentSectionTitle">Presentation</h2><p id="presentSectionSubtitle"></p></div>
""",
    """          <div class="present-section-card" id="presentSectionCard" hidden><p class="eyebrow" id="presentSectionKind">Overview</p><h2 id="presentSectionTitle">Presentation</h2><p id="presentSectionSubtitle"></p></div>
          <div class="present-card-stage" id="presentCardStage" hidden><img id="presentCardStageImage" alt="" /></div>
""",
)

edit(
    "html: one ＋ Add a slide… in the Navigator, replacing two of the eight kinds",
    """                <button class="btn ghost compact" id="presentAddOverviewButton" type="button">＋ Overview</button>
                <button class="btn ghost compact" id="presentAddSectionButton" type="button">＋ Section</button>
""",
    """                <button class="btn ghost compact" id="presentAddSlideButton" type="button" aria-haspopup="listbox" title="Put a slide between the steps of this walkthrough — a title, a note, a table, a picture">＋ Add a slide…</button>
""",
)

edit(
    "el: register the two new stage nodes",
    """'presentStageShell','presentStage','presentSectionCard',""",
    """'presentStageShell','presentStage','presentCardStage','presentCardStageImage','presentSectionCard',""",
)

edit(
    "el: the Navigator's add button",
    """'presentSequenceList','presentAddOverviewButton','presentAddSectionButton','presentEditSequenceButton',""",
    """'presentSequenceList','presentAddSlideButton','presentEditSequenceButton',""",
)

# -------------------------------------------------------------- 3. MODEL ----

edit(
    "model: a fifth entry type",
    """        const type = ['node','overview','section','chapter'].includes(entry.type) ? entry.type : '';""",
    """        const type = ['node','overview','section','chapter','card'].includes(entry.type) ? entry.type : '';""",
)

edit(
    "model: the entry carries a real map card",
    """        if (type === 'section' || type === 'overview') clean.title = String(entry.title || (type === 'overview' ? 'Overview' : 'Section')).slice(0, 120);
        return clean;
      }
""",
    """        if (type === 'section' || type === 'overview') clean.title = String(entry.title || (type === 'overview' ? 'Overview' : 'Section')).slice(0, 120);
        /* A CONTENT SLIDE INSIDE THE WALKTHROUGH. The walkthrough already had a
           section card, but only as a title plate: eyebrow, heading, one grey line.
           The full card model — eight kinds, the rich body, tables, pictures, the
           editor dialog and the slide renderer that lands in the PDF — lived on the
           Map. Rather than grow a second card model here, the entry CARRIES a map
           card record and hands it to the same sanitizeMapCard, so one editor, one
           renderer and one exporter serve both places. It rides inside
           diagram.presentation.sequence, which is already saved, undone, exported
           into a .siren and read back by this very function. */
        if (type === 'card') {
          clean.card = sanitizeMapCard(entry.card || {});
          clean.title = String(clean.card.title || clean.card.eyebrow || 'Slide').slice(0, 120);
        }
        return clean;
      }
""",
)

edit(
    "model: a card entry is always valid, like overview and section",
    """          return entry.type === 'overview' || entry.type === 'section';""",
    """          return entry.type === 'overview' || entry.type === 'section' || entry.type === 'card';""",
)

edit(
    "model: the step list and the header read the card's own heading",
    """        if (entry.type === 'section') return entry.title || 'Section';
        return entry.title || 'Overview';""",
    """        if (entry.type === 'section') return entry.title || 'Section';
        if (entry.type === 'card') return (entry.card && (entry.card.title || entry.card.eyebrow)) || entry.title || 'Slide';
        return entry.title || 'Overview';""",
)

edit(
    "camera: a card entry is a full-screen slide, not a place to fly to",
    """        if (!raw || !primary || !entry || entry.type === 'overview' || entry.type === 'section') return presentFullViewBox;""",
    """        if (!raw || !primary || !entry || entry.type === 'overview' || entry.type === 'section' || entry.type === 'card') return presentFullViewBox;""",
)

# ------------------------------------------------------- 4. STAGE RENDER ----

edit(
    "stage: show the card slide, and stand the section plate down",
    """      function updatePresentationSectionCard(entry) {
        const diagram = getPresentationDiagram();
        if (!entry || entry.type === 'overview') {""",
    """      /* THE SAME PICTURE THE DECK EXPORTS. mapCardSlideSvg is the deck's own slide
         renderer; putting its output on the stage as an image is what makes "render
         full-screen at projector size" and "export into the deck PDF" the same
         sentence rather than two implementations that drift. */
      let presentCardSlideKey = '';

      function presentShowCardSlide(entry) {
        if (!el.presentCardStage || !el.presentCardStageImage) return;
        const on = Boolean(entry && entry.type === 'card' && entry.card);
        el.presentStageShell.classList.toggle('is-card-slide', on);
        el.presentCardStage.hidden = !on;
        if (!on) {
          presentCardSlideKey = '';
          el.presentCardStageImage.removeAttribute('src');
          return;
        }
        let svg = '';
        try { svg = mapCardSlideSvg(entry.card, 1920, 1080); }
        catch (error) { svg = ''; }
        const key = entry.id + '\\u0000' + svg;
        if (key === presentCardSlideKey) return;
        presentCardSlideKey = key;
        el.presentCardStageImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        el.presentCardStageImage.alt = presentationEntryLabel(entry);
      }

      /* What the audience window is handed: the picture already on the stage, so the
         second screen cannot render a different one. */
      function presentCardSlideDataUrl() {
        if (!el.presentCardStage || el.presentCardStage.hidden || !el.presentCardStageImage) return '';
        return el.presentCardStageImage.getAttribute('src') || '';
      }

      function updatePresentationSectionCard(entry) {
        presentShowCardSlide(entry);
        if (entry && entry.type === 'card') { el.presentSectionCard.hidden = true; return; }
        const diagram = getPresentationDiagram();
        if (!entry || entry.type === 'overview') {""",
)

edit(
    "stage: leaving the presentation takes the card slide down with it",
    """        el.presentStage.replaceChildren();""",
    """        el.presentStage.replaceChildren();
        presentShowCardSlide(null);""",
)

# --------------------------------------------------- 5. THE NAVIGATOR UI ----

edit(
    "navigator: a card row says which kind it is",
    """          const meta = entry.type === 'node' ? `Block ${entry.nodeId}` : entry.type === 'chapter' ? 'Chapter' : entry.type === 'section' ? 'Section title' : 'Overview';""",
    """          const meta = entry.type === 'node' ? `Block ${entry.nodeId}`
            : entry.type === 'chapter' ? 'Chapter'
            : entry.type === 'section' ? 'Section title'
            : entry.type === 'card' ? `${mapCardKindMeta(entry.card && entry.card.kind)[1]} slide`
            : 'Overview';""",
)

edit(
    "navigator: a card row gains ✎, next to the four actions every row already has",
    """          [['↑','up','Move up'],['↓','down','Move down'],['⧉','duplicate','Repeat step'],['×','remove','Remove from presentation']].forEach(([glyph,action,title])=>{""",
    """          const rowActions = entry.type === 'card'
            ? [['✎','edit','Edit this slide'],['↑','up','Move up'],['↓','down','Move down'],['⧉','duplicate','Repeat step'],['×','remove','Remove from presentation']]
            : [['↑','up','Move up'],['↓','down','Move down'],['⧉','duplicate','Repeat step'],['×','remove','Remove from presentation']];
          rowActions.forEach(([glyph,action,title])=>{""",
)

edit(
    "navigator: ✎ opens the card editor; ⧉ copies the card instead of sharing it",
    """        event.stopPropagation();
        if (action === 'up' && index > 0) [presentSequence[index-1],presentSequence[index]]=[presentSequence[index],presentSequence[index-1]];
        else if (action === 'down' && index < presentSequence.length-1) [presentSequence[index+1],presentSequence[index]]=[presentSequence[index],presentSequence[index+1]];
        else if (action === 'duplicate') presentSequence.splice(index+1,0,{...presentSequence[index],id:makePresentationEntryId(presentSequence[index].type)});""",
    """        event.stopPropagation();
        if (action === 'edit') { editPresentationCardEntry(index); return; }
        if (action === 'up' && index > 0) [presentSequence[index-1],presentSequence[index]]=[presentSequence[index],presentSequence[index-1]];
        else if (action === 'down' && index < presentSequence.length-1) [presentSequence[index+1],presentSequence[index]]=[presentSequence[index],presentSequence[index+1]];
        else if (action === 'duplicate') presentSequence.splice(index+1,0,clonePresentationEntry(presentSequence[index]));""",
)

edit(
    "navigator: ＋ Add a slide… is the one home for everything insertable",
    """      function addPresentationOverviewEntry() {""",
    """      /* A repeated card has to be its OWN card. Spreading the entry shared one card
         record between the two steps, so editing the copy edited the original — which
         is not what 'repeat' means anywhere else in this app. */
      function clonePresentationEntry(entry) {
        const copy = { ...entry, id: makePresentationEntryId(entry.type) };
        if (entry.type === 'card' && entry.card) copy.card = sanitizeMapCard({ ...entry.card, id: '' });
        return copy;
      }

      /* ONE HOME FOR "PUT SOMETHING HERE". ＋ Overview and ＋ Section were two of the
         things an author can drop between two steps; the other six — text, table,
         picture, video link, document, block facts — existed only on the Map. The
         Map's own ＋ Add is exactly this menu, so the walkthrough gets the same menu
         in the same order under the same insertion rule: everything lands after the
         step the presenter is standing on, and opens its editor straight away. */
      function openPresentationAddSlideMenu(anchorEl) {
        const diagram = getPresentationDiagram();
        const options = [
          ['', 'A slide between the steps', 'heading'],
          ['title', '❖  Title slide'],
          ['text', '¶  Text — headings and bullets'],
          ['table', '▦  Table'],
          ['image', '🖼  Picture…'],
          ['embed', '▶  Video link…']
        ];
        const docRows = (state.workpapers || []).slice(0, 6).map(doc => [`doc:${doc.id}`, `📄  ${doc.title}`]);
        if (diagram) options.push(['facts', '⌗  Facts about the blocks in this diagram']);
        if (docRows.length) {
          options.push(['', 'From what you have written', 'heading']);
          docRows.forEach(row => options.push(row));
        }
        options.push(['', 'Markers on the diagram itself', 'heading'],
          ['marker:overview', '⤢  Show the whole diagram'],
          ['marker:section', '❘  Section title']);
        openStructureMenu(anchorEl, options.slice(0, 22), '', value => {
          if (value === 'marker:overview') { addPresentationOverviewEntry(); return; }
          if (value === 'marker:section') { addPresentationSectionEntry(); return; }
          if (value.startsWith('doc:')) {
            const doc = (state.workpapers || []).find(entry => entry.id === value.slice(4));
            if (doc) addPresentationCardEntry('doc', { title: doc.title, docId: doc.id });
            return;
          }
          if (value === 'facts') {
            const ids = presentSvg
              ? Array.from(presentSvg.querySelectorAll('.node')).map(mapNodeIdFromElement).filter(Boolean).slice(0, 8)
              : [];
            addPresentationCardEntry('facts', { diagramId: diagram ? diagram.id : '', nodeIds: ids });
            return;
          }
          addPresentationCardEntry(value, value === 'title'
            ? { eyebrow: '', title: diagram ? (diagram.name || diagram.diagramTitle || '') : '' }
            : null);
        });
        if (structureMenuEl) structureMenuEl.classList.add('is-plain');
      }

      function addPresentationCardEntry(kind, extra) {
        if (!state.map) state.map = makeDefaultMapState();
        const seed = MAP_CARD_SEEDS[kind] || MAP_CARD_SEEDS.text;
        const size = mapCardDefaultSize(kind);
        const card = sanitizeMapCard({ kind, w: size.w, h: size.h, ...seed, ...(extra || {}) });
        mapEnsureCardPayload(card);
        const entry = { id: makePresentationEntryId('card'), type: 'card', card, title: card.title || 'Slide' };
        const at = Math.max(0, presentIndex + 1);
        presentSequence.splice(at, 0, entry);
        presentIndex = at;
        resetPresentationNavigationForIndex(at);
        persistPresentationSequence();
        renderPresentationSequenceList();
        updatePresentationView(false);
        editPresentationCardEntry(at, true);
        return entry;
      }

      /* The Map's card editor, HOSTED by the walkthrough: the same dialog, the same
         kind rail, the same live "THE EXPORTED SLIDE" preview, the same Delete — only
         the three verbs that say where this card lives are swapped. One card editor
         in the app, which is the whole point of carrying a map card record. */
      function editPresentationCardEntry(index, fresh) {
        const entry = presentSequence[index];
        if (!entry || entry.type !== 'card' || !entry.card) return;
        if (!state.map) state.map = makeDefaultMapState();
        mapEditCard(entry.card, {
          fresh: Boolean(fresh),
          focus: entry.card.kind === 'text' ? 'body' : undefined,
          host: {
            redraw: () => {
              presentCardSlideKey = '';
              if (currentPresentationEntry() === entry) presentShowCardSlide(entry);
              renderPresentationSequenceList();
              schedulePresenterRefresh();
              scheduleAudienceBroadcast();
            },
            commit: card => {
              entry.card = sanitizeMapCard(card);
              entry.title = entry.card.title || entry.card.eyebrow || 'Slide';
              persistPresentationSequence();
              mapCollectAssets();
              presentCardSlideKey = '';
              renderPresentationSequenceList();
              updatePresentationView(false);
            },
            remove: () => {
              const at = presentSequence.indexOf(entry);
              if (at < 0) return;
              presentSequence.splice(at, 1);
              presentIndex = clamp(presentIndex, -1, presentSequence.length - 1);
              resetPresentationNavigationForIndex(presentIndex);
              persistPresentationSequence();
              mapCollectAssets();
              presentCardSlideKey = '';
              renderPresentationSequenceList();
              updatePresentationView(false);
            }
          }
        });
      }

      function addPresentationOverviewEntry() {""",
)

edit(
    "navigator: wire the one button",
    """        el.presentAddOverviewButton.addEventListener('click', addPresentationOverviewEntry);
        el.presentAddSectionButton.addEventListener('click', addPresentationSectionEntry);""",
    """        if (el.presentAddSlideButton) el.presentAddSlideButton.addEventListener('click', () => openPresentationAddSlideMenu(el.presentAddSlideButton));""",
)

# ------------------------------------------------- 6. THE EDITOR'S HOST ----

edit(
    "editor: a host, or the plane",
    """      let mapCardEditorCard = null;
      let mapCardEditorFresh = false;""",
    """      let mapCardEditorCard = null;
      /* Null means the card lives on the plane, which is what it has always meant. A
         host is set when the card lives inside one diagram's walkthrough instead:
         three verbs saying where to commit, what to redraw, and what Delete means. */
      let mapCardEditorHost = null;
      let mapCardEditorFresh = false;""",
)

edit(
    "editor: typing redraws the host, not the plane",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        scheduleSave();
        if (!mapCardRenderFrame) {""",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        scheduleSave();
        if (mapCardEditorHost) {
          mapCardEditorHost.redraw();
          mapCardEditorPreview();
          if (rerenderPane) mapRenderCardEditorPane();
          return;
        }
        if (!mapCardRenderFrame) {""",
)

edit(
    "editor: Done commits to the host",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        const index = state.map.cards.findIndex(entry => entry.id === card.id);""",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        if (mapCardEditorHost) { mapCardEditorHost.commit(card); return; }
        const index = state.map.cards.findIndex(entry => entry.id === card.id);""",
)

edit(
    "editor: Delete removes the step, not a card on the plane",
    """          confirmText: 'Delete card',
          action: () => {
            state.map.cards = state.map.cards.filter(entry => entry.id !== card.id);""",
    """          confirmText: 'Delete card',
          action: () => {
            if (host) {
              mapCardEditorCard = null;
              if (mapCardEditorEl && mapCardEditorEl.open) mapCardEditorEl.close();
              host.remove();
              showToast('Slide deleted.', 'success');
              return;
            }
            state.map.cards = state.map.cards.filter(entry => entry.id !== card.id);""",
)

edit(
    "editor: capture the host before the confirmation closes the dialog",
    """        const label = card.title || card.eyebrow || 'this card';
        requestConfirmation({
          title: 'Delete this card?',""",
    """        const label = card.title || card.eyebrow || 'this card';
        const host = mapCardEditorHost;
        requestConfirmation({
          title: 'Delete this card?',""",
)

edit(
    "editor: set the host when opening",
    """        mapCardEditorCard = card;
        mapCardEditorFresh = Boolean(settings.fresh);""",
    """        mapCardEditorCard = card;
        mapCardEditorHost = settings.host || null;
        mapCardEditorFresh = Boolean(settings.fresh);""",
)

edit(
    "editor: clear the host when the dialog closes",
    """        dialog.addEventListener('close', () => {
          mapCardEditorCard = null;
          if (mapCardEditorRefs) mapCardEditorRefs.body = null;
        });""",
    """        dialog.addEventListener('close', () => {
          mapCardEditorCard = null;
          mapCardEditorHost = null;
          if (mapCardEditorRefs) mapCardEditorRefs.body = null;
        });""",
)

edit(
    "assets: a picture on a walkthrough slide is in use too",
    """      function mapAssetIdsInUse() {
        const used = new Set();
        ((state.map && state.map.cards) || []).forEach(card => {
          if (card && card.assetId) used.add(String(card.assetId));
        });
        return used;
      }""",
    """      function mapAssetIdsInUse() {
        const used = new Set();
        ((state.map && state.map.cards) || []).forEach(card => {
          if (card && card.assetId) used.add(String(card.assetId));
        });
        /* A picture card can now also live inside one diagram's walkthrough. Those
           bytes are in use exactly as much as the plane's are — without this the next
           sweep would collect a slide's screenshot out from under it, and the .siren
           would travel without it. */
        (state.diagrams || []).forEach(diagram => {
          const sequence = (diagram && diagram.presentation && diagram.presentation.sequence) || [];
          if (!Array.isArray(sequence)) return;
          sequence.forEach(entry => {
            if (entry && entry.type === 'card' && entry.card && entry.card.assetId) used.add(String(entry.card.assetId));
          });
        });
        return used;
      }""",
)

# ------------------------------------------ 7. PRESENTER / AUDIENCE VIEW ----

edit(
    "presenter: NEXT draws a card slide, not the diagram with a block lit",
    """      function presenterStepSvg(entry) {
        if (!presentSvg) return '';""",
    """      function presenterStepSvg(entry) {
        // A content slide is not "the same picture with another block lit" — it is its
        // own picture, and it is the very picture the deck export draws.
        if (entry && entry.type === 'card' && entry.card) {
          try { return mapCardSlideSvg(entry.card, 1920, 1080); }
          catch (error) { return ''; }
        }
        if (!presentSvg) return '';""",
)

edit(
    "presenter: NOW draws the card slide while one is on stage",
    """        if (mapMode) nowSvg = stop ? await presenterSlideSvg(stop) : '';
        else nowSvg = presentSvg ? presenterDressSvg(new XMLSerializer().serializeToString(presentSvg)) : '';""",
    """        const nowEntry = mapMode ? null : currentPresentationEntry();
        if (mapMode) nowSvg = stop ? await presenterSlideSvg(stop) : '';
        else if (nowEntry && nowEntry.type === 'card') nowSvg = presenterStepSvg(nowEntry);
        else nowSvg = presentSvg ? presenterDressSvg(new XMLSerializer().serializeToString(presentSvg)) : '';""",
)

edit(
    "audience: the card slide travels in the broadcast",
    """annotations:el.presentAnnotationCanvas?.toDataURL('image/png')||'',pointer:presentPointerState};""",
    """annotations:el.presentAnnotationCanvas?.toDataURL('image/png')||'',cardSlide:presentCardSlideDataUrl(),pointer:presentPointerState};""",
)

edit(
    "audience: the direct-DOM path shows it",
    """doc.getElementById('annotations').src=payload.annotations;""",
    """doc.getElementById('annotations').src=payload.annotations;const cardSlide=doc.getElementById('cardSlide');if(cardSlide){cardSlide.hidden=!payload.cardSlide;if(payload.cardSlide)cardSlide.src=payload.cardSlide;else cardSlide.removeAttribute('src');}""",
)

edit(
    "audience: the BroadcastChannel path shows it",
    """q('annotations').src=d.annotations||'';""",
    """q('annotations').src=d.annotations||'';q('cardSlide').hidden=!d.cardSlide;if(d.cardSlide)q('cardSlide').src=d.cardSlide;else q('cardSlide').removeAttribute('src');""",
)

edit(
    "audience: the element and its rule",
    """<div id="stage"><div id="svg"></div><div id="section" hidden>""",
    """<div id="stage"><div id="svg"></div><img id="cardSlide" hidden><div id="section" hidden>""",
)

edit(
    "audience: the card slide fills the room's screen",
    """#stage svg{width:100%;height:100%;display:block}""",
    """#stage svg{width:100%;height:100%;display:block}#cardSlide{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:6}#cardSlide[hidden]{display:none}""",
)

# ------------------------------------------------------- 8. DECK EXPORT ----

edit(
    "export: a diagram stop expands into its walkthrough's content slides",
    """      async function mapExportRoute(format) {""",
    """      /* THE DECK IS WHAT THE ROOM SAW. A diagram stop used to be exactly one slide —
         the whole picture — while any content slide an author placed between the steps
         of that diagram's walkthrough lived on screen and nowhere else. So a stop now
         EXPANDS: the walkthrough is walked in its own order, each content slide becomes
         a slide, and the diagram's own picture stands where its first block step
         stands, which is where the room first sees it. A diagram with no content slides
         expands to exactly the one slide it always produced. */
      async function mapStopSlides(view) {
        const target = (view && view.target) || { kind: 'map' };
        const note = String((view && view.note) || '');
        if (target.kind !== 'diagram' && target.kind !== 'nodes') {
          const only = await mapViewSlideSvg(view);
          return only ? [{ svg: only, note, label: mapViewLabel(view) }] : [];
        }
        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        if (!diagram) return [];
        const base = await mapViewSlideSvg(view);
        const sequence = speakerSequenceForDiagram(diagram);
        const cards = sequence.filter(entry => entry && entry.type === 'card' && entry.card);
        if (!cards.length) return base ? [{ svg: base, note, label: mapViewLabel(view) }] : [];
        const notes = (diagram.presentation && diagram.presentation.notes) || {};
        const out = [];
        let placed = false;
        sequence.forEach(entry => {
          if (entry && entry.type === 'card' && entry.card) {
            let svg = '';
            try { svg = mapCardSlideSvg(entry.card, 1920, 1080); }
            catch (error) { svg = ''; }
            if (svg) {
              out.push({
                svg,
                note: String((notes['card:' + entry.id] || {}).text || ''),
                label: entry.card.title || entry.card.eyebrow || 'Slide'
              });
            }
            return;
          }
          if (!placed && base) { placed = true; out.push({ svg: base, note, label: mapViewLabel(view) }); }
        });
        if (!placed && base) out.push({ svg: base, note, label: mapViewLabel(view) });
        return out;
      }

      async function mapExportRoute(format) {""",
)

edit(
    "export: rasterise the expanded list",
    """        showToast(`Building ${route.length} slide${route.length === 1 ? '' : 's'}…`);
        const pages = [];
        const failed = [];
        for (let index = 0; index < route.length; index += 1) {
          try {
            const svg = await mapViewSlideSvg(route[index]);
            if (!svg) { failed.push(index + 1); continue; }
            const shot = await svgToCanvas(svg, 2, 'current');
            const canvas = shot && shot.canvas ? shot.canvas : shot;
            if (!canvas || !canvas.width) { failed.push(index + 1); continue; }
            pages.push({
              jpeg: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
              imageWidth: canvas.width,
              imageHeight: canvas.height,
              note: route[index].note || ''
            });
          } catch (error) {
            // One unrenderable view must not take the whole deck down silently.
            failed.push(index + 1);
            console.error('slide export failed for view', index + 1, error);
          }
        }""",
    """        showToast(`Building ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        const slides = [];
        const failed = [];
        for (let index = 0; index < route.length; index += 1) {
          try {
            const expanded = await mapStopSlides(route[index]);
            if (!expanded.length) { failed.push(index + 1); continue; }
            expanded.forEach(item => slides.push(item));
          } catch (error) {
            // One unrenderable view must not take the whole deck down silently.
            failed.push(index + 1);
            console.error('slide export failed for view', index + 1, error);
          }
        }
        const pages = [];
        for (let index = 0; index < slides.length; index += 1) {
          try {
            const shot = await svgToCanvas(slides[index].svg, 2, 'current');
            const canvas = shot && shot.canvas ? shot.canvas : shot;
            if (!canvas || !canvas.width) { failed.push(index + 1); continue; }
            pages.push({
              jpeg: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
              imageWidth: canvas.width,
              imageHeight: canvas.height,
              note: slides[index].note || ''
            });
          } catch (error) {
            failed.push(index + 1);
            console.error('slide export failed for slide', index + 1, error);
          }
        }""",
)

edit(
    "export: the notes file lists the slides it actually rendered",
    """        const notes = route.map((view, index) => `${index + 1}. ${mapViewLabel(view)}\\n${view.note || '(no note)'}`).join('\\n\\n');""",
    """        const notes = slides.map((slide, index) => `${index + 1}. ${slide.label}\\n${slide.note || '(no note)'}`).join('\\n\\n');""",
)

# ---------------------------------------------------------- 9. COLOUR UI ----

edit(
    "colour: the card's own toolbar gets the Docs palette",
    """        ['clear', '⌫', 'Remove formatting', '']
      ];""",
    """        ['clear', '⌫', 'Remove formatting', ''],
        /* Colour is the DOCS palette, not a second one: the same wp-c-* / wp-hl-*
           class names applied by the same applyWorkpaperTextClass and kept by the same
           sanitizeWorkpaperHtml this field already runs on blur. A class survives save,
           .siren and the slide renderer; an inline style would be stripped on the next
           keystroke. */
        ['colour', '◑', 'Text colour and highlight', '']
      ];""",
)

edit(
    "colour: the button opens the palette",
    """            if (command === 'h1') cardApplyRichTextFormat('heading', '<h1>');""",
    """            if (command === 'colour') openWorkpaperPalette(button);
            else if (command === 'h1') cardApplyRichTextFormat('heading', '<h1>');""",
)

edit(
    "colour: SHARED PRIMITIVE — a swatch must not blur the words it is colouring",
    """            if (!className) { button.dataset.none = 'yes'; button.textContent = '\\u2205'; }
            button.addEventListener('click', () => {""",
    """            if (!className) { button.dataset.none = 'yes'; button.textContent = '\\u2205'; }
            // Mousedown on a swatch blurred the editor the words were selected in; that
            // blur handler sanitises and rewrites innerHTML, and execCommand then had
            // nothing left to colour. Cancelling the default keeps focus and selection
            // exactly where they were — the same guard the formatting buttons already
            // use. This fixes the Docs palette as well as the card one.
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => {""",
)

# ------------------------------------------------- 10. COLOUR IN THE SVG ----

edit(
    "colour: SHARED PRIMITIVE — the outside-click listener must be detached when the palette closes",
    """      let workpaperPaletteEl = null;

      function closeWorkpaperPalette() {
        if (workpaperPaletteEl) { workpaperPaletteEl.remove(); workpaperPaletteEl = null; }
      }""",
    """      let workpaperPaletteEl = null;
      let workpaperPaletteAway = null;

      function closeWorkpaperPalette() {
        if (workpaperPaletteAway) {
          document.removeEventListener('mousedown', workpaperPaletteAway, true);
          workpaperPaletteAway = null;
        }
        if (workpaperPaletteEl) { workpaperPaletteEl.remove(); workpaperPaletteEl = null; }
      }""",
)

edit(
    "colour: SHARED PRIMITIVE — a second colour in one sitting used to do nothing",
    """        workpaperPaletteEl = pop;
        const away = event => {
          if (pop.contains(event.target) || anchor.contains(event.target)) return;
          closeWorkpaperPalette();
          document.removeEventListener('mousedown', away, true);
        };
        document.addEventListener('mousedown', away, true);""",
    """        workpaperPaletteEl = pop;
        /* The listener removed itself ONLY on the outside-click branch, so picking a
           swatch left it registered for ever. The NEXT palette's swatches then met that
           stale listener, which — remembering the old popover — saw them as "outside",
           closed the live palette on mousedown, and the click landed on a removed
           element. Colouring a second run of words in the same sitting silently did
           nothing. Closing detaches, so every open starts with exactly one listener. */
        const away = event => {
          if (pop.contains(event.target) || anchor.contains(event.target)) return;
          closeWorkpaperPalette();
        };
        workpaperPaletteAway = away;
        document.addEventListener('mousedown', away, true);""",
)

edit(
    "colour: SHARED PRIMITIVE — the palette must live in the same layer as its anchor",
    """        document.body.appendChild(pop);
        const box = anchor.getBoundingClientRect();
        const height = pop.offsetHeight;
        const width = pop.offsetWidth;""",
    """        /* A <dialog> opened with showModal() sits in the browser's top layer, which no
           z-index can climb over: parented to <body> the palette rendered BEHIND the
           card editor and every swatch click landed on the dialog instead. Parenting it
           to the open dialog puts it in the same layer. Position is `fixed`, so the
           viewport maths below is unchanged, and Docs — whose toolbar is not in a
           dialog — still gets document.body exactly as before. */
        ((anchor.closest && anchor.closest('dialog[open]')) || document.body).appendChild(pop);
        const box = anchor.getBoundingClientRect();
        const height = pop.offsetHeight;
        const width = pop.offsetWidth;""",
)

edit(
    "colour: measure each palette class instead of guessing it",
    """      /* The asset store is a separate key, not part of `state`, so a 40 MB library of""",
    """      /* wp-c-* / wp-hl-* are CSS classes, and an SVG <text> in a rasterised slide
         cannot carry a class: sanitizeSvgForRaster keeps no stylesheet, and the theme
         does the mixing anyway (color-mix against --text, per theme, 36 of them). So
         each class is MEASURED — a probe span carrying that class, in the live
         document, read back through getComputedStyle — and the literal rgb() it
         resolves to is what goes into the slide. That is why a red word is the same
         red on screen, in the editor's preview and in the exported PDF. */
      let mapSlideInkCache = null;

      function mapSlideInk() {
        let key = '';
        try {
          key = String((state && state.theme) || '') + '|'
            + String(getComputedStyle(document.body).getPropertyValue('--text') || '').trim() + '|'
            + String(getComputedStyle(document.body).getPropertyValue('--panel-bg') || '').trim();
        } catch (error) { key = 'none'; }
        if (mapSlideInkCache && mapSlideInkCache.key === key) return mapSlideInkCache.map;
        const map = { text: {}, fill: {} };
        let host = null;
        try {
          host = document.createElement('div');
          host.setAttribute('aria-hidden', 'true');
          host.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
          document.body.appendChild(host);
          const probe = className => {
            const span = document.createElement('span');
            span.className = className;
            span.textContent = 'x';
            host.appendChild(span);
            return getComputedStyle(span);
          };
          /* A theme may resolve a swatch to `color(srgb …)` or `oklch(…)`. A colour in
             an SVG paint attribute has to be something every consumer of the file can
             read, so one 1x1 canvas turns whatever the engine computed into the
             eight-bit hex it will actually paint. Still the measurement — just written
             in the only notation a paint attribute is guaranteed to understand. */
          let ink = null;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            ink = canvas.getContext('2d', { willReadFrequently: true }) || null;
          } catch (error) { ink = null; }
          const hex = value => {
            const text = String(value || '').trim();
            if (!text || !ink) return '';
            try {
              ink.clearRect(0, 0, 1, 1);
              ink.fillStyle = '#000000';
              ink.fillStyle = text;
              ink.fillRect(0, 0, 1, 1);
              const pixel = ink.getImageData(0, 0, 1, 1).data;
              if (!pixel[3]) return '';
              return '#' + [pixel[0], pixel[1], pixel[2]].map(part => part.toString(16).padStart(2, '0')).join('');
            } catch (error) { return ''; }
          };
          WP_TEXT_COLOURS.forEach(entry => {
            if (!entry[0]) return;
            const value = hex(probe(entry[0]).color);
            if (value) map.text[entry[0]] = value;
          });
          WP_TEXT_HIGHLIGHTS.forEach(entry => {
            if (!entry[0]) return;
            const value = hex(probe(entry[0]).backgroundColor);
            if (value) map.fill[entry[0]] = value;
          });
        } catch (error) { /* a probe is a nicety; a slide without colour still renders */ }
        if (host && host.parentNode) host.parentNode.removeChild(host);
        mapSlideInkCache = { key: key, map: map };
        return map;
      }

      /* The asset store is a separate key, not part of `state`, so a 40 MB library of""",
)

edit(
    "colour: two more properties make a run different",
    """      function mapSlideRunStyleEquals(a, b) {
        return !!a && !!b && a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;
      }""",
    """      function mapSlideRunStyleEquals(a, b) {
        return !!a && !!b && a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
          && (a.colour || '') === (b.colour || '') && (a.highlight || '') === (b.highlight || '');
      }""",
)

edit(
    "colour: merging keeps the ink",
    """          else runs.push({ text: token.text, bold: !!token.bold, italic: !!token.italic, underline: !!token.underline });""",
    """          else runs.push({ text: token.text, bold: !!token.bold, italic: !!token.italic, underline: !!token.underline, colour: token.colour || '', highlight: token.highlight || '' });""",
)

edit(
    "colour: a broken-up long word keeps the ink",
    """          if (buffer && mapSlideTextWidth(next, font) > limit) {
            pieces.push({ text: buffer, space: false, bold: token.bold, italic: token.italic, underline: token.underline });
            buffer = character;
          } else {
            buffer = next;
          }
        });
        if (buffer) pieces.push({ text: buffer, space: false, bold: token.bold, italic: token.italic, underline: token.underline });""",
    """          if (buffer && mapSlideTextWidth(next, font) > limit) {
            pieces.push({ ...token, text: buffer, space: false });
            buffer = character;
          } else {
            buffer = next;
          }
        });
        if (buffer) pieces.push({ ...token, text: buffer, space: false });""",
)

edit(
    "colour: wrapping keeps the ink",
    """            tokens.push({
              text: isSpace ? ' ' : part,
              space: isSpace,
              bold: !!(run && run.bold),
              italic: !!(run && run.italic),
              underline: !!(run && run.underline)
            });""",
    """            tokens.push({
              text: isSpace ? ' ' : part,
              space: isSpace,
              bold: !!(run && run.bold),
              italic: !!(run && run.italic),
              underline: !!(run && run.underline),
              colour: (run && run.colour) || '',
              // A space between two highlighted words carries the highlight too, or
              // the wash comes out as a row of separate stripes.
              highlight: (run && run.highlight) || ''
            });""",
)

edit(
    "colour: the line painter",
    """      function mapSlideLineSvg(runs, x, y, size, family, baseWeight, fill, opacity, anchor) {
        const list = (Array.isArray(runs) ? runs : []).filter(run => run && String(run.text || '').length);
        if (!list.length) return '';
        let attrs = `x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" fill="${mapEscapeXml(fill)}"`
          + ` font-family="${mapEscapeXml(family)}" font-size="${mapSlideNum(size)}"`;
        if (opacity != null && Number(opacity) < 1) attrs += ` opacity="${mapSlideNum(opacity)}"`;
        if (anchor) attrs += ` text-anchor="${mapEscapeXml(anchor)}"`;
        const decorate = run => (run.italic ? ' font-style="italic"' : '') + (run.underline ? ' text-decoration="underline"' : '');
        if (list.length === 1) {
          const run = list[0];
          return `<text ${attrs} font-weight="${run.bold ? 700 : baseWeight}"${decorate(run)}>${mapEscapeXml(run.text)}</text>`;
        }
        const spans = list.map(run =>
          `<tspan font-weight="${run.bold ? 700 : baseWeight}"${decorate(run)}>${mapEscapeXml(run.text)}</tspan>`).join('');
        return `<text ${attrs} font-weight="${baseWeight}" xml:space="preserve">${spans}</text>`;
      }""",
    """      function mapSlideLineSvg(runs, x, y, size, family, baseWeight, fill, opacity, anchor) {
        const list = (Array.isArray(runs) ? runs : []).filter(run => run && String(run.text || '').length);
        if (!list.length) return '';
        const decorate = run => (run.italic ? ' font-style="italic"' : '') + (run.underline ? ' text-decoration="underline"' : '');
        const weightOf = run => (run.bold ? 700 : baseWeight);

        /* A highlight is a rectangle behind the words, so the run's start has to be
           known in advance: SVG has no line box to paint one for us. Widths come from
           the same measurer that wrapped the line, so the wash lands exactly under the
           glyphs it belongs to at every anchor. */
        let marks = '';
        if (list.some(run => run.highlight)) {
          const widths = list.map(run => mapSlideTextWidth(run.text, mapSlideFont(size, weightOf(run), run.italic, family)));
          const total = widths.reduce((sum, value) => sum + value, 0);
          let cursor = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
          list.forEach((run, index) => {
            if (run.highlight && widths[index] > 0) {
              marks += `<rect x="${mapSlideNum(cursor - size * 0.05)}" y="${mapSlideNum(y - size * 0.84)}"`
                + ` width="${mapSlideNum(widths[index] + size * 0.1)}" height="${mapSlideNum(size * 1.14)}"`
                + ` rx="${mapSlideNum(size * 0.12)}" fill="${mapEscapeXml(run.highlight)}"/>`;
            }
            cursor += widths[index];
          });
        }

        // One run, no highlight: still one <text>, and its own colour simply becomes
        // the fill. A coloured run drops the body's 0.92 wash — the palette measured a
        // colour and the slide must show that colour, not a faded version of it.
        if (list.length === 1 && !list[0].highlight) {
          const run = list[0];
          let solo = `x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" fill="${mapEscapeXml(run.colour || fill)}"`
            + ` font-family="${mapEscapeXml(family)}" font-size="${mapSlideNum(size)}"`;
          if (!run.colour && opacity != null && Number(opacity) < 1) solo += ` opacity="${mapSlideNum(opacity)}"`;
          if (anchor) solo += ` text-anchor="${mapEscapeXml(anchor)}"`;
          return `${marks}<text ${solo} font-weight="${weightOf(run)}"${decorate(run)}>${mapEscapeXml(run.text)}</text>`;
        }

        // Mixed runs: the wash rides as fill-opacity so a coloured tspan can opt out of
        // it. For text with no stroke the two are the same picture.
        const inked = list.some(run => run.colour);
        let attrs = `x="${mapSlideNum(x)}" y="${mapSlideNum(y)}" fill="${mapEscapeXml(fill)}"`
          + ` font-family="${mapEscapeXml(family)}" font-size="${mapSlideNum(size)}"`;
        if (opacity != null && Number(opacity) < 1) attrs += `${inked ? ' fill-opacity' : ' opacity'}="${mapSlideNum(opacity)}"`;
        if (anchor) attrs += ` text-anchor="${mapEscapeXml(anchor)}"`;
        const ink = run => (run.colour ? ` fill="${mapEscapeXml(run.colour)}" fill-opacity="1"` : '');
        const spans = list.map(run =>
          `<tspan font-weight="${weightOf(run)}"${decorate(run)}${ink(run)}>${mapEscapeXml(run.text)}</tspan>`).join('');
        return `${marks}<text ${attrs} font-weight="${baseWeight}" xml:space="preserve">${spans}</text>`;
      }""",
)

edit(
    "colour: sanitised <span class=wp-…> becomes ink on the run",
    """        const addText = (value, style) => {
          const text = String(value == null ? '' : value).replace(/\\s+/g, ' ');
          if (!text) return;
          const item = ensure();
          if (!item.runs.length && text === ' ') return;
          const last = item.runs[item.runs.length - 1];
          if (mapSlideRunStyleEquals(last, style)) last.text += text;
          else item.runs.push({ text: text, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline });
        };
        const restyle = (style, patch) => Object.assign({ bold: false, italic: false, underline: false }, style, patch);""",
    """        const addText = (value, style) => {
          const text = String(value == null ? '' : value).replace(/\\s+/g, ' ');
          if (!text) return;
          const item = ensure();
          if (!item.runs.length && text === ' ') return;
          const last = item.runs[item.runs.length - 1];
          if (mapSlideRunStyleEquals(last, style)) last.text += text;
          else item.runs.push({ text: text, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline, colour: style.colour || '', highlight: style.highlight || '' });
        };
        const restyle = (style, patch) => Object.assign({ bold: false, italic: false, underline: false, colour: '', highlight: '' }, style, patch);""",
)

edit(
    "colour: the walker reads the class the sanitiser kept",
    """            if (tag === 'U') { walk(child, restyle(style, { underline: true }), list); return; }""",
    """            if (tag === 'U') { walk(child, restyle(style, { underline: true }), list); return; }
            /* The ONLY attribute sanitizeWorkpaperHtml keeps is class, and only for a
               SPAN, and only with names from the fixed palette — so this is the whole
               of the styling vocabulary that can reach here. */
            if (tag === 'SPAN') {
              const ink = mapSlideInk();
              const names = String(child.getAttribute('class') || '').split(/\\s+/);
              const colourName = names.find(name => ink.text[name]);
              const highlightName = names.find(name => ink.fill[name]);
              walk(child, restyle(style, {
                colour: colourName ? ink.text[colourName] : (style.colour || ''),
                highlight: highlightName ? ink.fill[highlightName] : (style.highlight || '')
              }), list);
              return;
            }""",
)

edit(
    "colour: an elided table cell keeps its ink",
    """              last[last.length - 1] = { text: `${last[last.length - 1].text}…`, bold: last[last.length - 1].bold, italic: last[last.length - 1].italic, underline: last[last.length - 1].underline };""",
    """              last[last.length - 1] = { ...last[last.length - 1], text: `${last[last.length - 1].text}…` };""",
)

edit(
    "colour: an elided heading keeps its ink",
    """          last[last.length - 1] = { text: `${tail.text}…`, bold: tail.bold, italic: tail.italic, underline: tail.underline };""",
    """          last[last.length - 1] = { ...tail, text: `${tail.text}…` };""",
)


# --------------------------------------------------------------- driver ----

def main():
    if len(sys.argv) < 2:
        say("usage: python fix_present_cardsindiagram.py <target.html>")
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        say("ABORT: no such file: " + target)
        return 2
    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()
    original = text
    before = len(text)

    problems = []
    for name, old, new, count in EDITS:
        found = text.count(old)
        if found != count:
            problems.append("  [%s] anchor found %d time(s), expected %d" % (name, found, count))
    if problems:
        say("ABORT: anchor drift, nothing written.")
        for line in problems:
            say(line)
        return 1

    for name, old, new, count in EDITS:
        text = text.replace(old, new, count)

    # --- sanity pass: what the patch promises must be true of the result ---
    checks = [
        ("card entry type accepted", "['node','overview','section','chapter','card']" in text),
        ("card entry carries a sanitised map card", "clean.card = sanitizeMapCard(entry.card || {});" in text),
        ("card stage element", 'id="presentCardStage"' in text),
        ("one add button, not two", text.count('id="presentAddSlideButton"') == 1
            and 'id="presentAddOverviewButton"' not in text
            and 'id="presentAddSectionButton"' not in text),
        ("editor host", "let mapCardEditorHost = null;" in text),
        ("assets sweep sees walkthrough cards", "entry.type === 'card' && entry.card && entry.card.assetId" in text),
        ("deck export expands a stop", "async function mapStopSlides(view)" in text),
        ("palette button on the card toolbar", "['colour', '◑', 'Text colour and highlight', '']" in text),
        ("palette swatch keeps the selection", "button.addEventListener('mousedown', event => event.preventDefault());" in text),
        ("class colours are measured", "function mapSlideInk()" in text),
        ("the slide painter honours ink", 'fill-opacity="1"' in text),
        ("measured colours are normalised to hex", "const hex = value =>" in text),
        ("palette listener is detached on close", "workpaperPaletteAway = null;" in text),
        ("no duplicate fill attribute in the solo path", "${marks}<text ${solo}" in text),
        ("palette lands in the dialog's own layer", "anchor.closest('dialog[open]')" in text),
    ]
    bad = [name for name, ok in checks if not ok]
    if bad:
        say("ABORT: sanity check failed, nothing written: " + ", ".join(bad))
        return 1

    if text == original:
        say("ABORT: patch produced no change.")
        return 1

    tmp = target + ".tmp-cardsindiagram"
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(tmp, target)
    say("OK  %s" % target)
    say("    %d edits, %d -> %d chars" % (len(EDITS), before, len(text)))
    say("    md5 %s" % hashlib.md5(text.encode("utf-8")).hexdigest())
    return 0


if __name__ == "__main__":
    sys.exit(main())
