#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIREN — the four defects that only exist once the wave-1 patches sit together.

Each of these was measured in the integrated build with real clicks and real keys; none
of them is visible in any single implementer's patch on its own.

  1. The ⋯ overflow menu is 14 items tall inside a 320px scroll box, so all three
     "Decisions · …" rows sit below a fold with no scrollbar. Folding the bar's long tail
     into a menu is only a win if the menu shows what it swallowed.
  2. Map tile thumbnails are the editor's own SVG, so every block arrives carrying the
     editor's tabindex and an "Edit …" name. Tab on the Map walked forty authoring stops
     before reaching a single tile's Present button — which is exactly what the new
     keyboard card promises it does not do.
  3. renderPresentationBranchChoices() reads the checkpoint card's hidden flag, and runs
     one line before the call that sets it. On a decision block that also carries a
     checkpoint the stage carried both prompts at once.
  4. The Map hint is permanent now (it used to erase itself after 5.2s), and it is pinned
     to the top centre — directly over the title of whichever tile the camera has framed.

Usage:  python fix_wave1_integration.py <path-to-app.html>
Every replacement asserts its occurrence count before it runs. The write is atomic.
"""

import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# ---------------------------------------------------------------------------
# 1. The overflow menu has to be able to show what the bar handed it
# ---------------------------------------------------------------------------

edit(
    "menu: a settings menu that scrolls its own last three rows out of sight is not a menu",
    """      max-height: 320px;
      overflow: auto;
      padding: 5px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--panel-elevated);""",
    """      /* The Present ⋯ menu is fourteen rows. At a fixed 320px the last three - every
         Decisions option - fell below a fold with no scrollbar to announce it. Long
         lists still scroll; a settings menu now simply fits. */
      max-height: min(72vh, 560px);
      overflow: auto;
      padding: 5px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--panel-elevated);""",
)


# ---------------------------------------------------------------------------
# 2. A tile thumbnail is a picture, not a second copy of the editor
# ---------------------------------------------------------------------------

edit(
    "map tile: the thumbnail leaves the tab order, so Tab reaches the tile's own button",
    """        tile.host.dataset.detail = 'near';
        tile.body.innerHTML = svg;
        const mounted = tile.body.querySelector('svg');
        if (mounted) {
          mounted.removeAttribute('width');
          mounted.removeAttribute('height');
          mounted.style.width = '100%';
          mounted.style.height = '100%';
        }""",
    """        tile.host.dataset.detail = 'near';
        tile.body.innerHTML = svg;
        const mounted = tile.body.querySelector('svg');
        if (mounted) {
          mounted.removeAttribute('width');
          mounted.removeAttribute('height');
          mounted.style.width = '100%';
          mounted.style.height = '100%';
          // The thumbnail is the editor's SVG, so every block arrives carrying the editor's
          // tabindex and an 'Edit ...' name. On the Map that is forty authoring stops in
          // front of the one control the tile actually offers. Clicking a block still works:
          // the tile's own click handler reads .node from the event target.
          mounted.querySelectorAll('[tabindex]').forEach(node => {
            node.removeAttribute('tabindex');
            node.removeAttribute('role');
            node.removeAttribute('aria-label');
          });
        }""",
)


# ---------------------------------------------------------------------------
# 3. One prompt on the stage at a time
# ---------------------------------------------------------------------------

edit(
    "checkpoint: the chooser's guard has to run after the flag it reads is set",
    """        } else {
          presentCheckpointResumeAutoplay = false;
        }
        updatePresentationControls();
      }

      function continuePresentationCheckpoint() {""",
    """        } else {
          presentCheckpointResumeAutoplay = false;
        }
        // The chooser hides itself while a checkpoint is up, but it renders one call
        // before this one - so on a decision block that also carries a checkpoint the
        // stage showed the audience two questions at once.
        renderPresentationBranchChoices();
        updatePresentationControls();
      }

      function continuePresentationCheckpoint() {""",
)

edit(
    "checkpoint: acknowledging it hands the stage to the decision behind it",
    """        checkpointAcknowledgedKey = currentCheckpointKey();
        el.presentCheckpointCard.hidden = true;
        const resume = presentCheckpointResumeAutoplay;
        presentCheckpointResumeAutoplay = false;
        updatePresentationControls();
        if (resume && presentAutoplay) schedulePresentationAutoplay();
        el.presentNextButton.focus();""",
    """        checkpointAcknowledgedKey = currentCheckpointKey();
        el.presentCheckpointCard.hidden = true;
        const resume = presentCheckpointResumeAutoplay;
        presentCheckpointResumeAutoplay = false;
        // The decision this checkpoint was standing in front of is the next thing to answer.
        renderPresentationBranchChoices();
        updatePresentationControls();
        if (resume && presentAutoplay) schedulePresentationAutoplay();
        // Next is disabled while a branch is pending, so focus goes where the answer is.
        const branch = el.presentDecisionPrompt && !el.presentDecisionPrompt.hidden
          ? el.presentDecisionChoices.querySelector('button')
          : null;
        (branch || el.presentNextButton).focus();""",
)


# ---------------------------------------------------------------------------
# 4. The permanent hint stops sitting on the framed tile's title
# ---------------------------------------------------------------------------

edit(
    "map hint: it rests with the rest of the presenter chrome, not across a tile title",
    """    .map-hint {
      position: absolute;
      left: 50%;
      top: 26px;
      transform: translateX(-50%);""",
    """    .map-hint {
      position: absolute;
      left: 50%;
      /* It used to erase itself after 5.2s; now that it rests there permanently, the top
         centre is squarely across the title of whichever tile the camera has framed.
         It joins the map bar instead - one band of presenter chrome, clear of the plane.
         160px = the bar's own 104px offset plus its height. */
      bottom: 160px;
      transform: translateX(-50%);""",
)


# ---------------------------------------------------------------------------
# 5-7. Acting on the design critique of the reworked Present surface
# ---------------------------------------------------------------------------

edit(
    "critique: the audience-facing tile title was the smallest type on an audience screen",
    """      font-size: clamp(34px, calc(16px / var(--map-scale, 1)), 150px);""",
    """      /* 16px screen was the fix for 5px, but on a projector it still left the only
         audience-facing text on the Whole-map view smaller than the presenter's own chrome.
         22px is the smallest size a name reads at from the back of a partner meeting room. */
      font-size: clamp(34px, calc(22px / var(--map-scale, 1)), 150px);""",
)

edit(
    "critique: the one control that says a tile can be opened should not be half-lit",
    """      /* Legible at rest: the only thing that said a tile could be opened used to be a
         hover state, which a client watching a screen never sees. */
      opacity: .62;""",
    """      /* Legible at rest: the only thing that said a tile could be opened used to be a
         hover state, which a client watching a screen never sees. At .62 over the tile it
         still read as disabled from across a room, so it rests near full strength and keeps
         hover for the difference. */
      opacity: .84;""",
)

edit(
    "critique: the ? on the Map bar was a 27px target between two 32px ones",
    """<button class="btn ghost compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>""",
    """<button class="btn ghost icon compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>""",
)

edit(
    "critique: the Present pill was floating in the title strip and clipping the name",
    """    .map-tile-open {
      position: absolute;
      right: 26px;
      top: 22px;""",
    """    .map-tile-open {
      position: absolute;
      right: 26px;
      /* It sat in the title strip, so at whole-map zoom every diagram name ran under it
         ("AP invoice a[Present]"). The name is the thing the audience reads; the pill is
         the thing the presenter clicks. They get a corner each. */
      bottom: 22px;""",
)



def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    if len(sys.argv) < 2:
        print('usage: python fix_wave1_integration.py <path-to-app.html>', file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    with io.open(target, 'r', encoding='utf-8', newline='') as handle:
        text = handle.read()

    for name, old, new, count in EDITS:
        found = text.count(old)
        if found != count:
            print('ABORT [%s]: expected %d occurrence(s) of the anchor, found %d. Nothing written.'
                  % (name, count, found), file=sys.stderr)
            return 1
        text = text.replace(old, new, count)
        print('ok  %s' % name)

    directory = os.path.dirname(target) or '.'
    handle = tempfile.NamedTemporaryFile('w', encoding='utf-8', newline='', dir=directory,
                                         prefix='.siren-wave1-', suffix='.tmp', delete=False)
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        handle.close()
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise
    print('wrote %s (%d edits)' % (target, len(EDITS)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
