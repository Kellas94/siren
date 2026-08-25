import io, os

SC = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

def read(name):
    return io.open(os.path.join(SC, name), encoding='utf-8').read()

# ---------------------------------------------------------------- CSS
rep("    .present-overlay {\n      position: fixed;",
    read('map.css').rstrip('\n') + "\n    .present-overlay {\n      position: fixed;")

# ---------------------------------------------------------------- markup
rep('    <div class="present-overlay" id="presentOverlay" hidden>\n      <div class="present-bar">',
    '    <div class="present-overlay" id="presentOverlay" hidden>\n'
    + read('map.html').rstrip('\n') + '\n'
    + '      <div class="present-bar" id="presentBar">')

# ---------------------------------------------------------------- el registry
rep("'presentOverlay','presentDimButton','presentTitle',",
    "'presentOverlay','presentBar','mapLayer','mapPlane','mapThread','mapFocusRing','mapHint','mapPanel','mapNextName','mapNotes',"
    "'mapAddCardButton','mapTidyButton','mapExportButton','mapBar','mapPrevButton','mapPosition','mapNextButton','mapViewName',"
    "'mapRecordButton','mapHomeButton','mapPresenterButton','mapFullscreenButton','mapExitButton','mapRoute',"
    "'presentDimButton','presentTitle',")

# ---------------------------------------------------------------- engine + cards
rep("      function closePresentation() {",
    read('map_engine.js').rstrip('\n') + '\n\n' + read('map_cards.js').rstrip('\n') + '\n\n      function closePresentation() {')

# ---------------------------------------------------------------- state
rep("""        state.workspaceFolders = sanitizeWorkspaceFolders(state.workspaceFolders);
        const validWorkspaceFolderIds = new Set(state.workspaceFolders.map(folder => folder.id));""",
    """        state.map = sanitizeMapState(state.map);
        state.workspaceFolders = sanitizeWorkspaceFolders(state.workspaceFolders);
        const validWorkspaceFolderIds = new Set(state.workspaceFolders.map(folder => folder.id));""")

# ---------------------------------------------------------------- open into the Map
rep("""        resizePresentationCanvas(true);
        await loadPresentationDiagram(presentDeckIndex, { startAt: -1, animate: false });
        el.presentNextButton.focus();""",
    """        resizePresentationCanvas(true);
        // Present opens on the Map now: the whole workspace at once, with a route
        // already drawn through it. A diagram is one press away, and the walk that
        // Present has always had is what that press opens.
        mapOpen();
        if (!document.fullscreenElement) mapToggleFullscreen();""")

# ---------------------------------------------------------------- keys and exit
rep("""        if(event.key==='Escape'){event.preventDefault();closePresentation();}""",
    """        if (mapHandleKey(event)) { event.preventDefault(); return; }
        if (event.key === 'Escape' && !mapMode && state.map && state.map.route.length) {
          // Leaving a diagram returns to the Map; leaving the Map leaves Present.
          event.preventDefault();
          mapReturnFromDiagram();
          return;
        }
        if(event.key==='Escape'){event.preventDefault();closePresentation();}""")

rep("""        el.presentOverlay.hidden=true;
        delete document.body.dataset.presenting;""",
    """        el.presentOverlay.hidden=true;
        mapStopCamera();
        mapSetMode(false);
        mapTileEls.forEach(tile => tile.host.remove());
        mapTileEls = new Map();
        mapRecording = false;
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        delete document.body.dataset.presenting;""")

# ---------------------------------------------------------------- wiring
rep("""        el.presentExitButton.addEventListener('click', closePresentation);""",
    """        if (el.mapPrevButton) el.mapPrevButton.addEventListener('click', () => mapStepRoute(-1));
        if (el.mapNextButton) el.mapNextButton.addEventListener('click', () => mapStepRoute(1));
        if (el.mapHomeButton) el.mapHomeButton.addEventListener('click', () => mapFlyTo(mapCameraForRect(mapBounds(), 1.06)));
        if (el.mapRecordButton) el.mapRecordButton.addEventListener('click', () => mapToggleRecording());
        if (el.mapFullscreenButton) el.mapFullscreenButton.addEventListener('click', mapToggleFullscreen);
        if (el.mapExitButton) el.mapExitButton.addEventListener('click', closePresentation);
        if (el.mapPresenterButton) el.mapPresenterButton.addEventListener('click', () => {
          const on = el.mapPanel.hidden;
          el.mapPanel.hidden = !on;
          el.mapPresenterButton.setAttribute('aria-pressed', String(on));
        });
        if (el.mapNotes) el.mapNotes.addEventListener('input', () => {
          const view = state.map && state.map.route[mapRouteIndex];
          if (!view) return;
          view.note = el.mapNotes.value.slice(0, 5000);
          scheduleSave();
        });
        if (el.mapAddCardButton) el.mapAddCardButton.addEventListener('click', () => mapOpenCardMenu(el.mapAddCardButton));
        if (el.mapTidyButton) el.mapTidyButton.addEventListener('click', () => {
          layoutMap(true);
          mapTileEls.forEach(tile => tile.host.remove());
          mapTileEls = new Map();
          mapRenderCards();
          mapRenderThread();
          mapUpdateTileDetail();
          mapFlyTo(mapCameraForRect(mapBounds(), 1.06));
          showToast('Map tidied.', 'success');
        });
        if (el.mapExportButton) el.mapExportButton.addEventListener('click', () => mapExportRoute('pdf'));
        el.presentExitButton.addEventListener('click', closePresentation);""")

# the map is drawn after cards exist, and cards are part of opening
rep("""        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapCamera = mapCameraForRect(mapBounds(), 1.06);""",
    """        mapRenderCards();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapCamera = mapCameraForRect(mapBounds(), 1.06);""")

# Present is no longer meaningless on the screen that shows every diagram
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d' % (len(orig), len(s)))
