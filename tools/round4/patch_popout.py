import io, os, sys
# Pop-out editor: free movement with an 8 px margin, Esc docks from the textarea, quiet
# title bar + one toolbar row + More menu, always-on footer, the render error travels,
# the docked column says where the editor went, min size 360x240.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ------------------------------------------------------------------ CSS: .editor-float
rep("""      grid-template-rows: auto auto auto minmax(0, 1fr) auto;
      width: min(760px, calc(100vw - 32px));""",
"""      /* Rows: title bar, toolbar, find, the editor, the render error, footer. The editor
         row honours the mount's minimum height (four lines, or a third of a very small
         window); the error strip below it takes what is left and scrolls inside that,
         so an error never pushes the code out of the window. */
      grid-template-rows: auto auto auto minmax(auto, 1fr) minmax(0, auto) auto;
      width: min(760px, calc(100vw - 32px));""")

rep("""      min-width: 340px;
      min-height: 300px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--panel-elevated);""",
"""      min-width: 360px;
      min-height: 240px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--panel-elevated);""")

# Title bar: one row, name on the left, window buttons on the right.
rep("""    .editor-float-bar strong { font-size: 12px; letter-spacing: .02em; flex: 0 0 auto; }
    /* One control height for the whole title bar: mixed heights read as crooked. */
    .editor-float-bar .btn,
    .editor-float-bar select,
    .editor-float-bar .popout-option {
      height: 30px;
      min-height: 30px;
      box-sizing: border-box;
    }
    .editor-float-bar .btn.icon {
      width: 30px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .editor-float-bar .popout-option { display: inline-flex; align-items: center; gap: 5px; }
    .editor-float-bar .popout-stats { margin-left: auto; }
    .editor-float-bar .btn { flex: 0 0 auto; }
    /* One row, never several: a wrapping title bar or toolbar steals the height the
       editor itself needs, which is the whole point of the window. */
    .editor-float-bar { flex-wrap: wrap; overflow: visible; row-gap: 6px; }
    .editor-float-bar .popout-diagram { flex: 0 1 auto; min-width: 0; }
    .editor-float-bar .popout-stats {
      flex: 0 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
""",
"""    /* One control height for the whole title bar: mixed heights read as crooked. */
    .editor-float-bar .btn,
    .editor-float-bar select {
      height: 30px;
      min-height: 30px;
      box-sizing: border-box;
    }
    .editor-float-bar .btn.icon {
      width: 30px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .editor-float-bar .btn { flex: 0 0 auto; }
    /* The title bar is one row at every width: the name on the left, the two window
       buttons on the right, and the empty middle is the handle you drag. (clip, not
       hidden: a hidden-overflow bar counts as zero-height for the window's grid and
       got squeezed when the error strip competed for room.) */
    .editor-float-bar { flex-wrap: nowrap; overflow: clip; }
    .editor-float-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .02em;
      white-space: nowrap;
    }
    .editor-float-title .editor-float-glyph { font-size: 13px; color: var(--muted); flex: 0 0 auto; }
    .editor-float-title .editor-float-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    /* The diagram picker is the document name: quiet until it is pointed at. */
    .editor-float-title .popout-diagram {
      flex: 0 1 auto;
      width: auto;
      min-width: 0;
      max-width: 200px;
      padding: 0 6px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: none;
      cursor: pointer;
    }
    /* The id and !important only because the light themes force a bordered input
       surface on every select with a heavier rule; this one is a title, not a field. */
    #editorPopout .editor-float-title .popout-diagram { background-color: transparent !important; border-color: transparent !important; }
    #editorPopout .editor-float-title .popout-diagram:hover,
    #editorPopout .editor-float-title .popout-diagram:focus-visible { background-color: var(--panel-bg) !important; border-color: var(--border) !important; }
""")

# A little less padding around the editor: at the 240 px minimum it is the difference
# between two visible lines and three. The minimum height is what the editor keeps when
# the render error strip is open: four lines, or a third of a very small window (cqh is
# the window's height - the window is a size container).
rep("""    .editor-popout-mount { min-height: 0; padding: 10px 12px 14px; }""",
    """    .editor-popout-mount { min-height: min(96px, 33cqh); padding: 8px 12px 10px; }""")

# Container queries: narrow windows lose words, not controls.
rep("""    /* When the stats span (the usual right-pusher) is hidden, the next surviving
       control inherits the auto margin, so the close button stays in the corner. */
    @container (max-width: 720px) {
      .editor-float-bar .popout-stats { display: none; }
      .editor-float-bar #popoutSnapLeft { margin-left: auto; }
    }
    @container (max-width: 640px) {
      .editor-float-bar .popout-option[for="popoutWrapToggle"],
      .editor-float-bar .popout-option[for="popoutAutoRender"] { display: none; }
    }
    @container (max-width: 560px) {
      #popoutSnapLeft, #popoutSnapRight { display: none; }
      .editor-float-bar #popoutMaximise { margin-left: auto; }
      .editor-popout-toolbar #popoutCleanButton, .editor-popout-toolbar #popoutSnapshotButton { display: none; }
    }
    @container (max-width: 470px) {
      .editor-float-bar .popout-diagram { display: none; }
      .editor-popout-toolbar .popout-option[for="popoutFontSize"] { display: none; }
    }
""",
"""    /* A narrow window loses words before it loses controls: the Insert word goes, then
       the long labels are spelled short, then the Line box keeps only its field (the
       field stays, so Ctrl+G always has somewhere to land), then the title word. Below
       about 510px the toolbar wraps to a second row; nothing is ever hidden. The
       thresholds are the measured widths at which each row stops fitting, plus a
       few pixels of slack. */
    @container (max-width: 704px) {
      .editor-popout-toolbar .popout-label-text { display: none; }
      .editor-popout-toolbar .popout-option[for="popoutInsert"] { max-width: 169px; }
    }
    @container (max-width: 664px) {
      .editor-popout-toolbar .popout-long { display: none; }
    }
    @container (max-width: 544px) {
      .editor-popout-toolbar .popout-goto label { display: none; }
    }
    /* Below the one-row width the toolbar wraps on purpose - the editing actions on the
       first row, the Line field and ⋯ on the second - rather than wherever the last
       control happens to stop fitting. The break is an invisible full-width item and
       stands in for the row gap; at the narrowest widths the row wraps by itself in the
       same shape, so the break steps aside again. */
    @container (max-width: 512px) {
      #editorPopout .editor-popout-toolbar { row-gap: 0; }
      #editorPopout .editor-popout-toolbar .popout-break { display: block; }
    }
    @container (max-width: 410px) {
      #editorPopout .editor-popout-toolbar { row-gap: 6px; }
      #editorPopout .editor-popout-toolbar .popout-break { display: none; }
    }
    @container (max-width: 470px) {
      .editor-float-title .editor-float-name { display: none; }
    }
""")

# The window is a size container so the error strip can be capped as a share of its
# height (cqh); it already has explicit width and height, so nothing else changes.
rep("""    .editor-float { container-type: inline-size; }
""", """    .editor-float { container-type: size; }
""")

rep("""    .editor-float-bar .popout-diagram select { max-width: 190px; }
""", "")

# Footer: always on, lint left, counts right.
rep("""      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: thin;
      padding: 4px 12px;
      border-top: 1px solid var(--border);
      background: var(--panel-alt);
    }
    .editor-popout-footer[hidden] { display: none; }
""",
"""      flex-wrap: nowrap;
      min-height: 28px;
      overflow: hidden;
      padding: 2px 12px;
      border-top: 1px solid var(--border);
      background: var(--panel-alt);
    }
    .editor-popout-footer[hidden] { display: none; }
    /* Lint on the left, the live counts on the right: the one strip that is always
       there, which is what lets the bar above it stay quiet. */
    .editor-popout-footer .popout-stats {
      flex: 0 1 auto;
      min-width: 0;
      margin-left: auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
""")

rep("""      color: var(--muted);
      padding: 4px 10px;
      cursor: pointer;
    }
    .popout-lint[hidden] { display: none !important; }""",
"""      color: var(--muted);
      padding: 2px 10px;
      cursor: pointer;
    }
    .popout-lint[hidden] { display: none !important; }""")

# Toolbar: one row of 30 px controls, the Line box and More button on the right.
rep("""    .popout-shape { margin-left: auto; font-size: 12px; color: var(--subtle); white-space: nowrap; }
    .editor-popout-toolbar > * { flex: 0 0 auto; }""",
"""    .popout-shape { margin-left: auto; font-size: 12px; color: var(--subtle); white-space: nowrap; }
    /* Every control in the row is 30 px tall, labels included (the app's labels carry a
       bottom margin meant for forms, which made the row taller than its buttons). */
    .editor-popout-toolbar .btn { min-height: 30px; }
    .editor-popout-toolbar .btn.icon { width: 30px; height: 30px; padding: 0; font-size: 15px; }
    .editor-popout-toolbar label { margin: 0; }
    .editor-popout-toolbar .popout-goto { margin-left: auto; }
    .editor-popout-toolbar > * { flex: 0 0 auto; }
    /* The Insert picker is the one control that gives: the row is laid out with it at
       its narrow width and it then grows into whatever is spare, so a slightly
       narrower window costs a few pixels of picker instead of a second toolbar row. */
    .editor-popout-toolbar .popout-option[for="popoutInsert"] { flex: 1 1 auto; min-width: 0; max-width: 208px; }
    .editor-popout-toolbar #popoutInsert { flex: 1 1 112px; width: 112px; min-width: 0; max-width: 169px; }
    .editor-popout-toolbar .popout-break { display: none; flex: 0 0 100%; height: 6px; }""")

rep("""      gap: 7px;
      padding: 8px 16px;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: var(--panel-alt);
    }
    .popout-option { display: inline-flex;""",
"""      gap: 7px;
      padding: 8px 12px;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: var(--panel-alt);
    }
    .popout-option { display: inline-flex;""")

rep("""      gap: 10px;
      padding: 8px 10px 8px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-alt);
      cursor: move;""",
"""      gap: 10px;
      padding: 6px 10px 6px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-alt);
      cursor: move;""")

# Error mount, the docked "editing in the pop-out" state.
rep("""    .editor-popout-mount .code-editor textarea { height: 100%; }
""",
"""    .editor-popout-mount .code-editor textarea { height: 100%; }
    /* The render error panel is moved into the window while it is open. Its strip is
       capped at 160px and at a third of the window, and scrolls inside that, so a
       long explanation never pushes the code or the footer out of a small window. */
    .editor-popout-error { min-height: 0; max-height: min(160px, 35cqh); overflow: auto; }
    .editor-popout-error .error-panel { margin: 0 12px 10px; }
    /* While the editor is away, the column says so in one line instead of showing the
       Text/Guided switch, the lint pill and the footer with nothing between them. */
    .code-mode-panel.is-editor-popped .layout-bar .layout-switch,
    .code-mode-panel.is-editor-popped .layout-bar [for="dockedWrapToggle"],
    .code-mode-panel.is-editor-popped .layout-bar #copyButton,
    .code-mode-panel.is-editor-popped #lintStatus,
    .code-mode-panel.is-editor-popped .editor-footer { display: none; }
    .editor-popped-note {
      margin: 10px 0 0;
      padding: 16px 14px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
    }
    .editor-popped-note[hidden] { display: none; }
""")

# ------------------------------------------------------------ markup: docked column
rep("""            <div id="editorHome"></div>

            <div class="error-panel" id="editorError" role="alert" hidden></div>
""",
"""            <div id="editorHome"></div>
            <p class="editor-popped-note" id="editorPoppedNote" hidden>The code editor is open in its own window. Drag it anywhere; <strong>Esc</strong> inside it brings it back here.</p>

            <div class="error-panel" id="editorError" role="alert" hidden></div>
            <div id="editorErrorHome"></div>
""")

# ------------------------------------------------------------ markup: the window
rep("""      <div class="editor-float-bar" id="editorPopoutBar">
        <strong title="Mermaid editor window">⧉</strong>
        <button class="btn ghost icon" id="popoutUndoButton" type="button" title="Undo" aria-label="Undo">↶</button>
        <button class="btn ghost icon" id="popoutRedoButton" type="button" title="Redo" aria-label="Redo">↷</button>
        <label class="popout-option popout-diagram" for="popoutDiagramSelect">Diagram
          <select id="popoutDiagramSelect" aria-label="Diagram being edited"></select>
        </label>
        <label class="popout-option" for="popoutAutoRender"><input id="popoutAutoRender" type="checkbox" /> Auto-render</label>
        <label class="popout-option" for="popoutWrapToggle"><input id="popoutWrapToggle" type="checkbox" /> Wrap</label>
        <span class="popout-stats" id="popoutStats"></span>
        <button class="btn ghost icon" id="popoutSnapLeft" type="button" title="Snap to the left half" aria-label="Snap to the left half">◧</button>
        <button class="btn ghost icon" id="popoutSnapRight" type="button" title="Snap to the right half" aria-label="Snap to the right half">◨</button>
        <button class="btn ghost icon" id="popoutMaximise" type="button" title="Maximise" aria-label="Maximise the editor window" aria-pressed="false">⛶</button>
        <button class="btn ghost icon" id="closeEditorPopout" type="button" aria-label="Close the editor window" title="Close">×</button>
      </div>
      <div class="editor-popout-toolbar">
        <button class="btn compact" id="popoutRenderButton" type="button">▶ Render</button>
        <label class="popout-option" for="popoutInsert">Insert
          <select id="popoutInsert" aria-label="Insert a Mermaid building block">""",
"""      <div class="editor-float-bar" id="editorPopoutBar">
        <span class="editor-float-title">
          <span class="editor-float-glyph" aria-hidden="true">⧉</span>
          <span class="editor-float-name">Mermaid editor</span>
          <select class="popout-diagram" id="popoutDiagramSelect" aria-label="Diagram being edited" title="Diagram being edited"></select>
        </span>
        <button class="btn ghost icon" id="popoutMaximise" type="button" title="Maximise" aria-label="Maximise the editor window" aria-pressed="false">⛶</button>
        <button class="btn ghost icon" id="closeEditorPopout" type="button" aria-label="Dock the editor back in the panel (Esc)" title="Dock the editor back in the panel (Esc)">×</button>
      </div>
      <div class="editor-popout-toolbar">
        <button class="btn ghost icon" id="popoutUndoButton" type="button" title="Undo" aria-label="Undo">↶</button>
        <button class="btn ghost icon" id="popoutRedoButton" type="button" title="Redo" aria-label="Redo">↷</button>
        <button class="btn compact" id="popoutRenderButton" type="button">▶ Render</button>
        <label class="popout-option" for="popoutInsert"><span class="popout-label-text">Insert</span>
          <select id="popoutInsert" aria-label="Insert a Mermaid building block">""")

rep("""        <button class="btn ghost compact" id="popoutCommentButton" type="button" title="Comment or uncomment the selected lines (Ctrl + /)">%% Comment</button>
        <button class="btn ghost compact" id="popoutFindButton" type="button">Find &amp; replace</button>
        <button class="btn ghost compact" id="popoutCleanButton" type="button">Clean whitespace</button>
        <button class="btn ghost compact" id="popoutCopyButton" type="button" title="Copy the Mermaid source of this diagram to the clipboard">Copy code</button>
        <button class="btn ghost compact" id="popoutSnapshotButton" type="button" title="Save a version snapshot you can restore later">◷ Snapshot</button>
        <label class="popout-option" for="popoutFontSize">Text
          <select id="popoutFontSize" aria-label="Editor text size">
            <option value="12">S</option>
            <option value="13" selected>M</option>
            <option value="15">L</option>
            <option value="17">XL</option>
          </select>
        </label>
        <span class="popout-goto">
          <label for="popoutGoToLine">Line</label>
          <input id="popoutGoToLine" type="number" min="1" step="1" inputmode="numeric" aria-label="Line number to jump to" />
        </span>
      </div>
      <div class="editor-popout-find" id="popoutFindMount"></div>
      <div class="editor-popout-mount" id="editorPopoutMount"></div>
      <div class="editor-popout-footer" id="popoutFooter" hidden>
        <button class="popout-lint" id="popoutLintStatus" type="button" data-level="idle" hidden></button>
      </div>
""",
"""        <button class="btn ghost compact" id="popoutCommentButton" type="button" title="Comment or uncomment the selected lines (Ctrl + /)"><span>%%<span class="popout-long">&nbsp;Comment</span></span></button>
        <button class="btn ghost compact" id="popoutFindButton" type="button" title="Find and replace in the code"><span>Find<span class="popout-long">&nbsp;&amp; replace</span></span></button>
        <span class="popout-break" aria-hidden="true"></span>
        <span class="popout-goto">
          <label for="popoutGoToLine">Line</label>
          <input id="popoutGoToLine" type="number" min="1" step="1" inputmode="numeric" placeholder="Line" title="Jump to a line (Ctrl + G)" aria-label="Line number to jump to" />
        </span>
        <button class="btn ghost icon" id="popoutMoreButton" type="button" title="More: copy, clean, snapshot, wrap, auto-render, text size" aria-label="More editor actions">⋯</button>
      </div>
      <div class="editor-popout-find" id="popoutFindMount"></div>
      <div class="editor-popout-mount" id="editorPopoutMount"></div>
      <div class="editor-popout-error" id="popoutErrorMount"></div>
      <div class="editor-popout-footer" id="popoutFooter">
        <button class="popout-lint" id="popoutLintStatus" type="button" data-level="idle" hidden></button>
        <span class="popout-stats" id="popoutStats"></span>
      </div>
""")

# ------------------------------------------------------------------------ el id map
rep("""'popoutCleanButton','popoutWrapToggle','popoutFontSize','popoutStats',""",
    """'popoutStats',""")
rep("""          'popoutCommentButton','popoutSnapshotButton','popoutAutoRender','popoutSnapLeft','popoutSnapRight','popoutMaximise',
          'popoutFindMount','popoutLintStatus','popoutGoToLine','popoutFooter','popoutCopyButton','findReplaceHome',""",
"""          'popoutCommentButton','popoutMaximise','popoutMoreButton','popoutErrorMount','editorErrorHome','editorPoppedNote',
          'popoutFindMount','popoutLintStatus','popoutGoToLine','popoutFooter','findReplaceHome',""")

# ------------------------------------------------------------------------ listeners
# The resize handler above this line already re-fits the window; the bare duplicate
# ran keepEditorFloatOnScreen a second time on every resize.
rep("""        }
        window.addEventListener('resize', keepEditorFloatOnScreen);
        if (el.popoutRenderButton)""",
"""        }
        if (el.popoutRenderButton)""")

rep("""        if (el.popoutSnapshotButton) el.popoutSnapshotButton.addEventListener('click', () => {
          saveVersionSnapshot('Snapshot from editor window', true);
          showToast('Snapshot saved to Versions.', 'success');
        });
        if (el.popoutAutoRender) el.popoutAutoRender.addEventListener('change', () => {
          el.autoRender.checked = el.popoutAutoRender.checked;
          el.autoRender.dispatchEvent(new Event('change', { bubbles: true }));
        });
""",
"""        if (el.popoutMoreButton) el.popoutMoreButton.addEventListener('click', openPopoutMoreMenu);
        // The guided rows live in the docked column, so switching to them brings the
        // editor home first instead of leaving an empty window behind. Capture phase:
        // it has to run before the listener that swaps the editors.
        if (el.structureModeButton) el.structureModeButton.addEventListener('click', () => {
          if (el.editorPopout && !el.editorPopout.hidden) setEditorPoppedOut(false);
        }, true);
""")

rep("""        if (el.popoutSnapLeft) el.popoutSnapLeft.addEventListener('click', () => snapEditorFloat('left'));
        if (el.popoutSnapRight) el.popoutSnapRight.addEventListener('click', () => snapEditorFloat('right'));
""", "")

rep("""        if (el.popoutCleanButton) el.popoutCleanButton.addEventListener('click', cleanWhitespace);
        if (el.popoutCopyButton) el.popoutCopyButton.addEventListener('click', copySource);
        if (el.dockedWrapToggle) el.dockedWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.dockedWrapToggle.checked);
          if (el.popoutWrapToggle) el.popoutWrapToggle.checked = el.dockedWrapToggle.checked;
        });
        if (el.popoutWrapToggle) el.popoutWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.popoutWrapToggle.checked);
          if (el.dockedWrapToggle) el.dockedWrapToggle.checked = el.popoutWrapToggle.checked;
          updateLineNumbers();
        });
        if (el.popoutFontSize) el.popoutFontSize.addEventListener('change', () => {
          const size = `${el.popoutFontSize.value}px`;
          el.source.style.fontSize = size;
          if (el.lineNumbers) el.lineNumbers.style.fontSize = size;
          updateLineNumbers();
        });
""",
"""        if (el.dockedWrapToggle) el.dockedWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.dockedWrapToggle.checked);
          updateLineNumbers();
        });
""")

# ------------------------------------------------------------------------ functions
rep("""      let editorFloatPlaced = false;

      function setEditorPoppedOut(open) {""",
"""      let editorFloatPlaced = false;
      // The window may sit anywhere the user puts it; the margin only keeps a sliver of
      // it on screen so the title bar can always be grabbed again.
      const POPOUT_MARGIN = 8, POPOUT_MIN_W = 360, POPOUT_MIN_H = 240;

      function setEditorPoppedOut(open) {""")

rep("""          if (el.popoutFindMount && el.findReplacePanel) el.popoutFindMount.appendChild(el.findReplacePanel);
          el.editorPopout.hidden = false;""",
"""          if (el.popoutFindMount && el.findReplacePanel) el.popoutFindMount.appendChild(el.findReplacePanel);
          // The render error explanation travels too: on a second screen the window is
          // the only place the user would see it.
          if (el.popoutErrorMount && el.editorError) el.popoutErrorMount.appendChild(el.editorError);
          el.editorPopout.hidden = false;""")

rep("""          if (el.findReplaceHome && el.findReplacePanel) {
            el.findReplaceHome.parentNode.insertBefore(el.findReplacePanel, el.findReplaceHome);
          }
          el.editorPopout.hidden = true;""",
"""          if (el.findReplaceHome && el.findReplacePanel) {
            el.findReplaceHome.parentNode.insertBefore(el.findReplacePanel, el.findReplaceHome);
          }
          if (el.editorErrorHome && el.editorError) el.editorErrorHome.parentNode.insertBefore(el.editorError, el.editorErrorHome);
          el.editorPopout.hidden = true;""")

rep("""        updateLineNumbers();
      }

      // The app header paints and hit-tests above this window, so anything parked in
      // that band is both invisible and unclickable -- including the title bar, which is
      // the only way to drag the thing. Every placement therefore starts below the header.
      function editorFloatTopLimit() {""",
"""        // The column says plainly where the editor went instead of showing empty stubs.
        if (el.codeModePanel) el.codeModePanel.classList.toggle('is-editor-popped', open);
        if (el.editorPoppedNote) el.editorPoppedNote.hidden = !open;
        updateLineNumbers();
      }

      // Where the first opening, maximise and the reset start: below the app header, so
      // the window lands in the work area. A drag is free to go anywhere after that.
      function editorFloatTopLimit() {""")

rep("""      function placeEditorFloat(left, top, width, height) {
        const minTop = editorFloatTopLimit();
        // A saved or first-open position that overlapped the editor column covered the
        // Visual/Code switch and Undo/Redo. When the window is wide enough to hold the
        // pop-out clear of that column, its left edge starts at the preview pane.
        const pane = document.querySelector('.preview-pane');
        if (pane) {
          const paneLeft = Math.round(pane.getBoundingClientRect().left);
          if (paneLeft > 0 && window.innerWidth - paneLeft - 8 >= Math.min(width, 340)) left = Math.max(left, paneLeft);
        }
        // Size first: the resize grip sits at the bottom-right corner, so a window
        // bigger than the space below the header would park the grip off-screen and
        // resize would silently look broken.
        const maxWidth = Math.max(340, window.innerWidth - 16);
        const maxHeight = Math.max(300, window.innerHeight - minTop - 8);
        if (width > maxWidth) { width = maxWidth; el.editorPopout.style.width = `${Math.round(maxWidth)}px`; }
        if (height > maxHeight) { height = maxHeight; el.editorPopout.style.height = `${Math.round(maxHeight)}px`; }
        const maxLeft = Math.max(8, window.innerWidth - width - 8);
        const maxTop = Math.max(minTop, window.innerHeight - height - 8);
        el.editorPopout.style.left = `${Math.round(clamp(left, 8, maxLeft))}px`;
        el.editorPopout.style.top = `${Math.round(clamp(top, minTop, maxTop))}px`;
      }""",
"""      function placeEditorFloat(left, top, width, height) {
        // The window goes wherever it is put - over the editor column, over the header,
        // anywhere - and only the margin is kept on every side.
        const minTop = POPOUT_MARGIN;
        // Size first: the resize grip sits at the bottom-right corner, so a window
        // bigger than the viewport would park the grip off-screen and resize would
        // silently look broken.
        const maxWidth = Math.max(POPOUT_MIN_W, window.innerWidth - 2 * POPOUT_MARGIN);
        const maxHeight = Math.max(POPOUT_MIN_H, window.innerHeight - minTop - POPOUT_MARGIN);
        if (width > maxWidth) { width = maxWidth; el.editorPopout.style.width = `${Math.round(maxWidth)}px`; }
        if (height > maxHeight) { height = maxHeight; el.editorPopout.style.height = `${Math.round(maxHeight)}px`; }
        const maxLeft = Math.max(POPOUT_MARGIN, window.innerWidth - width - POPOUT_MARGIN);
        const maxTop = Math.max(minTop, window.innerHeight - height - POPOUT_MARGIN);
        el.editorPopout.style.left = `${Math.round(clamp(left, POPOUT_MARGIN, maxLeft))}px`;
        el.editorPopout.style.top = `${Math.round(clamp(top, minTop, maxTop))}px`;
      }""")

rep("""        const width = clamp(Math.round(window.innerWidth * 0.52), 340, 980);
        const top = editorFloatTopLimit();
        const height = clamp(Math.round((window.innerHeight - top) * 0.86), 300, 980);""",
"""        const width = clamp(Math.round(window.innerWidth * 0.52), POPOUT_MIN_W, 980);
        const top = editorFloatTopLimit();
        const height = clamp(Math.round((window.innerHeight - top) * 0.86), POPOUT_MIN_H, 980);""")

rep("""        el.popoutLintStatus.title = popoutLintLine ? `Jump to line ${popoutLintLine}` : '';
        // The whole footer row earns its height only while there is something to say.
        if (el.popoutFooter) el.popoutFooter.hidden = !message;
      }""",
"""        el.popoutLintStatus.title = popoutLintLine ? `Jump to line ${popoutLintLine}` : '';
      }""")

rep("""        const raw = value && typeof value === 'object' ? value : {};
        return {
          left: Number.isFinite(Number(raw.left)) ? Number(raw.left) : null,
          top: Number.isFinite(Number(raw.top)) ? Number(raw.top) : null,
          width: clamp(Number(raw.width) || 760, 340, 4000),
          height: clamp(Number(raw.height) || 560, 220, 4000),""",
"""        const raw = value && typeof value === 'object' ? value : {};
        // Number(null) is 0, so the unset default used to read as a saved (0,0) and the
        // first opening never got its place over the preview pane. Unset stays unset.
        const coord = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
        return {
          left: coord(raw.left),
          top: coord(raw.top),
          width: clamp(Number(raw.width) || 760, POPOUT_MIN_W, 4000),
          height: clamp(Number(raw.height) || 560, POPOUT_MIN_H, 4000),""")

rep("""          el.editorPopout.style.width = `${Math.max(340, window.innerWidth - 16)}px`;
          el.editorPopout.style.height = `${Math.max(300, window.innerHeight - top - 8)}px`;""",
"""          el.editorPopout.style.width = `${Math.max(POPOUT_MIN_W, window.innerWidth - 2 * POPOUT_MARGIN)}px`;
          el.editorPopout.style.height = `${Math.max(POPOUT_MIN_H, window.innerHeight - top - POPOUT_MARGIN)}px`;""")

rep("""      function snapEditorFloat(side) {
        if (!el.editorPopout) return;
        setPopoutMaximised(false);
        const width = Math.max(340, Math.round(window.innerWidth / 2) - 12);
        const height = Math.max(220, window.innerHeight - 16);
        el.editorPopout.style.width = `${width}px`;
        el.editorPopout.style.height = `${height}px`;
        placeEditorFloat(side === 'right' ? window.innerWidth - width - 8 : 8, 8, width, height);
        saveEditorFloatGeometry();
      }
""",
"""      // Everything secondary sits behind the one ⋯ button, so the toolbar stays a single
      // row and the window keeps its height for the code. The boxes show the two
      // toggles' state; the highlighted row is the current text size.
      function openPopoutMoreMenu() {
        if (!el.popoutMoreButton) return;
        const wrapped = el.codeEditor.classList.contains('is-wrapped');
        const auto = Boolean(state.autoRender);
        const size = parseInt(el.source.style.fontSize, 10) || 13;
        const box = on => (on ? '☑ ' : '☐ ');
        const options = [
          ['copy', 'Copy code'],
          ['clean', 'Clean whitespace'],
          ['snapshot', 'Save a snapshot to Versions'],
          [null, 'View', 'heading'],
          ['wrap', `${box(wrapped)}Wrap long lines`],
          ['auto', `${box(auto)}Auto-render while typing`],
          [null, 'Text size', 'heading'],
          ['size:12', 'Small'], ['size:13', 'Medium'], ['size:15', 'Large'], ['size:17', 'Extra large']
        ];
        openStructureMenu(el.popoutMoreButton, options, `size:${size}`, value => {
          if (value === 'copy') { copySource(); return; }
          if (value === 'clean') { cleanWhitespace(); return; }
          if (value === 'snapshot') {
            saveVersionSnapshot('Snapshot from editor window', true);
            showToast('Snapshot saved to Versions.', 'success');
            return;
          }
          if (value === 'wrap') {
            const on = !el.codeEditor.classList.contains('is-wrapped');
            el.codeEditor.classList.toggle('is-wrapped', on);
            if (el.dockedWrapToggle) el.dockedWrapToggle.checked = on;
            updateLineNumbers();
            return;
          }
          if (value === 'auto') {
            el.autoRender.checked = !el.autoRender.checked;
            el.autoRender.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
          if (String(value).startsWith('size:')) setPopoutTextSize(Number(value.slice(5)));
        }, { plain: true, keyboard: true, label: 'More editor actions' });
      }

      function setPopoutTextSize(px) {
        const size = `${clamp(Math.round(px) || 13, 10, 24)}px`;
        el.source.style.fontSize = size;
        if (el.lineNumbers) el.lineNumbers.style.fontSize = size;
        updateLineNumbers();
      }
""")

# --------------------------------------------------------- Esc from the textarea docks
rep("""        if (event.key === 'Escape') {
          event.stopPropagation();
          el.source.blur();""",
"""        if (event.key === 'Escape') {
          event.stopPropagation();
          // Inside the pop-out, Esc peels the find bar first and then docks the window -
          // the same as from its buttons. Focus lands on the Pop out button, so the next
          // Tab continues from the place the editor went back to.
          if (el.editorPopout && !el.editorPopout.hidden && el.editorPopout.contains(el.source)) {
            event.preventDefault();
            if (el.findReplacePanel && !el.findReplacePanel.hidden && el.editorPopout.contains(el.findReplacePanel)) {
              toggleFindReplace(false);
              el.source.focus();
              return;
            }
            setEditorPoppedOut(false);
            el.popOutEditorButton?.focus();
            return;
          }
          el.source.blur();""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
