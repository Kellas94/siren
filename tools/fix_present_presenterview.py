# -*- coding: utf-8 -*-
"""
PRESENTER VIEW for SIREN Present mode.

The second window every presenter expects from PowerPoint and Keynote: the
current slide small, THE NEXT SLIDE large, this stop's notes at readable size,
the elapsed clock and the position. Next in either window moves both.

It is deliberately the MIRROR of the "▣ Audience" screen that already exists,
not a second concept:
  * the same same-origin window.open + document.write construction,
  * the same live Present state as its only source of truth (the Map route
    when the Map is up, the diagram walkthrough when a diagram is on stage),
  * the same refresh beat - it hangs off broadcastPresentationState() and
    mapUpdateChrome(), the two places the app already announces "the
    presentation moved".

Where it differs from the audience window, it differs on purpose: the popup
carries NO inline script. It is same-origin, so this document attaches real
addEventListener handlers to the popup's own buttons and writes its text with
textContent. Nothing depends on 'unsafe-inline' reaching an about:blank child,
and there is no message protocol to keep in sync.

Entry points are folded into controls that already exist - the Present bar's
⋯ menu (next to the audience entry) and the Map bar's ⋯ cluster. The resting
Present bar keeps its seven controls.

Usage:  python fix_present_presenterview.py <path-to-SIREN.html>
Anchor-guarded, atomic, and it aborts WITHOUT WRITING on any drift.
"""

import io
import os
import sys
import tempfile

# --------------------------------------------------------------------------
# The presenter window's own document. Static skeleton only: every piece of
# text and every picture is written into it from the app document afterwards,
# so this string never needs escaping and never goes stale.
# --------------------------------------------------------------------------
PRESENTER_HTML_JS = r"""
      /* The presenter display is always dark, the way Keynote's and PowerPoint's
         are: it is a private screen in a dim room, and it must not flare when the
         app is in a light theme. Fixed hexes rather than theme tokens, so the
         contrast below is a fact and not a theme's opinion:
           notes  #f4f7fa on #171e26 = 16.1:1
           muted  #a8b8c7 on #0e1319 =  9.3:1
           Next   #08131c on #7dd3fc = 11.4:1, hover #57bff0 = 9.1:1 (darker) */
      const PRESENTER_WINDOW_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>Siren Presenter</title><style>'
        + ':root{--pv-bg:#0e1319;--pv-panel:#171e26;--pv-line:#2b3642;--pv-ink:#f4f7fa;--pv-dim:#a8b8c7;--pv-accent:#7dd3fc;--pv-accent-ink:#08131c}'
        + '*{box-sizing:border-box}'
        + 'html,body{margin:0;height:100%;background:var(--pv-bg);color:var(--pv-ink);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;-webkit-font-smoothing:antialiased}'
        + '#pvRoot{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,.78fr) auto;gap:13px;padding:14px 16px 15px}'
        + '.pv-head{display:flex;align-items:baseline;gap:14px;min-width:0}'
        + '.pv-brand{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--pv-dim);white-space:nowrap}'
        + '.pv-title{font-size:16px;font-weight:700;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.pv-pos{font-size:13px;color:var(--pv-dim);white-space:nowrap;font-variant-numeric:tabular-nums}'
        + '.pv-clock{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}'
        + '.pv-panes{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:14px;min-height:0}'
        + '.pv-pane{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;min-width:0;min-height:0}'
        + '.pv-cap{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--pv-dim)}'
        + '.pv-pane.is-next .pv-cap{color:var(--pv-accent)}'
        + '.pv-frame{position:relative;min-height:0;border:1px solid var(--pv-line);border-radius:12px;background:var(--pv-panel);overflow:hidden;display:flex;align-items:center;justify-content:center}'
        + '.pv-pane.is-next .pv-frame{border-color:#41586b}'
        + '.pv-frame img{width:100%;height:100%;object-fit:contain;display:block}'
        + '.pv-frame img[hidden]{display:none}'
        + '.pv-plate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:20px}'
        + '.pv-plate[hidden]{display:none}'
        + '.pv-plate strong{font-size:20px}'
        + '.pv-plate span{font-size:14px;line-height:1.5;color:var(--pv-dim);max-width:36ch}'
        + '.pv-label{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.pv-notes{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-height:0}'
        + '.pv-notes-body{overflow:auto;border:1px solid var(--pv-line);border-radius:12px;background:var(--pv-panel);padding:16px 18px;font-size:21px;line-height:1.55;white-space:pre-wrap;color:var(--pv-ink)}'
        + '.pv-notes-body.is-empty{font-size:16px;font-style:italic;color:var(--pv-dim)}'
        + '.pv-foot{display:flex;align-items:center;gap:10px}'
        + '.pv-btn{font:inherit;font-size:14px;font-weight:600;padding:10px 17px;border-radius:10px;border:1px solid var(--pv-line);background:transparent;color:var(--pv-ink);cursor:pointer}'
        + '.pv-btn:hover{background:#212b35}'
        + '.pv-btn.is-primary{background:var(--pv-accent);border-color:var(--pv-accent);color:var(--pv-accent-ink)}'
        + '.pv-btn.is-primary:hover{background:#57bff0;border-color:#57bff0}'
        + '.pv-btn:focus-visible{outline:2px solid var(--pv-accent);outline-offset:2px}'
        + '.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}'
        + '</style></head><body><div id="pvRoot">'
        + '<div class="pv-head"><span class="pv-brand">Presenter</span><span class="pv-title" id="pvTitle">Presentation</span><span class="pv-pos" id="pvPos"></span><span class="pv-clock" id="pvClock">00:00</span></div>'
        + '<div class="pv-panes">'
        + '<section class="pv-pane is-now"><div class="pv-cap">On screen now</div><div class="pv-frame" id="pvNowFrame"><img alt=""><div class="pv-plate" hidden><strong></strong><span></span></div></div><div class="pv-label" id="pvNowLabel"></div></section>'
        + '<section class="pv-pane is-next"><div class="pv-cap">Next</div><div class="pv-frame" id="pvNextFrame"><img alt=""><div class="pv-plate" hidden><strong></strong><span></span></div></div><div class="pv-label" id="pvNextLabel"></div></section>'
        + '</div>'
        + '<section class="pv-notes"><div class="pv-cap" id="pvNotesCap">Notes</div><div class="pv-notes-body" id="pvNotes"></div></section>'
        + '<div class="pv-foot"><button class="pv-btn" id="pvPrev" type="button">&#9664; Previous</button><button class="pv-btn is-primary" id="pvNext" type="button">Next &#9654;</button><span class="pv-hint" id="pvHint"></span></div>'
        + '</div></body></html>';
"""

# --------------------------------------------------------------------------
# 1. State variables
# --------------------------------------------------------------------------
A_VARS = "      let presentAudienceBroadcastTimer = null;\n"
N_VARS = A_VARS + (
    "      // Presenter view: the second window this presenter looks at while the\n"
    "      // audience window shows the picture. A direct same-origin reference, not a\n"
    "      // channel - it is opened by this document, so its DOM is simply written.\n"
    "      let presentPresenterWindow = null;\n"
    "      let presentPresenterTimer = null;\n"
    "      let presentPresenterToken = 0;\n"
)

# --------------------------------------------------------------------------
# 2. Map bar entry, inside the ⋯ cluster (.map-authoring), never at rest
# --------------------------------------------------------------------------
A_MAPBTN = (
    '<button class="btn ghost compact" id="mapPresenterButton" type="button" '
    'aria-pressed="true" title="Presenter notes">▤ Notes</button>'
)
N_MAPBTN = A_MAPBTN + (
    '\n              <button class="btn ghost compact" id="mapPresenterViewButton" type="button" '
    'aria-pressed="false" title="Open the presenter view: the next slide, this stop’s notes and the clock, '
    'on your screen only">⧉ Presenter view</button>'
)

# --------------------------------------------------------------------------
# 3. Element registry
# --------------------------------------------------------------------------
A_REG = "'mapPresenterButton','mapFullscreenButton','mapMoreButton'"
N_REG = "'mapPresenterButton','mapPresenterViewButton','mapFullscreenButton','mapMoreButton'"

# --------------------------------------------------------------------------
# 4. Map bar binding
# --------------------------------------------------------------------------
A_BIND = """        if (el.mapPresenterButton) el.mapPresenterButton.addEventListener('click', () => {
          const on = el.mapPanel.hidden;
          el.mapPanel.hidden = !on;
          el.mapPresenterButton.setAttribute('aria-pressed', String(on));
        });
"""
N_BIND = A_BIND + (
    "        if (el.mapPresenterViewButton) el.mapPresenterViewButton.addEventListener('click', "
    "togglePresentationPresenterWindow);\n"
)

# --------------------------------------------------------------------------
# 5. Present bar ⋯ menu: the presenter entry sits beside the audience entry,
#    because they are the two halves of one idea.
# --------------------------------------------------------------------------
A_MENU = (
    "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? "
    "'▣ Close the audience screen' : '▣ Open the audience screen'],\n"
)
N_MENU = (
    "          ['presenter', presenterWindowLive() ? '⧉ Close the presenter view' : "
    "'⧉ Open the presenter view'],\n"
) + A_MENU

A_PICK = """        openStructureMenu(el.presentMoreButton, options, '', choice => {
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];
"""
N_PICK = """        openStructureMenu(el.presentMoreButton, options, '', choice => {
          // Presenter view has no stashed button to click through: it is a window,
          // not a control, so the menu calls it directly.
          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];
"""

# --------------------------------------------------------------------------
# 6. The implementation, inserted just before closePresentationAudienceWindow
# --------------------------------------------------------------------------
A_IMPL = "      function closePresentationAudienceWindow() {"

N_IMPL = r"""      /* =====================================================================
         PRESENTER VIEW — the second screen, and the mirror of ▣ Audience.

         ▣ Audience opens a same-origin popup and pushes the stage into it for
         the room. Presenter view is the SAME live state rendered for the other
         pair of eyes: what is on screen now (small), WHAT IS NEXT (large — the
         thing a presenter actually buys a second screen for), the note for this
         stop at reading size, the clock and the position. It is not a second
         presentation concept: there is one presentation, and Next in either
         window moves it.

         Built with document.write like the audience screen, but driven entirely
         from this document. The popup is same-origin, so its buttons take real
         addEventListener handlers from here and its text is written with
         textContent — no inline script in the child, no message protocol, and
         nothing that depends on 'unsafe-inline' reaching an about:blank frame.

         "Next" means whatever Next will actually do, which is not always the
         next stop: on the Map it is route[i+1]; inside a diagram it is the next
         step, then the next diagram in the deck, then the end. A pending
         decision is announced rather than guessed at, and the end of the deck
         says so instead of going blank. */

      /* The stage's own presentation classes carry no styling of their own — the
         overlay's stylesheet supplies it, and a data: URL in an <img> has no
         stylesheet. These rules ride inside the picture so a thumbnail shows the
         same block lit that the audience is looking at. Stroked rather than
         glowed: a drop-shadow disappears at preview size. */
      const PRESENTER_HIGHLIGHT_CSS = '.t-present-dim{opacity:.14}'
        + '.t-present-previous{opacity:.72}'
        + '.t-present-next{opacity:.8}'
        + '.t-present-active rect,.t-present-active circle,.t-present-active ellipse,.t-present-active polygon,.t-present-active>path{stroke:#7dd3fc!important;stroke-width:3.5px!important}'
        + '.t-present-chapter rect,.t-present-chapter circle,.t-present-chapter ellipse,.t-present-chapter polygon{stroke:#7dd3fc!important;stroke-width:2.5px!important}'
        + '.t-present-path path,path.t-present-path{stroke:#7dd3fc!important;stroke-width:3px!important}';

__PRESENTER_HTML__

      function presenterWindowLive() {
        try { return Boolean(presentPresenterWindow && !presentPresenterWindow.closed && presentPresenterWindow.document); }
        catch (error) { return false; }
      }

      function presenterRoute() {
        return (state.map && state.map.route) || [];
      }

      /* A stage SVG carries style="width:100%;height:100%" and no width/height
         attributes, which leaves an <img> with no intrinsic size to scale
         against. Give the picture its viewBox back, and append the highlight
         rules last so they win over mermaid's own <style>. */
      function presenterDressSvg(svgString) {
        const source = String(svgString || '');
        if (!source) return '';
        let root = null;
        try {
          const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
          root = parsed.documentElement;
          if (!root || root.nodeName === 'parsererror' || root.querySelector('parsererror')) return source;
        } catch (error) { return source; }
        try {
          const box = getSvgViewBox(root);
          if (box && box.width && box.height) {
            root.setAttribute('width', String(Math.round(box.width)));
            root.setAttribute('height', String(Math.round(box.height)));
          }
          root.removeAttribute('style');
          const style = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
          style.textContent = PRESENTER_HIGHLIGHT_CSS;
          root.appendChild(style);
          return new XMLSerializer().serializeToString(root);
        } catch (error) { return source; }
      }

      /* The same slide the deck export draws, so the preview and the exported
         PDF cannot disagree about what a stop looks like. */
      async function presenterSlideSvg(view) {
        if (!view) return '';
        try { return presenterDressSvg(await mapViewSlideSvg(view)); }
        catch (error) { return ''; }
      }

      /* The next step inside a diagram is the same picture with another block
         lit, so it is drawn by re-lighting a clone rather than by rendering a
         second diagram. */
      function presenterStepSvg(entry) {
        if (!presentSvg) return '';
        try {
          const clone = presentSvg.cloneNode(true);
          // The stage SVG's viewBox is wherever the camera is standing, which is
          // framed on the CURRENT block — cloning it would preview the next step
          // through a window the next step is not inside. The preview goes back to
          // the whole diagram, so the ring shows where the walk is heading.
          if (presentFullViewBox) {
            clone.setAttribute('viewBox', presentFullViewBox.x + ' ' + presentFullViewBox.y
              + ' ' + presentFullViewBox.width + ' ' + presentFullViewBox.height);
          }
          clone.querySelectorAll('.t-present-dim,.t-present-active,.t-present-previous,.t-present-path,.t-present-next,.t-present-chapter')
            .forEach(node => node.classList.remove('t-present-dim','t-present-active','t-present-previous','t-present-path','t-present-next','t-present-chapter'));
          if (entry && entry.type === 'node') {
            findSvgNodeGroups(clone, entry.nodeId).forEach(group => group.classList.add('t-present-active'));
          } else if (entry && entry.type === 'chapter') {
            const chapter = presentModel && presentModel.subgraphs
              ? presentModel.subgraphs.find(group => group.id === entry.chapterId)
              : null;
            (chapter ? chapter.members : []).forEach(id => {
              findSvgNodeGroups(clone, id).forEach(group => group.classList.add('t-present-active'));
            });
          }
          return presenterDressSvg(new XMLSerializer().serializeToString(clone));
        } catch (error) { return ''; }
      }

      function presenterDiagramName(diagram) {
        return diagram ? (diagram.name || diagram.diagramTitle || 'Diagram') : '';
      }

      /* What pressing Next will actually do — read off the same branches
         stepPresentation() and mapStepRoute() take, so the second screen cannot
         promise a slide the presentation will not go to. */
      async function presenterNextPlan() {
        const route = presenterRoute();
        if (mapMode) {
          const at = mapRouteIndex + 1;
          if (at < route.length) return { label: mapViewLabel(route[at]), svg: await presenterSlideSvg(route[at]) };
          if (state.map && state.map.settings && state.map.settings.loop && route.length) {
            return { label: '↻ Back to the start · ' + mapViewLabel(route[0]), svg: await presenterSlideSvg(route[0]) };
          }
          return { plate: 'End of the deck', plateNote: 'This is the last stop. There is nothing after it.' };
        }
        const entry = currentPresentationEntry();
        if (entry && entry.type === 'node' && presentDecisionMode !== 'continue') {
          const branches = outgoingEdges(entry.nodeId);
          if (branches.length > 1 && !presentBranchSelections.has(entry.nodeId)) {
            return {
              plate: 'A decision comes next',
              plateNote: branches.length + ' paths leave this block — Next will ask you which one to take.'
            };
          }
        }
        if (presentIndex < presentSequence.length - 1) {
          const nextEntry = presentSequence[presentIndex < 0 ? 0 : presentIndex + 1];
          return {
            label: 'Step ' + ((presentIndex < 0 ? 0 : presentIndex + 1) + 1) + ' · ' + presentationEntryLabel(nextEntry),
            svg: presenterStepSvg(nextEntry)
          };
        }
        if (presentDeckIndex < presentDeckIds.length - 1) {
          const diagram = state.diagrams.find(item => item.id === presentDeckIds[presentDeckIndex + 1]);
          let svg = '';
          try { svg = diagram ? presenterDressSvg(await presentationSvgForDiagram(diagram)) : ''; }
          catch (error) { svg = ''; }
          return { label: presenterDiagramName(diagram) + ' · Overview', svg };
        }
        if (el.presentAutoplayLoop && el.presentAutoplayLoop.checked && presentDeckIds.length) {
          const diagram = state.diagrams.find(item => item.id === presentDeckIds[0]);
          let svg = '';
          try { svg = diagram ? presenterDressSvg(await presentationSvgForDiagram(diagram)) : ''; }
          catch (error) { svg = ''; }
          return { label: '↻ Back to the start · ' + presenterDiagramName(diagram), svg };
        }
        return { plate: 'End of the deck', plateNote: 'This is the last step. There is nothing after it.' };
      }

      function presenterSetPicture(frame, svgString, plateTitle, plateNote) {
        if (!frame) return;
        const image = frame.querySelector('img');
        const plate = frame.querySelector('.pv-plate');
        if (!image || !plate) return;
        if (svgString) {
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
          image.hidden = false;
          plate.hidden = true;
          return;
        }
        image.removeAttribute('src');
        image.hidden = true;
        plate.hidden = false;
        plate.querySelector('strong').textContent = plateTitle || 'Nothing to show';
        plate.querySelector('span').textContent = plateNote || '';
      }

      async function renderPresenterWindow() {
        if (!presenterWindowLive()) return;
        const doc = presentPresenterWindow.document;
        const q = id => doc.getElementById(id);
        // The skeleton is written synchronously at open; if it is not there the
        // window is not ours to paint.
        if (!q('pvNext') || !q('pvNotes')) return;
        const token = ++presentPresenterToken;
        const route = presenterRoute();
        const at = route.length ? clamp(mapRouteIndex, 0, route.length - 1) : -1;
        const stop = at >= 0 ? route[at] : null;

        // Everything cheap first, so the second screen never lags the room.
        q('pvTitle').textContent = mapMode
          ? (state.projectName || 'Presentation')
          : (el.presentTitle.textContent || 'Presentation');
        q('pvPos').textContent = mapMode
          ? (route.length ? 'Stop ' + (at + 1) + ' of ' + route.length : 'No stops yet')
          : (el.presentDeckPosition.textContent || '');
        q('pvClock').textContent = el.presentElapsed.textContent || '00:00';
        q('pvHint').textContent = presentAudienceWindow && !presentAudienceWindow.closed
          ? 'Audience screen is live · ← → or Space moves both'
          : '← → or Space moves both screens';

        let notes = '';
        let notesCaption = 'Notes';
        if (mapMode) notes = stop ? String(stop.note || '') : '';
        else {
          notes = String((el.presentNotes && el.presentNotes.value) || '');
          // A step with no note of its own still has the note written against the
          // stop this diagram was entered from — better than an empty panel, as
          // long as the caption says whose note it is.
          if (!notes.trim() && stop && String(stop.note || '').trim()) {
            notes = String(stop.note);
            notesCaption = 'Notes · written on this stop';
          }
        }
        q('pvNotesCap').textContent = notesCaption;
        const notesBody = q('pvNotes');
        notesBody.classList.toggle('is-empty', !notes.trim());
        notesBody.textContent = notes.trim() ? notes : 'No notes for this stop.';
        notesBody.scrollTop = 0;

        const nowLabel = mapMode
          ? (stop ? mapViewLabel(stop) : 'The map')
          : (el.presentStep.textContent || '');
        q('pvNowLabel').textContent = nowLabel;

        const plan = await presenterNextPlan();
        if (token !== presentPresenterToken || !presenterWindowLive()) return;
        q('pvNextLabel').textContent = plan.label || '';
        presenterSetPicture(q('pvNextFrame'), plan.svg || '', plan.plate, plan.plateNote);

        let nowSvg = '';
        if (mapMode) nowSvg = stop ? await presenterSlideSvg(stop) : '';
        else nowSvg = presentSvg ? presenterDressSvg(new XMLSerializer().serializeToString(presentSvg)) : '';
        if (token !== presentPresenterToken || !presenterWindowLive()) return;
        presenterSetPicture(q('pvNowFrame'), nowSvg, 'Nothing on stage', 'The presentation has not put a picture up yet.');
      }

      function schedulePresenterRefresh() {
        if (!presenterWindowLive()) return;
        clearTimeout(presentPresenterTimer);
        presentPresenterTimer = setTimeout(() => {
          presentPresenterTimer = null;
          renderPresenterWindow();
        }, 70);
      }

      /* One second's tick is enough for the clock, and it is also the cheapest
         place to notice a window the presenter closed by its own titlebar. */
      function presenterSyncClock() {
        if (presentPresenterWindow && presentPresenterWindow.closed) {
          presentPresenterWindow = null;
          updatePresentationPresenterButtons();
          return;
        }
        if (!presenterWindowLive()) return;
        try {
          const clock = presentPresenterWindow.document.getElementById('pvClock');
          if (clock) clock.textContent = el.presentElapsed.textContent || '00:00';
        } catch (error) { /* the window is on its way out */ }
      }

      /* One verb for both chromes: the Map steps its route, a diagram steps its
         walkthrough, and the presenter never has to know which one is up. */
      function presenterAdvance(delta) {
        if (!el.presentOverlay || el.presentOverlay.hidden) return;
        if (mapMode) mapStepRoute(delta);
        else stepPresentation(delta);
        schedulePresenterRefresh();
      }

      function handlePresenterWindowKey(event) {
        const key = event.key;
        if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
          event.preventDefault();
          presenterAdvance(1);
          return;
        }
        if (key === 'ArrowLeft' || key === 'PageUp') {
          event.preventDefault();
          presenterAdvance(-1);
        }
      }

      function handlePresenterWindowGone() {
        // pagehide fires while the document is still alive; the reference is only
        // safe to drop once the window has actually gone.
        setTimeout(() => {
          if (presentPresenterWindow && presentPresenterWindow.closed) {
            presentPresenterWindow = null;
            updatePresentationPresenterButtons();
          }
        }, 0);
      }

      function updatePresentationPresenterButtons() {
        const live = presenterWindowLive();
        if (el.mapPresenterViewButton) {
          el.mapPresenterViewButton.setAttribute('aria-pressed', String(live));
          el.mapPresenterViewButton.textContent = live ? '⧉ Presenter view on' : '⧉ Presenter view';
        }
      }

      function openPresentationPresenterWindow() {
        if (presenterWindowLive()) {
          try { presentPresenterWindow.focus(); } catch (error) { /* no-op */ }
          renderPresenterWindow();
          return;
        }
        let opened = null;
        try { opened = window.open('', 'sirenPresenter', 'popup=yes,width=1180,height=780'); }
        catch (error) { opened = null; }
        if (!opened) {
          showToast('The browser blocked the presenter view. Allow pop-ups for this page and try again.', 'error');
          return;
        }
        presentPresenterWindow = opened;
        try {
          opened.document.open();
          opened.document.write(PRESENTER_WINDOW_HTML);
          opened.document.close();
        } catch (error) {
          presentPresenterWindow = null;
          try { opened.close(); } catch (closeError) { /* no-op */ }
          showToast('The presenter view could not be prepared. ' + (error.message || error), 'error');
          return;
        }
        const doc = opened.document;
        const previous = doc.getElementById('pvPrev');
        const next = doc.getElementById('pvNext');
        if (previous) previous.addEventListener('click', () => presenterAdvance(-1));
        if (next) next.addEventListener('click', () => presenterAdvance(1));
        doc.addEventListener('keydown', handlePresenterWindowKey);
        opened.addEventListener('pagehide', handlePresenterWindowGone);
        opened.addEventListener('unload', handlePresenterWindowGone);
        updatePresentationPresenterButtons();
        renderPresenterWindow();
        showToast('Presenter view opened. Keep it on your screen — the audience screen goes on theirs.', 'success');
      }

      function closePresentationPresenterWindow() {
        clearTimeout(presentPresenterTimer);
        presentPresenterTimer = null;
        if (presentPresenterWindow && !presentPresenterWindow.closed) {
          try { presentPresenterWindow.close(); } catch (error) { /* no-op */ }
        }
        presentPresenterWindow = null;
        updatePresentationPresenterButtons();
      }

      function togglePresentationPresenterWindow() {
        if (presenterWindowLive()) closePresentationPresenterWindow();
        else openPresentationPresenterWindow();
      }

""" + A_IMPL

# --------------------------------------------------------------------------
# 7. Refresh hooks — the two places the app already says "the presentation moved"
# --------------------------------------------------------------------------
A_BCAST = """      function broadcastPresentationState(force=false) {
        if(!presentAudienceWindow||presentAudienceWindow.closed)return;"""
N_BCAST = """      function broadcastPresentationState(force=false) {
        // The presenter window is the other half of this announcement, and it is
        // live even when no audience screen is open — so it is served before the
        // audience early-return, not after it.
        schedulePresenterRefresh();
        if(!presentAudienceWindow||presentAudienceWindow.closed)return;"""

A_CHROME = """        if (el.mapNotes) {
          const view = state.map && state.map.route[mapRouteIndex];
          el.mapNotes.value = view ? view.note : '';
        }
      }
"""
N_CHROME = """        if (el.mapNotes) {
          const view = state.map && state.map.route[mapRouteIndex];
          el.mapNotes.value = view ? view.note : '';
        }
        // The Map moves its camera without broadcasting a stage, so the second
        // screen hangs off the Map's own chrome update instead.
        schedulePresenterRefresh();
      }
"""

A_ELAPSED = """        if(presentAutoplay&&presentAutoplayDeadline){const left=Math.max(0,Math.ceil((presentAutoplayDeadline-Date.now())/1000));el.presentAutoplayStatus.textContent=`Next step in ${left}s.`;}
      }
"""
N_ELAPSED = """        if(presentAutoplay&&presentAutoplayDeadline){const left=Math.max(0,Math.ceil((presentAutoplayDeadline-Date.now())/1000));el.presentAutoplayStatus.textContent=`Next step in ${left}s.`;}
        presenterSyncClock();
      }
"""

# Notes typed on the Map have to reach the second screen too.
A_NOTEIN = """        if (el.mapNotes) el.mapNotes.addEventListener('input', () => {
          const view = state.map && state.map.route[mapRouteIndex];
          if (!view) return;
          view.note = el.mapNotes.value.slice(0, 5000);
          scheduleSave();
        });
"""
N_NOTEIN = """        if (el.mapNotes) el.mapNotes.addEventListener('input', () => {
          const view = state.map && state.map.route[mapRouteIndex];
          if (!view) return;
          view.note = el.mapNotes.value.slice(0, 5000);
          scheduleSave();
          schedulePresenterRefresh();
        });
"""

A_STUDIONOTE = (
    "        [el.presentNotes, el.presentNoteOwner, el.presentNoteSource, el.presentNoteDuration, "
    "el.presentCheckpointEnabled, el.presentCheckpointText].forEach(control => "
    "control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', saveCurrentPresentationNote));\n"
)
N_STUDIONOTE = A_STUDIONOTE + (
    "        if (el.presentNotes) el.presentNotes.addEventListener('input', schedulePresenterRefresh);\n"
)

# --------------------------------------------------------------------------
# 8. Leaving Present closes both windows
# --------------------------------------------------------------------------
A_CLOSE = "        closePresentationAudienceWindow();\n"
N_CLOSE = "        closePresentationAudienceWindow();\n        closePresentationPresenterWindow();\n"

# --------------------------------------------------------------------------
# 9. Keyboard help
# --------------------------------------------------------------------------
A_KEYS = '          <div class="guide-callout"><strong>In the Studio step list:</strong>'
N_KEYS = (
    '          <div class="guide-callout"><strong>Two screens:</strong> the ⋯ menu opens '
    '<strong>⧉ Presenter view</strong> — the next slide, this stop’s notes, the clock and the '
    'position, on your screen only — and <strong>▣ Audience</strong> puts the picture alone on theirs. '
    '<kbd>←</kbd>/<kbd>→</kbd> or <kbd>Space</kbd> in either window moves both.</div>\n'
    + A_KEYS
)


EDITS = [
    ("presenter state variables", A_VARS, N_VARS),
    ("Map bar entry inside the more-menu cluster", A_MAPBTN, N_MAPBTN),
    ("element registry", A_REG, N_REG),
    ("Map bar binding", A_BIND, N_BIND),
    ("Present bar more-menu option", A_MENU, N_MENU),
    ("Present bar more-menu pick handler", A_PICK, N_PICK),
    ("presenter view implementation", A_IMPL, N_IMPL),
    ("broadcastPresentationState refresh hook", A_BCAST, N_BCAST),
    ("mapUpdateChrome refresh hook", A_CHROME, N_CHROME),
    ("elapsed clock hook", A_ELAPSED, N_ELAPSED),
    ("Map notes input hook", A_NOTEIN, N_NOTEIN),
    ("Studio notes input hook", A_STUDIONOTE, N_STUDIONOTE),
    ("closePresentation teardown", A_CLOSE, N_CLOSE),
    ("keyboard help", A_KEYS, N_KEYS),
]


def main():
    if len(sys.argv) < 2:
        print("usage: python fix_present_presenterview.py <target.html>")
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        print("ABORT - no such file: %s" % target)
        return 2

    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()
    original_len = len(text)

    if "PRESENTER_WINDOW_HTML" in text or "togglePresentationPresenterWindow" in text:
        print("ABORT - presenter view already installed; nothing written.")
        return 1

    # Every anchor must be present exactly once BEFORE anything is changed.
    for name, anchor, _ in EDITS:
        count = text.count(anchor)
        if count != 1:
            print("ABORT - anchor drift on '%s': found %d occurrences, expected 1." % (name, count))
            print("        anchor head: %r" % anchor[:110])
            return 1

    impl = N_IMPL.replace("__PRESENTER_HTML__", PRESENTER_HTML_JS.strip("\n"))
    applied = []
    for name, anchor, replacement in EDITS:
        if replacement is N_IMPL:
            replacement = impl
        if text.count(anchor) != 1:
            print("ABORT - anchor '%s' stopped being unique mid-run; nothing written." % name)
            return 1
        text = text.replace(anchor, replacement, 1)
        applied.append(name)

    # Cheap structural sanity: the braces of the inserted block have to balance,
    # and the file must not have shrunk.
    if len(text) <= original_len:
        print("ABORT - patched text is not larger than the original; nothing written.")
        return 1
    for needle in ("function openPresentationPresenterWindow(",
                   "function closePresentationPresenterWindow(",
                   "function renderPresenterWindow(",
                   "id=\"mapPresenterViewButton\"",
                   "'mapPresenterViewButton'"):
        if text.count(needle) < 1:
            print("ABORT - post-check missing %r; nothing written." % needle)
            return 1

    directory = os.path.dirname(os.path.abspath(target)) or "."
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", suffix=".tmp",
        prefix=".siren_presenter_", dir=directory, delete=False)
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except Exception:
        try:
            os.unlink(handle.name)
        except OSError:
            pass
        raise

    print("OK - presenter view installed into %s" % target)
    print("     %d edits, %d -> %d bytes" % (len(applied), original_len, len(text)))
    for name in applied:
        print("     - %s" % name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
