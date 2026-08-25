#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIREN — Present control surface.

The walkthrough faced a client with 65 pieces of chrome: 14 in a top bar that has
never fitted on one row, and 51 in a Studio sidebar whose live presenting tools sat
four panels below the fold.  This script folds the long tail of the bar into one
overflow menu, puts the presenter's own tools first in the sidebar, gives the step
name back the room the editing buttons were taking, turns the route chip's invisible
delete into a real control, merges the two halves of the camera concept, makes the
audience screen closeable, reduces the two branch choosers to the one the client can
see, and stops the Map chrome from parking itself on top of the tiles.

Usage:  python fix_present_controls.py <path-to-T_Industries_SIREN_v1.html>

Every replacement asserts its occurrence count BEFORE it runs, so a moved anchor
fails loudly instead of quietly patching the wrong place.  The write is atomic.
"""

import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# =====================================================================
# 1. TOP BAR — 14 controls folded to 7, the long tail into one ⋯ menu
# =====================================================================

edit(
    "bar: fourteen controls become seven plus an overflow menu",
    """        <div class="present-actions">
          <button class="btn ghost compact" id="presentMapButton" type="button" title="Back to the map of the whole workspace">⌂ Map</button>
          <button class="btn ghost compact" id="presentPrevButton" type="button">◀ Previous</button>
          <button class="btn secondary compact" id="presentNextButton" type="button">Next ▶</button>
          <select id="presentCameraMode" aria-label="Presentation camera mode" title="Camera framing">
            <option value="block" selected>Camera · Block</option>
            <option value="path">Camera · Path</option>
            <option value="context">Camera · Context</option>
          </select>
          <select id="presentTransition" aria-label="Camera transition speed" title="Camera transition speed">
            <option value="instant">Instant</option>
            <option value="fast">Fast</option>
            <option value="smooth" selected>Smooth</option>
            <option value="cinematic">Cinematic</option>
          </select>
          <select id="presentDecisionMode" aria-label="Decision handling mode" title="How to behave when a decision block has multiple branches">
            <option value="ask" selected>Decision · Ask</option>
            <option value="continue">Decision · Auto-continue</option>
            <option value="saved">Decision · Saved scenario</option>
          </select>
          <button class="btn ghost compact" id="presentAllButton" type="button">Show all</button>
          <button class="btn ghost compact" id="presentAutoFocusButton" type="button" aria-pressed="true" title="Automatically frame the active step">◎ Auto camera</button>
          <button class="btn ghost compact" id="presentResumeButton" type="button" title="Resume automatic framing">↺ Resume</button>
          <button class="btn ghost compact" id="presentAutoplayButton" type="button" aria-pressed="false">▶ Auto-play</button>
          <button class="btn ghost compact" id="presentAudienceButton" type="button">▣ Audience</button>
          <button class="btn ghost compact" id="presentSidebarToggle" type="button" aria-pressed="true">☰ Studio</button>
          <button class="btn ghost compact" id="presentDimButton" type="button" aria-pressed="false" title="Fade the presenter controls - move the mouse over them to bring them back">◐ Dim UI</button>
          <button class="btn compact" id="presentExitButton" type="button">Exit</button>
        </div>
""",
    """        <div class="present-actions">
          <button class="btn ghost compact" id="presentMapButton" type="button" title="Back to the map of the whole workspace">⌂ Map</button>
          <span class="present-step-group">
            <button class="btn ghost compact" id="presentPrevButton" type="button">◀ Previous</button>
            <button class="btn secondary compact" id="presentNextButton" type="button">Next ▶</button>
          </span>
          <button class="btn ghost compact" id="presentMoreButton" type="button" aria-haspopup="listbox" title="Camera, motion, decisions, auto-play and the audience screen">⋯</button>
          <button class="btn ghost compact" id="presentSidebarToggle" type="button" aria-pressed="true">☰ Studio</button>
          <button class="btn ghost compact" id="presentDimButton" type="button" aria-label="Presenter chrome dimming: level 0 of 3" title="Fade the presenter controls - move the mouse over them to bring them back">◐ Dim 0/3</button>
          <button class="btn compact" id="presentExitButton" type="button">Exit</button>
          <!-- These are the settings, not the verbs. They moved behind ⋯ so the bar fits on
               one row in front of a client, but they stay real controls in the DOM: every
               existing handler, disabled state and label update still applies to them, and
               the menu reads their current value rather than keeping a second copy of it. -->
          <span class="present-stashed" hidden>
            <select id="presentCameraMode" aria-label="Presentation camera mode" title="Camera framing">
              <option value="block" selected>Camera · Block</option>
              <option value="path">Camera · Path</option>
              <option value="context">Camera · Context</option>
            </select>
            <select id="presentTransition" aria-label="Camera transition speed" title="Camera transition speed">
              <option value="instant">Instant</option>
              <option value="fast">Fast</option>
              <option value="smooth" selected>Smooth</option>
              <option value="cinematic">Cinematic</option>
            </select>
            <select id="presentDecisionMode" aria-label="Decision handling mode" title="How to behave when a decision block has multiple branches">
              <option value="ask" selected>Decision · Ask</option>
              <option value="continue">Decision · Auto-continue</option>
              <option value="saved">Decision · Saved scenario</option>
            </select>
            <button class="btn ghost compact" id="presentAllButton" type="button">Show all</button>
            <button class="btn ghost compact" id="presentAutoFocusButton" type="button" aria-pressed="true" title="Automatically frame the active step">◎ Auto camera</button>
            <button class="btn ghost compact" id="presentAutoplayButton" type="button" aria-pressed="false">▶ Auto-play</button>
            <button class="btn ghost compact" id="presentAudienceButton" type="button" aria-pressed="false">▣ Audience</button>
          </span>
        </div>
""",
)

edit(
    "bar CSS: no wrap, and the two stepping verbs get their own group",
    """    .present-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 6px;
    }
""",
    """    .present-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: flex-end;
      /* No wrap. The bar spent every release quietly falling onto a second row; now a
         regression back to two rows shows up as overflow the moment it happens. */
      flex-wrap: nowrap;
      gap: 6px;
    }
    /* Previous and Next carry 95% of the presses. They travel together, they are the only
       pair fenced off from the rest of the bar, and they are the tallest targets on it. */
    .present-step-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
    }
    .present-step-group .btn { min-height: 40px; }
    .present-stashed[hidden] { display: none !important; }
""",
)

edit(
    "bar CSS: the audience chip lights up like the other state chips",
    """    #presentAutoFocusButton[aria-pressed="true"],
    #presentAutoplayButton[aria-pressed="true"],
    #presentSidebarToggle[aria-pressed="true"] {""",
    """    #presentAutoFocusButton[aria-pressed="true"],
    #presentAutoplayButton[aria-pressed="true"],
    #presentAudienceButton[aria-pressed="true"],
    #presentSidebarToggle[aria-pressed="true"] {""",
)

edit(
    "bar CSS: dimmed chrome stops accepting clicks it cannot be seen to accept",
    """    .present-overlay[data-dim] .present-bar:hover, .present-overlay[data-dim] .present-bar:focus-within,
    .present-overlay[data-dim] .present-sidebar:hover, .present-overlay[data-dim] .present-sidebar:focus-within { opacity: 1; }
""",
    """    .present-overlay[data-dim] .present-bar:hover, .present-overlay[data-dim] .present-bar:focus-within,
    .present-overlay[data-dim] .present-sidebar:hover, .present-overlay[data-dim] .present-sidebar:focus-within { opacity: 1; }
    /* At levels 2 and 3 the chrome is all but invisible but still took clicks, so a stray
       press fired a real action on nothing the presenter could see. The panels themselves
       stay hoverable, so moving the mouse over them still brings everything back. */
    .present-overlay[data-dim="2"] .present-bar > *, .present-overlay[data-dim="3"] .present-bar > *,
    .present-overlay[data-dim="2"] .present-sidebar > *, .present-overlay[data-dim="3"] .present-sidebar > * { pointer-events: none; }
    .present-overlay[data-dim] .present-bar:hover > *, .present-overlay[data-dim] .present-bar:focus-within > *,
    .present-overlay[data-dim] .present-sidebar:hover > *, .present-overlay[data-dim] .present-sidebar:focus-within > * { pointer-events: auto; }
""",
)


# =====================================================================
# 2. WIRING — overflow menu, audience toggle, one camera control
# =====================================================================

edit(
    "wiring: drop the Resume handler, make Audience a toggle, open the ⋯ menu",
    """        el.presentAutoFocusButton.addEventListener('click', togglePresentationAutoFocus);
        el.presentResumeButton.addEventListener('click', resumePresentationAutoFocus);
        el.presentAutoplayButton.addEventListener('click', togglePresentationAutoplay);
        el.presentAudienceButton.addEventListener('click', openPresentationAudienceWindow);
""",
    """        el.presentAutoFocusButton.addEventListener('click', togglePresentationAutoFocus);
        el.presentAutoplayButton.addEventListener('click', togglePresentationAutoplay);
        el.presentAudienceButton.addEventListener('click', togglePresentationAudienceWindow);
        if (el.presentMoreButton) el.presentMoreButton.addEventListener('click', () => openPresentationMoreMenu());
""",
)

edit(
    "wiring: the Dim button's label and accessible name both count to three",
    """          el.presentDimButton.setAttribute('aria-pressed', String(level > 0));
          el.presentDimButton.textContent = level ? '◐ Dim ' + level + '/3' : '◐ Dim UI';
""",
    """          setPresentationDimLabel(level);
""",
)

edit(
    "wiring: the Edit sequence toggle",
    """        el.presentResetSequenceButton.addEventListener('click', resetPresentationSequence);
""",
    """        el.presentResetSequenceButton.addEventListener('click', resetPresentationSequence);
        if (el.presentEditSequenceButton) el.presentEditSequenceButton.addEventListener('click', togglePresentationSequenceEditing);
""",
)

edit(
    "registry: Resume out, the ⋯ button in",
    "'presentPrevButton','presentNextButton','presentAllButton','presentAutoFocusButton','presentResumeButton','presentAutoplayButton','presentAudienceButton','presentSidebarToggle',",
    "'presentPrevButton','presentNextButton','presentMoreButton','presentAllButton','presentAutoFocusButton','presentAutoplayButton','presentAudienceButton','presentSidebarToggle',",
)

edit(
    "registry: the sidebar branch panel out, the Edit sequence toggle in",
    "'presentBreadcrumb','presentBranchPanel','presentBranchChoices','presentContinueSequenceButton','presentReturnDecisionButton','presentSearch','presentSequenceList','presentAddOverviewButton','presentAddSectionButton','presentResetSequenceButton',",
    "'presentBreadcrumb','presentReturnDecisionButton','presentSearch','presentSequenceList','presentAddOverviewButton','presentAddSectionButton','presentEditSequenceButton','presentResetSequenceButton',",
)


# =====================================================================
# 3. ONE CAMERA CONTROL, ONE AUDIENCE TOGGLE, ONE OVERFLOW MENU
# =====================================================================

edit(
    "camera: '↺ Resume' folds into the chip that held the camera in the first place",
    """      function updatePresentationAutoFocusButton() {
        el.presentAutoFocusButton.setAttribute('aria-pressed', String(presentAutoFocus));
        el.presentAutoFocusButton.textContent = presentAutoFocus ? '◎ Auto camera' : '○ Manual camera';
        el.presentResumeButton.disabled = presentAutoFocus;
      }

      function togglePresentationAutoFocus() {
        presentAutoFocus = !presentAutoFocus;
        // Clicking the toggle is an explicit choice and persists across steps. A drag or wheel
        // zoom is only a temporary override and automatically resets at the next step.
        presentAutoFocusLocked = !presentAutoFocus;
        updatePresentationAutoFocusButton();
        if (presentAutoFocus) updatePresentationCamera(true);
      }

      function resumePresentationAutoFocus() {
        presentAutoFocusLocked = false;
        presentAutoFocus = true;
        updatePresentationAutoFocusButton();
        updatePresentationCamera(true);
      }
""",
    """      function updatePresentationAutoFocusButton() {
        // One concept, one control. '↺ Resume' was a second button whose only job was to turn
        // this one back on, which meant it was disabled and grey in the default state of every
        // presentation. The chip that holds the camera is now the chip that gives it back.
        el.presentAutoFocusButton.setAttribute('aria-pressed', String(presentAutoFocus));
        el.presentAutoFocusButton.textContent = presentAutoFocus ? '◎ Auto camera' : '◎ Camera held · resume';
      }

      function togglePresentationAutoFocus() {
        presentAutoFocus = !presentAutoFocus;
        // Clicking the toggle is an explicit choice and persists across steps. A drag or wheel
        // zoom is only a temporary override and automatically resets at the next step.
        presentAutoFocusLocked = !presentAutoFocus;
        updatePresentationAutoFocusButton();
        if (presentAutoFocus) updatePresentationCamera(true);
      }

      /* The audience screen was one-way: pressing the button again only refocused the popup,
         so there was no way to blank the client's screen for a private aside. */
      function togglePresentationAudienceWindow() {
        if (presentAudienceWindow && !presentAudienceWindow.closed) closePresentationAudienceWindow();
        else openPresentationAudienceWindow();
        updatePresentationAudienceButton();
      }

      function updatePresentationAudienceButton() {
        if (!el.presentAudienceButton) return;
        const live = Boolean(presentAudienceWindow && !presentAudienceWindow.closed);
        el.presentAudienceButton.setAttribute('aria-pressed', String(live));
        el.presentAudienceButton.textContent = live ? '▣ Audience on' : '▣ Audience';
      }

      /* Four states, so it stops wearing a two-state toggle's clothes: the visible label and
         the accessible name both count, and the fourth press brings the chrome back. */
      function setPresentationDimLabel(level) {
        if (!el.presentDimButton) return;
        el.presentDimButton.removeAttribute('aria-pressed');
        el.presentDimButton.textContent = '◐ Dim ' + level + '/3';
        el.presentDimButton.setAttribute('aria-label', 'Presenter chrome dimming: level ' + level + ' of 3');
      }

      /* The bar carried fourteen controls and never fitted on one row. Everything that is not
         a live presenting verb lives here instead - one press away, with a full text label in
         place of three 11px selects that faced the audience saying 'Smooth'. The controls
         themselves are still the real ones, so this menu only reads and clicks them. */
      function openPresentationMoreMenu() {
        const inUse = (select, value) => (select.value === value ? ' · in use' : '');
        const blocked = button => (button.disabled ? ' · needs a rendered diagram' : '');
        const options = [
          ['all', 'Show the whole diagram' + blocked(el.presentAllButton)],
          ['autofocus', el.presentAutoFocusButton.textContent + blocked(el.presentAutoFocusButton)],
          ['autoplay', el.presentAutoplayButton.textContent === '▶ Auto-play' ? '▶ Start auto-play' : '❚❚ Pause auto-play'],
          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? '▣ Close the audience screen' : '▣ Open the audience screen'],
          ['camera:block', 'Camera framing · Block' + inUse(el.presentCameraMode, 'block')],
          ['camera:path', 'Camera framing · Path' + inUse(el.presentCameraMode, 'path')],
          ['camera:context', 'Camera framing · Context' + inUse(el.presentCameraMode, 'context')],
          ['motion:instant', 'Motion · Instant' + inUse(el.presentTransition, 'instant')],
          ['motion:fast', 'Motion · Fast' + inUse(el.presentTransition, 'fast')],
          ['motion:smooth', 'Motion · Smooth' + inUse(el.presentTransition, 'smooth')],
          ['motion:cinematic', 'Motion · Cinematic' + inUse(el.presentTransition, 'cinematic')],
          ['decision:ask', 'Decisions · Ask me which path' + inUse(el.presentDecisionMode, 'ask')],
          ['decision:continue', 'Decisions · Follow the sequence' + inUse(el.presentDecisionMode, 'continue')],
          ['decision:saved', 'Decisions · Use the saved scenario' + inUse(el.presentDecisionMode, 'saved')]
        ];
        openStructureMenu(el.presentMoreButton, options, '', choice => {
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];
          if (select) {
            select.value = choice.split(':')[1];
            select.dispatchEvent(new Event('change'));
            return;
          }
          const button = { all: el.presentAllButton, autofocus: el.presentAutoFocusButton,
            autoplay: el.presentAutoplayButton, audience: el.presentAudienceButton }[choice];
          if (!button) return;
          // A disabled control on the bar said why by being visibly grey. Inside a menu it has
          // to say it out loud instead of silently doing nothing.
          if (button.disabled) { showToast('That needs a rendered diagram on the stage first.', 'normal'); return; }
          button.click();
        });
      }
""",
)

edit(
    "controls: the Resume button is gone, and the audience chip tracks a popup closed by hand",
    """        el.presentAllButton.disabled = !presentSvg;
        el.presentAutoFocusButton.disabled = !presentSvg;
        el.presentResumeButton.disabled = presentAutoFocus;
        el.presentReturnDecisionButton.hidden = !presentBranchHistory.length;
""",
    """        el.presentAllButton.disabled = !presentSvg;
        el.presentAutoFocusButton.disabled = !presentSvg;
        // A presenter can close the audience popup from its own title bar; refresh the chip
        // here so the bar never claims a screen is live after it has gone.
        updatePresentationAudienceButton();
        el.presentReturnDecisionButton.hidden = !presentBranchHistory.length;
""",
)

edit(
    "audience: opening from anywhere lights the chip",
    """        setTimeout(()=>broadcastPresentationState(true),300);
      }
""",
    """        setTimeout(()=>broadcastPresentationState(true),300);
        updatePresentationAudienceButton();
      }
""",
)

edit(
    "dim: the reset on opening a presentation counts from zero",
    """        if (el.presentDimButton) { el.presentDimButton.setAttribute('aria-pressed', 'false'); el.presentDimButton.textContent = '◐ Dim UI'; }
""",
    """        setPresentationDimLabel(0);
""",
)

edit(
    "dim: the reset on entering the Map counts from zero",
    """          if (el.presentDimButton) {
            el.presentDimButton.setAttribute('aria-pressed', 'false');
            el.presentDimButton.textContent = '◐ Dim UI';
          }
""",
    """          setPresentationDimLabel(0);
""",
)


# =====================================================================
# 4. SEQUENCE ROWS — the step name gets the row back
# =====================================================================

edit(
    "sequence CSS: editing chrome is one hover, or one Edit press, away",
    """    .present-sequence-buttons { display: flex; gap: 3px; }
""",
    """    /* Four editing buttons took 140px of a 265px row and the step name got 79px, so
       'Invoice arrives in shared mailbox' read as 'Invoice arrives…'. They are still one
       hover - or one press of Edit - away; they are just no longer what a presenter reads. */
    .present-sequence-buttons { display: none; gap: 3px; }
    .present-sequence-item:hover .present-sequence-buttons,
    .present-sequence-item:focus-within .present-sequence-buttons,
    #presentSequenceList.is-editing .present-sequence-buttons { display: flex; }
""",
)

edit(
    "sequence CSS: the toolbar makes room for the Edit toggle",
    """    .present-sequence-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px;
      margin-bottom: 8px;
    }
""",
    """    .present-sequence-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 7px;
      margin-bottom: 8px;
    }
    #presentEditSequenceButton[aria-pressed="true"] {
      background: var(--pill-bg);
      color: var(--pill-text);
      border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
    }
""",
)

edit(
    "sequence: an explicit Edit toggle next to Reset",
    """                <button class="btn ghost compact" id="presentResetSequenceButton" type="button">Reset</button>
""",
    """                <button class="btn ghost compact" id="presentEditSequenceButton" type="button" aria-pressed="false" title="Keep the move, repeat and remove buttons visible on every step">✎ Edit</button>
                <button class="btn ghost compact" id="presentResetSequenceButton" type="button">Reset</button>
""",
)

edit(
    "sequence: the four glyph buttons say what they are and what they act on",
    """          [['↑','up','Move up'],['↓','down','Move down'],['⧉','duplicate','Repeat step'],['×','remove','Remove from presentation']].forEach(([glyph,action,title])=>{
            const button=document.createElement('button'); button.type='button'; button.className='btn ghost compact'; button.dataset.sequenceAction=action; button.title=title; button.textContent=glyph; actions.appendChild(button);
          });
""",
    """          [['↑','up','Move up'],['↓','down','Move down'],['⧉','duplicate','Repeat step'],['×','remove','Remove from presentation']].forEach(([glyph,action,title])=>{
            const button=document.createElement('button'); button.type='button'; button.className='btn ghost compact'; button.dataset.sequenceAction=action; button.title=title; button.textContent=glyph;
            // A screen reader met four unlabelled buttons per row reading the raw glyphs.
            button.setAttribute('aria-label', `${title}: ${label}`);
            actions.appendChild(button);
          });
""",
)

edit(
    "sequence: the Edit toggle pins the row buttons open",
    """      function persistPresentationSequence() {
""",
    """      /* Hovering a row reveals its editing buttons, which is enough while authoring with a
         mouse. Pinning them open is the keyboard and touch route to the same four actions. */
      function togglePresentationSequenceEditing() {
        const on = !el.presentSequenceList.classList.contains('is-editing');
        el.presentSequenceList.classList.toggle('is-editing', on);
        el.presentEditSequenceButton.setAttribute('aria-pressed', String(on));
        el.presentEditSequenceButton.title = on
          ? 'Hide the move, repeat and remove buttons again'
          : 'Keep the move, repeat and remove buttons visible on every step';
      }

      function persistPresentationSequence() {
""",
)


# =====================================================================
# 5. ROUTE CHIPS — a real, visible, focusable remove control
# =====================================================================

edit(
    "route CSS: the delete is a 24px target that is visible before you touch it",
    """    .map-route-item {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      max-width: 220px;
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--panel-alt);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .map-route-item.is-current { border-color: var(--primary); background: var(--pill-bg); color: var(--pill-text); font-weight: 700; }
    .map-route-item.is-drop { border-color: var(--warning); }
    .map-route-number { font-variant-numeric: tabular-nums; font-weight: 800; opacity: .7; }
    .map-route-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .map-route-drop { opacity: 0; padding: 0 2px; font-weight: 800; }
    .map-route-item:hover .map-route-drop, .map-route-item:focus-within .map-route-drop { opacity: .75; }
    .map-route-drop:hover { opacity: 1; color: var(--danger); }
""",
    """    .map-route-item {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      max-width: 250px;
      padding: 2px 3px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--panel-alt);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
    }
    .map-route-item.is-current { border-color: var(--primary); background: var(--pill-bg); color: var(--pill-text); font-weight: 700; }
    .map-route-item.is-drop { border-color: var(--warning); }
    .map-route-go {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      max-width: 200px;
      min-height: 26px;
      padding: 4px 8px;
      border: 0;
      border-radius: 999px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 12px;
      font-weight: inherit;
      cursor: pointer;
    }
    .map-route-number { font-variant-numeric: tabular-nums; font-weight: 800; opacity: .7; }
    .map-route-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* This used to be a 13x16 transparent span that deleted a stop from the presentation
       route with no undo. It is now a real button, above the WCAG 2.2 target minimum,
       visible before the pointer arrives, and it asks first. */
    .map-route-drop {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      min-width: 24px;
      min-height: 24px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 13px;
      font-weight: 800;
      opacity: .55;
      cursor: pointer;
    }
    .map-route-drop:hover, .map-route-drop:focus-visible { opacity: 1; color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, transparent); }
""",
)

edit(
    "route: the chip becomes a group of two real buttons, and removal confirms",
    """          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'map-route-item' + (index === mapRouteIndex ? ' is-current' : '');
          item.draggable = true;
          item.dataset.index = String(index);
          const number = document.createElement('span');
          number.className = 'map-route-number';
          number.textContent = String(index + 1);
          const label = document.createElement('span');
          label.className = 'map-route-label';
          label.textContent = mapViewLabel(view);
          const drop = document.createElement('span');
          drop.className = 'map-route-drop';
          drop.textContent = '×';
          drop.title = 'Remove this view from the route';
          drop.addEventListener('click', event => {
            event.stopPropagation();
            if (state.map.route.length <= 1) { showToast('A route needs at least one view.', 'error'); return; }
            mapRouteIndex = index;
            mapDeleteView();
            showToast('View removed.', 'success');
          });
          item.append(number, label, drop);
          item.title = view.note ? view.note.slice(0, 200) : mapViewLabel(view);
          item.addEventListener('click', () => mapGoToView(index));
""",
    """          const name = mapViewLabel(view);
          // A chip holds two different actions - go there, and take it out of the route - so
          // it is a group of two buttons rather than one button with a span inside it.
          const item = document.createElement('span');
          item.className = 'map-route-item' + (index === mapRouteIndex ? ' is-current' : '');
          item.draggable = true;
          item.dataset.index = String(index);
          const go = document.createElement('button');
          go.type = 'button';
          go.className = 'map-route-go';
          go.setAttribute('aria-label', `Go to stop ${index + 1}, ${name}`);
          const number = document.createElement('span');
          number.className = 'map-route-number';
          number.textContent = String(index + 1);
          const label = document.createElement('span');
          label.className = 'map-route-label';
          label.textContent = name;
          go.append(number, label);
          const drop = document.createElement('button');
          drop.type = 'button';
          drop.className = 'map-route-drop';
          drop.textContent = '×';
          drop.title = `Remove ${name} from the route`;
          drop.setAttribute('aria-label', `Remove ${name} from the route`);
          drop.addEventListener('click', event => {
            event.stopPropagation();
            if (state.map.route.length <= 1) { showToast('A route needs at least one view.', 'error'); return; }
            requestConfirmation({
              title: 'Remove this stop from the route?',
              message: `“${name}” will no longer be part of the presentation route. There is no undo for this.`,
              confirmText: 'Remove stop',
              action: () => { mapRouteIndex = index; mapDeleteView(); showToast('Stop removed from the route.', 'success'); }
            });
          });
          item.append(go, drop);
          item.title = view.note ? view.note.slice(0, 200) : name;
          go.addEventListener('click', () => mapGoToView(index));
""",
)


# =====================================================================
# 6. ONE BRANCH CHOOSER, ON THE STAGE THE CLIENT IS LOOKING AT
# =====================================================================

edit(
    "decision: the sidebar's duplicate chooser goes",
    """              <div class="present-branch-panel" id="presentBranchPanel" hidden>
                <strong>Choose a branch</strong>
                <div class="present-branch-choices" id="presentBranchChoices"></div>
                <div class="present-inline-actions">
                  <button class="btn ghost compact" id="presentContinueSequenceButton" type="button">Continue sequence</button>
                  <button class="btn ghost compact" id="presentReturnDecisionButton" type="button" hidden>Return to decision</button>
                </div>
              </div>
""",
    "",
)

edit(
    "decision: Return to decision joins the on-stage card",
    """            <div class="present-decision-prompt-actions"><button class="btn ghost compact" id="presentDecisionContinueButton" type="button">Continue sequence instead</button></div>
""",
    """            <div class="present-decision-prompt-actions"><button class="btn ghost compact" id="presentReturnDecisionButton" type="button" hidden>Return to decision</button><button class="btn ghost compact" id="presentDecisionContinueButton" type="button">Continue sequence instead</button></div>
""",
)

edit(
    "decision CSS: the sidebar panel's rules go with it",
    """    .present-branch-panel {
      margin-top: 9px;
      padding: 9px;
      border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border));
      border-radius: var(--radius-sm);
      background: var(--warning-bg);
    }
    .present-branch-panel[hidden] { display: none !important; }
    .present-branch-panel strong { display: block; margin-bottom: 7px; color: var(--text); font-size: 11px; }
    .present-branch-choices { display: grid; gap: 6px; }
    .present-branch-choice {""",
    """    .present-branch-choice {""",
)

edit(
    "decision: one chooser, shown whether or not the Studio is open",
    """      function renderPresentationBranchChoices() {
        const entry = currentPresentationEntry();
        const branches = entry?.type === 'node' ? outgoingEdges(entry.nodeId) : [];
        const hasDecision = branches.length > 1;
        const askForDecision = hasDecision && (presentDecisionMode === 'ask' || (presentDecisionMode === 'saved' && !presentBranchSelections.has(entry.nodeId)));
        const showSidebar = askForDecision || presentBranchHistory.length > 0;
        el.presentBranchPanel.hidden = !showSidebar;
        el.presentBranchChoices.replaceChildren();
        el.presentDecisionChoices.replaceChildren();
        el.presentBranchPanel.querySelector('strong').textContent = hasDecision ? 'Choose a branch' : 'Branch navigation';
        el.presentDecisionPrompt.hidden = !(askForDecision && presentPendingBranch);
        if (!askForDecision) {
          presentPendingBranch = false;
          el.presentContinueSequenceButton.hidden = true;
          el.presentReturnDecisionButton.hidden = !presentBranchHistory.length;
          el.presentReturnDecisionButton.onclick = returnToPresentationDecision;
          return;
        }
        el.presentDecisionPromptTitle.textContent = `Choose the path after “${presentationNodeLabel(entry.nodeId)}”`;
        el.presentContinueSequenceButton.hidden = presentDecisionMode === 'continue';
        branches.forEach(edge => {
          el.presentBranchChoices.appendChild(makePresentationBranchButton(entry, edge));
          el.presentDecisionChoices.appendChild(makePresentationBranchButton(entry, edge));
        });
        el.presentContinueSequenceButton.onclick = continuePresentationSequenceFromDecision;
        el.presentDecisionContinueButton.onclick = continuePresentationSequenceFromDecision;
        el.presentReturnDecisionButton.onclick = returnToPresentationDecision;
      }
""",
    """      /* One decision, one card, on the stage the client is looking at. The sidebar carried a
         second copy of this chooser that only appeared when the Studio was open - and while it
         was up, the purpose-built audience-facing card stayed hidden. */
      function renderPresentationBranchChoices() {
        const entry = currentPresentationEntry();
        const branches = entry?.type === 'node' ? outgoingEdges(entry.nodeId) : [];
        const hasDecision = branches.length > 1;
        const askForDecision = hasDecision && (presentDecisionMode === 'ask' || (presentDecisionMode === 'saved' && !presentBranchSelections.has(entry.nodeId)));
        const checkpointActive = Boolean(el.presentCheckpointCard && !el.presentCheckpointCard.hidden);
        el.presentDecisionChoices.replaceChildren();
        el.presentDecisionPrompt.hidden = !askForDecision || checkpointActive;
        el.presentReturnDecisionButton.hidden = !presentBranchHistory.length;
        el.presentReturnDecisionButton.onclick = returnToPresentationDecision;
        if (!askForDecision) {
          presentPendingBranch = false;
          return;
        }
        el.presentDecisionPromptTitle.textContent = `Choose the path after “${presentationNodeLabel(entry.nodeId)}”`;
        el.presentDecisionContinueButton.hidden = false;
        branches.forEach(edge => {
          el.presentDecisionChoices.appendChild(makePresentationBranchButton(entry, edge));
        });
        el.presentDecisionContinueButton.onclick = continuePresentationSequenceFromDecision;
      }
""",
)

edit(
    "decision: focus lands on the card, since there is no sidebar copy to fall back to",
    """          const first = el.presentDecisionChoices?.querySelector('button') || el.presentBranchChoices?.querySelector('button');
""",
    """          const first = el.presentDecisionChoices?.querySelector('button');
""",
)


# =====================================================================
# 7. THE STAGE OWNS ITS OWN CORNERS
# =====================================================================

edit(
    "stage CSS: the decision prompt sits above the mini-map, not under it",
    """    .present-decision-prompt {
      position: absolute;
      z-index: 42;
""",
    """    .present-decision-prompt {
      position: absolute;
      /* Above the mini-map (45) and the annotation canvas (35). At 1280x800 the mini-map
         covered 64px of 'Continue sequence instead' and swallowed clicks meant for it. */
      z-index: 60;
""",
)

edit(
    "stage CSS: the checkpoint card comes out from under the pen strokes too",
    """    .present-checkpoint-card { position:absolute; z-index:24;""",
    """    .present-checkpoint-card { position:absolute; z-index:60;""",
)

edit(
    "stage CSS: whichever prompt is up owns the bottom-right corner",
    """    .present-minimap {
      position: absolute;
      z-index: 45;
""",
    """    /* The mini-map is a presenter convenience. An escape hatch the client is watching the
       presenter reach for is not, so the prompt gets the corner to itself. */
    .present-stage-shell:has(#presentDecisionPrompt:not([hidden])) .present-minimap,
    .present-stage-shell:has(#presentCheckpointCard:not([hidden])) .present-minimap { display: none; }
    .present-minimap {
      position: absolute;
      z-index: 45;
""",
)

edit(
    "map: the camera fits the tiles into the space its own chrome leaves free",
    """      function mapViewport() {
        const host = el.mapLayer;
        if (!host) return { w: window.innerWidth, h: window.innerHeight };
        const box = host.getBoundingClientRect();
        return { w: Math.max(320, box.width), h: Math.max(240, box.height) };
      }
""",
    """      /* The floating bar and the route strip are 155px of chrome along the bottom edge, and
         fitting the plane to the whole layer parked tiles underneath them. Measure where the
         free area actually ends rather than hard-coding offsets the CSS owns - but measure it
         when the chrome moves, not inside mapViewport: the camera tween writes a transform on
         every tick and reads the viewport four times, and a rect read between two writes is
         exactly the layout thrash that turns a fly-to into a stall. */
      let mapChromeReserve = 0;

      function mapMeasureChrome() {
        const host = el.mapLayer;
        if (!host) { mapChromeReserve = 0; return; }
        const box = host.getBoundingClientRect();
        const chromeTop = element => {
          if (!element || !element.offsetHeight) return box.bottom;
          const rect = element.getBoundingClientRect();
          return rect.height ? rect.top : box.bottom;
        };
        mapChromeReserve = Math.max(0, box.bottom - Math.min(chromeTop(el.mapBar), chromeTop(el.mapRoute)));
      }

      function mapViewport() {
        const host = el.mapLayer;
        if (!host) return { w: window.innerWidth, h: window.innerHeight };
        const box = host.getBoundingClientRect();
        // Every camera and pointer conversion goes through here, so the reserved band applies
        // to all of them at once and they stay consistent with each other.
        return { w: Math.max(320, box.width), h: Math.max(240, box.height - mapChromeReserve - 24) };
      }
""",
)


# =====================================================================
# 8. THE STUDIO SIDEBAR LEADS WITH THE LIVE PRESENTING TOOLS
# =====================================================================

edit(
    "notes: the presenter's own box is no longer a four-line slot",
    """    .present-notes-grid textarea { min-height: 94px; resize: vertical; }
""",
    """    .present-notes-grid textarea { min-height: 180px; resize: vertical; }
""",
)


edit(
    "map: measure the chrome band when the Map opens",
    """        mapUpdateChrome();
        mapCamera = mapCameraForRect(mapBounds(), 1.06);
        applyMapCamera();
""",
    """        mapUpdateChrome();
        mapMeasureChrome();
        mapCamera = mapCameraForRect(mapBounds(), 1.06);
        applyMapCamera();
""",
)

edit(
    "map: measure it again whenever the Map is shown",
    """        if (mapMode) {
          mapShowBar();
          mapUpdateTileDetail();
        }
""",
    """        if (mapMode) {
          mapShowBar();
          mapMeasureChrome();
          mapUpdateTileDetail();
        }
""",
)

edit(
    "map: and after a window resize moves the chrome",
    """        if(el.presentOverlay.hidden)return;resizePresentationCanvas(true);""",
    """        if(el.presentOverlay.hidden)return;mapMeasureChrome();resizePresentationCanvas(true);""",
)


PANEL_START = '          <details class="present-panel"'
PANEL_END = '\n          </details>\n'


def cut_panel(text, summary):
    """Lift one <details> panel out of the Studio sidebar, by its summary."""
    needle = '<summary>%s</summary>' % summary
    if text.count(needle) != 1:
        raise SystemExit('ABORT: expected exactly 1 "%s" panel, found %d' % (summary, text.count(needle)))
    marker = text.index(needle)
    start = text.rindex(PANEL_START, 0, marker)
    end = text.index(PANEL_END, marker) + len(PANEL_END)
    return text[:start] + text[end:], text[start:end]


def reorder_sidebar(text):
    """A presenter opens the Studio to read their notes and reach the laser pointer. Both
    started four panels and 52 editing controls below the fold; now they lead."""
    text, notes = cut_panel(text, 'Presenter notes')
    text, playback = cut_panel(text, 'Playback & live tools')
    anchor = '          <details class="present-panel" open>\n            <summary>Navigator & sequence</summary>\n'
    if text.count(anchor) != 1:
        raise SystemExit('ABORT: expected exactly 1 open "Navigator & sequence" panel, found %d' % text.count(anchor))
    # Playback opens too - the laser, spotlight, pen and Clear drawings are live tools.
    playback = playback.replace('<details class="present-panel">', '<details class="present-panel" open>', 1)
    # The navigator is authoring. It stays reachable, one press below the live tools.
    closed = anchor.replace('<details class="present-panel" open>', '<details class="present-panel">')
    return text.replace(anchor, notes + playback + closed, 1)


def main():
    # A Windows console defaults to cp1252 and would die on the glyphs in these labels
    # before it ever got to the file. Progress output must never be what breaks the patch.
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    if len(sys.argv) < 2:
        raise SystemExit('usage: fix_present_controls.py <path-to-app.html>')
    target = os.path.abspath(sys.argv[1])
    with io.open(target, 'r', encoding='utf-8', newline='') as handle:
        text = handle.read()
    original = text

    for name, old, new, count in EDITS:
        found = text.count(old)
        if found != count:
            raise SystemExit('ABORT: "%s" expected %d occurrence(s) of its anchor, found %d. '
                             'Nothing was written.' % (name, count, found))
        text = text.replace(old, new, count)
        print('  ok  %s' % name)

    text = reorder_sidebar(text)
    print('  ok  sidebar: Presenter notes and Playback & live tools lead; Navigator closes')

    if text == original:
        raise SystemExit('ABORT: nothing changed.')

    directory = os.path.dirname(target) or '.'
    handle = tempfile.NamedTemporaryFile('w', encoding='utf-8', newline='', dir=directory,
                                         prefix='.siren-present-', suffix='.tmp', delete=False)
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        handle.close()
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print('wrote %s (%d -> %d bytes)' % (target, len(original.encode('utf-8')), len(text.encode('utf-8'))))


if __name__ == '__main__':
    main()
