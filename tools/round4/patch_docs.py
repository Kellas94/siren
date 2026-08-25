import io, os, sys
# Docs module: right-click ladder with real functions, three export defects, plain
# menu face, one noun, general-audience empty state. Idempotent against FROZEN_1_62_0.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# ---------------------------------------------------------------- A. Docs HTML chrome
rep(r'''<section class="wp-surface" id="wpWorkspace" aria-label="Workpapers and agent documentation" hidden>
      <div class="wp-topbar">
        <strong>▤ Workpapers</strong>''',
r'''<section class="wp-surface" id="wpWorkspace" aria-label="Documents" hidden>
      <div class="wp-topbar">
        <strong>▤ Docs</strong>''')
rep(r'''<input id="wpSearch" type="search" placeholder="Search documents…" aria-label="Search workpapers" />
        <select id="wpFilter" aria-label="Filter workpapers">''',
r'''<input id="wpSearch" type="search" placeholder="Search documents…" aria-label="Search documents" />
        <select id="wpFilter" aria-label="Filter documents">''')
rep(r'''<aside class="wp-list" id="wpList" aria-label="Workpaper register"></aside>''',
r'''<aside class="wp-list" id="wpList" aria-label="Document register"></aside>''')
rep(r'''            <h3>Document your agents next to their diagrams</h3>
            <p>A workpaper is a written page — headings, text, tables, checklists — plus the exact prompt and settings behind each Copilot agent. Link it to a diagram or to a single step, and it travels with the project when you export it.</p>
            <button class="btn" id="wpEmptyNewButton" type="button">＋ Create the first workpaper</button>''',
r'''            <h3>Write the document next to its diagram</h3>
            <p>A document is a written page — headings, text, tables, checklists, evidence — and, for an agent, its exact prompt and settings. Link it to a diagram or to a single step and it travels with the project.</p>
            <button class="btn" id="wpEmptyNewButton" type="button" aria-haspopup="menu" aria-expanded="false">＋ Create the first document ▾</button>''')
rep(r'''<button class="btn secondary compact" id="wpAddLinkButton" type="button">⚭ Add</button>''',
r'''<button class="btn secondary compact" id="wpAddLinkButton" type="button" title="Add a reference. Inside a text block, [[Diagram name]] links too: Ctrl+click it (⌘-click on a Mac) to jump to that diagram.">⚭ Add</button>''')

# ---------------------------------------------------------------- B. init handlers: New, empty state, ⋯ menu, toasts
rep(r'''        const startNewWorkpaper = (pickedType) => {
          // Menu callbacks pass a type string; the empty-state button passes its
          // click Event and therefore uses the documented Agent spec default.
          const type = typeof pickedType === 'string' ? pickedType : 'agent-spec';
          const doc = createWorkpaper(normalizeWorkpaperType(type));
          if (!doc) return;
          // On a phone the register overlay may be covering the document pane; the
          // new document has to be visible, not created behind it.
          el.wpBody?.classList.remove('show-list');
          el.wpListToggleButton?.setAttribute('aria-pressed', 'false');
          renderWorkpapers();
          el.wpTitle.focus();
          el.wpTitle.select();
        };
        // The type of a new document is a property of creating one, so it is asked at
        // the moment of creating one - not parked in a dropdown beside the button that
        // looks exactly like the open document's own type.
        if (el.wpNewButton) el.wpNewButton.addEventListener('click', () => {
          openStructureMenu(el.wpNewButton, [
            ['agent-spec', 'Agent spec'],
            ['narrative', 'Narrative'],
            ['control', 'Control doc'],
            ['note', 'Note']
          ], '', startNewWorkpaper, { keyboard: true, role: 'menu', label: 'New document type', restoreFocus: true });
        });''',
r'''        // The type of a new document is a property of creating one, so it is asked at
        // the moment of creating one - not parked in a dropdown beside the button that
        // looks exactly like the open document's own type. The empty-state button asks
        // the same question: it used to create an agent spec without saying so.
        const openNewWorkpaperTypeMenu = (anchor) => {
          openStructureMenu(anchor, WORKPAPER_TYPE_CHOICES.map(pair => pair.slice()), '',
            type => startNewWorkpaperOfType(type),
            { keyboard: true, role: 'menu', label: 'New document type', restoreFocus: true, plain: true });
        };
        if (el.wpNewButton) el.wpNewButton.addEventListener('click', () => openNewWorkpaperTypeMenu(el.wpNewButton));''')
rep(r'''        if (el.wpEmptyNewButton) el.wpEmptyNewButton.addEventListener('click', startNewWorkpaper);''',
r'''        if (el.wpEmptyNewButton) el.wpEmptyNewButton.addEventListener('click', () => openNewWorkpaperTypeMenu(el.wpEmptyNewButton));''')
rep(r'''          const typeRows = [
            ['agent-spec', 'Agent spec'], ['narrative', 'Narrative'], ['control', 'Control doc'], ['note', 'Note']
          ].map(([v, label]) => ['type:' + v, (v === currentType ? '✓ ' : '   ') + 'Type · ' + label]);''',
r'''          const typeRows = WORKPAPER_TYPE_CHOICES
            .map(([v, label]) => ['type:' + v, (v === currentType ? '✓ ' : '') + 'Type · ' + label]);''')
rep(r'''            else if (value === 'delete') el.wpDeleteButton.click();
          }, { keyboard: true, role: 'menu', label: 'Document actions', restoreFocus: true });''',
r'''            else if (value === 'delete') el.wpDeleteButton.click();
          }, { keyboard: true, role: 'menu', label: 'Document actions', restoreFocus: true, plain: true });''')
rep(r'''            ? 'Workpaper duplicated — releases and the governance review stay with the original.'
            : 'Workpaper duplicated.', 'success');''',
r'''            ? 'Document duplicated — releases and the governance review stay with the original.'
            : 'Document duplicated.', 'success');''')
rep(r'''            title: 'Delete this workpaper?',''', r'''            title: 'Delete this document?',''')
rep(r'''            confirmText: 'Delete workpaper',''', r'''            confirmText: 'Delete document',''')
rep(r'''              scheduleRender('Workpaper deleted');
              showToast('Workpaper deleted.', 'success');''',
r'''              scheduleRender('Document deleted');
              showToast('Document deleted.', 'success');''')

rep(r"""            showToast(`The register holds up to ${MAX_WORKPAPERS} workpapers.`, 'error');""",
r"""            showToast(`The register holds up to ${MAX_WORKPAPERS} documents.`, 'error');""")
# the Docs export toasts (HTML single, HTML zip, PDF print queue) say the same noun
rep(r"""        showToast('Workpaper downloaded as a printable HTML page.', 'success');""",
r"""        showToast('Document downloaded as a printable HTML page.', 'success');""")
rep(r"""        if (!docs.length) { showToast('There are no workpapers to export yet.', 'error'); return; }""",
r"""        if (!docs.length) { showToast('There are no documents to export yet.', 'error'); return; }""")
rep(r"""        showToast(docs.length + ' workpaper' + (docs.length === 1 ? '' : 's') + ' exported as HTML in one ZIP.', 'success');""",
r"""        showToast(docs.length + ' document' + (docs.length === 1 ? '' : 's') + ' exported as HTML in one ZIP.', 'success');""")
rep(r"""        showToast(list.length === 1 ? 'Print dialog opened — choose "Save as PDF".' : `${list.length} workpapers queued — choose "Save as PDF".`, 'success');""",
r"""        showToast(list.length === 1 ? 'Print dialog opened — choose "Save as PDF".' : `${list.length} documents queued — choose "Save as PDF".`, 'success');""")

rep(r"""          el.workpapersButton.title = linked
            ? `${linked} workpaper${linked === 1 ? '' : 's'} linked to this diagram`
            : 'Documentation and agent specs (workpapers)';""",
r"""          el.workpapersButton.title = linked
            ? `${linked} document${linked === 1 ? '' : 's'} linked to this diagram`
            : 'Documents: written pages, evidence and agent specs next to the diagrams';""")

# ---------------------------------------------------------------- C. createWorkpaper: one noun, one shared "start a new document" body
rep(r'''      function createWorkpaper(type = 'agent-spec', link = null) {
        commitWorkpaperSession(activeWorkpaper());
        if (state.workpapers.length >= MAX_WORKPAPERS) {
          showToast(`The register holds up to ${MAX_WORKPAPERS} workpapers. Delete one you no longer need first.`, 'error');
          return null;
        }
        const doc = sanitizeWorkpapers([{
          title: type === 'agent-spec' ? 'New agent specification' : 'New workpaper',''',
r'''      // The four document types, in the order every menu lists them.
      const WORKPAPER_TYPE_CHOICES = [['agent-spec', 'Agent spec'], ['narrative', 'Narrative'], ['control', 'Control doc'], ['note', 'Note']];

      /* Create a document of the chosen type and put the cursor in its title. Shared by
         the New ▾ button, the empty state and the register's right-click menu, so a
         new document behaves the same wherever it was asked for. */
      function startNewWorkpaperOfType(type) {
        const doc = createWorkpaper(normalizeWorkpaperType(type));
        if (!doc) return null;
        // On a phone the register overlay may be covering the document pane; the
        // new document has to be visible, not created behind it.
        el.wpBody?.classList.remove('show-list');
        el.wpListToggleButton?.setAttribute('aria-pressed', 'false');
        renderWorkpapers();
        el.wpTitle.focus();
        el.wpTitle.select();
        return doc;
      }

      function createWorkpaper(type = 'agent-spec', link = null) {
        commitWorkpaperSession(activeWorkpaper());
        if (state.workpapers.length >= MAX_WORKPAPERS) {
          showToast(`The register holds up to ${MAX_WORKPAPERS} documents. Delete one you no longer need first.`, 'error');
          return null;
        }
        const doc = sanitizeWorkpapers([{
          title: type === 'agent-spec' ? 'New agent specification' : 'New document',''')

# ---------------------------------------------------------------- D. register list wording
rep(r'''          empty.textContent = state.workpapers.length ? 'Nothing matches this search or filter.' : 'No workpapers yet.';
          el.wpList.appendChild(empty);''',
r'''          empty.textContent = state.workpapers.length ? 'Nothing matches this search or filter.' : 'No documents yet.';
          el.wpList.appendChild(empty);''')
rep(r'''          title.textContent = doc.title || 'Untitled workpaper';
          const meta = document.createElement('span');''',
r'''          title.textContent = doc.title || 'Untitled document';
          const meta = document.createElement('span');''')
rep(r'''          item.setAttribute('aria-label', `${doc.title || 'Untitled workpaper'}, ${doc.ref},''',
r'''          item.setAttribute('aria-label', `${doc.title || 'Untitled document'}, ${doc.ref},''')
rep(r'''          showToast('This document is at its block limit. Split it into a second workpaper.', 'error');''',
r'''          showToast('This document is at its block limit. Split it into a second document.', 'error');''')

# ---------------------------------------------------------------- E. the Docs right-click ladder
rep(r'''      /* ---------------- the Docs surface ----------------
         Only the register row. The body of a document is text, and the browser's own
         menu there carries spellcheck, paste and dictation that nothing here can
         replace; the block toolbars already own everything else. A surface with no
         actions of its own gets no menu, and therefore keeps the browser's. */
      function buildDocsContextMenu(target) {
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');
        if (!row) return null;
        return buildDocsRowContextMenu(row);
      }

      function buildDocsRowContextMenu(row) {
        const id = row.dataset.workpaperId;
        const doc = (state.workpapers || []).find(entry => entry.id === id);
        if (!doc) return null;
        const name = doc.title || 'Untitled workpaper';''',
r'''      /* ---------------- the Docs surface ----------------
         Register row, register empty area, a block's chrome, an inserter gap and the
         rest of the open page. The TEXT of a document - the editable body, a heading
         input, a table cell, a prompt - keeps the browser's own menu by the rule
         above: spellcheck, paste and dictation cannot be replaced. So the block menu
         lives on the block's chrome (left strip, role tag, kind tag, image head,
         tools pill) and in the gaps between blocks. Every row here runs a function
         the pill buttons, the toolbar or the ⋯ menu already run. */
      function buildDocsContextMenu(target) {
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');
        if (row) return buildDocsRowContextMenu(row);
        if (target.closest('#wpList')) return buildDocsRegisterContextMenu(target);
        const blockEl = target.closest('#wpBlocks .wp-block[data-block-id]');
        if (blockEl) return buildDocsBlockContextMenu(blockEl, target);
        const gap = target.closest('#wpBlocks .wp-inserter');
        if (gap) return buildDocsInserterContextMenu(gap);
        if (target.closest('#wpDocInner')) return buildDocsPageContextMenu(target);
        return null;
      }

      // Empty space in the register: the same four types New ▾ offers.
      function buildDocsRegisterContextMenu(target) {
        if (readOnlyMode) return null;
        const rows = [[null, 'New document', 'heading']];
        WORKPAPER_TYPE_CHOICES.forEach(([type, label]) => rows.push([() => startNewWorkpaperOfType(type), '＋  ' + label]));
        return { rows, anchor: target, label: 'New document' };
      }

      // A gap between two blocks: insert exactly there.
      function buildDocsInserterContextMenu(gap) {
        if (readOnlyMode || !activeWorkpaper()) return null;
        const at = Array.from(el.wpBlocks.querySelectorAll('.wp-inserter')).indexOf(gap);
        return {
          rows: [[() => openWorkpaperAddMenu(gap, at < 0 ? null : at), '＋  Insert a block here…']],
          anchor: gap, label: 'Insert a block'
        };
      }

      // The block's own actions - the hover pill, as a list. The second-level menus
      // (insert, role) anchor on the element that was clicked, so they open where the
      // pointer is and not at the far end of a tall block.
      function buildDocsBlockContextMenu(blockEl, target) {
        const doc = activeWorkpaper();
        if (!doc) return null;
        const index = doc.blocks.findIndex(block => block.id === blockEl.dataset.blockId);
        if (index < 0) return null;
        const block = doc.blocks[index];
        const count = doc.blocks.length;
        const open = (doc.comments || []).filter(comment => comment.blockId === block.id && !comment.resolved).length;
        const anchor = target && target.closest('#wpBlocks') ? target : blockEl;
        const rows = [
          [null, `${workpaperBlockLabel(block)} · block ${index + 1} of ${count}`, 'heading'],
          [() => toggleWorkpaperBlockThread(doc, block), open ? `💬  Comments (${open})` : '💬  Add a comment…']
        ];
        if (!readOnlyMode) {
          rows.push([() => openWorkpaperAddMenu(anchor, index), '＋  Insert a block above…']);
          rows.push([() => openWorkpaperAddMenu(anchor, index + 1), '＋  Insert a block below…']);
          rows.push([() => moveWorkpaperBlock(doc, index, -1), '↑  Move up', index === 0 ? 'Already first' : undefined]);
          rows.push([() => moveWorkpaperBlock(doc, index, 1), '↓  Move down', index === count - 1 ? 'Already last' : undefined]);
          if (doc.type === 'agent-spec') rows.push([() => openWorkpaperRoleMenu(anchor, doc, block), '⚑  Mark as purpose, boundaries, capabilities or test cases…']);
          rows.push([() => deleteWorkpaperBlock(doc, index), '×  Delete block']);
        }
        return { rows, anchor: blockEl, label: `${workpaperBlockLabel(block)} block actions` };
      }

      // Anywhere else on the open page: meta line, links row, toolbar gaps, the space
      // under the last block.
      function buildDocsPageContextMenu(target) {
        const doc = activeWorkpaper();
        if (!doc) return null;
        const rows = [[null, doc.title || doc.ref || 'Document', 'heading']];
        if (!readOnlyMode) rows.push([() => openWorkpaperAddMenu(target, null), '＋  Add a block at the end…']);
        rows.push([() => openWorkpaperFind(), '⌕  Find in this document']);
        if (workpaperHeadingEntries(doc).length) rows.push([() => openWorkpaperContentsMenu(target), '☰  Contents…']);
        rows.push([() => el.wpExportButton.click(), '⇩  Export…']);
        return { rows, anchor: target, label: 'Document actions' };
      }

      function buildDocsRowContextMenu(row) {
        const id = row.dataset.workpaperId;
        const doc = (state.workpapers || []).find(entry => entry.id === id);
        if (!doc) return null;
        const name = doc.title || 'Untitled document';''')
rep(r'''        const rows = [
          [null, name, 'heading'],
          [() => { aim(); el.wpExportButton.click(); }, '⇩  Export…']
        ];
        if (!readOnlyMode) {
          rows.push([() => { aim(); el.wpDuplicateButton.click(); }, 'Duplicate']);''',
r'''        const rows = [
          [null, name, 'heading'],
          // Same body as the row's own click: open it, and on a narrow layout put the
          // register overlay away and the cursor in the title.
          [() => {
            aim();
            el.wpBody.classList.remove('show-list');
            el.wpListToggleButton?.setAttribute('aria-pressed', 'false');
            el.wpTitle?.focus({ preventScroll: true });
          }, '→  Open'],
          [() => { aim(); el.wpExportButton.click(); }, '⇩  Export…']
        ];
        if (!readOnlyMode) {
          rows.push([() => { aim(); el.wpDuplicateButton.click(); }, 'Duplicate']);''')

# ---------------------------------------------------------------- F. block tools: named functions the pill AND the menu call
rep(r'''      function buildWorkpaperBlockTools(doc, index) {
        const tools = document.createElement('span');
        tools.className = 'wp-block-tools';
        const block = doc.blocks[index];
        const actions = [
          ['＋', 'Insert a block below this one', 'insert', event => openWorkpaperAddMenu(event.currentTarget, index + 1)],
          ['↑', 'Move up', 'move-up', () => {
            if (index === 0) return;
            const [moved] = doc.blocks.splice(index, 1);
            doc.blocks.splice(index - 1, 0, moved);
            touchWorkpaper(doc);
            renderWorkpaperBlocks(doc);
          }],
          ['↓', 'Move down', 'move-down', () => {
            if (index >= doc.blocks.length - 1) return;
            const [moved] = doc.blocks.splice(index, 1);
            doc.blocks.splice(index + 1, 0, moved);
            touchWorkpaper(doc);
            renderWorkpaperBlocks(doc);
          }],
          ['×', 'Delete this block', 'delete', () => {
            const removed = doc.blocks[index];
            doc.blocks.splice(index, 1);
            // Comments anchored to the removed block go with it, visibly now rather
            // than dangling invisibly until a later load discards them.
            doc.comments = (doc.comments || []).filter(comment => comment.blockId !== removed.id);
            touchWorkpaper(doc);
            renderWorkpaperBlocks(doc);
          }]
        ];
        const openCount = (doc.comments || []).filter(comment => comment.blockId === block.id && !comment.resolved).length;
        actions.unshift([openCount ? `\ud83d\udcac ${openCount}` : '\ud83d\udcac', 'Comments on this block', 'comments', () => {
          if (workpaperOpenThreads.has(block.id)) workpaperOpenThreads.delete(block.id);
          else workpaperOpenThreads.add(block.id);
          renderWorkpaperBlocks(doc);
        }]);
        if (doc.type === 'agent-spec') {
          actions.push(['⚑', "Mark this block as the agent's purpose, boundaries, capabilities or test cases", 'role', event => {
            openStructureMenu(event.currentTarget,
              [['', '(none)']].concat(AGENT_BLOCK_ROLES.map(role => [role, AGENT_BLOCK_ROLE_LABELS[role]])),
              block.role || '',
              value => {
                if (value) block.role = value; else delete block.role;
                touchWorkpaper(doc);
                renderWorkpaperBlocks(doc);
              }, { keyboard: true, label: 'Agent block role', restoreFocus: true });
          }]);
        }''',
r'''      /* The block mutations, named so the hover pill and the right-click menu run the
         very same code. A block moves by one place, within the document. */
      function moveWorkpaperBlock(doc, index, delta) {
        const to = index + delta;
        if (!doc || to < 0 || to >= doc.blocks.length || index < 0 || index >= doc.blocks.length) return;
        const [moved] = doc.blocks.splice(index, 1);
        doc.blocks.splice(to, 0, moved);
        touchWorkpaper(doc);
        renderWorkpaperBlocks(doc);
      }

      function deleteWorkpaperBlock(doc, index) {
        const removed = doc && doc.blocks[index];
        if (!removed) return;
        doc.blocks.splice(index, 1);
        // Comments anchored to the removed block go with it, visibly now rather
        // than dangling invisibly until a later load discards them.
        doc.comments = (doc.comments || []).filter(comment => comment.blockId !== removed.id);
        touchWorkpaper(doc);
        renderWorkpaperBlocks(doc);
      }

      function toggleWorkpaperBlockThread(doc, block) {
        if (workpaperOpenThreads.has(block.id)) workpaperOpenThreads.delete(block.id);
        else workpaperOpenThreads.add(block.id);
        renderWorkpaperBlocks(doc);
      }

      function openWorkpaperRoleMenu(anchor, doc, block) {
        openStructureMenu(anchor,
          [['', '(none)']].concat(AGENT_BLOCK_ROLES.map(role => [role, AGENT_BLOCK_ROLE_LABELS[role]])),
          block.role || '',
          value => {
            if (value) block.role = value; else delete block.role;
            touchWorkpaper(doc);
            renderWorkpaperBlocks(doc);
          }, { keyboard: true, label: 'Agent block role', restoreFocus: true, plain: true });
      }

      function buildWorkpaperBlockTools(doc, index) {
        const tools = document.createElement('span');
        tools.className = 'wp-block-tools';
        const block = doc.blocks[index];
        const actions = [
          ['＋', 'Insert a block below this one', 'insert', event => openWorkpaperAddMenu(event.currentTarget, index + 1)],
          ['↑', 'Move up', 'move-up', () => moveWorkpaperBlock(doc, index, -1)],
          ['↓', 'Move down', 'move-down', () => moveWorkpaperBlock(doc, index, 1)],
          ['×', 'Delete this block', 'delete', () => deleteWorkpaperBlock(doc, index)]
        ];
        const openCount = (doc.comments || []).filter(comment => comment.blockId === block.id && !comment.resolved).length;
        actions.unshift([openCount ? `\ud83d\udcac ${openCount}` : '\ud83d\udcac', 'Comments on this block', 'comments', () => toggleWorkpaperBlockThread(doc, block)]);
        if (doc.type === 'agent-spec') {
          actions.push(['⚑', "Mark this block as the agent's purpose, boundaries, capabilities or test cases", 'role',
            event => openWorkpaperRoleMenu(event.currentTarget, doc, block)]);
        }''')

# ---------------------------------------------------------------- G. plain face on Add block and Contents menus
rep(r'''        openStructureMenu(anchor, choices, '', kind => {
          workpaperInsertAt = Number.isInteger(at) ? at : null;
          addWorkpaperBlock(kind);
        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true });''',
r'''        openStructureMenu(anchor, choices, '', kind => {
          workpaperInsertAt = Number.isInteger(at) ? at : null;
          addWorkpaperBlock(kind);
        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true, plain: true });''')
rep(r'''        openStructureMenu(anchor, options, '', jumpToWorkpaperBlock,
          { keyboard: true, role: 'menu', label: 'Document contents', restoreFocus: true });''',
r'''        openStructureMenu(anchor, options, '', jumpToWorkpaperBlock,
          { keyboard: true, role: 'menu', label: 'Document contents', restoreFocus: true, plain: true });''')

# ---------------------------------------------------------------- H. short text placeholder (the [[ ]] tip moved to the References row)
rep(r'''          editor.dataset.placeholder = 'Write here - bold, italics and lists via the toolbar. Type [[Diagram name]] and Ctrl+click (⌘-click on a Mac) it to jump to that diagram.';''',
r'''          editor.dataset.placeholder = 'Write here…';''')

# ---------------------------------------------------------------- I. export defect D2: the empty knowledge placeholder row
rep(r'''      function workpaperBlockDigest(block) {
        if (!block || typeof block !== 'object') return '';''',
r'''      /* The editor keeps one empty placeholder row in a knowledge block so there is
         somewhere to type. An export is a record, and an empty source is not one -
         every writer reads the rows through this filter. */
      function workpaperKnowledgeRows(block) {
        return (block && Array.isArray(block.rows) ? block.rows : []).filter(row => row
          && [row.name, row.role, row.notes, row.content, row.sourceOrigin, row.confirmedAt].some(value => String(value || '').trim()));
      }

      function workpaperBlockDigest(block) {
        if (!block || typeof block !== 'object') return '';''')
rep(r'''        if (block.kind === 'knowledge') return (block.reasoningEffort ? 'Reasoning effort: ' + block.reasoningEffort + '\n' : '') + (block.rows || []).map(row => (`${row.name} (${row.fileType}${row.role ? ' \u00b7 ' + row.role : ''}) ${row.notes}`
          + (row.sourceOrigin ? `\nSource origin: ${row.sourceOrigin}` : '')
          + (row.confirmedAt ? `\nConfirmed current (UTC): ${row.confirmedAt}` : '')
          + `\n${row.content || ''}`).trim()).join('\n');''',
r'''        if (block.kind === 'knowledge') {
          const rows = workpaperKnowledgeRows(block);
          return (block.reasoningEffort ? 'Reasoning effort: ' + block.reasoningEffort + '\n' : '') + (rows.length ? rows.map(row => (`${row.name} (${row.fileType}${row.role ? ' \u00b7 ' + row.role : ''}) ${row.notes}`
            + (row.sourceOrigin ? `\nSource origin: ${row.sourceOrigin}` : '')
            + (row.confirmedAt ? `\nConfirmed current (UTC): ${row.confirmedAt}` : '')
            + `\n${row.content || ''}`).trim()).join('\n') : 'No knowledge sources recorded.');
        }''')
rep(r'''          if (block.kind === 'knowledge') {
            const withRole = block.rows.some(row => row.role);
            const withOrigin = block.rows.some(row => row.sourceOrigin);
            const withConfirmed = block.rows.some(row => row.confirmedAt);
            const effort = block.reasoningEffort ? `<p><em>Reasoning effort: ${esc(block.reasoningEffort)}</em></p>` : '';
            const table = `<div class="kind-tag">KNOWLEDGE</div>${effort}<table class="settings"><tr><th>Source</th><th>Type</th>${withRole ? '<th>Role</th>' : ''}<th>Represents</th>${withOrigin ? '<th>Source origin</th>' : ''}${withConfirmed ? '<th>Confirmed current (UTC)</th>' : ''}</tr>${block.rows.map(row =>
              `<tr><td>${esc(row.name)}</td><td>${esc(row.fileType)}</td>${withRole ? `<td>${esc(knowledgeRoleLabel(row.role))}</td>` : ''}<td>${esc(row.notes)}</td>${withOrigin ? `<td>${esc(row.sourceOrigin || '')}</td>` : ''}${withConfirmed ? `<td>${esc(row.confirmedAt || '')}</td>` : ''}</tr>`).join('')}</table>`;
            const payloads = block.rows.filter(row => row.content.trim()).map(row =>''',
r'''          if (block.kind === 'knowledge') {
            const kRows = workpaperKnowledgeRows(block);
            const effort = block.reasoningEffort ? `<p><em>Reasoning effort: ${esc(block.reasoningEffort)}</em></p>` : '';
            if (!kRows.length) return `<div class="kind-tag">KNOWLEDGE</div>${effort}<p><em>No knowledge sources recorded.</em></p>`;
            const withRole = kRows.some(row => row.role);
            const withOrigin = kRows.some(row => row.sourceOrigin);
            const withConfirmed = kRows.some(row => row.confirmedAt);
            const table = `<div class="kind-tag">KNOWLEDGE</div>${effort}<table class="settings"><tr><th>Source</th><th>Type</th>${withRole ? '<th>Role</th>' : ''}<th>Represents</th>${withOrigin ? '<th>Source origin</th>' : ''}${withConfirmed ? '<th>Confirmed current (UTC)</th>' : ''}</tr>${kRows.map(row =>
              `<tr><td>${esc(row.name)}</td><td>${esc(row.fileType)}</td>${withRole ? `<td>${esc(knowledgeRoleLabel(row.role))}</td>` : ''}<td>${esc(row.notes)}</td>${withOrigin ? `<td>${esc(row.sourceOrigin || '')}</td>` : ''}${withConfirmed ? `<td>${esc(row.confirmedAt || '')}</td>` : ''}</tr>`).join('')}</table>`;
            const payloads = kRows.filter(row => row.content.trim()).map(row =>''')
rep(r'''          else if (block.kind === 'knowledge') {
            if (block.reasoningEffort) lines.push('*Reasoning effort: ' + block.reasoningEffort + '*', '');
            (block.rows || []).forEach(row => {
              lines.push('- **' + row.name + '** (' + row.fileType + (row.role ? ' · ' + row.role : '') + ') ' + row.notes);
              if (row.sourceOrigin) lines.push('  - Source origin: ' + String(row.sourceOrigin).replace(/[\r\n]+/g, ' '));
              if (row.confirmedAt) lines.push('  - Confirmed current (UTC): ' + row.confirmedAt);
            });
            lines.push('');
          }''',
r'''          else if (block.kind === 'knowledge') {
            if (block.reasoningEffort) lines.push('*Reasoning effort: ' + block.reasoningEffort + '*', '');
            const kRows = workpaperKnowledgeRows(block);
            if (!kRows.length) lines.push('No knowledge sources recorded.');
            kRows.forEach(row => {
              lines.push('- **' + row.name + '** (' + row.fileType + (row.role ? ' · ' + row.role : '') + ') ' + row.notes);
              if (row.sourceOrigin) lines.push('  - Source origin: ' + String(row.sourceOrigin).replace(/[\r\n]+/g, ' '));
              if (row.confirmedAt) lines.push('  - Confirmed current (UTC): ' + row.confirmedAt);
            });
            lines.push('');
          }''')
rep(r'''        if (block.kind === 'knowledge') {
          const rows = Array.isArray(block.rows) ? block.rows : [];
          const descriptions = rows.slice(0, 3).map(row => {''',
r'''        if (block.kind === 'knowledge') {
          const rows = workpaperKnowledgeRows(block);
          const descriptions = rows.slice(0, 3).map(row => {''')
rep(r'''        if (block.kind === 'knowledge') {
          return { headerRow: true, rows: [['Source / type / role', 'Represents / payload', 'Provenance'], ...(block.rows || []).map(row => [''',
r'''        if (block.kind === 'knowledge') {
          const kRows = workpaperKnowledgeRows(block);
          if (!kRows.length) return { headerRow: true, rows: [['Source / type / role', 'Represents / payload', 'Provenance'], ['No knowledge sources recorded.', '', '']] };
          return { headerRow: true, rows: [['Source / type / role', 'Represents / payload', 'Provenance'], ...kRows.map(row => [''')

# ---------------------------------------------------------------- J. export defect D3: PPTX must not rewrite a user's own header cell
rep(r'''              const blockLabel = workpaperPptxCleanText(block.label || workpaperBlockLabel(block));
              if (labelledTable.rows.length && labelledTable.rows[0].length && blockLabel) {''',
r'''              const blockLabel = workpaperPptxCleanText(block.label || workpaperBlockLabel(block));
              // Settings, knowledge and test runs carry fixed headers where the block's
              // name helps; a plain table's header is the author's own words and exports
              // verbatim.
              if (block.kind !== 'table' && labelledTable.rows.length && labelledTable.rows[0].length && blockLabel) {''')

# ---------------------------------------------------------------- K. export defect D1: Markdown text keeps paragraphs, lines, lists, bold, italics
rep(r'''      function workpaperMarkdown(doc) {
        const lines = ['# ' + doc.title, '',''',
r'''      /* Markdown for one text block. The old one-line tag strip glued paragraphs and
         list items together and dropped bold and italics. This walks the sanitised
         HTML the way the editor shows it: Enter makes a new line (a hard break, two
         trailing spaces), an empty line makes a paragraph gap, lists keep their
         bullets and nesting, tables become pipe tables. The editor writes Enter as
         <div> lines, so a leading run of text and the <div> after it are two lines. */
      function workpaperHtmlToMarkdownText(html) {
        const NL = String.fromCharCode(10);
        const holder = document.createElement('div');
        holder.innerHTML = sanitizeWorkpaperHtml(html);
        const groups = [];      // paragraphs, lists and tables - a blank line between them
        let group = null;       // the group taking lines now
        let buf = '';           // the line being written
        const lists = [];       // open lists, innermost last: { ordered, count, width, indent }
        let marker = null;      // the bullet waiting for the current list item's first line
        let table = null, row = null, inCell = 0;
        const tidy = text => text.replace(/\s+/g, ' ').trim();
        const open = kind => { if (!group || group.kind !== kind) { group = { kind, lines: [] }; groups.push(group); } return group; };
        // Finish the line in progress (nothing pending: nothing written).
        const line = () => {
          const text = tidy(buf); buf = '';
          if (!text) return;
          if (lists.length) {
            const top = lists[lists.length - 1], g = open('list');
            if (marker) { g.lines.push(top.indent + marker + text); marker = null; }
            else {
              // A second line inside the same item: hard break, then the item's indent.
              if (g.lines.length) g.lines[g.lines.length - 1] += '  ';
              g.lines.push(top.indent + ' '.repeat(top.width) + text);
            }
            return;
          }
          open('text').lines.push(text);
        };
        const endGroup = () => { line(); group = null; };
        const blank = () => { if (lists.length) return; if (group && group.lines.length) group = null; };
        const wrap = (mark, from) => {
          const start = Math.min(from, buf.length);
          const inner = buf.slice(start), core = inner.trim();
          if (!core) return;
          const lead = inner.match(/^\s*/)[0], tail = inner.match(/\s*$/)[0];
          buf = buf.slice(0, start) + lead + mark + core + mark + tail;
        };
        const walk = node => {
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3) { buf += String(child.nodeValue || ''); return; }
            if (child.nodeType !== 1) return;
            const tag = child.tagName.toUpperCase();
            if (tag === 'STRONG' || tag === 'B' || tag === 'EM' || tag === 'I') {
              const from = buf.length; walk(child); wrap(tag === 'STRONG' || tag === 'B' ? '**' : '*', from); return;
            }
            if (inCell) {
              // Inside a table cell everything is one run of text.
              if (tag === 'BR') { buf += ' '; return; }
              walk(child); if (tag !== 'SPAN' && tag !== 'U') buf += ' ';
              return;
            }
            if (tag === 'BR') { if (tidy(buf)) line(); else blank(); return; }
            if (tag === 'UL' || tag === 'OL') {
              line();
              if (!lists.length) endGroup();
              const parent = lists[lists.length - 1];
              lists.push({ ordered: tag === 'OL', count: 0, width: 2, indent: parent ? parent.indent + ' '.repeat(parent.width) : '' });
              walk(child);
              line();
              lists.pop();
              if (!lists.length) endGroup();
              return;
            }
            if (tag === 'LI') {
              line();
              const top = lists[lists.length - 1];
              if (top) { top.count += 1; marker = top.ordered ? top.count + '. ' : '- '; top.width = marker.length; }
              walk(child);
              line();
              marker = null;
              return;
            }
            if (tag === 'TABLE' && !lists.length) {
              endGroup();
              const t = { kind: 'table', rows: [] };
              table = t; walk(child); table = null;
              if (t.rows.length) groups.push(t);
              group = null;
              return;
            }
            if (tag === 'TR') {
              if (!table) { line(); walk(child); line(); return; }
              const r = []; row = r; walk(child); row = null;
              if (r.length) table.rows.push(r);
              return;
            }
            if (tag === 'TD' || tag === 'TH') {
              if (!row) { walk(child); buf += ' '; return; }
              const from = buf.length; inCell += 1; walk(child); inCell -= 1;
              row.push(tidy(buf.slice(from)).replace(/\|/g, '\\|'));
              buf = buf.slice(0, from);
              return;
            }
            if (tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3') {
              if (lists.length) { line(); walk(child); line(); return; }
              endGroup();
              walk(child);
              if (tag !== 'P') wrap('**', 0);   // a heading inside a text block: bold line, the document's own heading levels stay unique
              endGroup();
              return;
            }
            if (tag === 'DIV') { line(); walk(child); line(); return; }
            walk(child);   // SPAN, U and anything else: inline
          });
        };
        walk(holder);
        endGroup();
        return groups.map(g => {
          if (g.kind === 'table') {
            const cols = Math.max(...g.rows.map(r => r.length));
            const rows = g.rows.map(r => '| ' + r.concat(Array(cols - r.length).fill('')).join(' | ') + ' |');
            rows.splice(1, 0, '| ' + Array(cols).fill('---').join(' | ') + ' |');
            return rows.join(NL);
          }
          if (g.kind === 'list') return g.lines.join(NL);
          return g.lines.join('  ' + NL);
        }).filter(Boolean).join(NL + NL).trim();
      }

      function workpaperMarkdown(doc) {
        const lines = ['# ' + doc.title, '',''')
rep(r'''          else if (block.kind === 'text') lines.push(String(block.html || '').replace(/<br\s*\/?>/gi, String.fromCharCode(10)).replace(/<[^>]+>/g, '').trim(), '');''',
r'''          else if (block.kind === 'text') lines.push(workpaperHtmlToMarkdownText(block.html), '');''')

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
