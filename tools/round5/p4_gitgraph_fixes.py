"""SIREN patch 4/4 - the six defects the verifier found in the git-graph work.

Run after p1_gitgraph_type.py, p2_git_branch_colours.py and p3_code_only_surface.py:
every anchor here is text those three added, so this script touches no region they did
not already own.

  1. HIGH  - with ten or more branches a Style row painted the WRONG branch. The order
             key copied Mermaid's own `0.<index>` form, in which "0.10" equals "0.1", so
             branch 10 tied with branch 1 and every row after it slid one slot along.
             Measured against the real renderer: a branch with no `order:` keeps the
             place it was declared in, so the key is now a plain 0 and the sort's own
             stability does the rest. The row list is also cut to eight AFTER the order
             is known, and the branches past the eighth are named in the notes instead of
             silently disappearing.
  2. MEDIUM - the code-only hint chip ran off a narrow window, taking its dismiss button
             with it. It now wraps and is capped to the window's width.
  3. LOW    - two hint chips could stack on top of each other. Showing one hides the other.
  4. MEDIUM - when the person's own %%{init}%% sets git0..git7, Mermaid ignores our fill
             but was still handed our label ink, computed against a colour that never got
             painted - white text on a bright green label. Those slots are now left alone
             entirely, and the rows that cannot win say so and show the code's colour.
  5. LOW    - "mainBranchName" written inside a commit message renamed branch zero in the
             rows. Only a %%{init}%% directive can rename it.
  6. LOW    - a colour picked but not yet applied was thrown away by the next render.
             It now survives, and the notes say it is waiting to be applied.

Also: a flowchart whose source cannot round-trip keeps the flowchart menu it has on the
base, instead of being treated as a code-only diagram.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ------------------------------------------------------------------ 1. the main branch
# Only a directive renames branch zero; the words in a commit message do not.
rep("""      function gitGraphMainBranchName(source) {
        const found = /mainBranchName\\s*['"]?\\s*:\\s*['"]([^'"]+)['"]/.exec(String(source || ''));
        return found ? found[1] : 'main';
      }""",
    """      function gitGraphMainBranchName(source) {
        const blocks = String(source || '').match(/%%\\{[\\s\\S]*?\\}%%/g) || [];
        for (let i = 0; i < blocks.length; i += 1) {
          const found = /mainBranchName\\s*['"]?\\s*:\\s*['"]([^'"]+)['"]/.exec(blocks[i]);
          if (found) return found[1];
        }
        return 'main';
      }

      // The git colour slots the person's own %%{init}%% directive sets. Mermaid gives a
      // directive precedence over the app's config, so those slots are not ours to paint -
      // and the label ink for them has to stay derived from THEIR colour, not ours.
      // Returns index -> the colour written in the code, or null when only the label was set.
      function gitGraphInitColourSlots(source) {
        const spoken = new Map();
        const text = String(source || '');
        if (text.indexOf('%%{') < 0) return spoken;
        (text.match(/%%\\{[\\s\\S]*?\\}%%/g) || []).forEach(block => {
          for (let i = 0; i < DIAGRAM_PALETTE_SLOTS; i += 1) {
            const fill = new RegExp('["\\']?git' + i + '["\\']?\\\\s*:\\\\s*["\\']([^"\\']+)["\\']').exec(block);
            const label = new RegExp('["\\']?gitBranchLabel' + i + '["\\']?\\\\s*:').test(block);
            if (fill) spoken.set(i, isDiagramColour(String(fill[1]).trim().toLowerCase()) ? String(fill[1]).trim().toLowerCase() : null);
            else if (label) spoken.set(i, null);
          }
        });
        return spoken;
      }""")

# ------------------------------------------------------------------ 2. the branch order
rep("""        return entries
          .map((entry, index) => ({ name: entry.name, order: entry.order == null ? Number(`0.${index}`) : entry.order }))
          .sort((a, b) => a.order - b.order)
          .map(entry => entry.name)
          .slice(0, DIAGRAM_PALETTE_SLOTS);""",
    """        // A branch with no `order:` keeps the place it was declared in - measured against
        // the renderer, not guessed. (Mermaid writes that default as 0.<index>, where
        // "0.10" equals "0.1"; copying the form tied branch 10 with branch 1 and shifted
        // every row after it onto the wrong branch.) The list is returned whole; whoever
        // needs only the eight Mermaid can colour cuts it AFTER the order is known.
        return entries
          .map(entry => ({ name: entry.name, order: entry.order == null ? 0 : entry.order }))
          .sort((a, b) => a.order - b.order)
          .map(entry => entry.name);""")

# ------------------------------------------------------------------ 3. the config
rep("""        if (Object.keys(gitChosen).length) {
          gitGraphBranchNames(gitGraphSourceOf(diagram)).forEach((name, index) => {
            const colour = gitChosen[name];
            if (!colour || index >= DIAGRAM_PALETTE_SLOTS) return;""",
    """        if (Object.keys(gitChosen).length) {
          const gitSource = gitGraphSourceOf(diagram);
          const gitSpoken = gitGraphInitColourSlots(gitSource);
          gitGraphBranchNames(gitSource).forEach((name, index) => {
            const colour = gitChosen[name];
            // A slot the code's own %%{init}%% claims is left exactly as the theme built it:
            // overriding only the label there produced ink for a fill nobody paints.
            if (!colour || index >= DIAGRAM_PALETTE_SLOTS || gitSpoken.has(index)) return;""")

# ------------------------------------------------------------------ 4. the notes
rep("""      const gitBranchSlots = [];
      let gitBranchControlsWired = false;""",
    """      const gitBranchSlots = [];
      let gitBranchControlsWired = false;
      // Branches past the eighth (Mermaid starts its eight colours again), and the rows
      // the code's own %%{init}%% has already decided. Both are things the notes must say
      // out loud, because both are places a row would otherwise lie.
      let gitBranchOverflow = [];
      let gitBranchLocked = [];""")

rep("""        const notes = auditGitBranchColours(gitBranchSlots, preset);
        const rows = notes.length
          ? notes.map(text => ({ text, kind: 'warn' }))
          : [{ text: 'Every branch reads clearly on this theme. Apply to see it in the diagram and in exports.', kind: 'ok' }];""",
    """        const rows = [];
        // The two things a row could otherwise lie about, said before any colour advice:
        // a branch the code has already decided, and a branch past Mermaid's eighth colour.
        if (gitBranchLocked.length) {
          rows.push({ kind: 'warn', text: `This diagram sets its own git colours in its code (%%{init}%%), so ${listPhrase(gitBranchLocked)} follow${gitBranchLocked.length === 1 ? 's' : ''} the code, not ${gitBranchLocked.length === 1 ? 'its row' : 'these rows'}.` });
        }
        if (gitBranchOverflow.length) {
          const pairs = gitBranchOverflow.slice(0, 3).map(entry => `${entry.name} follows ${entry.follows}`);
          rows.push({ kind: 'ok', text: `Mermaid has eight branch colours and then starts again: ${listPhrase(pairs)}${gitBranchOverflow.length > 3 ? ', and so on' : ''}.` });
        }
        if (gitBranchSlots.some(slot => slot.dirty)) {
          rows.push({ kind: 'warn', text: 'Not applied yet - press Apply branch colours to put these in the diagram.' });
        }
        auditGitBranchColours(gitBranchSlots, preset).forEach(text => rows.push({ text, kind: 'warn' }));
        if (!rows.length) rows.push({ text: 'Every branch reads clearly on this theme. Apply to see it in the diagram and in exports.', kind: 'ok' });""")

# ------------------------------------------------------------------ 5. the rows
rep("""        const names = gitGraphBranchNames(el.source ? el.source.value : (state.source || ''));
        section.hidden = names.length === 0;
        gitBranchSlots.length = 0;
        grid.replaceChildren();
        if (!names.length) return;
        const defaults = gitBranchDefaultFills();
        const chosen = sanitizeGitBranchColours((getActiveDiagram() || {}).gitBranchColours);""",
    """        const source = el.source ? el.source.value : (state.source || '');
        const all = gitGraphBranchNames(source);
        // Only the first eight get a row: Mermaid has eight colours and rotates. The rest
        // are named in the notes rather than given a control that cannot be honoured.
        const names = all.slice(0, DIAGRAM_PALETTE_SLOTS);
        section.hidden = names.length === 0;
        gitBranchOverflow = all.slice(DIAGRAM_PALETTE_SLOTS).map((name, offset) => {
          const index = DIAGRAM_PALETTE_SLOTS + offset;
          return { name, follows: all[index % DIAGRAM_PALETTE_SLOTS] };
        });
        gitBranchLocked = [];
        // A pick the person made and has not applied yet must survive the next render -
        // one keystroke in the code editor used to throw it away without a word.
        const pending = {};
        gitBranchSlots.forEach(slot => { if (slot.dirty) pending[slot.name] = slot.input.value; });
        gitBranchSlots.length = 0;
        grid.replaceChildren();
        if (!names.length) return;
        const spoken = gitGraphInitColourSlots(source);
        const defaults = gitBranchDefaultFills();
        const chosen = sanitizeGitBranchColours((getActiveDiagram() || {}).gitBranchColours);""")

rep("""          input.value = toHexColour(chosen[name] || defaults[index % DIAGRAM_PALETTE_SLOTS] || '#808080');
          const sample = document.createElement('span');
          sample.className = 'palette-sample';
          const slot = { name, input, sample };
          input.addEventListener('input', () => { refreshGitBranchSlot(slot); refreshGitBranchNotes(); });""",
    """          input.value = toHexColour(pending[name] || chosen[name] || defaults[index % DIAGRAM_PALETTE_SLOTS] || '#808080');
          const sample = document.createElement('span');
          sample.className = 'palette-sample';
          const slot = { name, input, sample, dirty: Boolean(pending[name]) };
          if (spoken.has(index)) {
            // The code decided this one. Show what the code says and take the control away,
            // rather than offer a picker whose result Mermaid throws out.
            gitBranchLocked.push(name);
            const written = spoken.get(index);
            if (written) input.value = toHexColour(written);
            input.disabled = true;
            input.title = `${name} takes its colour from the %%{init}%% block in this diagram's code.`;
            slot.locked = true;
          }
          input.addEventListener('input', () => { slot.dirty = true; refreshGitBranchSlot(slot); refreshGitBranchNotes(); });""")

# The two buttons finish the pick, so nothing is left waiting after them.
rep("""        diagram.gitBranchColours = next;
        scheduleSave();""",
    """        diagram.gitBranchColours = next;
        gitBranchSlots.forEach(slot => { slot.dirty = false; });
        scheduleSave();""")

rep("""        diagram.gitBranchColours = {};
        scheduleSave();""",
    """        diagram.gitBranchColours = {};
        gitBranchSlots.forEach(slot => { slot.dirty = false; });
        scheduleSave();""")

# A row the code owns must not be written back into the diagram's own colours.
rep("""        gitBranchSlots.forEach((slot, index) => {
          const picked = String(slot.input.value || '').trim().toLowerCase();""",
    """        gitBranchSlots.forEach((slot, index) => {
          // A row the code owns is not the person's pick to store.
          if (slot.locked) return;
          const picked = String(slot.input.value || '').trim().toLowerCase();""")

# A plain "a, b and c" for the notes above.
rep("""      function refreshGitBranchSlot(slot) {""",
    """      function listPhrase(items) {
        const list = items.filter(Boolean);
        if (list.length <= 1) return list.join('');
        return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
      }

      function refreshGitBranchSlot(slot) {""")

# ------------------------------------------------------------------ 6. the flowchart menu
# A flowchart whose source cannot round-trip is still a flowchart: it keeps the builder's
# own menu (a disabled "New block..." and all), exactly as it does without this work.
rep("""        const codeOnly = Boolean(source.trim()) && !canvasReadModel();""",
    """        const codeOnly = Boolean(source.trim()) && type !== 'flowchart' && !canvasReadModel();""")

rep("""        // A flowchart keeps the builder's own selection; this is only for the rest.
        if (!source.trim() || canvasReadModel()) return;""",
    """        // A flowchart keeps the builder's own selection; this is only for the rest.
        if (!source.trim() || detectMermaidDiagramType(source) === 'flowchart' || canvasReadModel()) return;""")

# ------------------------------------------------------------------ 7. the hint chip
rep("""      function codeOnlyMaybeShowHint() {
        if (state.codeOnlyHintSeen || !el.zoomViewport || !canvasBuilderAvailable()) return;
        const source = String(el.source ? el.source.value : (state.source || ''));
        if (!source.trim() || detectMermaidDiagramType(source) === 'flowchart') return;
        state.codeOnlyHintSeen = true;""",
    """      function codeOnlyMaybeShowHint() {
        if (!el.zoomViewport || !canvasBuilderAvailable()) return;
        const source = String(el.source ? el.source.value : (state.source || ''));
        // Back on a flowchart this chip is wrong: drop it so the canvas's own chip is alone.
        if (!source.trim() || detectMermaidDiagramType(source) === 'flowchart') { codeOnlyHideHint(); return; }
        if (state.codeOnlyHintSeen) return;
        const room = el.zoomViewport.getBoundingClientRect();
        // The preview can be off-screen behind a tab on a narrow window. Saying "click the
        // drawing" over a drawing nobody can see is noise - wait, and keep the one chance.
        if (room.width < 40 || room.height < 40) return;
        state.codeOnlyHintSeen = true;""")

# On a narrow window the preview pane does not exist until this view is up, so the chip
# had nowhere honest to sit. It waits here instead of floating over the editor.
rep("""        if (preview) {
          setTimeout(() => {
            if (pendingAutoFit) { runPendingAutoFit(); return; }""",
    """        if (preview) {
          setTimeout(codeOnlyMaybeShowHint, 420);
          setTimeout(() => {
            if (pendingAutoFit) { runPendingAutoFit(); return; }""")

rep("""          text.textContent = 'This diagram type is drawn from its code \\u00b7 click a part of it to find its line \\u00b7 right-click for fit, size, export and colours';""",
    """          text.textContent = 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size, export and colours';""")

rep("""          chip.append(text, close);
          document.body.appendChild(chip);
          codeOnlyHintEl = chip;
        }
        chip.hidden = false;""",
    """          chip.append(text, close);
          // The pill never wraps, so on a narrow window the sentence and this button ran
          // off the screen together. Let it wrap, and never let it be wider than the window.
          chip.style.whiteSpace = 'normal';
          chip.style.borderRadius = '14px';
          chip.style.lineHeight = '1.35';
          document.body.appendChild(chip);
          codeOnlyHintEl = chip;
        }
        chip.style.maxWidth = `${Math.max(180, Math.min(560, window.innerWidth - 24))}px`;
        chip.hidden = false;
        // One chip at a time: the canvas has a chip of its own at the same spot.
        document.querySelectorAll('.canvas-hint').forEach(other => { if (other !== chip) other.hidden = true; });""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
