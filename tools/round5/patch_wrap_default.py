import io, os, sys
# Wrap: on for everyone, and the checkbox goes.
#
# What the off state did, measured on 1.63.3: nothing. `textarea#source { white-space:
# pre }` is an id rule and outranks `.code-editor.is-wrapped textarea`, so the box was
# inert - ticked or not, a long line still scrolled sideways (scrollWidth 1100 against a
# 372 wide box). So the control is removed AND wrapping is made real.
#
# Making it real moves the line-number gutter: a wrapped line is more than one row on
# screen, and a gutter of fixed 20px rows drifts below every one of them (200 lines
# measured 12,020px of text against 4,020px of numbers). Each number now sits on an
# invisible copy of its own line, wrapped at the textarea's width, so it stays level.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- CSS
rep("""    .code-editor.is-wrapped textarea { white-space: pre-wrap; overflow-wrap: anywhere; }""",
    """    /* Long lines wrap. Sideways scrolling in a 372px column hid the end of every
       connector; the gutter below follows the wrap so the numbers stay honest. */
    textarea#source { white-space: pre-wrap; overflow-wrap: anywhere; }
    /* Each number rides on an invisible copy of its own line, laid out at the
       textarea's width and font, so the row is exactly as tall as the line it counts. */
    .line-ghost {
      display: block;
      visibility: hidden;
      width: var(--ghost-w, 0px);
      font-size: var(--ghost-fs, 13px);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      line-height: 20px;
      tab-size: 4;
      text-align: left;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }""")

rep("""    .line-number { display: block; height: 20px; }""",
    """    .line-number { display: block; position: relative; min-height: 20px; }
    .line-number > .line-number-value { position: absolute; top: 0; right: 0; }""")

# The docked bar's Wrap label is gone, so the rule that hid it while popped out goes too.
rep("""    .code-mode-panel.is-editor-popped .layout-bar [for="dockedWrapToggle"],
""", "")

# ---------------------------------------------------------------- the checkbox itself
rep("""              <label class="popout-option" for="dockedWrapToggle" title="Wrap long lines instead of scrolling sideways"><input id="dockedWrapToggle" type="checkbox" /> Wrap</label>
""", "")

rep("""'codeEditor','dockedWrapToggle','popOutEditorButton',""", """'codeEditor','popOutEditorButton',""")

rep("""        if (el.dockedWrapToggle) el.dockedWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.dockedWrapToggle.checked);
          updateLineNumbers();
        });
""", "")

# ---------------------------------------------------------------- the More menu row
rep("""        const wrapped = el.codeEditor.classList.contains('is-wrapped');
        const auto = Boolean(state.autoRender);""",
    """        const auto = Boolean(state.autoRender);""")

rep("""          [null, 'View', 'heading'],
          ['wrap', `${box(wrapped)}Wrap long lines`],
          ['auto', `${box(auto)}Auto-render while typing`],""",
    """          [null, 'View', 'heading'],
          ['auto', `${box(auto)}Auto-render while typing`],""")

rep("""          if (value === 'wrap') {
            const on = !el.codeEditor.classList.contains('is-wrapped');
            el.codeEditor.classList.toggle('is-wrapped', on);
            if (el.dockedWrapToggle) el.dockedWrapToggle.checked = on;
            updateLineNumbers();
            return;
          }
""", "")

rep("""title="More: copy, clean, snapshot, wrap, auto-render, text size\"""",
    """title="More: copy, clean, snapshot, auto-render, text size\"""")

rep("""        if (el.popoutWrapToggle) el.popoutWrapToggle.checked = el.codeEditor.classList.contains('is-wrapped');
""", "")

# ---------------------------------------------------------------- the gutter
rep("""      let renderedLineCount = -1;
      let renderedErrorLine = null;
      let renderedWarnKey = '';""",
    """      let renderedLineCount = -1;
      let renderedErrorLine = null;
      let renderedWarnKey = '';
      // The width and text size the ghosts were last laid out at: change either and
      // every line wraps somewhere else, so the gutter has to be told.
      let renderedGhostWidth = -1;
      let renderedGhostFont = '';""")

rep("""      function updateLineNumbers() {
        const count = Math.max(1, el.source.value.split(/\\r?\\n/).length);
        // Rebuilding every gutter row on each keystroke is wasteful on long sources.
        const warnKey = Array.from(lintWarningLines).sort((a, b) => a - b).join(',');
        if (count === renderedLineCount && errorLineNumber === renderedErrorLine && warnKey === renderedWarnKey) {
          el.lineNumbers.scrollTop = el.source.scrollTop;
          return;
        }
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= count; i += 1) {
          const span = document.createElement('span');
          const isError = errorLineNumber === i;
          const isWarn = !isError && lintWarningLines.has(i);
          span.className = `line-number${isError ? ' error-line' : ''}${isWarn ? ' warn-line' : ''}`;
          span.textContent = String(i);
          if (isWarn) span.title = lintMessages.get(i) || 'Problem on this line';
          fragment.appendChild(span);
        }
        el.lineNumbers.replaceChildren(fragment);
        renderedLineCount = count;
        renderedErrorLine = errorLineNumber;
        renderedWarnKey = warnKey;
        el.lineNumbers.scrollTop = el.source.scrollTop;
      }""",
    """      function updateLineNumbers() {
        const lines = el.source.value.split(/\\r?\\n/);
        const count = Math.max(1, lines.length);
        // The ghosts wrap at the textarea's own content width and text size. The editor
        // moves between the column and the floating window, so this is read each time.
        const style = getComputedStyle(el.source);
        const ghostWidth = Math.max(0, Math.round(el.source.clientWidth
          - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)));
        const ghostFont = style.fontSize;
        if (ghostWidth !== renderedGhostWidth || ghostFont !== renderedGhostFont) {
          el.lineNumbers.style.setProperty('--ghost-w', `${ghostWidth}px`);
          el.lineNumbers.style.setProperty('--ghost-fs', ghostFont);
          renderedGhostWidth = ghostWidth;
          renderedGhostFont = ghostFont;
        }
        // Rebuilding every gutter row on each keystroke is wasteful on long sources.
        const warnKey = Array.from(lintWarningLines).sort((a, b) => a - b).join(',');
        if (count === renderedLineCount && errorLineNumber === renderedErrorLine && warnKey === renderedWarnKey) {
          // Same rows: only the text of a line can have changed, and only the ghosts
          // that actually differ are touched - a thousand rewrites per keystroke would
          // cost more than the wrap is worth.
          const rows = el.lineNumbers.children;
          for (let i = 0; i < count; i += 1) {
            const ghost = rows[i] && rows[i].lastElementChild;
            const text = lines[i] || ' ';
            if (ghost && ghost.textContent !== text) ghost.textContent = text;
          }
          el.lineNumbers.scrollTop = el.source.scrollTop;
          return;
        }
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= count; i += 1) {
          const span = document.createElement('span');
          const isError = errorLineNumber === i;
          const isWarn = !isError && lintWarningLines.has(i);
          span.className = `line-number${isError ? ' error-line' : ''}${isWarn ? ' warn-line' : ''}`;
          const value = document.createElement('span');
          value.className = 'line-number-value';
          value.textContent = String(i);
          const ghost = document.createElement('span');
          ghost.className = 'line-ghost';
          ghost.setAttribute('aria-hidden', 'true');
          ghost.textContent = lines[i - 1] || ' ';
          span.append(value, ghost);
          if (isWarn) span.title = lintMessages.get(i) || 'Problem on this line';
          fragment.appendChild(span);
        }
        el.lineNumbers.replaceChildren(fragment);
        renderedLineCount = count;
        renderedErrorLine = errorLineNumber;
        renderedWarnKey = warnKey;
        el.lineNumbers.scrollTop = el.source.scrollTop;
      }""")

# A narrower editor wraps the lines somewhere else, and the splitter, the browser window
# and the move in and out of the floating editor all change the width without typing.
rep("""        if (el.source) el.source.addEventListener('input', syncPopoutStats);""",
    """        if (el.source) el.source.addEventListener('input', syncPopoutStats);
        if (el.source && window.ResizeObserver) new ResizeObserver(() => updateLineNumbers()).observe(el.source);""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
