# -*- coding: utf-8 -*-
"""
fix_preview.py — preview pane and preview toolbar fixes for T_Industries_SIREN_v1.html

Usage:  python fix_preview.py <path-to-app.html>

Every replacement asserts its expected occurrence count BEFORE it is applied, so a
moved or already-patched anchor fails loudly instead of silently doing the wrong
thing. The file is written atomically (tmp + os.replace).

What it changes (see the numbered notes next to each patch):
  1  workspace mode no longer blankets .zoom-tools with pointer-events:none
  2  the seven zoom controls fold into one chip + popover; no control is deleted by width
  3  the diagram re-fits after a size-changing render and after a pane resize
  4  the filter panel falls back to the preview pane when its anchor is not laid out
  5  the preview toolbar and pane header each come down to one row
  6  workspace mode: dead zoom strip gone, four board selects folded behind "View"
  7  the batch bar appears only when cards are ticked
  8  Present tooltip is mode-correct; Present is the primary, Render the ghost
  9  24px zoom slider, 24px selection tick, logarithmic zoom track, visible preview card
"""

import io
import os
import sys

EDITS = []


def edit(note, old, new, count=1):
    EDITS.append((note, old, new, count))


# ==========================================================================
#  CSS
# ==========================================================================

# [2][5][9] The zoom cluster replaces seven separate zoom controls in the toolbar row.
edit(
    "css: zoom cluster, chip and popover",
    """    .zoom-tools { min-width: 0; flex: 1 1 520px; flex-wrap: wrap; row-gap: 6px; gap: 8px; }
    .zoom-range { min-width: 120px; max-width: 320px; flex: 1 1 180px; margin-right: 2px; }
    .zoom-value { width: auto; min-width: 42px; margin-left: -4px; color: var(--muted); font-size: 11px; font-weight: 850; text-align: left; }
""",
    """    .zoom-tools { min-width: 0; flex: 1 1 auto; flex-wrap: wrap; row-gap: 6px; gap: 6px; }
    /* Zoom used to be four controls in the row (minus, plus, slider, readout) plus three
       more text buttons. It is one chip now: the chip fits the page, the caret opens the
       rest. That is what gets the toolbar onto a single row at split-view widths. */
    .zoom-cluster { display: inline-flex; align-items: center; flex: 0 0 auto; }
    .zoom-chip { min-width: 66px; gap: 5px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .zoom-chip-caret { width: 28px; margin-left: -1px; border-top-left-radius: 0; border-bottom-left-radius: 0; font-size: 12px; }
    .zoom-value { min-width: 34px; font-size: 11px; font-weight: 850; text-align: right; font-variant-numeric: tabular-nums; }
    /* Fixed and hand-positioned like .filter-panel: the preview pane is a size container
       with overflow:hidden, so an in-flow popover would be clipped by it. */
    .zoom-popover {
      position: fixed;
      z-index: 300;
      display: grid;
      gap: 8px;
      width: max-content;
      padding: 10px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--panel-elevated);
      box-shadow: var(--shadow);
    }
    .zoom-popover[hidden] { display: none !important; }
    .zoom-popover-row { display: flex; align-items: center; gap: 6px; }
    /* WCAG 2.2 SC 2.5.8: the track stays thin, the control keeps a 24px box. */
    .zoom-range { flex: 1 1 190px; min-width: 190px; max-width: 260px; min-height: 24px; }
    @media (pointer: coarse) { .zoom-range { min-height: 44px; } }
""",
)

# [2] The old rule deleted six controls outright below 880px, Fit page among them.
edit(
    "css: 880px container query folds words, not controls",
    """    @container preview-pane (max-width: 880px) {
      /* Keep ⇢ Connect and ▢ Hide panel: hiding the only control that
         collapses the 500px editor pane at exactly the width that needs it
         stranded the user (and Connect is one of only two ways to draw a
         connector). */
      .zoom-tools .text-action:not(#connectModeButton):not(#focusPreviewButton) { display: none; }
      .zoom-tools { flex-basis: 240px; }
      .renderer-status { font-size: 10px; }
    }
""",
    """    /* What gives way in a narrow pane is the words, not the controls: every button keeps
       its glyph, its tooltip and its accessible name. The layout pair sheds its words
       first because ↕ and ↔ carry it on their own; the verbs keep theirs as long as they
       fit (measured: all of them fit down to a 745px pane). The rule this replaces deleted
       six controls outright — 100%, Fit width, Fit page, Connect, Filters and Hide panel —
       with no overflow menu, and Fit page is precisely what a too-tall diagram needs. */
    @container preview-pane (max-width: 880px) {
      .zoom-tools .preview-layout-switch .text-label { display: none; }
      .zoom-tools .btn { padding-inline: 9px; gap: 5px; }
      .renderer-status { font-size: 10px; }
    }
    @container preview-pane (max-width: 745px) {
      .zoom-tools .text-label { display: none; }
      .zoom-tools { gap: 5px; }
      .zoom-tools .btn { padding-inline: 9px; }
    }
""",
)

# [2] The slider now lives in the popover, outside the preview-pane container.
edit(
    "css: drop the stale zoom-range sizing from the 1220px container query",
    """      .preview-step-indicator { min-width: 68px; max-width: 82px; }
      .zoom-range { min-width: 105px; max-width: 220px; flex-basis: 135px; }
    }
""",
    """      .preview-step-indicator { min-width: 68px; max-width: 82px; }
    }
""",
)

# [2] Same swap for the coarse-pointer / narrow-window sheet.
edit(
    "css: mobile sheet folds words, not controls",
    """      .multi-preview-canvas { min-height: 200px; }
      .diagram-stage { min-height: 330px; }
      .zoom-tools .text-action { display: none; }
""",
    """      .multi-preview-canvas { min-height: 200px; }
      .diagram-stage { min-height: 330px; }
      .zoom-tools .text-label { display: none; }
""",
)

# [1][6] The bug: a blanket pointer-events:none over all twelve zoom-tools children.
edit(
    "css: workspace mode hides the zoom cluster instead of ghosting the whole toolbar",
    """    .preview-pane.is-multi-preview .zoom-tools { opacity: 0.42; pointer-events: none; }
""",
    """    /* Only the zoom cluster is meaningless in workspace mode — it would report a zoom for
       a diagram that is not on screen — so it goes rather than being dimmed. The blanket
       `pointer-events: none` this replaces also covered Present, Filters, Hide panel and
       the layout pair: enabled, focusable, firing on Enter, and dead to the mouse. */
    .preview-pane.is-multi-preview .zoom-cluster { display: none; }
""",
)

# [7] Selection-driven, like #multiPreviewSelectionCount already is.
# [6] The four board selects fold behind "View".
edit(
    "css: batch bar and folded board selects",
    """    .multi-preview-batch { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
""",
    """    .multi-preview-batch { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
    .multi-preview-batch[hidden] { display: none; }
    .multi-preview-control.is-folded { display: none; }
""",
)

# [9] WCAG 2.2 SC 2.5.8: the box keeps its 15px look, the label carries a 24px hit area.
edit(
    "css: 24px hit area around the 15px selection tick",
    """    .multi-preview-tick { flex: 0 0 auto; width: 15px; height: 15px; cursor: pointer; }
""",
    """    .multi-preview-tick { flex: 0 0 auto; width: 15px; height: 15px; cursor: pointer; }
    .multi-preview-tick-hit {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      min-height: 24px;
      margin: 0;
      cursor: pointer;
    }
""",
)

# [5] Three stacked lines (eyebrow, name, status) cost 77px before any diagram.
edit(
    "css: preview pane header on one baseline",
    """    .pane-heading { min-width: 0; gap: 10px; }
    .pane-heading-text { min-width: 0; }
""",
    """    .pane-heading { min-width: 0; gap: 10px; }
    /* Eyebrow, name and render status stacked three deep were 77px of chrome above the
       diagram. On one baseline they are the same information in a third of the height. */
    .pane-heading-text { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
    .pane-heading-text .eyebrow { flex: 0 0 auto; margin: 0; }
    .pane-heading-text h2 { flex: 0 1 auto; }
    /* The status is the part that ellipsises: the diagram name keeps its width. */
    .pane-heading-text p:not(.eyebrow) { flex: 1 1 0; min-width: 0; margin: 0; }
    /* A row is wider than a stack, so the heading has to be the part that gives: left to
       flex defaults it steals width and pushes Compare onto a second row of buttons. */
    .preview-pane .pane-heading { flex: 1 1 0; min-width: 0; overflow: hidden; }
    .preview-pane .pane-actions { flex: 0 0 auto; flex-wrap: nowrap; }
""",
)

# [9] The card was 1.02:1 against the pane behind it; only a 1px --border separated them.
edit(
    "css: give the preview card a visible edge",
    """    .preview-card {
      position: relative;
      width: max-content;
      min-width: 100%;
      min-height: 100%;
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background: var(--canvas-bg);
      box-shadow: var(--shadow);
    }
""",
    """    .preview-card {
      position: relative;
      width: max-content;
      min-width: 100%;
      min-height: 100%;
      padding: 22px;
      /* The card sat at 1.02:1 against the pane, so the diagram had no container to sit
         on. --canvas-bg is deliberate per theme and is left alone; the edge is what does
         the work — the strong border plus a hairline ring reads in every theme. */
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-xl);
      background: var(--canvas-bg);
      box-shadow: var(--shadow), 0 0 0 1px color-mix(in srgb, var(--border-strong) 30%, transparent);
    }
""",
)


# ==========================================================================
#  Markup
# ==========================================================================

# [8] Render duplicates autoRender; Present is the auditor's client-facing action.
edit(
    "markup: Render demoted to ghost",
    """            <button class="btn compact" id="renderPreviewButton" type="button">Render</button>
""",
    """            <button class="btn ghost compact" id="renderPreviewButton" type="button" title="Draw the preview now — with Auto-render on this happens by itself">Render</button>
""",
)

# [2] Seven zoom controls become one chip; the originals move into the popover below.
edit(
    "markup: zoom chip replaces the zoom cluster head",
    """          <div class="zoom-tools">
            <button class="btn secondary icon compact" id="zoomOutButton" type="button" aria-label="Zoom out" title="Zoom out">−</button>
            <button class="btn secondary icon compact" id="zoomInButton" type="button" aria-label="Zoom in" title="Zoom in">+</button>
            <button class="btn ghost compact text-action" id="actualSizeButton" type="button">100%</button>
            <button class="btn ghost compact text-action" id="fitWidthButton" type="button">Fit width</button>
            <button class="btn ghost compact text-action" id="fitPageButton" type="button">Fit page</button>
""",
    """          <div class="zoom-tools">
            <div class="zoom-cluster" id="zoomCluster">
              <button class="btn secondary compact zoom-chip" id="zoomChipButton" type="button" data-palette="skip" title="Fit the whole diagram in the pane"><span aria-hidden="true">⤡</span><span class="zoom-value" id="zoomValue">100%</span></button>
              <button class="btn secondary icon compact zoom-chip-caret" id="zoomMenuButton" type="button" data-palette="skip" aria-haspopup="true" aria-expanded="false" aria-label="Zoom controls" title="Zoom controls">▾</button>
            </div>
""",
)

# [2][5][8] Connect / Filters / Hide panel keep their glyph when the words fold away.
#           Present becomes the primary and keeps its word at every width.
edit(
    "markup: Connect, Filters, Present, Hide panel",
    """            <button class="btn ghost compact text-action" id="connectModeButton" type="button" aria-pressed="false" title="Click one block then another to connect them">⇢ Connect</button>
            <button class="btn ghost compact text-action" id="filterButton" type="button" aria-pressed="false" title="Filters, swimlanes and metadata badges">⚑ Filters</button><button class="btn secondary compact" id="presentButton" type="button" title="Full-screen step-by-step walkthrough">▶ Present</button>
            <button class="btn ghost compact text-action" id="focusPreviewButton" type="button" aria-pressed="false" title="Hide the editor panel and show the preview full width">▢ Hide panel</button>
            <label class="sr-only" for="zoomRange">Diagram zoom</label>
            <input class="zoom-range" id="zoomRange" type="range" min="5" max="800" step="5" value="100" aria-label="Diagram zoom" />
            <span class="zoom-value" id="zoomValue">100%</span>
          </div>
""",
    """            <button class="btn ghost compact" id="connectModeButton" type="button" aria-pressed="false" aria-label="Connect blocks" title="Click one block then another to connect them"><span class="btn-glyph" aria-hidden="true">⇢</span> <span class="text-label">Connect</span></button>
            <button class="btn ghost compact" id="filterButton" type="button" aria-pressed="false" aria-label="Filters and lanes" title="Filters, swimlanes and metadata badges"><span class="btn-glyph" aria-hidden="true">⚑</span> <span class="text-label">Filters</span></button>
            <button class="btn compact" id="presentButton" type="button" title="Full-screen step-by-step walkthrough"><span aria-hidden="true">▶</span> <span>Present</span></button>
            <button class="btn ghost compact" id="focusPreviewButton" type="button" aria-pressed="false" aria-label="Hide the editor panel" title="Hide the editor panel and show the preview full width"><span class="btn-glyph" aria-hidden="true">▢</span> <span class="text-label">Hide panel</span></button>
          </div>
""",
)

# [2][5] The layout pair keeps its arrows when the words fold away.
edit(
    "markup: layout switch labels",
    """              <button class="btn layout-choice compact" id="verticalLayoutButton" type="button" aria-pressed="true" title="Top-to-bottom flow — writes TD">↕ Vertical</button>
              <button class="btn layout-choice compact" id="horizontalLayoutButton" type="button" aria-pressed="false" title="Left-to-right flow — writes LR">↔ Horizontal</button>
""",
    """              <button class="btn layout-choice compact" id="verticalLayoutButton" type="button" aria-pressed="true" aria-label="Vertical layout" title="Top-to-bottom flow — writes TD"><span aria-hidden="true">↕</span> <span class="text-label">Vertical</span></button>
              <button class="btn layout-choice compact" id="horizontalLayoutButton" type="button" aria-pressed="false" aria-label="Horizontal layout" title="Left-to-right flow — writes LR"><span aria-hidden="true">↔</span> <span class="text-label">Horizontal</span></button>
""",
)

# [2] The real zoom controls, kept whole, moved to body level so nothing clips them.
edit(
    "markup: zoom popover at body level",
    """      </section>
    </main>
""",
    """      </section>
    </main>

    <!-- The zoom controls themselves, unchanged and all still here: they are what pushed
         the preview toolbar onto a second row and what the 880px container query used to
         delete. Body level because .preview-pane is a size container with overflow:hidden. -->
    <div class="zoom-popover" id="zoomPopover" hidden role="group" aria-label="Zoom controls">
      <div class="zoom-popover-row">
        <button class="btn secondary icon compact" id="zoomOutButton" type="button" aria-label="Zoom out" title="Zoom out">−</button>
        <label class="sr-only" for="zoomRange">Diagram zoom</label>
        <input class="zoom-range" id="zoomRange" type="range" min="0" max="100" step="1" value="59" aria-label="Diagram zoom" />
        <button class="btn secondary icon compact" id="zoomInButton" type="button" aria-label="Zoom in" title="Zoom in">+</button>
      </div>
      <div class="zoom-popover-row">
        <button class="btn ghost compact text-action" id="actualSizeButton" type="button" title="Show the diagram at actual size">100%</button>
        <button class="btn ghost compact text-action" id="fitWidthButton" type="button" title="Fit the diagram to the width of the pane">Fit width</button>
        <button class="btn ghost compact text-action" id="fitPageButton" type="button" title="Fit the whole diagram in the pane">Fit page</button>
      </div>
    </div>
""",
)

# [6] Four selects, three wrapped rows. They fold behind one View button.
edit(
    "markup: View button in the workspace bar",
    """            <input class="multi-preview-search" id="multiPreviewSearch" type="search" placeholder="Filter diagrams by name or content…" autocomplete="off" aria-label="Filter diagrams" />
""",
    """            <input class="multi-preview-search" id="multiPreviewSearch" type="search" placeholder="Filter diagrams by name or content…" autocomplete="off" aria-label="Filter diagrams" />
            <button class="btn ghost compact" id="multiPreviewViewButton" type="button" aria-haspopup="true" title="Sort, group, filter and lay out the board">▤ View ▾</button>
""",
)

for _label in ("Sort", "Group", "Project / folder", "Columns"):
    edit(
        "markup: fold the %s select behind View" % _label,
        """<label class="multi-preview-control"><span>%s</span>""" % _label,
        """<label class="multi-preview-control is-folded"><span>%s</span>""" % _label,
    )

# [7] Three disabled buttons and a folder picker held permanent space at rest.
edit(
    "markup: batch bar starts hidden",
    """            <div class="multi-preview-batch">
""",
    """            <div class="multi-preview-batch" id="multiPreviewBatch" hidden>
""",
)


# ==========================================================================
#  Script: element registry
# ==========================================================================

edit(
    "js: register the new zoom elements",
    """          'fitWidthButton','fitPageButton','zoomRange','zoomValue','previewStepControls',""",
    """          'fitWidthButton','fitPageButton','zoomRange','zoomValue','zoomCluster','zoomChipButton','zoomMenuButton','zoomPopover','previewStepControls',""",
)

edit(
    "js: register the workspace View button and batch bar",
    """'multiPreviewCount','multiPreviewSelectionCount',""",
    """'multiPreviewCount','multiPreviewSelectionCount','multiPreviewViewButton','multiPreviewBatch',""",
)


# ==========================================================================
#  Script: behaviour
# ==========================================================================

# [3][9] Zoom bookkeeping, the auto-fit rule, the popover, and the log slider mapping.
edit(
    "js: auto-fit, zoom popover and logarithmic slider",
    """      function fitToPage() {
""",
    """      // Zoom is remembered per diagram, which is right, but until now nothing ever
      // re-fitted it: a diagram whose drawing grew, or whose pane was dragged narrower,
      // kept a zoom chosen for a size that no longer exists (measured at 1.7x and 1.9x the
      // viewport height). A zoom the auditor set by hand is theirs and is never touched;
      // an untouched diagram always arrives fitted.
      const pinnedZoomDiagrams = new Set();
      const lastFittedDrawing = new Map();
      let previewResizeTimer = 0;

      function markZoomAsUserSet() {
        if (state.activeDiagramId) pinnedZoomDiagrams.add(state.activeDiagramId);
      }

      // Fit page (and the zoom chip) is the "back to automatic" gesture.
      function releaseZoomPin() {
        pinnedZoomDiagrams.delete(state.activeDiagramId);
      }

      function drawingSizeChangedForActiveDiagram() {
        const key = state.activeDiagramId || '';
        const size = `${Math.round(baseSvgWidth || 0)}x${Math.round(baseSvgHeight || 0)}`;
        const changed = lastFittedDrawing.get(key) !== size;
        lastFittedDrawing.set(key, size);
        return changed;
      }

      function autoFitPreviewToPane() {
        if (state.multiPreview || previewWalkthroughIndex >= 0) return;
        if (pinnedZoomDiagrams.has(state.activeDiagramId)) return;
        if (!baseSvgWidth || !baseSvgHeight || !previewViewportIsMeasurable()) return;
        // Capped at 100% for the same reason fitStructuralPreview caps fitToWidth: an
        // automatic fit should never blow a two-block diagram up to 209%. Zooming in past
        // actual size stays a deliberate act.
        const target = Math.min(calculateFitPageZoom(), 100);
        // The observer watches the element the fit resizes, so ignore the small deltas a
        // scrollbar appearing or disappearing produces; otherwise this oscillates.
        if (Math.abs(target - currentZoom) < 2) return;
        setZoom(target);
        requestAnimationFrame(resetPreviewPan);
      }

      function observePreviewViewportSize() {
        if (typeof ResizeObserver !== 'function') return;
        const observer = new ResizeObserver(() => {
          clearTimeout(previewResizeTimer);
          previewResizeTimer = setTimeout(autoFitPreviewToPane, 150);
        });
        observer.observe(el.zoomViewport, { box: 'border-box' });
      }

      // A toolbar button that is not laid out reports a 0x0 rect at the window origin.
      // That is how the filter panel ended up in the top-left corner over the brand
      // lockup when its anchor was hidden; anything anchored to the toolbar needs this.
      function previewToolbarAnchorRect(button) {
        const rect = button ? button.getBoundingClientRect() : null;
        if (rect && rect.width) return rect;
        const pane = el.previewPane.getBoundingClientRect();
        const edge = pane.right - 10;
        return { top: pane.top + 8, bottom: pane.top + 8, left: edge, right: edge };
      }

      function positionZoomPopover() {
        if (!el.zoomPopover || el.zoomPopover.hidden) return;
        const anchor = previewToolbarAnchorRect(el.zoomCluster);
        const panel = el.zoomPopover.getBoundingClientRect();
        const margin = 10;
        // Left-aligned with the chip: right-aligning it under the caret hangs a 300px
        // panel back over the editor pane, which is not what the chip belongs to.
        const left = clamp(anchor.left, margin, Math.max(margin, window.innerWidth - panel.width - margin));
        let top = anchor.bottom + 8;
        if (top + panel.height > window.innerHeight - margin) {
          top = Math.max(margin, Math.min(anchor.top - panel.height - 8, window.innerHeight - panel.height - margin));
        }
        el.zoomPopover.style.left = `${Math.round(left)}px`;
        el.zoomPopover.style.top = `${Math.round(top)}px`;
      }

      function toggleZoomPopover(force) {
        if (!el.zoomPopover) return;
        const show = typeof force === 'boolean' ? force : el.zoomPopover.hidden;
        el.zoomPopover.hidden = !show;
        el.zoomMenuButton.setAttribute('aria-expanded', String(show));
        if (!show) return;
        positionZoomPopover();
        requestAnimationFrame(positionZoomPopover);
      }

      // 5-800% on a linear track put the whole 25-200% working range in the first fifth of
      // it, so 100% to 125% was a 3px drag. Log scale gives that range about half.
      const ZOOM_SLIDER_SPAN = 160;
      function sliderPositionToZoom(position) {
        const at = clamp(Number(position) || 0, 0, 100);
        return clamp(Math.round(5 * Math.pow(ZOOM_SLIDER_SPAN, at / 100)), 5, 800);
      }
      function zoomToSliderPosition(zoom) {
        const value = clamp(Number(zoom) || 100, 5, 800);
        return clamp(Math.round((Math.log(value / 5) / Math.log(ZOOM_SLIDER_SPAN)) * 100), 0, 100);
      }

      function fitToPage() {
""",
)

# [3][9] setZoom writes the slider position, the chip label and an aria-valuetext.
edit(
    "js: setZoom drives the chip and the log slider",
    """        el.zoomRange.value = String(currentZoom);
        el.zoomValue.textContent = `${currentZoom}%`;
""",
    """        el.zoomRange.value = String(zoomToSliderPosition(currentZoom));
        // The slider position is logarithmic, so its raw value means nothing spoken aloud.
        el.zoomRange.setAttribute('aria-valuetext', `${currentZoom}%`);
        el.zoomValue.textContent = `${currentZoom}%`;
        if (el.zoomChipButton) {
          el.zoomChipButton.setAttribute('aria-label', `Zoom ${currentZoom} percent. Fit the whole diagram in the pane.`);
        }
""",
)

# [3] Fit width was passing the click event in as `cap`, which made it a 100% button.
edit(
    "js: zoom control wiring",
    """        el.zoomRange.addEventListener('input', () => setZoom(Number(el.zoomRange.value)));
        el.zoomOutButton.addEventListener('click', () => setZoom(currentZoom - 10));
        el.zoomInButton.addEventListener('click', () => setZoom(currentZoom + 10));
        el.actualSizeButton.addEventListener('click', () => setZoom(100));
        el.fitWidthButton.addEventListener('click', fitToWidth);
        el.fitPageButton.addEventListener('click', fitToPage);
""",
    """        el.zoomRange.addEventListener('input', () => { markZoomAsUserSet(); setZoom(sliderPositionToZoom(el.zoomRange.value)); });
        el.zoomOutButton.addEventListener('click', () => { markZoomAsUserSet(); setZoom(currentZoom - 10); });
        el.zoomInButton.addEventListener('click', () => { markZoomAsUserSet(); setZoom(currentZoom + 10); });
        el.actualSizeButton.addEventListener('click', () => { markZoomAsUserSet(); setZoom(100); });
        // Passing the handler straight to addEventListener handed the click event in as
        // `cap`, so every Fit width was really a 100% button.
        el.fitWidthButton.addEventListener('click', () => { markZoomAsUserSet(); fitToWidth(); });
        el.fitPageButton.addEventListener('click', () => { releaseZoomPin(); fitToPage(); });
        el.zoomChipButton.addEventListener('click', () => { releaseZoomPin(); fitToPage(); });
        el.zoomMenuButton.addEventListener('click', () => toggleZoomPopover());
        el.zoomPopover.addEventListener('keydown', event => {
          if (event.key !== 'Escape') return;
          toggleZoomPopover(false);
          el.zoomMenuButton.focus();
        });
        document.addEventListener('mousedown', event => {
          if (el.zoomPopover.hidden) return;
          if (el.zoomPopover.contains(event.target) || el.zoomCluster.contains(event.target)) return;
          toggleZoomPopover(false);
        }, true);
        window.addEventListener('resize', positionZoomPopover);
        observePreviewViewportSize();
""",
)

# [3] Fit width caps at 100%, so a tall diagram still arrived several viewports deep.
edit(
    "js: the structural fit falls through to fit page on a too-tall drawing",
    """      function fitStructuralPreview() {
        if (!previewViewportIsMeasurable()) { pendingAutoFit = true; return; }
        pendingAutoFit = false;
        fitToWidth(100);
      }
""",
    """      function fitStructuralPreview() {
        if (!previewViewportIsMeasurable()) { pendingAutoFit = true; return; }
        pendingAutoFit = false;
        fitToWidth(100);
        // The 100% cap is there so a narrow diagram is not blown up, but on a tall one it
        // leaves the drawing several viewports deep — a 16-step flowchart landed at 4.1x
        // the viewport height. If the whole drawing still does not fit, fit the page.
        if (baseSvgHeight && baseSvgHeight * currentZoom / 100 > el.zoomViewport.clientHeight) fitToPage();
      }
""",
)

# [3] The ResizeObserver catches resizer drags; this catches window resizes.
edit(
    "js: window resize re-fits the preview too",
    """          runPendingAutoFit();
          if (el.presentOverlay && !el.presentOverlay.hidden) requestAnimationFrame(() => updatePresentationCamera(false));
""",
    """          runPendingAutoFit();
          // The ResizeObserver on #zoomViewport catches resizer drags and focus mode; this
          // catches the window itself changing size. Same debounce, same guard.
          clearTimeout(previewResizeTimer);
          previewResizeTimer = setTimeout(autoFitPreviewToPane, 150);
          if (el.presentOverlay && !el.presentOverlay.hidden) requestAnimationFrame(() => updatePresentationCamera(false));
""",
)

# [3] Wheel zoom is a deliberate zoom too.
edit(
    "js: wheel zoom pins the zoom",
    """        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        const oldZoom = currentZoom;
""",
    """        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        markZoomAsUserSet();
        const oldZoom = currentZoom;
""",
)

# [3] The render path kept the stored zoom and never re-measured the drawing.
edit(
    "js: re-fit after a render that changed the drawing's size",
    """          if (shouldAutoFitAfterRender(reason)) fitStructuralPreview();
""",
    """          const drawingChanged = drawingSizeChangedForActiveDiagram();
          if (shouldAutoFitAfterRender(reason)) fitStructuralPreview();
          else if (drawingChanged) autoFitPreviewToPane();
""",
)

# [2][5] The three buttons that fold their word now carry it in a span.
edit(
    "js: label helper for the folding toolbar buttons",
    """      function updateFocusPreviewButton() {
        if (!el.focusPreviewButton) return;
        el.focusPreviewButton.setAttribute('aria-pressed', String(focusPreviewMode));
        el.focusPreviewButton.textContent = focusPreviewMode ? '▣ Show panel' : '▢ Hide panel';
""",
    """      // These buttons drop their word in a narrow pane, so the glyph and the label are
      // separate spans and a bare textContent write would destroy both.
      function setToolbarButtonLabel(button, glyph, label) {
        if (!button) return;
        const glyphNode = button.querySelector('.btn-glyph');
        const labelNode = button.querySelector('.text-label');
        if (glyphNode) glyphNode.textContent = glyph;
        if (labelNode) labelNode.textContent = label;
      }

      function updateFocusPreviewButton() {
        if (!el.focusPreviewButton) return;
        el.focusPreviewButton.setAttribute('aria-pressed', String(focusPreviewMode));
        setToolbarButtonLabel(el.focusPreviewButton, focusPreviewMode ? '▣' : '▢', focusPreviewMode ? 'Show panel' : 'Hide panel');
        el.focusPreviewButton.setAttribute('aria-label', focusPreviewMode ? 'Show the editor panel' : 'Hide the editor panel');
""",
)

edit(
    "js: filter button label",
    """        el.filterButton.textContent = count ? `⚑ Filters · ${count}` : '⚑ Filters';
""",
    """        setToolbarButtonLabel(el.filterButton, '⚑', count ? `Filters · ${count}` : 'Filters');
        el.filterButton.setAttribute('aria-label', count ? `Filters and lanes, ${count} active` : 'Filters and lanes');
""",
)

edit(
    "js: connect button label",
    """        el.connectModeButton.textContent = connectMode ? '⇢ Connecting…' : '⇢ Connect';
""",
    """        setToolbarButtonLabel(el.connectModeButton, '⇢', connectMode ? 'Connecting…' : 'Connect');
""",
)

# [4] The guard the filter panel never had.
edit(
    "js: filter panel falls back to the preview pane",
    """        const anchor = el.filterButton.getBoundingClientRect();
        const panel = el.filterPanel.getBoundingClientRect();
""",
    """        const anchor = previewToolbarAnchorRect(el.filterButton);
        const panel = el.filterPanel.getBoundingClientRect();
""",
)

# [8] The workspace wording survived the unconditional call this function gets at init.
edit(
    "js: Present tooltip follows the mode",
    """        if (el.presentButton) el.presentButton.title = 'Present the whole workspace as one map';
""",
    """        // Called unconditionally at init, so without the else branch every single-diagram
        // load advertised a workspace feature on a button that presents one diagram.
        if (el.presentButton) el.presentButton.title = state.multiPreview
          ? 'Present the whole workspace as one map'
          : 'Full-screen step-by-step walkthrough';
        toggleZoomPopover(false);
""",
)

# [7] The same code that already hides the selection count.
edit(
    "js: batch bar appears with the selection",
    """          el.multiPreviewSelectionCount.textContent = chosen.length ? `${chosen.length} selected` : '';
          el.multiPreviewSelectionCount.hidden = !chosen.length;
        }
""",
    """          el.multiPreviewSelectionCount.textContent = chosen.length ? `${chosen.length} selected` : '';
          el.multiPreviewSelectionCount.hidden = !chosen.length;
        }
        // Move / Compare / Delete only mean anything against a selection, so the bar is a
        // selection bar rather than four permanently dead controls (one of them red).
        if (el.multiPreviewBatch) el.multiPreviewBatch.hidden = !chosen.length;
""",
)

# [6] Two levels of the existing menu primitive, driving the existing selects.
edit(
    "js: workspace View menu",
    """      function syncWorkspaceBoardFromControls() {
""",
    """      // The four board selects wrapped the workspace bar onto three rows for 146px of
      // chrome. They fold into one menu here: same selects, same change handlers. One flat
      // list rather than a submenu per select — openStructureMenu's dismiss-on-outside-
      // click watcher belongs to the menu that opened it, so a menu opened from inside
      // another one is closed by the next mousedown before its own click lands.
      const WORKSPACE_VIEW_MENUS = [
        ['sort', 'Sort', () => el.multiPreviewSort],
        ['group', 'Group', () => el.multiPreviewGroupBy],
        ['columns', 'Columns', () => el.multiPreviewColumns],
        ['folder', 'Show', () => el.multiPreviewFolderFilter]
      ];

      function openWorkspaceViewMenu(anchor) {
        const options = [];
        WORKSPACE_VIEW_MENUS.forEach(([key, label, get]) => {
          const control = get();
          if (!control) return;
          Array.from(control.options).forEach(option => {
            const current = option.value === control.value;
            options.push([`${key}:${option.value}`, `${current ? '✓ ' : '   '}${label} · ${option.textContent}`]);
          });
        });
        openStructureMenu(anchor, options, '', picked => {
          const split = picked.indexOf(':');
          const control = (WORKSPACE_VIEW_MENUS.find(entry => entry[0] === picked.slice(0, split)) || [])[2];
          const select = control && control();
          if (!select) return;
          select.value = picked.slice(split + 1);
          select.dispatchEvent(new Event('change'));
        });
      }

      function syncWorkspaceBoardFromControls() {
""",
)

edit(
    "js: wire the View button",
    """        el.workspaceNewFolderButton.addEventListener('click', createWorkspaceFolder);
""",
    """        if (el.multiPreviewViewButton) {
          el.multiPreviewViewButton.addEventListener('click', () => openWorkspaceViewMenu(el.multiPreviewViewButton));
        }
        el.workspaceNewFolderButton.addEventListener('click', createWorkspaceFolder);
""",
)

# [9] The tick keeps its 15px look inside a 24px label.
edit(
    "js: 24px hit area on the card selection tick",
    """        tick.addEventListener('change', () => toggleWorkspaceSelection(diagram.id, tick.checked));
""",
    """        tick.addEventListener('change', () => toggleWorkspaceSelection(diagram.id, tick.checked));
        // The 15px box was 39% of the required 24px target, and it is the only way into
        // the batch actions. The label carries the hit area; the box keeps its size.
        const tickHit = document.createElement('label');
        tickHit.className = 'multi-preview-tick-hit';
        tickHit.title = 'Select for batch actions';
        tickHit.addEventListener('click', event => event.stopPropagation());
        tickHit.appendChild(tick);
""",
)

edit(
    "js: card head takes the padded tick",
    """        head.append(tick, meta, menu, edit);
""",
    """        head.append(tickHit, meta, menu, edit);
""",
)

edit(
    "js: 24px hit area on the group select-all tick",
    """        head.append(selectAll, toggle, actions);
""",
    """        const selectAllHit = document.createElement('label');
        selectAllHit.className = 'multi-preview-tick-hit';
        selectAllHit.title = selectAll.title;
        selectAllHit.appendChild(selectAll);
        head.append(selectAllHit, toggle, actions);
""",
)

# [2] The chip and its caret are covered by Fit page / the zoom menu already.
edit(
    "js: let a button opt out of the command palette harvest",
    """          if (button.closest('#commandPalette')) return;
""",
    """          if (button.closest('#commandPalette')) return;
          if (button.dataset.palette === 'skip') return;
""",
)


def main():
    if len(sys.argv) < 2:
        print("usage: python fix_preview.py <path-to-app.html>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    with io.open(path, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()

    for note, old, new, count in EDITS:
        found = text.count(old)
        if found != count:
            print(
                "ABORT: anchor for %r matched %d times, expected %d" % (note, found, count),
                file=sys.stderr,
            )
            return 1
        text = text.replace(old, new, count)
        print("ok: %s" % note)

    tmp = path + ".fix_preview.tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(tmp, path)
    print("wrote %s (%d edits)" % (path, len(EDITS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
