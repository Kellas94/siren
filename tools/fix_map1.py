import io, os

P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# Tiles for diagrams that were never opened have no cached picture yet. Render them
# on demand, once each, and upgrade the tile when the picture arrives.
rep("""      function mapSvgFor(diagram) {
        const cached = diagramPreviewCache.get(diagram.id);
        if (cached && cached.svg) return cached.svg;
        if (diagram.id === state.activeDiagramId && lastGoodSvg) return lastGoodSvg;
        return '';
      }""",
    """      const mapSvgPending = new Set();

      function mapSvgFor(diagram) {
        const cached = diagramPreviewCache.get(diagram.id);
        if (cached && cached.svg) return cached.svg;
        if (diagram.id === state.activeDiagramId && lastGoodSvg) return lastGoodSvg;
        mapRequestSvg(diagram);
        return '';
      }

      function mapRequestSvg(diagram) {
        if (mapSvgPending.has(diagram.id)) return;
        mapSvgPending.add(diagram.id);
        presentationSvgForDiagram(diagram).then(() => {
          mapSvgPending.delete(diagram.id);
          const tile = mapTileEls.get(diagram.id);
          if (tile) tile.level = '';
          if (mapMode) {
            // The tile was measured from a placeholder aspect; once the real picture
            // is here the plane is worth re-laying only if nothing has been placed
            // by hand, so just repaint the detail.
            mapUpdateTileDetail();
            mapRenderThread();
          }
        }).catch(() => { mapSvgPending.delete(diagram.id); });
      }""")

# A route of one diagram is not a presentation of a workspace.
rep("""        const ordered = state.presentationDeck && state.presentationDeck.length
          ? state.presentationDeck.filter(id => state.diagrams.some(diagram => diagram.id === id))
          : state.diagrams.map(diagram => diagram.id);""",
    """        const deck = (state.presentationDeck || []).filter(id => state.diagrams.some(diagram => diagram.id === id));
        // The seeded route covers the workspace: a deck of one was almost always a
        // leftover, and an empty-looking presentation is the reason nobody used this.
        const ordered = deck.length > 1 ? deck : state.diagrams.map(diagram => diagram.id);""")

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d' % (len(orig), len(s)))
