#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_present_settings.py - rebuild the Present ... menu.

    python fix_present_settings.py <path-to-T_Industries_SIREN_v1.html>

WHAT IT DOES
    The Present bar's ... menu was one flat list of sixteen rows that mixed two
    different kinds of thing: six ACTIONS ("Show the whole diagram", "Start
    auto-play", "Open the presenter view", "Open the audience screen", "Export
    the deck as slides") and three PERSISTENT SETTINGS - camera framing, motion
    and decisions - flattened into the same list as ten more rows. Every option
    of those three wore a " . in use" suffix, which exists only because an action
    list has no way to draw radio state.

    After this patch:
      * the ... menu is ACTIONS only - seven rows, all verbs, no state suffixes;
      * the three settings live in ONE new Studio panel, "Camera, motion &
        decisions", as three real radiogroups on the same segmented control the
        card editor already uses, each with a plain sentence underneath saying
        what the current choice does;
      * the last ... row, "Camera, motion & decisions...", opens that panel
        (uncollapsing the Studio rail if needed) rather than repeating it.

    Nothing about persistence changes: the stashed <select>s in the Present bar
    are still the model, the segments write to them and dispatch their own change
    event, and diagram.presentation.cameraMode / .transition / .decisionMode are
    still where the values land.

    The resting Present bar is untouched: still seven controls on one row.

    Anchor-guarded, atomic, and aborts WITHOUT WRITING on any drift.
"""

import io
import os
import sys
import tempfile

MIDDOT = u"·"
GEAR = u"⚙"
ELLIPSIS = u"…"
DASH = u"—"
DOTS = u"⋯"

# --------------------------------------------------------------------------- #
# every edit is (name, needle, replacement, expected occurrences)
# --------------------------------------------------------------------------- #

CSS_ANCHOR = u"""    .present-tool-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
"""

CSS_NEW = CSS_ANCHOR + u"""    /* Camera framing, motion and decisions were three radio groups flattened into
       the Present """ + DOTS + u""" menu, each option carrying a ' """ + MIDDOT + u""" in use' suffix because an
       action list cannot draw radio state. They are settings, so they sit in the
       Studio on the same segmented control the card editor already uses - laid out
       as a grid rather than an inline pill, because the Studio rail is narrower
       than a dialog and a four-option row has to fit inside it. */
    .present-settings { display: grid; gap: 12px; }
    .present-setting { display: grid; gap: 5px; }
    .present-setting-label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.015em;
    }
    .present-setting-hint { margin: 0; color: var(--subtle); font-size: 10px; line-height: 1.45; }
    .present-seg {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 3px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel-alt);
    }
    .present-seg-button {
      min-height: 26px;
      padding: 4px 5px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
    }
    .present-seg-button:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); color: var(--text); }
    .present-seg-button.is-on { background: var(--primary); color: var(--primary-text); }
    /* Hovering the chosen segment goes DARKER than its resting fill: a pointer must
       never lighten a filled accent. */
    .present-seg-button.is-on:hover { background: color-mix(in srgb, var(--primary) 76%, #000); color: var(--primary-text); }
    .present-seg-button:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    /* The """ + DOTS + u""" menu's last row is a door, not a copy. When it opens the panel the
       panel says so, once, instead of leaving the presenter hunting the rail. */
    .present-settings-flash { animation: presentSettingsFlash 1.6s ease 1; }
    @keyframes presentSettingsFlash {
      0%, 100% { box-shadow: var(--shadow-soft); }
      12%, 60% { box-shadow: 0 0 0 2px var(--primary), var(--shadow-soft); }
    }
"""

HTML_ANCHOR = u"""          <details class="present-panel" open>
            <summary>Current step</summary>
            <div class="present-panel-body">
              <div class="present-breadcrumb" id="presentBreadcrumb">Overview</div>
            </div>
          </details>
"""

HTML_NEW = HTML_ANCHOR + u"""
          <!-- One home for the three walkthrough settings. They were ten rows of the
               Present """ + DOTS + u""" menu, where you could not see the configuration without
               opening it and every change cost a full menu round trip. The stashed
               <select>s in the bar above are still the model - these buttons write to
               them and the app's own change handlers do the rest - so there is exactly
               one place each value is kept and exactly one place it is shown. -->
          <details class="present-panel" id="presentPlaybackPanel" open>
            <summary>Camera, motion &amp; decisions</summary>
            <div class="present-panel-body">
              <div class="present-settings" id="presentPlaybackSettings">
                <div class="present-setting">
                  <span class="present-setting-label" id="presentCameraLabel">Camera framing</span>
                  <div class="present-seg" role="radiogroup" aria-labelledby="presentCameraLabel" data-setting="camera">
                    <button class="present-seg-button" type="button" role="radio" aria-checked="true" data-value="block">Block</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="path">Path</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="context">Context</button>
                  </div>
                  <p class="present-setting-hint" id="presentCameraHint"></p>
                </div>
                <div class="present-setting">
                  <span class="present-setting-label" id="presentMotionLabel">Motion</span>
                  <div class="present-seg" role="radiogroup" aria-labelledby="presentMotionLabel" data-setting="motion">
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="instant">Instant</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="fast">Fast</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="true" data-value="smooth">Smooth</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="cinematic">Cinematic</button>
                  </div>
                  <p class="present-setting-hint" id="presentMotionHint"></p>
                </div>
                <div class="present-setting">
                  <span class="present-setting-label" id="presentDecisionLabel">Decisions</span>
                  <div class="present-seg" role="radiogroup" aria-labelledby="presentDecisionLabel" data-setting="decision">
                    <button class="present-seg-button" type="button" role="radio" aria-checked="true" data-value="ask">Ask me</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="continue">Follow</button>
                    <button class="present-seg-button" type="button" role="radio" aria-checked="false" data-value="saved">Scenario</button>
                  </div>
                  <p class="present-setting-hint" id="presentDecisionHint"></p>
                </div>
              </div>
            </div>
          </details>
"""

TITLE_ANCHOR = (u'<button class="btn ghost compact" id="presentMoreButton" type="button" '
                u'aria-haspopup="listbox" title="Camera, motion, decisions, auto-play and the audience screen">'
                + DOTS + u'</button>')
TITLE_NEW = (u'<button class="btn ghost compact" id="presentMoreButton" type="button" '
             u'aria-haspopup="listbox" title="Auto-play, the presenter and audience screens, the slide export, '
             u'and the way the walkthrough plays">' + DOTS + u'</button>')

EL_ANCHOR = u"'presentAutoplaySeconds','presentAutoplayLoop','presentToolSelect'"
EL_NEW = (u"'presentAutoplaySeconds','presentAutoplayLoop',"
          u"'presentPlaybackPanel','presentPlaybackSettings',"
          u"'presentCameraHint','presentMotionHint','presentDecisionHint',"
          u"'presentToolSelect'")

BIND_ANCHOR = u"""        el.presentDecisionMode.addEventListener('change', handlePresentationDecisionModeChange);
"""

BIND_NEW = BIND_ANCHOR + u"""        // Whoever moves the value - a segment, a restored diagram, a future control -
        // the Studio's picture of it is redrawn from the select itself, so there is
        // never a second copy of the state to keep in step.
        [el.presentCameraMode, el.presentTransition, el.presentDecisionMode]
          .forEach(select => { if (select) select.addEventListener('change', syncPresentationSettings); });
        if (el.presentPlaybackSettings) {
          el.presentPlaybackSettings.addEventListener('click', event => {
            const button = event.target instanceof Element ? event.target.closest('.present-seg-button') : null;
            const rail = button && button.closest('.present-seg');
            if (!rail) return;
            setPresentationSetting(rail.dataset.setting, button.dataset.value);
            button.focus();
          });
          el.presentPlaybackSettings.addEventListener('keydown', handlePresentationSettingKeydown);
        }
"""

LOAD_ANCHOR = u"""        if (el.presentDecisionMode) el.presentDecisionMode.value = presentDecisionMode;
        el.presentAutoplaySeconds.value = String(presentation.autoplaySeconds);
"""

LOAD_NEW = u"""        if (el.presentDecisionMode) el.presentDecisionMode.value = presentDecisionMode;
        // Assigning .value fires no change event, so the Studio is redrawn by hand
        // here - this is the path a reload comes back on.
        syncPresentationSettings();
        el.presentAutoplaySeconds.value = String(presentation.autoplaySeconds);
"""

KEY_ANCHOR = u"""        if (target instanceof Element && target.closest('#presentSequenceList')) return;
"""

KEY_NEW = KEY_ANCHOR + u"""        // A segmented setting is a radiogroup: the arrows move inside the group and
        // Home/End reach its ends. Same bargain as the step list above - the
        // presentation does not steal the keys of a control that has focus.
        if (target instanceof Element && target.closest('.present-seg')) return;
"""

FUNCS_ANCHOR = u"""      /* The bar carried fourteen controls and never fitted on one row. Everything that is not
         a live presenting verb lives here instead - one press away, with a full text label in
         place of three 11px selects that faced the audience saying 'Smooth'. The controls
         themselves are still the real ones, so this menu only reads and clicks them. */
"""

FUNCS_NEW = u"""      /* --- camera framing, motion and decisions: one home, in the Studio ---
         The value lives on the stashed <select>; the segments only read and write it,
         exactly as the """ + DOTS + u""" menu used to. The sentence under each group is the honest
         replacement for the ' """ + MIDDOT + u""" in use' suffix a flat list had to wear. */
      const PRESENT_SETTING_GROUPS = [
        { key: 'camera', select: 'presentCameraMode', hint: 'presentCameraHint', options: [
          ['block', 'Block """ + DASH + u""" a close-up of the step you are on, and nothing else.'],
          ['path', 'Path """ + DASH + u""" also frames the block you came from and the arrow between them.'],
          ['context', 'Context """ + DASH + u""" also frames the blocks this step leads to.']
        ] },
        { key: 'motion', select: 'presentTransition', hint: 'presentMotionHint', options: [
          ['instant', 'Instant """ + DASH + u""" the camera cuts, with no travel at all.'],
          ['fast', 'Fast """ + DASH + u""" the camera travels in about 0.2 seconds.'],
          ['smooth', 'Smooth """ + DASH + u""" the camera travels in about 0.4 seconds.'],
          ['cinematic', 'Cinematic """ + DASH + u""" the camera travels in about 0.9 seconds.']
        ] },
        { key: 'decision', select: 'presentDecisionMode', hint: 'presentDecisionHint', options: [
          ['ask', 'Ask me """ + DASH + u""" at a block with more than one way out, the walkthrough stops and you pick the path.'],
          ['continue', 'Follow """ + DASH + u""" it carries on down the written sequence without asking.'],
          ['saved', 'Scenario """ + DASH + u""" it takes the path saved in the active scenario, and still asks where the scenario has none.']
        ] }
      ];

      function syncPresentationSettings() {
        if (!el.presentPlaybackSettings) return;
        PRESENT_SETTING_GROUPS.forEach(group => {
          const select = el[group.select];
          if (!select) return;
          const current = select.value;
          const rail = el.presentPlaybackSettings.querySelector('.present-seg[data-setting="' + group.key + '"]');
          if (rail) {
            Array.from(rail.querySelectorAll('.present-seg-button')).forEach(button => {
              const on = button.dataset.value === current;
              button.classList.toggle('is-on', on);
              button.setAttribute('aria-checked', String(on));
              // Roving tabindex: one Tab stop per group, arrows move inside it.
              button.tabIndex = on ? 0 : -1;
            });
          }
          const hint = el[group.hint];
          const chosen = group.options.find(option => option[0] === current);
          if (hint) hint.textContent = chosen ? chosen[1] : '';
        });
      }

      function setPresentationSetting(key, value) {
        const group = PRESENT_SETTING_GROUPS.find(item => item.key === key);
        const select = group && el[group.select];
        if (!select || select.value === value) { syncPresentationSettings(); return; }
        select.value = value;
        // The select stays the one model. Firing its own change event keeps a single
        // path into diagram.presentation, the camera and the save queue.
        select.dispatchEvent(new Event('change'));
        syncPresentationSettings();
      }

      function handlePresentationSettingKeydown(event) {
        const button = event.target instanceof Element ? event.target.closest('.present-seg-button') : null;
        const rail = button && button.closest('.present-seg');
        if (!rail) return;
        const buttons = Array.from(rail.querySelectorAll('.present-seg-button'));
        const index = buttons.indexOf(button);
        let next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        setPresentationSetting(rail.dataset.setting, buttons[next].dataset.value);
        buttons[next].focus();
      }

      /* The Studio is the home; the """ + DOTS + u""" menu only points at it. A collapsed rail, a
         closed panel and a rail scrolled past are all opened before the first control
         takes focus, so that row can never land the presenter somewhere blank. */
      function openPresentationSettings() {
        if (el.presentBody.classList.contains('sidebar-collapsed')) togglePresentationSidebar();
        const panel = el.presentPlaybackPanel;
        if (!panel) return;
        panel.open = true;
        syncPresentationSettings();
        requestAnimationFrame(() => {
          panel.scrollIntoView({ block: 'nearest' });
          panel.classList.remove('present-settings-flash');
          void panel.offsetWidth;
          panel.classList.add('present-settings-flash');
          const target = panel.querySelector('.present-seg-button.is-on') || panel.querySelector('.present-seg-button');
          if (target) target.focus();
        });
      }

      /* The bar carried fourteen controls and never fitted on one row. Everything that is not
         a live presenting verb lives here instead - one press away, with a full text label in
         place of three 11px selects that faced the audience saying 'Smooth'. The controls
         themselves are still the real ones, so this menu only reads and clicks them.
         It then carried the settings too: three radio groups flattened into the same list,
         sixteen rows deep, every option wearing a ' """ + MIDDOT + u""" in use' suffix to fake the radio
         state a list cannot draw. Those went to the Studio, where the whole configuration
         reads at a glance. What is left here is verbs. */
"""

INUSE_ANCHOR = (u"        const inUse = (select, value) => (select.value === value ? ' "
                + MIDDOT + u" in use' : '');\n"
                u"        const blocked = button => (button.disabled ? ' "
                + MIDDOT + u" needs a rendered diagram' : '');\n")

INUSE_NEW = (u"        const blocked = button => (button.disabled ? ' "
             + MIDDOT + u" needs a rendered diagram' : '');\n")

ROWS_ANCHOR = (u"""              : 'The deck is the route on the Map. Present the whole workspace to build one.'],
          ['camera:block', 'Camera framing """ + MIDDOT + u""" Block' + inUse(el.presentCameraMode, 'block')],
          ['camera:path', 'Camera framing """ + MIDDOT + u""" Path' + inUse(el.presentCameraMode, 'path')],
          ['camera:context', 'Camera framing """ + MIDDOT + u""" Context' + inUse(el.presentCameraMode, 'context')],
          ['motion:instant', 'Motion """ + MIDDOT + u""" Instant' + inUse(el.presentTransition, 'instant')],
          ['motion:fast', 'Motion """ + MIDDOT + u""" Fast' + inUse(el.presentTransition, 'fast')],
          ['motion:smooth', 'Motion """ + MIDDOT + u""" Smooth' + inUse(el.presentTransition, 'smooth')],
          ['motion:cinematic', 'Motion """ + MIDDOT + u""" Cinematic' + inUse(el.presentTransition, 'cinematic')],
          ['decision:ask', 'Decisions """ + MIDDOT + u""" Ask me which path' + inUse(el.presentDecisionMode, 'ask')],
          ['decision:continue', 'Decisions """ + MIDDOT + u""" Follow the sequence' + inUse(el.presentDecisionMode, 'continue')],
          ['decision:saved', 'Decisions """ + MIDDOT + u""" Use the saved scenario' + inUse(el.presentDecisionMode, 'saved')]
        ];
""")

SETTINGS_ROW = u"['settings', '" + GEAR + u" Camera, motion & decisions" + ELLIPSIS + u"']"

ROWS_NEW = (u"""              : 'The deck is the route on the Map. Present the whole workspace to build one.'],
          // The ten setting rows that used to sit here now live in one Studio panel,
          // where the whole configuration is visible without opening anything. This
          // row is the door to that home, not a second copy of it.
          """ + SETTINGS_ROW + u"""
        ];
""")

PICK_ANCHOR = u"""          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];
          if (select) {
            select.value = choice.split(':')[1];
            select.dispatchEvent(new Event('change'));
            return;
          }
"""

PICK_NEW = u"""          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }
          if (choice === 'settings') { openPresentationSettings(); return; }
"""

EDITS = [
    ('css: the segmented setting control', CSS_ANCHOR, CSS_NEW, 1),
    ('html: the Studio settings panel', HTML_ANCHOR, HTML_NEW, 1),
    ('html: the ... button tooltip', TITLE_ANCHOR, TITLE_NEW, 1),
    ('js: element registry', EL_ANCHOR, EL_NEW, 1),
    ('js: bindEvents wiring', BIND_ANCHOR, BIND_NEW, 1),
    ('js: redraw on diagram load', LOAD_ANCHOR, LOAD_NEW, 1),
    ('js: keyboard hand-off to the radiogroup', KEY_ANCHOR, KEY_NEW, 1),
    ('js: the settings controller', FUNCS_ANCHOR, FUNCS_NEW, 1),
    ('js: drop the " . in use" helper', INUSE_ANCHOR, INUSE_NEW, 1),
    ('js: ten setting rows become one door', ROWS_ANCHOR, ROWS_NEW, 1),
    ('js: the menu pick handler', PICK_ANCHOR, PICK_NEW, 1),
]


def main():
    if len(sys.argv) < 2:
        sys.stdout.write('usage: python fix_present_settings.py <target.html>\n')
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        sys.stdout.write('ABORT - no such file: ' + target + '\n')
        return 2

    with io.open(target, encoding='utf-8', newline='') as handle:
        text = handle.read()
    original_length = len(text)

    if 'presentPlaybackSettings' in text or 'PRESENT_SETTING_GROUPS' in text:
        sys.stdout.write('ABORT - this patch is already applied to ' + target + '. Nothing was written.\n')
        return 1

    # --- guard pass: every anchor must appear exactly as often as expected.
    # --- Nothing is written until all of them check out.
    problems = []
    for name, needle, replacement, expected in EDITS:
        found = text.count(needle)
        if found != expected:
            problems.append('%s: anchor found %d time(s), expected %d' % (name, found, expected))
    if problems:
        sys.stdout.write('ABORT - the file has drifted from the expected v1.36.0 shape.\n')
        for line in problems:
            sys.stdout.write('  - ' + line + '\n')
        sys.stdout.write('Nothing was written.\n')
        return 1

    for name, needle, replacement, expected in EDITS:
        text = text.replace(needle, replacement, expected)

    # --- sanity pass: the shapes this patch promises ---
    checks = [
        # The phrase survives only inside the two comments that explain why it left.
        ('the " . in use" suffix is gone from the UI', 'inUse(' not in text
            and (u"? ' " + MIDDOT + u" in use' : ''") not in text),
        ('no camera:/motion:/decision: menu rows remain',
            "'camera:block'" not in text and "'decision:saved'" not in text and "'motion:smooth'" not in text),
        ('the settings row exists', SETTINGS_ROW in text),
        ('the Studio panel exists', 'id="presentPlaybackSettings"' in text),
        ('the three selects are still the model',
            text.count('id="presentCameraMode"') == 1
            and text.count('id="presentTransition"') == 1
            and text.count('id="presentDecisionMode"') == 1),
        ('the resting Present bar still holds its seven controls',
            text.count('id="presentMapButton"') == 1 and text.count('id="presentPrevButton"') == 1
            and text.count('id="presentNextButton"') == 1 and text.count('id="presentMoreButton"') == 1
            and text.count('id="presentSidebarToggle"') == 1 and text.count('id="presentDimButton"') == 1
            and text.count('id="presentExitButton"') == 1),
        ('the file grew', len(text) > original_length),
    ]
    failed = [name for name, ok in checks if not ok]
    if failed:
        sys.stdout.write('ABORT - post-patch sanity failed. Nothing was written.\n')
        for name in failed:
            sys.stdout.write('  - ' + name + '\n')
        return 1

    directory = os.path.dirname(os.path.abspath(target)) or '.'
    handle, temporary = tempfile.mkstemp(dir=directory, suffix='.tmp')
    os.close(handle)
    try:
        with io.open(temporary, 'w', encoding='utf-8', newline='') as out:
            out.write(text)
        os.replace(temporary, target)
    except Exception:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise

    sys.stdout.write('PATCHED ' + target + '\n')
    for name, needle, replacement, expected in EDITS:
        sys.stdout.write('  applied - ' + name + '\n')
    sys.stdout.write('  %d -> %d characters\n' % (original_length, len(text)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
