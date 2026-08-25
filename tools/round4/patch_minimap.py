import io, os, sys
# Minimap for the diagram preview: a tiny overview in the bottom-right of #zoomViewport,
# shown only when the drawing overflows the pane. Applies to FROZEN_1_62_0.html.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# 1. HTML: the dock lives in the scroll pane next to the card, never inside #diagram or its
#    SVG, so no serializer (exports, thumbnails, lastGoodSvg) can ever see it.
rep("""            <div class="preview-overlay" id="previewOverlay" hidden>Preview is showing the last valid render.</div>
          </div>
        </div>
      </section>""",
"""            <div class="preview-overlay" id="previewOverlay" hidden>Preview is showing the last valid render.</div>
          </div>
          <!-- Minimap: a tiny overview for a drawing larger than the pane. Sits outside the
               card and the SVG so exports and thumbnails never see it; it only shows itself
               when the preview overflows (see previewMinimapLayout). -->
          <div class="preview-minimap-dock" id="previewMinimapDock" aria-hidden="true" hidden>
            <div class="preview-minimap" id="previewMinimap">
              <img class="preview-minimap-thumb" id="previewMinimapThumb" alt="" draggable="false" decoding="async" />
              <div class="preview-minimap-view" id="previewMinimapView"></div>
            </div>
          </div>
        </div>
      </section>""")

# 2. CSS, right after the diagram stage rules.
rep("""    .diagram-stage svg { display: block; flex: 0 0 auto; max-width: none !important; }
""",
"""    .diagram-stage svg { display: block; flex: 0 0 auto; max-width: none !important; }

    /* ---- preview minimap: an overview of a drawing larger than the pane ---- */
    /* The dock is a zero-height sticky strip after the card, so the map pins to the pane's
       bottom-right corner through scrolling without JS repositioning or extra scroll room.
       Insets of 0 land it on the pane's own padding (measured: 18px in every scroll state). */
    .preview-minimap-dock {
      position: sticky;
      left: 0;
      bottom: 0;
      height: 0;
      z-index: 10;
      pointer-events: none;
    }
    .preview-minimap-dock[hidden] { display: none; }
    .preview-minimap {
      position: absolute;
      right: 0;
      bottom: 0;
      overflow: hidden;
      border: 1px solid var(--border-strong);
      border-radius: 7px;
      background: color-mix(in srgb, var(--panel-bg) 90%, transparent);
      box-shadow: var(--shadow-soft, var(--shadow));
      opacity: 0.82;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      touch-action: none;
      transition: opacity 0.15s ease;
    }
    .preview-minimap:hover,
    .preview-minimap.is-dragging { opacity: 1; }
    .preview-minimap-thumb {
      position: absolute;
      display: block;
      pointer-events: none;
      opacity: 0.9;
    }
    .preview-minimap-view {
      position: absolute;
      left: 0;
      top: 0;
      box-sizing: border-box;
      border: 1px solid var(--primary);
      border-radius: 2px;
      background: color-mix(in srgb, var(--primary) 16%, transparent);
      cursor: grab;
      will-change: transform;
    }
    .preview-minimap.is-dragging .preview-minimap-view { cursor: grabbing; }
    /* Never on the board, never under Present. */
    .preview-pane.is-multi-preview .preview-minimap-dock,
    body[data-presenting="on"] .preview-minimap-dock { display: none; }
    @media (prefers-reduced-motion: reduce) { .preview-minimap { transition: none; } }
""")

# 3. Wiring: one init call next to the viewport's other observers.
rep("""        observePreviewViewportSize();
""",
"""        observePreviewViewportSize();
        previewMinimapInit();
""")

# 4. Render path: one call next to canvasAfterRender (the thumbnail is rebuilt lazily).
rep("""          canvasAfterRender();
""",
"""          canvasAfterRender();
          previewMinimapAfterRender();
""")

# 5. Zoom: the rectangle and the map scale follow (deferred to one frame, no re-render).
rep("""        if (shouldSave) scheduleSave();
        canvasOverlayRescale();
      }
""",
"""        if (shouldSave) scheduleSave();
        canvasOverlayRescale();
        previewMinimapSchedule();
      }
""")

# 6. The module itself, after observePreviewViewportSize.
rep("""        observer.observe(el.zoomViewport, { box: 'border-box' });
      }
""",
"""        observer.observe(el.zoomViewport, { box: 'border-box' });
      }

      /* ---- preview minimap ----
         A tiny overview in the bottom-right of the pane, only while the drawing is larger
         than the pane. The map is the whole scrollable area at one scale; the thumbnail
         (the last rendered SVG as an image, built once per render) sits where the drawing
         sits in it; the rectangle is the visible part and follows scroll and zoom without
         touching the thumbnail. Drag the rectangle, or press anywhere on the map, to move.
         It lives outside #diagram, so exports, thumbnails and lastGoodSvg never see it. */
      const MINIMAP_MAX_W = 160;
      const MINIMAP_MIN_H = 120;
      const MINIMAP_MAX_H = 220;
      let minimapDock = null;
      let minimapBox = null;
      let minimapThumb = null;
      let minimapView = null;
      let minimapScale = 0;            // map px per pane px, from the last layout pass
      let minimapThumbFor = '';        // the lastGoodSvg the thumbnail was built from
      let minimapFrame = 0;            // pending rAF for a layout pass
      let minimapDrag = null;          // { id, dx, dy } while the rectangle is held

      function previewMinimapInit() {
        minimapDock = document.getElementById('previewMinimapDock');
        minimapBox = document.getElementById('previewMinimap');
        minimapThumb = document.getElementById('previewMinimapThumb');
        minimapView = document.getElementById('previewMinimapView');
        if (!minimapDock || !minimapBox || !minimapThumb || !minimapView || !el.zoomViewport) return;
        el.zoomViewport.addEventListener('scroll', previewMinimapTrack, { passive: true });
        // Pane resizes (resizer drag, focus mode, window) change the visible rectangle.
        if (typeof ResizeObserver === 'function') {
          new ResizeObserver(() => previewMinimapSchedule()).observe(el.zoomViewport, { box: 'border-box' });
        }
        // The thumbnail is an object URL; release it once the image has it.
        minimapThumb.addEventListener('load', () => { if (minimapThumb.src.startsWith('blob:')) URL.revokeObjectURL(minimapThumb.src); });
        minimapThumb.addEventListener('error', () => { minimapThumb.removeAttribute('src'); });
        // Pointer handling stays on the map itself: the pan and ring gestures of the pane
        // never hear these, and the map never hears theirs.
        minimapBox.addEventListener('pointerdown', minimapPointerDown);
        minimapBox.addEventListener('pointermove', minimapPointerMove);
        minimapBox.addEventListener('pointerup', minimapPointerEnd);
        minimapBox.addEventListener('pointercancel', minimapPointerEnd);
        minimapBox.addEventListener('click', event => event.stopPropagation());
        minimapBox.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); });
      }

      // Shown only while it helps: one diagram, outside Present, and overflowing the pane.
      function previewMinimapWanted() {
        if (!minimapDock || !el.zoomViewport || !lastGoodSvg) return false;
        if (state.multiPreview || el.previewCard.hidden) return false;
        if (document.body.dataset.presenting === 'on') return false;
        if (!previewViewportIsMeasurable()) return false;
        // A few hidden pixels are not worth a map: at least a tenth of the pane (40px floor)
        // has to be out of view on one axis.
        const pane = el.zoomViewport;
        const hiddenX = pane.scrollWidth - pane.clientWidth;
        const hiddenY = pane.scrollHeight - pane.clientHeight;
        return hiddenX > Math.max(40, pane.clientWidth * 0.1) || hiddenY > Math.max(40, pane.clientHeight * 0.1);
      }

      function previewMinimapAfterRender() {
        previewMinimapSchedule();
      }

      // All geometry work is coalesced into one frame; scroll alone never gets here.
      function previewMinimapSchedule() {
        if (!minimapDock || minimapFrame) return;
        minimapFrame = requestAnimationFrame(() => { minimapFrame = 0; previewMinimapLayout(); });
      }

      function previewMinimapLayout() {
        if (!minimapDock) return;
        const svg = el.diagram ? el.diagram.querySelector('svg') : null;
        if (!svg || !previewMinimapWanted()) {
          minimapDock.hidden = true;
          minimapScale = 0;
          return;
        }
        const pane = el.zoomViewport;
        const scrollW = pane.scrollWidth;
        const scrollH = pane.scrollHeight;
        // Up to 160 wide; a tall drawing gets a taller strip (a third of the pane, capped at
        // 220px) because at 120px a 40-block flow was a 33px-wide sliver nobody could read.
        const maxH = clamp(pane.clientHeight * 0.34, MINIMAP_MIN_H, MINIMAP_MAX_H);
        const k = Math.min(MINIMAP_MAX_W / scrollW, maxH / scrollH);
        minimapScale = k;
        const paneRect = pane.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        // Where the drawing sits inside the scrollable area, in pane pixels.
        const svgX = svgRect.left - paneRect.left - pane.clientLeft + pane.scrollLeft;
        const svgY = svgRect.top - paneRect.top - pane.clientTop + pane.scrollTop;
        minimapBox.style.width = `${Math.round(scrollW * k)}px`;
        minimapBox.style.height = `${Math.round(scrollH * k)}px`;
        minimapThumb.style.left = `${(svgX * k).toFixed(2)}px`;
        minimapThumb.style.top = `${(svgY * k).toFixed(2)}px`;
        minimapThumb.style.width = `${(svgRect.width * k).toFixed(2)}px`;
        minimapThumb.style.height = `${(svgRect.height * k).toFixed(2)}px`;
        minimapView.style.width = `${(pane.clientWidth * k).toFixed(2)}px`;
        minimapView.style.height = `${(pane.clientHeight * k).toFixed(2)}px`;
        minimapDock.hidden = false;
        previewMinimapRefreshThumb();
        previewMinimapTrack();
      }

      // The thumbnail is the last rendered drawing as an image, made once per render and
      // only while the map is showing, so a small diagram never pays for it.
      function previewMinimapRefreshThumb() {
        if (!minimapThumb || minimapThumbFor === lastGoodSvg) return;
        minimapThumbFor = lastGoodSvg;
        let markup = lastGoodSvg;
        try { markup = sanitizeSvgForRaster(lastGoodSvg); } catch (error) { /* show the drawing as it is */ }
        // At map scale a 1px outline vanishes and a block is just its label; a thicker
        // outline keeps blocks and groups readable as shapes. Only this copy is touched.
        const stroke = Math.max(3, Math.round(Math.max(baseSvgWidth || 0, baseSvgHeight || 0) / 180));
        markup = markup.replace(/<svg(\\s[^>]*)?>/, tag => `${tag}<style>.node rect,.node polygon,.node circle,.node ellipse,.node path{stroke-width:${stroke}px!important}.cluster rect{stroke-width:${Math.max(2, Math.round(stroke * 0.6))}px!important}</style>`);
        try {
          const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
          minimapThumb.src = URL.createObjectURL(blob);
        } catch (error) {
          minimapThumb.removeAttribute('src');
        }
      }

      // Scroll: move the rectangle only. Cheap enough to run on every scroll event.
      function previewMinimapTrack() {
        if (!minimapDock || minimapDock.hidden || !minimapScale) return;
        const pane = el.zoomViewport;
        minimapView.style.transform = `translate(${(pane.scrollLeft * minimapScale).toFixed(2)}px, ${(pane.scrollTop * minimapScale).toFixed(2)}px)`;
      }

      function minimapPointerDown(event) {
        if (!minimapScale || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const pane = el.zoomViewport;
        const box = minimapBox.getBoundingClientRect();
        const mx = event.clientX - box.left - minimapBox.clientLeft;
        const my = event.clientY - box.top - minimapBox.clientTop;
        const rectX = pane.scrollLeft * minimapScale;
        const rectY = pane.scrollTop * minimapScale;
        const rectW = pane.clientWidth * minimapScale;
        const rectH = pane.clientHeight * minimapScale;
        const inside = mx >= rectX && mx <= rectX + rectW && my >= rectY && my <= rectY + rectH;
        // Holding the rectangle keeps the grip where it was taken; pressing elsewhere
        // centres the rectangle on the pointer first, then the same drag continues.
        minimapDrag = inside ? { id: event.pointerId, dx: mx - rectX, dy: my - rectY } : { id: event.pointerId, dx: rectW / 2, dy: rectH / 2 };
        minimapBox.classList.add('is-dragging');
        try { minimapBox.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointer */ }
        if (!inside) minimapScrollTo(mx, my);
      }

      function minimapPointerMove(event) {
        if (!minimapDrag || event.pointerId !== minimapDrag.id) return;
        event.stopPropagation();
        const box = minimapBox.getBoundingClientRect();
        minimapScrollTo(event.clientX - box.left - minimapBox.clientLeft, event.clientY - box.top - minimapBox.clientTop);
      }

      function minimapPointerEnd(event) {
        if (!minimapDrag || event.pointerId !== minimapDrag.id) return;
        event.stopPropagation();
        minimapDrag = null;
        minimapBox.classList.remove('is-dragging');
        try { minimapBox.releasePointerCapture(event.pointerId); } catch (error) { /* already released */ }
      }

      // Map point under the grip -> pane scroll. The browser clamps to the scroll range.
      function minimapScrollTo(mx, my) {
        if (!minimapDrag || !minimapScale) return;
        const pane = el.zoomViewport;
        pane.scrollLeft = (mx - minimapDrag.dx) / minimapScale;
        pane.scrollTop = (my - minimapDrag.dy) / minimapScale;
      }
""")

# 7. Connector waypoint mode listens for clicks on #zoomViewport in the CAPTURE phase, so it
#    ran before the minimap could swallow its own click: a press on the map navigated AND
#    planted a bogus waypoint. The map is navigation, never a canvas point - skip it here.
rep("""      function handleEdgeWaypointCanvasClick(event) {
        if(!edgeWaypointMode||!edgeInspectorKey)return;
""",
"""      function handleEdgeWaypointCanvasClick(event) {
        if(!edgeWaypointMode||!edgeInspectorKey)return;
        // A press on the preview minimap moves the view; it is never a waypoint.
        if(event.target instanceof Element&&event.target.closest('#previewMinimapDock'))return;
""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
