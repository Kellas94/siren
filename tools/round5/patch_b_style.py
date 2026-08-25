"""style5 (b), fix pass: the Style card stops being one wall of forms.

Before: one collapsible called "Style - title, fonts, spacing, block styling, legend"
whose body is 2,631 px tall with 59 visible controls in 8 unrelated groups. Opening it
is the same as not opening it: there is no way to find the one thing you came for.

After: the same controls, in six named folds, only the first open. Each fold's summary
says who needs it and when, so the closed list is the map. Two controls also move to
where they are actually used - the connector curve joins connector routing (the routing
menu's first option is literally "Follow connector curve"), and the layout engine, which
is rare and needs the internet, leaves the top of the card for the layout fold.

Nothing is removed and nothing changes what it does; every id stays where it was.

Fix pass adds two things the verifier asked for:
  * each fold's explanatory line is named out of the summary's accessible name with
    aria-labelledby, so a screen reader announces "Fonts", not the whole sentence,
    while the sentence stays on screen and in the accessibility tree;
  * the preview-head Style button opens the first fold if the user left them all shut,
    so that button never lands on a card with nothing to touch.

Rebased onto FROZEN_1_63_6.html; every anchor below matched that file unchanged.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)


# ---------------------------------------------------------------- CSS -------
rep(
    """    .style-subsection {
      margin-top: 14px;""",
    """    /* Style is one room with six named drawers instead of one wall. The summary of
       each drawer says who needs it, so the closed list is the map. */
    .style-fold { border-top: 1px solid var(--border); }
    .details-body > .style-fold:first-of-type { border-top: none; }
    .style-subsection > .style-fold:first-child { border-top: none; }
    .style-fold > summary { min-height: 40px; padding: 11px 2px; font-size: 13px; font-weight: 800; }
    .style-fold[open] > summary { border-bottom: none; }
    .style-fold > summary > span { display: block; }
    .style-fold-who { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 600; line-height: 1.45; }
    .style-fold-body { padding: 0 2px 14px; }
    .style-fold-body > .style-subsection:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    /* This wrapper holds nothing but folds now, so it must not draw a rule of its own. */
    .style-subsection.style-fold-host { margin-top: 0; padding-top: 0; border-top: none; }

    .style-subsection {
      margin-top: 14px;""")

# ------------------------------------------------- fold 1 opens the card ----
rep(
    """            <summary>Style · title, fonts, spacing, block styling, legend</summary>
            <div class="details-body">
              <div class="settings-grid">""",
    """            <summary>Style · how this diagram looks</summary>
            <div class="details-body">
              <details class="style-fold" open>
                <summary aria-labelledby="styleFoldNameTitle"><span><span id="styleFoldNameTitle">Title &amp; numbering</span><span class="style-fold-who">The diagram's name, and whether its blocks carry numbers you can quote in a written report.</span></span></summary>
                <div class="style-fold-body">
              <div class="settings-grid">""")

# --- the connector curve moves to sit beside connector routing --------------
rep(
    """                <div>
                  <label for="curve">Connector curve</label>
                  <select id="curve">
                    <option value="basis">Smooth</option>
                    <option value="linear">Straight</option>
                    <option value="monotoneX">Monotone</option>
                    <option value="stepBefore">Step before</option>
                    <option value="stepAfter">Step after</option>
                    <option value="orthogonal">Orthogonal · right angles</option>
                  </select>
                </div>
""",
    "")

# --- the layout engine is rare and needs the internet: out of the first view -
rep(
    """                <div>
                  <label for="layoutEngineSelect">Layout engine</label>
                  <select id="layoutEngineSelect">
                    <option value="dagre">Standard (offline)</option>
                    <option value="elk">ELK · better on dense diagrams</option>
                  </select>
                  <div class="field-hint">ELK downloads once and needs internet the first time.</div>
                </div>
""",
    "")

# ------------------------------------------------- fold 2: spacing ----------
rep(
    """              <div class="style-subsection" aria-label="Automatic layout controls">""",
    """                </div>
              </details>

              <details class="style-fold">
                <summary aria-labelledby="styleFoldNameSpacing"><span><span id="styleFoldNameSpacing">Spacing &amp; connectors</span><span class="style-fold-who">How much room the blocks get, and how the lines between them are drawn.</span></span></summary>
                <div class="style-fold-body">
              <div class="style-subsection" aria-label="Automatic layout controls">""")

rep(
    """                  <div class="full"><label for="layoutRouting">Connector routing</label>""",
    """                  <div><label for="curve">Connector curve</label><select id="curve"><option value="basis">Smooth</option><option value="linear">Straight</option><option value="monotoneX">Monotone</option><option value="stepBefore">Step before</option><option value="stepAfter">Step after</option><option value="orthogonal">Orthogonal · right angles</option></select></div>
                  <div class="full"><label for="layoutRouting">Connector routing</label>""")

rep(
    """                <div class="block-style-actions"><button class="btn secondary compact" id="applyLayoutButton" type="button">Apply layout</button>""",
    """                <div class="advanced-tool-grid" style="margin-top:10px;">
                  <div class="full"><label for="layoutEngineSelect">Layout engine</label><select id="layoutEngineSelect"><option value="dagre">Standard (offline)</option><option value="elk">ELK · better on dense diagrams</option></select><div class="field-hint">Rarely needed. ELK downloads once and needs internet the first time; try it when a dense diagram overlaps itself.</div></div>
                </div>
                <div class="block-style-actions"><button class="btn secondary compact" id="applyLayoutButton" type="button">Apply layout</button>""")

# ------------------------------------------------- fold 3: chart colours ----
rep(
    """              <div class="style-subsection" aria-label="Chart colours">""",
    """                </div>
              </details>

              <details class="style-fold">
                <summary aria-labelledby="styleFoldNameChart"><span><span id="styleFoldNameChart">Chart colours</span><span class="style-fold-who">Only for pie, mindmap, git and timeline diagrams - a flowchart takes its colours from the theme and from each block.</span></span></summary>
                <div class="style-fold-body">
              <div class="style-subsection" aria-label="Chart colours">""")

# --- close fold 3; the typography wrapper hosts folds 4, 5 and 6 -------------
rep(
    """              <div class="style-subsection" aria-label="Diagram typography and block styling">""",
    """                </div>
              </details>

              <div class="style-subsection style-fold-host" aria-label="Diagram typography and block styling">""")

# ------------------------------------------------- fold 4: fonts ------------
rep(
    """                <div class="style-subsection-head">
                  <div><strong>Typography</strong><span>These settings apply to the active diagram only.</span></div>
                </div>""",
    """                <details class="style-fold" id="styleFoldFonts">
                  <summary aria-labelledby="styleFoldNameFonts"><span><span id="styleFoldNameFonts">Fonts</span><span class="style-fold-who">Typeface, size and weight for every label in this diagram.</span></span></summary>
                  <div class="style-fold-body">""")

# ------------------------------------------------- fold 5: reusable styles --
rep(
    """                <div class="style-subsection">
                  <div class="style-subsection-head">
                    <div><strong>Block styling</strong>""",
    """                  </div>
                </details>

                <details class="style-fold" id="styleFoldBlocks">
                  <summary aria-labelledby="styleFoldNameBlocks"><span><span id="styleFoldNameBlocks">Reusable block styles</span><span class="style-fold-who">To style one block, click it in the preview. This is for a look you want to use again: style classes and a saved house style.</span></span></summary>
                  <div class="style-fold-body">
                <div class="style-subsection">
                  <div class="style-subsection-head">
                    <div><strong>Block styling</strong>""")

# ------------------------------------------------- fold 6: legend -----------
rep(
    """                <div class="legend-builder">""",
    """                  </div>
                </details>

                <details class="style-fold" id="styleFoldLegend">
                  <summary aria-labelledby="styleFoldNameLegend"><span><span id="styleFoldNameLegend">Legend</span><span class="style-fold-who">A key beside the diagram. Off unless you turn it on; it is included in SVG, PNG and PDF exports.</span></span></summary>
                  <div class="style-fold-body">
                <div class="legend-builder">""")

rep(
    """                  <p class="legend-preview-note">Tick only the rows you want to show. Legend changes are rendered live.</p>
                </div>
              </div>""",
    """                  <p class="legend-preview-note">Tick only the rows you want to show. Legend changes are rendered live.</p>
                </div>
                  </div>
                </details>
              </div>""")

# ------------------------------------------------- the preview-head button --
rep(
    """title="Open the diagram's style and layout settings: title, fonts, spacing, block styling, legend\"""",
    """title="How this diagram looks: title, fonts, spacing, colours and the legend\"""")

# --- ...and it must never land on a card with nothing to touch --------------
rep(
    """          cardEl.open = true;
          // Instant, not smooth: smooth scrolling never completes in a tab the""",
    """          cardEl.open = true;
          // Six shut doors and no control is not an answer: if the user closed every
          // fold, reopen the first one so this button always arrives somewhere.
          const folds = Array.from(cardEl.querySelectorAll('.style-fold'));
          if (folds.length && !folds.some(fold => fold.open)) folds[0].open = true;
          // Instant, not smooth: smooth scrolling never completes in a tab the""")

# ------------------------------------------------- JS: reach into a fold ----
rep(
    """      function openSelectedNodeInSidebar() {""",
    """      // A field inside a closed <details> cannot take focus, and the Style card now
      // keeps its rarer parts in folds. Open every fold above a control before sending
      // anyone to it, otherwise the app scrolls to a closed door.
      function revealStyleControl(node) {
        let fold = node instanceof Element ? node.closest('details') : null;
        while (fold) {
          fold.open = true;
          fold = fold.parentElement ? fold.parentElement.closest('details') : null;
        }
      }

      function openSelectedNodeInSidebar() {""")

rep(
    """        el.settingsSection.open = true;
        el.settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => el.nodeStyleTarget.focus(), 250);""",
    """        el.settingsSection.open = true;
        revealStyleControl(el.nodeStyleTarget);
        // Land on the control, not on the top of the card. Instant, not smooth: smooth
        // scrolling never finishes in a tab the compositor has parked.
        el.nodeStyleTarget.scrollIntoView({ block: 'center' });
        setTimeout(() => el.nodeStyleTarget.focus(), 250);""")

# --- building a legend from classes must show the legend it just built ------
rep(
    """        renderDiagram({ reason: 'Legend built from classes', saveVersion: false });""",
    """        revealStyleControl(el.legendItems);
        el.legendItems.scrollIntoView({ block: 'center' });
        renderDiagram({ reason: 'Legend built from classes', saveVersion: false });""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('patch_b_style applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
