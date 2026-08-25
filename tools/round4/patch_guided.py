import io, os, sys
# Guided editor: remove the per-row up/down/x buttons and make the interaction fluid
# (scout reports a-guided-editor-row-bu.md and scout-guided-ux/REPORT.md, P1-P8).
# Idempotent against C:\Claude\SIREN\pending\FROZEN_1_62_0.html. Takes the target path as argv[1].
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# ============================ CSS ============================

# The row draws its own drop line, so it needs to be a positioning box.
rep("""    .struct-code {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 1px 4px;
      border-radius: 4px;
      white-space: pre;
    }
""", """    .struct-code {
      position: relative;
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 1px 4px;
      border-radius: 4px;
      white-space: pre;
    }
""")

# Long rows wrap into two chip lines instead of hiding their tail behind a per-row scrollbar.
rep("""    .struct-gutter { flex: 0 0 30px; text-align: right; color: var(--subtle); user-select: none; font-size: 11.5px; }
    .struct-code-text { flex: 1 1 auto; min-width: 0; overflow-x: auto; color: var(--code-text); }
""", """    .struct-gutter { position: relative; flex: 0 0 30px; text-align: right; color: var(--subtle); user-select: none; font-size: 11.5px; }
    /* A long row wraps - the chips are inline-flex, so they wrap as units - rather than
       clipping its tail behind a scrollbar of its own. */
    .struct-code-text { flex: 1 1 auto; min-width: 0; overflow: visible; white-space: pre-wrap; color: var(--code-text); }
""")

# A hover you can see: the old 14% -> 18% step was invisible.
rep("""    .struct-token[role="button"]:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
""", """    .struct-token[role="button"]:hover { background: color-mix(in srgb, var(--primary) 28%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent); }
    /* A line with no chips (blank, `end`) can hold keyboard focus itself after a delete
       or a move; the ring says so. */
    .struct-code:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
""")

# The inline input must be chip-sized: the global input[type="text"] rule (0,1,1) beat
# .struct-inline-input (0,1,0), so an edit grew the row 8px and scrolled the id off-screen.
rep("""    .struct-inline-input {
      font: inherit;
      padding: 0 3px;
      border: 1px solid var(--primary);
      border-radius: 3px;
      background: var(--input-bg);
      color: var(--text);
    }
    /* Half-visible at rest so a mouse user can discover the row tools exist;
       full strength on hover or keyboard focus. */
    .struct-line-actions { display: flex; gap: 2px; opacity: .55; transition: opacity .12s ease; }
    .struct-code:hover .struct-line-actions, .struct-code:focus-within .struct-line-actions { opacity: 1; }
    .struct-line-actions .btn { min-width: 24px; padding: 0 5px; font-size: 11px; }
    /* The line number is the drag handle: it is already unselectable, so a drag from
       it never fights a text selection, and the tokens keep their click. */
    .struct-code:not(.is-blank) .struct-gutter { cursor: grab; touch-action: none; }
    .struct-code[data-dragging="true"] { opacity: .45; }
    .struct-code[data-drop="before"] { box-shadow: inset 0 2px 0 0 var(--primary); }
    .struct-code[data-drop="after"] { box-shadow: inset 0 -2px 0 0 var(--primary); }
""", """    .struct-inline-input {
      font: inherit;
      padding: 0 3px;
      border: 1px solid var(--primary);
      border-radius: 3px;
      background: var(--input-bg);
      color: var(--text);
    }
    /* Same box as the chip it replaces, so an edit never moves the row or scrolls the
       id away. Written to out-rank the app-wide text-input rule. */
    .struct-code input.struct-inline-input[type="text"] {
      width: auto; min-height: 0; height: 24px; padding: 0 5px; border-radius: 4px;
      box-shadow: none; font: inherit; line-height: 1; vertical-align: baseline;
    }
    /* The line number is the drag handle: it is already unselectable, so a drag from
       it never fights a text selection, and the tokens keep their click. A blank line
       drags too. The grip glyph shows on row hover only - quiet at rest. */
    .struct-code .struct-gutter { cursor: grab; touch-action: none; }
    .struct-code:hover .struct-gutter::before { content: '⋮⋮'; position: absolute; left: 0; top: 0; letter-spacing: -1px; color: var(--subtle); opacity: .75; }
    .struct-code[data-dragging="true"] { opacity: .45; }
    /* The drop indicator is a line BETWEEN rows, not a border on one of them. */
    .struct-code[data-drop]::after { content: ''; position: absolute; left: 36px; right: 6px; height: 2px; border-radius: 2px; background: var(--primary); box-shadow: 0 0 0 1px var(--panel-bg); pointer-events: none; }
    .struct-code[data-drop="before"]::after { top: -1px; }
    .struct-code[data-drop="after"]::after { bottom: -1px; }
""")

# Footer in reach: on a 900px screen + Block sat 31px below the fold. The rows box gives
# up the room the footer needs (the rows are 28px now, not 34, so as many are visible).
rep("""      max-height: min(58vh, 620px);
      overflow: auto;
      padding: 8px 6px;
""", """      /* Leaves room for the hint above and the + Block footer below on a 900px screen, so
         the footer sits on screen at rest; the floor keeps a short window usable. */
      max-height: max(240px, min(58vh, 620px, calc(100vh - 460px)));
      overflow: auto;
      padding: 8px 6px;
""")

# ============================ HTML ============================

rep("""              <p class="struct-guide-hint">Click any blue chip to change it — labels, shapes and connectors are edited where they sit.</p>
""", """              <p class="struct-guide-hint">Click a chip to edit it in place. Drag a line number to reorder; right-click a line to add, move or delete it.</p>
""")

# ============================ JS ============================

# The footer buttons must not take focus from the row the person is on.
rep("""        if (el.structureAddBlockButton) el.structureAddBlockButton.addEventListener('click', structureAddBlock);
        if (el.structureAddLinkButton) el.structureAddLinkButton.addEventListener('click', structureAddLink);
""", """        if (el.structureAddBlockButton) el.structureAddBlockButton.addEventListener('click', structureAddBlock);
        if (el.structureAddLinkButton) el.structureAddLinkButton.addEventListener('click', structureAddLink);
        // A press on these must not take focus from the row the person is on: the new
        // line lands after THAT row, and the focused chip is how the editor knows which.
        [el.structureAddBlockButton, el.structureAddLinkButton].forEach(button => {
          if (button) button.addEventListener('mousedown', event => event.preventDefault());
        });
""")

# Each guided write is one undo step. The source's undo snapshot is debounced 560ms for
# typing; two row deletes inside that window used to merge, so one Ctrl+Z brought both back.
rep("""        // Reuse the app's own pipeline: validation, preview, autosave, undo.
        el.source.dispatchEvent(new Event('input', { bubbles: true }));
        if (rerender) renderStructureEditor();
""", """        // Reuse the app's own pipeline: validation, preview, autosave, undo.
        el.source.dispatchEvent(new Event('input', { bubbles: true }));
        // A row action is one step, not typing: commit its undo snapshot now rather than
        // after the typing debounce, so two quick deletes are two undos, not one.
        commitUndoSnapshot();
        if (rerender) renderStructureEditor();
""")

# Module state for the focus bookkeeping.
rep("""      let structureRenderedSource = null;
""", """      let structureRenderedSource = null;
      // The chip that should hold focus after the next rebuild of the rows, set by a
      // guided writer just before it writes (Enter, Tab, a delete, an insert). Consumed
      // once; a rebuild never pulls focus into the editor on its own.
      let structurePendingFocus = null;
      // The row last worked on, so + Block / + Connection still land there after focus
      // has wandered (a footer press, the preview). Forgotten on an outside change.
      let structureLastFocusedLine = null;
      // The inline edit that is open, if any, so a click on another chip can commit it
      // first instead of losing the click to the rebuild.
      let structureInlineEdit = null;
""")

# structureFocusRow: a moved blank line keeps the focus too (the row div, tabindex -1).
rep("""        const tokens = Array.from(line.querySelectorAll('.struct-token[tabindex]'));
        const token = tokens[ordinal] || tokens[0];
        if (token) token.focus({ preventScroll: true });
        line.scrollIntoView({ block: 'nearest' });
""", """        const tokens = Array.from(line.querySelectorAll('.struct-token[tabindex]'));
        const token = tokens[ordinal] || tokens[0];
        if (token) token.focus({ preventScroll: true });
        else { line.tabIndex = -1; line.focus({ preventScroll: true }); } // a blank line: the row itself
        line.scrollIntoView({ block: 'nearest' });
""")

# structureFocusChip: focus by line AND chip, walking to the neighbouring row on a step.
rep("""      function structureMoveRowAndFocus(index, delta) {
""", """      // Focus the chip at `ordinal` on `line` after a rebuild. A `step` of +1 / -1 walks past
      // the row's ends to the neighbouring row that has chips - Tab from the last chip of a
      // line lands on the first chip of the next. False when there is nowhere to go.
      function structureFocusChip(line, ordinal, step = 0) {
        if (!el.structureRows) return false;
        const rows = Array.from(el.structureRows.querySelectorAll('.struct-code'));
        let at = rows.findIndex(row => Number(row.dataset.line) === Number(line));
        if (at < 0) return false;
        let tokens = Array.from(rows[at].querySelectorAll('.struct-token[tabindex]'));
        let target = Math.max(0, ordinal) + step;
        if (!step) {
          // A line with no chips (blank, `end`) keeps focus on the line itself, so Alt+↑/↓
          // and Delete still address it. The row div answers only to script focus.
          if (!tokens.length) {
            rows[at].tabIndex = -1;
            rows[at].focus({ preventScroll: true });
            rows[at].scrollIntoView({ block: 'nearest' });
            return true;
          }
          target = Math.min(target, tokens.length - 1);
        }
        while (target < 0 || target >= tokens.length) {
          at += step;
          if (at < 0 || at >= rows.length) return false;
          tokens = Array.from(rows[at].querySelectorAll('.struct-token[tabindex]'));
          target = step > 0 ? 0 : tokens.length - 1;
        }
        const token = tokens[target];
        if (!token) return false;
        token.focus({ preventScroll: true });
        rows[at].scrollIntoView({ block: 'nearest' });
        return true;
      }

      // After an insert: focus one chip of the new line, optionally opening it.
      function structureFocusNewLine(index, kind, open) {
        const line = el.structureRows && el.structureRows.querySelector('.struct-code[data-line="' + index + '"]');
        const chips = line ? Array.from(line.querySelectorAll('.struct-token[data-kind="' + kind + '"][role="button"]')) : [];
        const chip = chips[chips.length - 1];
        if (!chip) return;
        chip.focus({ preventScroll: true });
        line.scrollIntoView({ block: 'nearest' });
        if (open) chip.click();
      }

      function structureMoveRowAndFocus(index, delta) {
""")

# Delete: no native confirm. Ordinary lines go at once (Undo restores them); only a line
# that holds the diagram together is questioned, through the app's own dialog.
rep("""      // The × button and the right-click menu ask the same questions before a delete.
      function structureRequestDeleteRow(row) {
        const structural = row.kind === 'header' || row.kind === 'group' || row.kind === 'groupEnd';
        const carriesWords = Boolean(row.label || row.toLabel || row.fromLabel
          || (row.nodes && row.nodes.some(node => node.token)));
        if (structural && !window.confirm('This line holds the diagram together. Delete it anyway?')) return;
        if (!structural && carriesWords && !window.confirm('Delete this line and the words on it?')) return;
        structureDeleteRow(row.index);
      }

      /* Reordering by hand. Drag is the gesture, the line number is the handle (it is
         already unselectable, so no text selection starts under it), Alt+↑ / Alt+↓ is
         the keyboard route for the focused line, and the row's ↑ ↓ buttons and its
         right-click menu are the visible ones. Every route commits through the same
         single write. Wired once; the rows underneath are rebuilt freely. */
""", """      // The row menu and the Delete key come here. An ordinary line goes at once - Undo
      // restores it, and the toast says so. Only a line that holds the diagram together
      // is questioned, through the app's own dialog rather than a browser confirm.
      function structureRequestDeleteRow(row) {
        const structural = row.kind === 'header' || row.kind === 'group' || row.kind === 'groupEnd';
        if (structural) {
          requestConfirmation({
            title: 'Delete line ' + (row.index + 1) + '?',
            message: 'This line holds the diagram together. Delete it anyway? Undo restores it.',
            confirmText: 'Delete',
            action: () => structureDeleteRow(row.index)
          });
          return;
        }
        if (structureDeleteRow(row.index)) showToast('Line ' + (row.index + 1) + ' removed. Undo restores it.', 'success');
      }

      /* Reordering by hand. Drag is the gesture, the line number is the handle (it is
         already unselectable, so no text selection starts under it), Alt+↑ / Alt+↓ is
         the keyboard route for the focused line, and the row's right-click menu
         (Shift+F10 / the Menu key on a focused line) is the visible one. Every route
         commits through the same single write. Wired once; the rows underneath are
         rebuilt freely. */
""")

# Keyboard: Delete / Backspace on a focused line; remember the last focused row; one
# click from an open inline edit to another chip.
rep("""        host.addEventListener('keydown', event => {
          if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
""", """        // Where the person is working, for + Block / + Connection after focus has moved on.
        host.addEventListener('focusin', event => {
          const line = event.target instanceof Element ? event.target.closest('.struct-code') : null;
          const n = line ? Number(line.dataset.line) : NaN;
          if (Number.isFinite(n)) structureLastFocusedLine = n;
        });

        // One click moves from an open inline edit to another chip. Without this the
        // press blurred the input, the commit rebuilt the rows, and the click landed on
        // nothing - a second click was needed. Chips only: the gutter drag and the row
        // menu are untouched.
        host.addEventListener('pointerdown', event => {
          if (event.button !== 0 || !structureInlineEdit) return;
          // An edit whose input an outside rebuild already threw away has nothing to commit.
          if (!structureInlineEdit.input.isConnected) { structureInlineEdit = null; return; }
          const chip = event.target instanceof Element ? event.target.closest('.struct-token[role="button"]') : null;
          if (!chip || !host.contains(chip)) return;
          const row = chip.closest('.struct-code');
          const line = row ? Number(row.dataset.line) : NaN;
          const ordinal = row ? Array.from(row.querySelectorAll('.struct-token[tabindex]')).indexOf(chip) : -1;
          if (!Number.isFinite(line) || ordinal < 0) return;
          event.preventDefault();
          event.stopPropagation();
          structurePendingFocus = { line, ordinal, step: 0 };
          structureInlineEdit.finish(true);
          const next = document.activeElement;
          if (next instanceof Element && host.contains(next) && next.matches('.struct-token[role="button"]')) next.click();
        }, true);

        host.addEventListener('keydown', event => {
          // Delete / Backspace on a focused line removes it, as on a block in the canvas.
          // An inline edit owns its own keys.
          if ((event.key === 'Delete' || event.key === 'Backspace') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            const active = document.activeElement;
            if (active && active.matches('input, textarea')) return;
            const index = structureFocusedRowIndex();
            if (index === null) return;
            const row = parseStructureRows(el.source.value)[index];
            if (!row) return;
            event.preventDefault();
            event.stopPropagation();
            structureRequestDeleteRow(row);
            return;
          }
          if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
""")

# A blank line drags too (the writer already handles any index).
rep("""          const handle = event.target instanceof Element ? event.target.closest('.struct-gutter') : null;
          const line = handle ? handle.closest('.struct-code:not(.is-blank)') : null;
""", """          const handle = event.target instanceof Element ? event.target.closest('.struct-gutter') : null;
          const line = handle ? handle.closest('.struct-code') : null;
""")

# structureDeleteRow reports success and keeps focus in the rows.
rep("""      function structureDeleteRow(index) {
        if (structureRowsAreStale()) return;
        const lines = el.source.value.split(/\\r?\\n/);
        if (index < 0 || index >= lines.length) return;
        const removed = parseStructureRows(el.source.value)[index];
        lines.splice(index, 1);
""", """      function structureDeleteRow(index) {
        if (structureRowsAreStale()) return false;
        const lines = el.source.value.split(/\\r?\\n/);
        if (index < 0 || index >= lines.length) return false;
        const removed = parseStructureRows(el.source.value)[index];
        lines.splice(index, 1);
        // Focus stays in the rows: on the line that moves into the slot, or the last line
        // when the deleted one was last - never dropped on the page.
        const active = document.activeElement;
        if (active && el.structureRows && el.structureRows.contains(active)) {
          structurePendingFocus = { line: Math.min(index, lines.length - 1), ordinal: 0, step: 0 };
        }
""")
rep("""          if (!stillUsed) structureForgetNode(removed.id);
        }
        writeStructureSource(lines.join('\\n'));
      }

      // The row that holds focus, so a new block or connection lands where the person is
      // working rather than at the end of the file. Null when nothing in the editor has focus.
      function structureFocusedRowIndex() {
        const active = document.activeElement;
        if (!active || !el.structureRows || !el.structureRows.contains(active)) return null;
        const host = active.closest('.struct-code');
        if (!host || host.dataset.line === undefined) return null;
        const n = Number(host.dataset.line);
        return Number.isFinite(n) ? n : null;
      }
""", """          if (!stillUsed) structureForgetNode(removed.id);
        }
        writeStructureSource(lines.join('\\n'));
        return true;
      }

      // The row that holds focus, so a new block or connection lands where the person is
      // working rather than at the end of the file. When nothing in the rows has focus
      // (a footer press, a click in the preview) the row last worked on stands in, as
      // long as it still exists. Null when there is no such row.
      function structureFocusedRowIndex() {
        const active = document.activeElement;
        const inside = Boolean(active && el.structureRows && el.structureRows.contains(active));
        const host = inside ? active.closest('.struct-code') : null;
        if (host && host.dataset.line !== undefined) {
          const n = Number(host.dataset.line);
          return Number.isFinite(n) ? n : null;
        }
        if (inside || structureLastFocusedLine === null) return null;
        const total = el.source.value.split(/\\r?\\n/).length;
        return structureLastFocusedLine < total ? structureLastFocusedLine : null;
      }
""")

# + Block: lands after the given or focused row, and its label opens ready to type.
rep("""      function structureAddBlock() {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const id = structureNextId();
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = structureFocusedRowIndex();
        // Insert after the focused row; else after the last declaring row; else at the end.
        let at = focused !== null ? focused : structureLastDeclaringIndex(rows);
        if (at < 0 || at >= lines.length) at = lines.length - 1;
        lines.splice(at + 1, 0, `${indent}${id}${makeShapeToken('rect', 'New block')}`);
        writeStructureSource(lines.join('\\n'));
        showToast(focused !== null ? `Block added after line ${focused + 1}.` : 'Block added.', 'success');
      }
      function structureAddLink() {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const ids = structureLineIds();
        if (ids.length < 2) { showToast('Add two blocks first, then connect them.', 'error'); return; }
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = structureFocusedRowIndex();
""", """      // The row menu passes the line it was opened on; the footer button passes its click
      // event. Anything that is not a line number means "where the person is working".
      function structureAddBlock(afterIndex) {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const id = structureNextId();
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = Number.isInteger(afterIndex) ? afterIndex : structureFocusedRowIndex();
        // Insert after the focused row; else after the last declaring row; else at the end.
        let at = focused !== null ? focused : structureLastDeclaringIndex(rows);
        if (at < 0 || at >= lines.length) at = lines.length - 1;
        lines.splice(at + 1, 0, `${indent}${id}${makeShapeToken('rect', 'New block')}`);
        writeStructureSource(lines.join('\\n'));
        // The new line is the feedback: its label opens with the words selected, so the
        // next thing typed names the block. No toast needed.
        structureFocusNewLine(at + 1, 'label', true);
      }
      function structureAddLink(afterIndex) {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const ids = structureLineIds();
        if (ids.length < 2) { showToast('Add two blocks first, then connect them.', 'error'); return; }
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = Number.isInteger(afterIndex) ? afterIndex : structureFocusedRowIndex();
""")
rep("""        lines.splice(at + 1, 0, `${indent}${from} --> ${to}`);
        writeStructureSource(lines.join('\\n'));
        showToast(`Connected ${from} \\u2192 ${to}.`, 'success');
      }
""", """        lines.splice(at + 1, 0, `${indent}${from} --> ${to}`);
        writeStructureSource(lines.join('\\n'));
        // Focus lands on the new line's target block - the part most likely to change next.
        structureFocusNewLine(at + 1, 'id', false);
        showToast(`Connected ${from} \\u2192 ${to} on line ${at + 2}.`, 'success');
      }
""")

# openStructureMenu: open on the current value (the ONE line changed in this primitive).
rep("""        const first = menu.querySelector('.struct-menu-item:not(:disabled)');
        if (first) first.focus();
""", """        const first = menu.querySelector('.struct-menu-item[aria-selected="true"]:not(:disabled)') || menu.querySelector('.struct-menu-item:not(:disabled)'); // the current value, else the first
        if (first) first.focus();
""")

# The row menu: insert, connect, move, delete - on blank lines too.
rep("""      /* ---------------- a guided line ----------------
         Right-click is the accelerator. The same moves are on the row's ↑ ↓ buttons,
         on Alt+↑ / Alt+↓ for the focused line, and on a drag of the line number. A
         blank line offers nothing, so the browser keeps its menu there. */
      function buildStructureRowContextMenu(line) {
        const index = Number(line.dataset.line);
        if (!Number.isFinite(index)) return null;
        const row = parseStructureRows(el.source.value)[index];
        if (!row || (row.kind === 'blank' && !row.text)) return null;
        const lines = el.source.value.split(/\\r?\\n/);
        const hasAbove = lines.slice(0, index).some(text => text.trim());
        const hasBelow = lines.slice(index + 1).some(text => text.trim());
        const rows = [[null, 'Line ' + (index + 1), 'heading']];
        rows.push([() => structureMoveRowAndFocus(index, -1), 'Move line up', hasAbove ? '' : 'This is already the first line.']);
        rows.push([() => structureMoveRowAndFocus(index, 1), 'Move line down', hasBelow ? '' : 'This is already the last line.']);
        rows.push([() => structureRequestDeleteRow(row), 'Delete line']);
        return { rows, anchor: line, label: 'Actions for line ' + (index + 1) };
      }
""", """      /* ---------------- a guided line ----------------
         Right-click is the accelerator. The same moves are on Alt+↑ / Alt+↓ for the
         focused line and on a drag of the line number; Delete removes the focused line;
         Shift+F10 or the Menu key opens this list from the keyboard. A blank line gets
         the same list, so it can be moved or deleted rather than leap-frogged. */
      function buildStructureRowContextMenu(line) {
        const index = Number(line.dataset.line);
        if (!Number.isFinite(index)) return null;
        const row = parseStructureRows(el.source.value)[index];
        if (!row) return null;
        const blank = row.kind === 'blank' && !row.text;
        const lines = el.source.value.split(/\\r?\\n/);
        const hasAbove = lines.slice(0, index).some(text => text.trim());
        const hasBelow = lines.slice(index + 1).some(text => text.trim());
        const flow = structureIsFlowchart();
        const rows = [[null, 'Line ' + (index + 1), 'heading']];
        rows.push([() => structureAddBlock(index), 'Insert block below', flow ? '' : 'Blocks are flowchart syntax; this diagram type is edited as code.']);
        rows.push([() => structureAddLink(index), 'Connect from here', flow ? '' : 'Connections are flowchart syntax; this diagram type is edited as code.']);
        rows.push([() => structureMoveRowAndFocus(index, -1), 'Move line up', hasAbove ? '' : 'This is already the first line.']);
        rows.push([() => structureMoveRowAndFocus(index, 1), 'Move line down', hasBelow ? '' : 'This is already the last line.']);
        rows.push([() => structureRequestDeleteRow(row), blank ? 'Delete blank line' : 'Delete line']);
        return { rows, anchor: line, label: 'Actions for line ' + (index + 1) };
      }
""")

# structureEditToken: chip-aware focus (Enter / Esc back to the chip, Tab / Shift+Tab to
# the neighbour), and the open edit is known to the click handler.
rep("""      function structureEditToken(span, value, commit) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'struct-inline-input';
        input.value = value;
        input.size = Math.max(4, Math.min(60, value.length + 2));
        input.spellcheck = false;
        span.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = save => {
          if (done) return;
          done = true;
          if (save && input.value !== value) commit(input.value);
          else renderStructureEditor();
        };
        input.addEventListener('input', () => { input.size = Math.max(4, Math.min(60, input.value.length + 2)); });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') { event.preventDefault(); finish(true); }
          else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        });
      }
""", """      function structureEditToken(span, value, commit) {
        if (!span.isConnected) return;
        // Which chip this is, so the rebuild can hand focus back to it - not to the
        // line's first chip - or to its neighbour on Tab.
        const row = span.closest('.struct-code');
        const line = row ? Number(row.dataset.line) : NaN;
        const ordinal = row ? Array.from(row.querySelectorAll('.struct-token[tabindex]')).indexOf(span) : -1;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'struct-inline-input';
        input.value = value;
        input.size = Math.max(4, Math.min(60, value.length + 2));
        input.spellcheck = false;
        span.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        // A key says where focus goes next (step 0: this chip; +1 / -1: its neighbour).
        // A blur says nothing - the person clicked elsewhere, and the rebuild must not
        // pull focus back into the rows.
        const finish = (save, step) => {
          if (done) return;
          done = true;
          if (structureInlineEdit && structureInlineEdit.input === input) structureInlineEdit = null;
          if (step !== undefined && Number.isFinite(line)) structurePendingFocus = { line, ordinal, step };
          if (save && input.value !== value) commit(input.value);
          else renderStructureEditor();
          // A writer that did not rebuild leaves the request standing; honour it now.
          if (structurePendingFocus) renderStructureEditor();
        };
        structureInlineEdit = { input, finish };
        input.addEventListener('input', () => { input.size = Math.max(4, Math.min(60, input.value.length + 2)); });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') { event.preventDefault(); finish(true, 0); }
          else if (event.key === 'Escape') { event.preventDefault(); finish(false, 0); }
          else if (event.key === 'Tab') { event.preventDefault(); finish(true, event.shiftKey ? -1 : 1); }
        });
      }
""")

# Menu configs and the shape-chip display helper.
rep("""      function structureShapeChoices() {
        return NODE_SHAPES.map(shape => [shape, makeShapeToken(shape, '…') + '   ' + shapeDisplayName(shape)]);
      }
""", """      function structureShapeChoices() {
        return NODE_SHAPES.map(shape => [shape, makeShapeToken(shape, '…') + '   ' + shapeDisplayName(shape)]);
      }
      // The chip menus are managed: arrows walk them, Escape and a pick hand focus back
      // to the chip, and the list opens on the current value.
      const STRUCT_MENU_SHAPE = { keyboard: true, label: 'Block shape' };
      const STRUCT_MENU_ARROW = { keyboard: true, label: 'Connector' };
      const STRUCT_MENU_BLOCK = { keyboard: true, label: 'Block' };
      const STRUCT_MENU_DIRECTION = { keyboard: true, label: 'Flow direction' };
      // The brackets as the chip shows them: `[` and `]`, not `["` and `"]`. The quotes are
      // Mermaid's, mean nothing to the reader and cost width on every block; the written
      // line keeps them.
      function structureShapeEnds(shape) {
        const token = makeShapeToken(shape, '');
        const half = Math.ceil(token.length / 2);
        return [token.slice(0, half).replace(/"/g, ''), token.slice(half).replace(/"/g, '')];
      }
""")

rep("""        gutter.title = 'Drag to move this line. Alt+↑ / Alt+↓ moves the focused line.';
""", """        gutter.title = 'Drag to move this line. Alt+↑ / Alt+↓ moves the focused line, Delete removes it; right-click for more.';
""")

# Block row.
rep("""          const token = makeShapeToken(row.shape, '');
          const half = Math.ceil(token.length / 2);
          code.appendChild(structureToken(token.slice(0, half), 'shape', 'Shape of this block. Click to change it.', span =>
            openStructureMenu(span, structureShapeChoices(), row.shape, value =>
              writeStructureLine(row.index, structureBlockLine({ ...row, shape: value })))));
          code.appendChild(structureToken(row.label, 'label', 'The words in the block. Click to edit them here.', span =>
            structureEditToken(span, row.label, value =>
              writeStructureLine(row.index, structureBlockLine({ ...row, label: value })))));
          code.appendChild(structureToken(token.slice(half), 'shape-close'));
""", """          const [open, close] = structureShapeEnds(row.shape);
          code.appendChild(structureToken(open, 'shape', 'Shape of this block. Click to change it.', span =>
            openStructureMenu(span, structureShapeChoices(), row.shape, value =>
              writeStructureLine(row.index, structureBlockLine({ ...row, shape: value })), STRUCT_MENU_SHAPE)));
          code.appendChild(structureToken(row.label, 'label', 'The words in the block. Click to edit them here.', span =>
            structureEditToken(span, row.label, value =>
              writeStructureLine(row.index, structureBlockLine({ ...row, label: value })))));
          code.appendChild(structureToken(close, 'shape-close'));
""")
# Link row: endpoint id menu.
rep("""            openStructureMenu(span, ids.map(other => [other, other]), id, value => structureRetarget(row, side, value)));
""", """            openStructureMenu(span, ids.map(other => [other, other]), id, value => structureRetarget(row, side, value), STRUCT_MENU_BLOCK));
""")
# Link row: a block declared inside the connection.
rep("""          const wrapper = makeShapeToken(shape, '');
          const half = Math.ceil(wrapper.length / 2);
          code.appendChild(structureToken(wrapper.slice(0, half), 'shape', 'Shape of this block. Click to change it.', span =>
            openStructureMenu(span, structureShapeChoices(), shape, value => rebuild(value, label))));
          code.appendChild(structureToken(label, 'label', 'The words in the block. Click to edit them here.', span =>
            structureEditToken(span, label, value => rebuild(shape, value))));
          code.appendChild(structureToken(wrapper.slice(half), 'shape-close'));
""", """          const [open, close] = structureShapeEnds(shape);
          code.appendChild(structureToken(open, 'shape', 'Shape of this block. Click to change it.', span =>
            openStructureMenu(span, structureShapeChoices(), shape, value => rebuild(value, label), STRUCT_MENU_SHAPE)));
          code.appendChild(structureToken(label, 'label', 'The words in the block. Click to edit them here.', span =>
            structureEditToken(span, label, value => rebuild(shape, value))));
          code.appendChild(structureToken(close, 'shape-close'));
""")
# Link row: arrow menu.
rep("""            openStructureMenu(span, STRUCT_ARROW_CHOICES, row.arrow, value => structureWriteLink(row, { arrow: value }))));
""", """            openStructureMenu(span, STRUCT_ARROW_CHOICES, row.arrow, value => structureWriteLink(row, { arrow: value }), STRUCT_MENU_ARROW)));
""")
# Chain row: node id menu, shape menu, arrow menu.
rep("""              openStructureMenu(span, ids.map(other => [other, other]), node.id, value =>
                structureChainRetarget(row, index, value))));
""", """              openStructureMenu(span, ids.map(other => [other, other]), node.id, value =>
                structureChainRetarget(row, index, value), STRUCT_MENU_BLOCK)));
""")
rep("""              const wrapper = makeShapeToken(parsed.shape, '');
              const half = Math.ceil(wrapper.length / 2);
              code.appendChild(structureToken(wrapper.slice(0, half), 'shape', 'Shape of this block. Click to change it.', span =>
                openStructureMenu(span, structureShapeChoices(), parsed.shape, value =>
                  setNode(index, { token: makeShapeToken(value, structureEncodeLabel(label)) }))));
              code.appendChild(structureToken(label, 'label', 'The words in the block. Click to edit them here.', span =>
                structureEditToken(span, label, value =>
                  setNode(index, { token: makeShapeToken(parsed.shape, structureEncodeLabel(value)) }))));
              code.appendChild(structureToken(wrapper.slice(half), 'shape-close'));
""", """              const [open, close] = structureShapeEnds(parsed.shape);
              code.appendChild(structureToken(open, 'shape', 'Shape of this block. Click to change it.', span =>
                openStructureMenu(span, structureShapeChoices(), parsed.shape, value =>
                  setNode(index, { token: makeShapeToken(value, structureEncodeLabel(label)) }), STRUCT_MENU_SHAPE)));
              code.appendChild(structureToken(label, 'label', 'The words in the block. Click to edit them here.', span =>
                structureEditToken(span, label, value =>
                  setNode(index, { token: makeShapeToken(parsed.shape, structureEncodeLabel(value)) }))));
              code.appendChild(structureToken(close, 'shape-close'));
""")
rep("""              openStructureMenu(span, STRUCT_ARROW_CHOICES, step.arrow, value => setStep(index, { arrow: value }))));
""", """              openStructureMenu(span, STRUCT_ARROW_CHOICES, step.arrow, value => setStep(index, { arrow: value }), STRUCT_MENU_ARROW)));
""")
# Header row: direction menu.
rep("""            openStructureMenu(span, STRUCT_DIRECTION_CHOICES, row.direction, value =>
              writeStructureLine(row.index, row.indent + row.keyword + ' ' + value))));
""", """            openStructureMenu(span, STRUCT_DIRECTION_CHOICES, row.direction, value =>
              writeStructureLine(row.index, row.indent + row.keyword + ' ' + value), STRUCT_MENU_DIRECTION)));
""")

# The per-row buttons go.
rep("""        const actions = document.createElement('span');
        actions.className = 'struct-line-actions';
        [['↑', 'Move this line up · Alt+↑', () => structureMoveRowAndFocus(row.index, -1)],
         ['↓', 'Move this line down · Alt+↓', () => structureMoveRowAndFocus(row.index, 1)],
         ['×', 'Delete this line', () => structureRequestDeleteRow(row)]].forEach(([glyph, title, run]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn ghost compact';
          button.textContent = glyph;
          button.title = title;
          button.setAttribute('aria-label', title + ' (line ' + (row.index + 1) + ')');
          button.addEventListener('click', run);
          actions.appendChild(button);
        });
        line.append(gutter, code, actions);
        return line;
      }
""", """        // No per-row buttons: the line number drags, Alt+↑/↓ moves, Delete removes, and the
        // line's right-click menu (Shift+F10 / Menu key) does all of it - three routes
        // already; the buttons were a fourth that ate 76px of every row.
        line.append(gutter, code);
        return line;
      }
""")

# renderStructureEditor: consume the pending focus request; restore by line AND chip;
# forget the remembered row on an outside change.
rep("""      function renderStructureEditor() {
        if (!el.structureRows || el.structureEditor.hidden) return;
        ensureStructureRowsInteractions();
        const scrollTop = el.structureRows.scrollTop;
        const active = document.activeElement;
        const focusedLine = active && el.structureRows.contains(active) && active.closest('.struct-code')
          ? active.closest('.struct-code').dataset.line : null;
        closeStructureMenu();
        structureRenderedSource = el.source.value;
""", """      function renderStructureEditor() {
        // A focus request is for THIS rebuild only, whether or not it can be honoured.
        const pending = structurePendingFocus;
        structurePendingFocus = null;
        if (!el.structureRows || el.structureEditor.hidden) return;
        ensureStructureRowsInteractions();
        const scrollTop = el.structureRows.scrollTop;
        const active = document.activeElement;
        const activeRow = active && el.structureRows.contains(active) ? active.closest('.struct-code') : null;
        // Where focus goes afterwards: what a guided writer asked for, else the chip that
        // had it - same line, same chip, not the line's first chip.
        const focusedLine = pending ? pending.line : activeRow ? Number(activeRow.dataset.line) : null;
        const focusedOrdinal = pending ? pending.ordinal
          : activeRow ? Array.from(activeRow.querySelectorAll('.struct-token[tabindex]')).indexOf(active) : -1;
        const focusStep = pending ? pending.step || 0 : 0;
        // An outside change (undo, a diagram switch, the visual builder) can make the
        // remembered row a stranger's line: forget it.
        if (structureRenderedSource !== null && el.source.value !== structureRenderedSource) structureLastFocusedLine = null;
        closeStructureMenu();
        structureRenderedSource = el.source.value;
""")
rep("""        el.structureRows.scrollTop = scrollTop;
        if (focusedLine !== null) {
          const host = el.structureRows.querySelector('[data-line=' + String.fromCharCode(34) + focusedLine + String.fromCharCode(34) + ']');
          const token = host && host.querySelector('.struct-token[tabindex]');
          if (token) token.focus();
        }
      }
""", """        el.structureRows.scrollTop = scrollTop;
        if (focusedLine !== null && !structureFocusChip(focusedLine, focusedOrdinal, focusStep) && focusStep) {
          // Tab past the last chip (or Shift+Tab before the first) leaves the rows for the
          // neighbouring control, as it would from any other field.
          const tokens = el.structureRows.querySelectorAll('.struct-token[tabindex]');
          const edge = focusStep > 0 ? tokens[tokens.length - 1] : tokens[0];
          if (edge) focusBesideControl(edge, focusStep < 0);
        }
      }
""")

# The legend under the editor describes the editor that is showing.
rep("""      function setStructureMode(on) {
        const enabled = Boolean(on);
        state.structureMode = enabled;
        if (el.structureEditor) el.structureEditor.hidden = !enabled;
        if (el.codeEditor) el.codeEditor.hidden = enabled;
""", """      function setStructureMode(on) {
        const enabled = Boolean(on);
        state.structureMode = enabled;
        if (el.structureEditor) el.structureEditor.hidden = !enabled;
        if (el.codeEditor) el.codeEditor.hidden = enabled;
        // The legend under the editor describes the editor that is showing: the Text
        // legend's "Tab indents" and "Esc leaves" are not true of the Guided rows.
        const legend = document.querySelector('.editor-footer > span:first-child');
        if (legend) {
          if (!legend.dataset.textLegend) legend.dataset.textLegend = legend.innerHTML;
          legend.innerHTML = enabled
            ? '<strong>Enter</strong> opens the focused chip · <strong>Esc</strong> cancels · <strong>Tab</strong> next chip · <strong>Alt + ↑/↓</strong> moves the line · <strong>Delete</strong> removes it'
            : legend.dataset.textLegend;
        }
""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
