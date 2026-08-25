"""SIREN patch 2/3 - a colour per git branch, in the diagram's own Style surface.

Mermaid paints a git graph from a rotating list (git0..git7) handed out in the
order the branches are declared, so "make this branch red" had nowhere to go: the
theme owned every slot. This adds a Style subsection that names the branches the
diagram actually has and lets each keep a colour of its own. The choice is stored
with the diagram, never written into the Mermaid, so the source round-trips
untouched; label ink stays derived from the fill, at the same 4.5:1 floor.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- 1. persistence
# ensureWorkspaceState rebuilds every diagram from a whitelist, so an unknown field
# would be dropped on the next load. Give the colours a declared home.
rep("""          rules: sanitizeFormatRules(diagram.rules),
          numbering: sanitizeNumbering(diagram.numbering),
          review: sanitizeReview(diagram.review),
          legend: sanitizeLegend(diagram.legend),
          presentation: sanitizePresentation(diagram.presentation)""",
    """          rules: sanitizeFormatRules(diagram.rules),
          numbering: sanitizeNumbering(diagram.numbering),
          review: sanitizeReview(diagram.review),
          legend: sanitizeLegend(diagram.legend),
          gitBranchColours: sanitizeGitBranchColours(diagram.gitBranchColours),
          presentation: sanitizePresentation(diagram.presentation)""")

# The same field in the per-diagram snapshot, so a restore point puts the branch
# colours back with everything else it carries.
rep("""          rules: structuredCloneSafe(sanitizeFormatRules(diagram.rules)),
          numbering: sanitizeNumbering(diagram.numbering),
          review: sanitizeReview(diagram.review),
          legend: sanitizeLegend(diagram.legend),
          presentation: sanitizePresentation(diagram.presentation)""",
    """          rules: structuredCloneSafe(sanitizeFormatRules(diagram.rules)),
          numbering: sanitizeNumbering(diagram.numbering),
          review: sanitizeReview(diagram.review),
          legend: sanitizeLegend(diagram.legend),
          gitBranchColours: sanitizeGitBranchColours(diagram.gitBranchColours),
          presentation: sanitizePresentation(diagram.presentation)""")

rep("""        diagram.legend = sanitizeLegend(snapshot.legend);
        diagram.presentation = sanitizePresentation(snapshot.presentation || diagram.presentation);""",
    """        diagram.legend = sanitizeLegend(snapshot.legend);
        diagram.gitBranchColours = sanitizeGitBranchColours(snapshot.gitBranchColours);
        diagram.presentation = sanitizePresentation(snapshot.presentation || diagram.presentation);""")

# ---------------------------------------------------------------- 2. the markup
rep("""                <div class="palette-grid" id="diagramPaletteGrid"></div>
                <div class="palette-notes" id="diagramPaletteNotes"></div>
                <div class="block-style-actions">
                  <button class="btn secondary compact" id="applyDiagramPaletteButton" type="button">Apply colours</button>
                  <button class="btn ghost compact" id="resetDiagramPaletteButton" type="button">Use theme colours</button>
                </div>
              </div>
""",
    """                <div class="palette-grid" id="diagramPaletteGrid"></div>
                <div class="palette-notes" id="diagramPaletteNotes"></div>
                <div class="block-style-actions">
                  <button class="btn secondary compact" id="applyDiagramPaletteButton" type="button">Apply colours</button>
                  <button class="btn ghost compact" id="resetDiagramPaletteButton" type="button">Use theme colours</button>
                </div>
              </div>

              <div class="style-subsection" id="gitBranchSection" aria-label="Git branch colours" hidden>
                <div class="style-subsection-head">
                  <div><strong>Git branch colours</strong><span>The branches in this git graph, in the order Mermaid draws them. Leave one on the theme colour or give it one of its own; its commits, arrows and label all follow.</span></div>
                </div>
                <div class="palette-grid" id="gitBranchGrid"></div>
                <div class="palette-notes" id="gitBranchNotes"></div>
                <div class="block-style-actions">
                  <button class="btn secondary compact" id="applyGitBranchColours" type="button">Apply branch colours</button>
                  <button class="btn ghost compact" id="resetGitBranchColours" type="button">Use theme colours</button>
                </div>
              </div>
""")

# ---------------------------------------------------------------- 3. the config
rep("""        const scaleInk = fills.slice(0, 6).map(fill => inkOnFill(fill, surface, preset, { brightness: DIAGRAM_EVENT_BRIGHTNESS }));
        return {""",
    """        const scaleInk = fills.slice(0, 6).map(fill => inkOnFill(fill, surface, preset, { brightness: DIAGRAM_EVENT_BRIGHTNESS }));
        // A git branch the person gave a colour of its own takes over its rotating slot;
        // every other branch keeps the theme's. The label ink is still derived, never picked.
        const gitFills = fills.slice();
        const gitInk = fillInk.slice();
        const gitChosen = sanitizeGitBranchColours(diagram && diagram.gitBranchColours);
        if (Object.keys(gitChosen).length) {
          gitGraphBranchNames(gitGraphSourceOf(diagram)).forEach((name, index) => {
            const colour = gitChosen[name];
            if (!colour || index >= DIAGRAM_PALETTE_SLOTS) return;
            gitFills[index] = colour;
            gitInk[index] = inkOnFill(colour, surface, preset);
          });
        }
        return {""")

rep("""            git0: fills[0], git1: fills[1], git2: fills[2], git3: fills[3],
            git4: fills[4], git5: fills[5], git6: fills[6], git7: fills[7],
            gitBranchLabel0: fillInk[0], gitBranchLabel1: fillInk[1], gitBranchLabel2: fillInk[2],
            gitBranchLabel3: fillInk[3], gitBranchLabel4: fillInk[4], gitBranchLabel5: fillInk[5],
            gitBranchLabel6: fillInk[6], gitBranchLabel7: fillInk[7],""",
    """            git0: gitFills[0], git1: gitFills[1], git2: gitFills[2], git3: gitFills[3],
            git4: gitFills[4], git5: gitFills[5], git6: gitFills[6], git7: gitFills[7],
            gitBranchLabel0: gitInk[0], gitBranchLabel1: gitInk[1], gitBranchLabel2: gitInk[2],
            gitBranchLabel3: gitInk[3], gitBranchLabel4: gitInk[4], gitBranchLabel5: gitInk[5],
            gitBranchLabel6: gitInk[6], gitBranchLabel7: gitInk[7],""")

# ---------------------------------------------------------------- 4. the module
MODULE = """
      /* ==========================================================================
         Git branch colours.

         Mermaid hands a git graph a ROTATING list - git0..git7 - in the order the
         branches are declared, and pairs each with gitBranchLabel0..7 for its label.
         Nothing in that scheme is addressable by branch, so "make feature red" was
         impossible: the theme owned all eight slots.

         The rows below read the branches out of the source in the same order Mermaid
         does, and let each one hold a colour of its own. The choice lives with the
         diagram, NOT in the Mermaid, so the code the person wrote round-trips
         character for character. A branch left on the theme colour stores nothing and
         keeps following the theme. The label ink is never picked - it is derived from
         whichever fill it lands on, by the same function every other diagram colour
         uses, so a hand-picked branch cannot ship unreadable text.
         ========================================================================== */

      // %%{init: ... mainBranchName: 'trunk' ...}%% renames branch zero.
      function gitGraphMainBranchName(source) {
        const found = /mainBranchName\\s*['"]?\\s*:\\s*['"]([^'"]+)['"]/.exec(String(source || ''));
        return found ? found[1] : 'main';
      }

      // Mermaid's own order: the main branch first, then each `branch` as it is
      // declared, then the whole list re-sorted when a branch carries `order:`.
      // Mirrored here so a colour lands on the branch the person picked.
      function gitGraphBranchNames(source) {
        const text = String(source || '');
        if (detectMermaidDiagramType(text) !== 'gitgraph') return [];
        const entries = [{ name: gitGraphMainBranchName(text), order: null }];
        text.split(/\\r?\\n/).forEach(line => {
          const clean = line.replace(/%%.*$/, '').trim();
          const found = /^branch\\s+(?:"([^"]+)"|'([^']+)'|(\\S+))\\s*(?:order\\s*:\\s*(-?\\d+(?:\\.\\d+)?))?\\s*$/.exec(clean);
          if (!found) return;
          const name = found[1] || found[2] || found[3];
          if (!name || entries.some(entry => entry.name === name)) return;
          entries.push({ name, order: found[4] == null ? null : Number(found[4]) });
        });
        return entries
          .map((entry, index) => ({ name: entry.name, order: entry.order == null ? Number(`0.${index}`) : entry.order }))
          .sort((a, b) => a.order - b.order)
          .map(entry => entry.name)
          .slice(0, DIAGRAM_PALETTE_SLOTS);
      }

      // The live editor text for the diagram being rendered; a stored copy for any other.
      function gitGraphSourceOf(diagram) {
        if (!diagram) return el.source ? el.source.value : (state.source || '');
        const active = getActiveDiagram();
        if (active && diagram === active && el.source) return el.source.value;
        return typeof diagram.source === 'string' ? diagram.source : '';
      }

      function sanitizeGitBranchColours(value) {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.keys(value).slice(0, 32).forEach(key => {
          const name = String(key).slice(0, 80);
          const colour = String(value[key] == null ? '' : value[key]).trim().toLowerCase();
          if (name && isDiagramColour(colour)) out[name] = colour;
        });
        return out;
      }

      // What Mermaid would use if nobody picked anything: the theme's chart colours,
      // in the rotation the git renderer applies.
      function gitBranchDefaultFills() {
        return diagramPaletteFills(themePresets[state.theme] || themePresets.dark);
      }

      const gitBranchSlots = [];
      let gitBranchControlsWired = false;

      function refreshGitBranchSlot(slot) {
        const preset = themePresets[state.theme] || themePresets.dark;
        const fill = slot.input.value;
        const result = diagramPaletteRatio(fill, preset);
        slot.sample.style.backgroundColor = fill;
        slot.sample.style.color = result.ink;
        slot.sample.textContent = `Aa  ${result.ratio.toFixed(1)}:1`;
        slot.sample.title = `Label colour chosen for ${slot.name}: ${result.ink} at ${result.ratio.toFixed(2)}:1.`;
      }

      // Same two questions the chart palette asks, phrased with the branch's own name
      // so the person knows which row to change.
      function auditGitBranchColours(slots, preset) {
        const notes = [];
        const ground = parseCssColour(preset.canvasBg) || { r: 0, g: 0, b: 0, a: 1 };
        const solid = slots.map(slot => {
          const parsed = parseCssColour(slot.input.value);
          return parsed ? compositeOver(parsed, ground) : null;
        });
        solid.forEach((colour, index) => {
          if (!colour) return;
          const against = colourContrast(colour, ground);
          if (against < 3) notes.push(`${slots[index].name} is very close to this theme's background (${against.toFixed(2)}:1). Its commits will read as empty space.`);
        });
        for (let i = 0; i < solid.length; i += 1) {
          for (let j = i + 1; j < solid.length; j += 1) {
            if (!solid[i] || !solid[j]) continue;
            if (colourDistance(solid[i], solid[j]) < 60) notes.push(`${slots[i].name} and ${slots[j].name} are almost the same colour. Two branches will look like one.`);
          }
        }
        return notes;
      }

      function refreshGitBranchNotes() {
        const host = document.getElementById('gitBranchNotes');
        if (!host) return;
        const preset = themePresets[state.theme] || themePresets.dark;
        const notes = auditGitBranchColours(gitBranchSlots, preset);
        const rows = notes.length
          ? notes.map(text => ({ text, kind: 'warn' }))
          : [{ text: 'Every branch reads clearly on this theme. Apply to see it in the diagram and in exports.', kind: 'ok' }];
        host.replaceChildren();
        rows.forEach(row => {
          const line = document.createElement('div');
          line.className = 'field-hint palette-note';
          line.dataset.kind = row.kind;
          line.textContent = row.text;
          host.appendChild(line);
        });
      }

      function renderGitBranchControls() {
        const section = document.getElementById('gitBranchSection');
        const grid = document.getElementById('gitBranchGrid');
        if (!section || !grid) return;
        if (!gitBranchControlsWired) {
          gitBranchControlsWired = true;
          const apply = document.getElementById('applyGitBranchColours');
          const reset = document.getElementById('resetGitBranchColours');
          if (apply) apply.addEventListener('click', applyGitBranchColoursFromControls);
          if (reset) reset.addEventListener('click', resetGitBranchColours);
        }
        const names = gitGraphBranchNames(el.source ? el.source.value : (state.source || ''));
        section.hidden = names.length === 0;
        gitBranchSlots.length = 0;
        grid.replaceChildren();
        if (!names.length) return;
        const defaults = gitBranchDefaultFills();
        const chosen = sanitizeGitBranchColours((getActiveDiagram() || {}).gitBranchColours);
        names.forEach((name, index) => {
          const wrap = document.createElement('div');
          wrap.className = 'palette-slot';
          const label = document.createElement('label');
          label.setAttribute('for', `gitBranchColour${index}`);
          label.textContent = name;
          const input = document.createElement('input');
          input.type = 'color';
          input.id = `gitBranchColour${index}`;
          input.value = toHexColour(chosen[name] || defaults[index % DIAGRAM_PALETTE_SLOTS] || '#808080');
          const sample = document.createElement('span');
          sample.className = 'palette-sample';
          const slot = { name, input, sample };
          input.addEventListener('input', () => { refreshGitBranchSlot(slot); refreshGitBranchNotes(); });
          wrap.append(label, input, sample);
          grid.appendChild(wrap);
          gitBranchSlots.push(slot);
        });
        gitBranchSlots.forEach(refreshGitBranchSlot);
        refreshGitBranchNotes();
      }

      function applyGitBranchColoursFromControls() {
        const diagram = getActiveDiagram();
        if (!diagram || !gitBranchSlots.length) return;
        const defaults = gitBranchDefaultFills();
        const next = {};
        gitBranchSlots.forEach((slot, index) => {
          const picked = String(slot.input.value || '').trim().toLowerCase();
          const theme = toHexColour(defaults[index % DIAGRAM_PALETTE_SLOTS] || '#808080').toLowerCase();
          // A branch still on the theme colour stores nothing, so it keeps following the theme.
          if (isDiagramColour(picked) && picked !== theme) next[slot.name] = picked;
        });
        diagram.gitBranchColours = next;
        scheduleSave();
        renderDiagram({ reason: 'git-branch-colours' });
        renderGitBranchControls();
        const count = Object.keys(next).length;
        setStatus(count
          ? `${count} branch colour${count === 1 ? '' : 's'} applied. Label colours were recomputed to stay readable.`
          : 'Branch colours follow the theme again.');
      }

      function resetGitBranchColours() {
        const diagram = getActiveDiagram();
        if (!diagram) return;
        diagram.gitBranchColours = {};
        scheduleSave();
        renderDiagram({ reason: 'git-branch-colours' });
        renderGitBranchControls();
        setStatus('Branch colours reset to the theme.');
      }

      // The Style panel, opened on this subsection - the row the drawing's own menu uses.
      function revealGitBranchColours() {
        renderGitBranchControls();
        const section = document.getElementById('gitBranchSection');
        if (el.settingsSection) {
          el.settingsSection.open = true;
          el.settingsSection.classList.add('is-highlighted-card');
          setTimeout(() => el.settingsSection.classList.remove('is-highlighted-card'), 1600);
        }
        if (window.innerWidth <= 900) setMobileView('editor');
        requestAnimationFrame(() => {
          const target = section && !section.hidden ? section : el.settingsSection;
          if (target) target.scrollIntoView({ block: 'start' });
          const first = section ? section.querySelector('input[type="color"]') : null;
          if (first) first.focus({ preventScroll: true });
        });
      }
"""

rep("""      function resetDiagramPalette() {
        state.diagramPalette = [];
        renderDiagramPaletteControls();
        scheduleSave();
        renderDiagram({ reason: 'chart-palette' });
        setStatus('Chart colours reset to the theme.');
      }
""",
    """      function resetDiagramPalette() {
        state.diagramPalette = [];
        renderDiagramPaletteControls();
        scheduleSave();
        renderDiagram({ reason: 'chart-palette' });
        setStatus('Chart colours reset to the theme.');
      }
""" + MODULE)

# ---------------------------------------------------------------- 5. keep it in sync
# Source edits and diagram switches come through the type chip; theme changes and
# the first paint come through the chart palette. Between them the rows are never stale.
rep("""        updateDiagramTypeStarterUi();
      }

      function revealDiagramTypeControls() {""",
    """        updateDiagramTypeStarterUi();
        renderGitBranchControls();
      }

      function revealDiagramTypeControls() {""")

rep("""      function renderDiagramPaletteControls() {
        if (!el.diagramPaletteGrid) return;""",
    """      function renderDiagramPaletteControls() {
        renderGitBranchControls();
        if (!el.diagramPaletteGrid) return;""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
