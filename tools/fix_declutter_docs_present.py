r"""[09] Declutter: the two remaining verified moves from DECLUTTER_MOVES.md.

#3 Docs head: #wpType, #wpChangesButton, #wpReleasesButton leave the wall and live in the
   existing document ⋯ (#wpDocMenuButton). Type becomes four rows with the current one
   ticked (openStructureMenu cannot nest, and must not). Second routes kept: Changes and
   Releases are already palette commands; the type stays displayed on the register row.
   Head 8 → 5 at rest; at 1280 the head drops from two lines to one.
#4 Map bar: #mapBuildButton and #presentKeysButton move INTO the authoring cluster
   (.map-authoring) that #mapMoreButton already opens. E and ? keys keep working (handlers
   are by id); the Present caret menu still offers "Build the presentation…". Bar 7 → 5 at
   rest - the bar that is on screen in front of a client for the whole talk.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------- #4 map bar: move Build and ? into the authoring cluster ----------------
rep("""            <button class="btn ghost compact" id="mapHomeButton" type="button" title="Pull back to the whole workspace">⌂ Whole map</button>
            <button class="btn ghost compact" id="mapBuildButton" type="button" aria-pressed="false" title="Build the presentation: add, reorder and remove its slides (E)">✎ Build</button>
            <span class="map-authoring">
              <button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>""",
    """            <button class="btn ghost compact" id="mapHomeButton" type="button" title="Pull back to the whole workspace">⌂ Whole map</button>
            <span class="map-authoring">
              <!-- Build and the shortcut card are authoring: zero-frequency while a room
                   is watching, so they live behind ⋯ with Notes and Presenter view.
                   E and ? still open them from the keyboard. -->
              <button class="btn ghost compact" id="mapBuildButton" type="button" aria-pressed="false" title="Build the presentation: add, reorder and remove its slides (E)">✎ Build</button>
              <button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>""")
rep("""              <button class="btn ghost compact" id="mapFullscreenButton" type="button" title="Full screen">⤢</button>
            </span>
            <button class="btn ghost compact" id="mapMoreButton" type="button" aria-pressed="false" title="Authoring tools">⋯</button>""",
    """              <button class="btn ghost compact" id="mapFullscreenButton" type="button" title="Full screen">⤢</button>
              <button class="btn ghost icon compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
            </span>
            <button class="btn ghost compact" id="mapMoreButton" type="button" aria-pressed="false" title="Authoring tools, Build and the keyboard shortcuts">⋯</button>""")
# remove the old standalone ? button (it now lives in the cluster)
rep("""          <button class="btn ghost icon compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>""",
    """          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>""")

# ---------------- #3 Docs head: Type / Changes / Releases into the document ⋯ ----------------
# hide the three at rest (keep them in the DOM: their handlers and aria-controls stay valid)
rep("""              <select id="wpType" aria-label="Document type">""",
    """              <select id="wpType" aria-label="Document type" hidden>""")
rep("""              <button class="btn ghost compact" id="wpChangesButton" type="button" aria-controls="wpChangesPanel" aria-expanded="false" title="Tracked changes: live edits this session, plus archived revisions with compare and restore">◷ Changes</button>""",
    """              <button class="btn ghost compact" id="wpChangesButton" type="button" hidden aria-controls="wpChangesPanel" aria-expanded="false" title="Tracked changes: live edits this session, plus archived revisions with compare and restore">◷ Changes</button>""")
# wpReleasesButton is already `hidden` at rest (shown for agent specs by JS) - leave its markup;
# the menu row below toggles it regardless of visibility.

rep("""          openStructureMenu(el.wpDocMenuButton, [
            ['export', '⇩ Export…'],
            ['import', '⇧ Import…'],
            ['duplicate', 'Duplicate'],
            ['delete', 'Delete document']
          ], '', value => {
            if (value === 'export') el.wpExportButton.click();
            else if (value === 'import') el.wpImportButton.click();
            else if (value === 'duplicate') el.wpDuplicateButton.click();
            else if (value === 'delete') el.wpDeleteButton.click();
          }, { keyboard: true, role: 'menu', label: 'Document actions', restoreFocus: true });""",
    """          // Type, Changes and Releases used to sit on the document head at rest - three
          // controls, two of them selects that look like the filter one letter away. They
          // live here now; the type stays displayed on the register row.
          const doc = activeWorkpaper();
          const currentType = doc ? normalizeWorkpaperType(doc.type) : 'narrative';
          const typeRows = [
            ['agent-spec', 'Agent spec'], ['narrative', 'Narrative'], ['control', 'Control doc'], ['note', 'Note']
          ].map(([v, label]) => ['type:' + v, (v === currentType ? '✓ ' : '   ') + 'Type · ' + label]);
          const rows = [
            ['changes', '◷ Changes'],
          ];
          if (el.wpReleasesButton && !el.wpReleasesButton.hidden) rows.push(['releases', '⛿ Releases']);
          rows.push([null, 'Document type', 'heading']);
          rows.push(...typeRows);
          rows.push([null, 'Document', 'heading']);
          rows.push(['export', '⇩ Export…'], ['import', '⇧ Import…'], ['duplicate', 'Duplicate'], ['delete', 'Delete document']);
          openStructureMenu(el.wpDocMenuButton, rows, '', value => {
            if (value === 'changes') el.wpChangesButton.click();
            else if (value === 'releases') el.wpReleasesButton.click();
            else if (String(value).startsWith('type:')) {
              el.wpType.value = value.slice(5);
              el.wpType.dispatchEvent(new Event('change', { bubbles: true }));
            }
            else if (value === 'export') el.wpExportButton.click();
            else if (value === 'import') el.wpImportButton.click();
            else if (value === 'duplicate') el.wpDuplicateButton.click();
            else if (value === 'delete') el.wpDeleteButton.click();
          }, { keyboard: true, role: 'menu', label: 'Document actions', restoreFocus: true });""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_declutter2.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('declutter docs+present applied: %d -> %d chars' % (len(orig), len(s)))
