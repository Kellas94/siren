"""A changelog section in the Guide.

Short bullets per version, newest first, starting at the current one - the history
before it is not reconstructed and is not claimed. The list is data, so adding a
version later is one entry rather than markup surgery, and it collapses so the
Guide's own contents are not pushed down by a list that only grows.
"""
import io, os, re, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'

s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:80])
    s = s.replace(anchor, new)


# ---------------------------------------------------------------- the data
CHANGELOG = """      /* Newest first. Keep each line to one plain sentence about what changed for
         the person using it - not the mechanism. History before 1.44.0 is not
         reconstructed, so the list starts there and grows forward. */
      const CHANGELOG = [
        {
          version: '1.44.0',
          notes: [
            'Slides exported from a presentation now fill the page instead of sitting in a narrow strip, and carry the stop\\u2019s title.',
            'A presentation now exports the walkthrough itself, one slide per step, with the presenter\\u2019s note on each.',
            'Clicking a block on the map to frame it works, and the framed block is marked on the exported slide.',
            'The presenter view shows the current slide large and the next one beside it.',
            'The slide count under the strip, the menu and the exported file now agree.',
            'Escape no longer leaves a menu on screen that could still edit the deck.',
            'Removing a diagram removes its slide from the presentation.',
            'A new theme, Shinkansen, joins the Japan collection.'
          ]
        }
      ];
"""

anchor_js = "      const THEME_INTRO_STYLES = {"
rep(anchor_js, CHANGELOG + "\n" + anchor_js)

# ---------------------------------------------------------------- the renderer
RENDER = """      function renderChangelog() {
        if (!el.guideChangelog) return;
        el.guideChangelog.replaceChildren();
        CHANGELOG.forEach((release, index) => {
          const block = document.createElement('div');
          block.className = 'guide-release';
          const head = document.createElement('h4');
          head.textContent = 'Version ' + release.version;
          if (index === 0) {
            const now = document.createElement('span');
            now.className = 'guide-release-now';
            now.textContent = 'this version';
            head.appendChild(now);
          }
          block.appendChild(head);
          const list = document.createElement('ul');
          release.notes.forEach(note => {
            const item = document.createElement('li');
            item.textContent = note;
            list.appendChild(item);
          });
          block.appendChild(list);
          el.guideChangelog.appendChild(block);
        });
      }

"""
anchor_fn = "      function renderDiagramTabs() {"
rep(anchor_fn, RENDER + anchor_fn)

# call it when the guide opens
open_anchor = """        if (el.guideButton) el.guideButton.addEventListener('click', () => {"""
if s.count(open_anchor) == 1:
    rep(open_anchor, open_anchor + "\n          renderChangelog();")
else:
    # fall back to rendering once at startup
    boot = "        renderDiagramTabs();"
    assert s.count(boot) >= 1
    s = s.replace(boot, "        renderChangelog();\n" + boot, 1)

# ---------------------------------------------------------------- the markup
MARKUP = """        <section class="guide-section">
          <h3>What changed</h3>
          <details class="guide-changelog-wrap">
            <summary>Recent versions</summary>
            <div class="guide-changelog" id="guideChangelog"></div>
          </details>
        </section>
"""
tail = """      </div>
      <div class="dialog-footer">
        <div class="dialog-actions">
          <!-- People open a guide to read it; the tour is an explicit choice
               here instead of the first thing Enter hits in the header. -->
          <button class="btn ghost" id="startTourButton" type="button" title="Replay the welcome tour">Start the tour</button>"""
rep(tail, MARKUP + tail)

rep("'guideDialog','closeGuideDialog'", "'guideDialog','guideChangelog','closeGuideDialog'")

# ---------------------------------------------------------------- the styles
CSS = """    .guide-changelog-wrap > summary {
      cursor: pointer;
      font-size: 12.5px;
      color: var(--muted);
      padding: 4px 0;
    }
    .guide-changelog-wrap > summary:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    .guide-changelog { display: grid; gap: 14px; margin-top: 8px; }
    .guide-release > h4 {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 0 0 6px;
      font-size: 12px;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .guide-release-now {
      font-size: 10.5px;
      letter-spacing: .04em;
      text-transform: none;
      color: var(--pill-text);
      background: var(--pill-bg);
      border-radius: 999px;
      padding: 1px 8px;
    }
    .guide-release ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; }
    .guide-release li { color: var(--text); font-size: 12.5px; line-height: 1.45; }
"""
css_anchor = "    .guide-section { margin-top: 18px; }"
rep(css_anchor, CSS + css_anchor)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_changelog.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('changelog installed: %d -> %d chars' % (len(orig), len(s)))
