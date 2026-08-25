#!/usr/bin/env python3
"""What the design critique of the presenter view changed.

Four findings were acted on:

  1. THE ROOM'S BLACK SCREEN WAS INVISIBLE ON THE PRESENTER'S OWN SCREEN.
     B blanks the projector; the presenter view carried on showing the slide the
     room could no longer see. The second screen now says "The room sees black"
     in place of the picture, in the same plate the end-of-deck message uses, and
     the blank is announced the moment the key is pressed.

  2. "NEXT" WAS A PICTURE OF NOTHING.
     The next-step preview was drawn at whole-diagram scale, so the block the walk
     is heading for came out about six pixels tall in a 700px panel. It is now
     framed with the very camera box the presentation is about to fly to, plus a
     little air, so what the presenter reads is what the room is about to see.

  3. AN EMPTY NOTES BOX THE SIZE OF A SLIDE.
     With nothing written for a stop, 45% of the window was an empty panel saying
     so. The panel now shrinks to a line when it has nothing to say and gives its
     height back to the two frames.

  4. AN UNLABELLED 26px CLOCK.
     It reads "elapsed" now. Presenters ask "since when?" exactly once - in front
     of the room.

Usage:  python fix_present_critique.py <path-to-SIREN.html>

Anchor-guarded, atomic, and refused on a file that already carries the changes.
"""

import io
import os
import sys
import tempfile

EDITS = [
    (
        "presenter CSS: quiet notes, loud blank",
        "        + '.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}'\n",
        "        + '.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}'\n"
        "        + '.pv-clock-cap{margin-left:2px}'\n"
        "        + '#pvRoot.is-noteless{grid-template-rows:auto minmax(0,1fr) auto auto}'\n"
        "        + '#pvRoot.is-noteless .pv-notes-body{padding:9px 14px;font-size:15px}'\n"
        "        + '#pvRoot.is-blanked .pv-pane.is-now .pv-frame{border-color:#f2c94c;background:#0a0d11}'\n"
        "        + '#pvRoot.is-blanked .pv-pane.is-now .pv-cap{color:#f2c94c}'\n"
        "        + '#pvRoot.is-blanked .pv-pane.is-now .pv-plate strong{color:#f2c94c}'\n",
    ),
    (
        "presenter head: the clock says what it counts",
        '<span class="pv-clock" id="pvClock">00:00</span>',
        '<span class="pv-cap pv-clock-cap">elapsed</span>'
        '<span class="pv-clock" id="pvClock">00:00</span>',
    ),
    (
        "next preview: framed the way the camera will frame it",
        """          if (presentFullViewBox) {
            clone.setAttribute('viewBox', presentFullViewBox.x + ' ' + presentFullViewBox.y
              + ' ' + presentFullViewBox.width + ' ' + presentFullViewBox.height);
          }""",
        """          // What Next will actually put in front of the room: the same camera
          // box the presentation is about to fly to, not the whole diagram. A whole
          // diagram in a 700px panel is a picture of nothing - the block the walk is
          // heading for comes out about six pixels tall. A little air is left around
          // the box so the ring is not cut by the frame.
          const focusBox = entry && typeof presentationFocusBox === 'function'
            ? presentationFocusBox(entry) : null;
          const previewBox = focusBox && focusBox.width && focusBox.height ? focusBox : presentFullViewBox;
          if (previewBox && previewBox.width && previewBox.height) {
            const previewWidth = previewBox.width * 1.12;
            const previewHeight = previewBox.height * 1.12;
            clone.setAttribute('viewBox',
              (previewBox.x - (previewWidth - previewBox.width) / 2) + ' '
              + (previewBox.y - (previewHeight - previewBox.height) / 2) + ' '
              + previewWidth + ' ' + previewHeight);
          }""",
    ),
    (
        "notes panel: gives its height back when it has nothing to say",
        "        notesBody.classList.toggle('is-empty', !notes.trim());",
        """        notesBody.classList.toggle('is-empty', !notes.trim());
        // An empty notes box the size of a slide tells the presenter the notes
        // matter more than the pictures. With nothing written, it shrinks to a
        // line and hands its height to the two frames.
        const pvRoot = q('pvRoot');
        if (pvRoot) pvRoot.classList.toggle('is-noteless', !notes.trim());""",
    ),
    (
        "presenter view says when the room is blanked",
        "        presenterSetPicture(q('pvNowFrame'), nowSvg, 'Nothing on stage', "
        "'The presentation has not put a picture up yet.');",
        """        // B and W take the slide away from the room. The presenter's own screen
        // has to say so, or the second screen quietly lies - it keeps showing the
        // slide the room can no longer see, and the talk carries on into a black
        // projector.
        const blankedTone = typeof presentBlankTone === 'string' ? presentBlankTone : '';
        const blankRoot = q('pvRoot');
        if (blankRoot) blankRoot.classList.toggle('is-blanked', Boolean(blankedTone));
        if (blankedTone) {
          presenterSetPicture(q('pvNowFrame'), '', 'The room sees ' + blankedTone,
            'The screen is blanked. Any key, or a click on the presentation, brings this slide back.');
          return;
        }
        presenterSetPicture(q('pvNowFrame'), nowSvg, 'Nothing on stage', """
        """'The presentation has not put a picture up yet.');""",
    ),
    (
        "the presenter window must not walk the deck while the room is black",
        """      function presenterAdvance(delta) {
        if (!el.presentOverlay || el.presentOverlay.hidden) return;""",
        """      function presenterAdvance(delta) {
        if (!el.presentOverlay || el.presentOverlay.hidden) return;
        // The room is looking at a black screen. The presentation's own keyboard
        // already treats the next press as 'bring the slide back'; the second
        // screen has to follow the same rule, or Next from here walks the deck
        // where nobody can see it - and the blank layer's own promise, "any key
        // or a click brings it back", stops being true.
        if (presentBlankTone) { setPresentationBlank(''); return; }""",
    ),
    (
        "blank on: tell the second screen at once",
        "        setPresentationAudienceBlank(next);",
        "        setPresentationAudienceBlank(next);\n"
        "        schedulePresenterRefresh();",
    ),
    (
        "blank off: tell the second screen at once",
        "          setPresentationAudienceBlank('');",
        "          setPresentationAudienceBlank('');\n"
        "          schedulePresenterRefresh();",
    ),
]

ALREADY = "is-blanked"


def main():
    if len(sys.argv) != 2:
        print("usage: python fix_present_critique.py <path-to-SIREN.html>", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    if not os.path.isfile(target):
        print("ABORT: no such file: %s" % target, file=sys.stderr)
        return 2

    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        original = handle.read()

    if ALREADY in original:
        print("ABORT: this file already carries the critique changes.", file=sys.stderr)
        return 3

    problems = []
    for name, anchor, _new in EDITS:
        found = original.count(anchor)
        if found != 1:
            problems.append("  %-52s expected 1, found %d" % (name, found))
    if problems:
        print("ABORT: anchor drift; nothing written.", file=sys.stderr)
        for line in problems:
            print(line, file=sys.stderr)
        return 4

    text = original
    for name, anchor, new in EDITS:
        text = text.replace(anchor, new, 1)

    directory = os.path.dirname(target) or "."
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", dir=directory,
                                         delete=False, prefix=".siren_critique_", suffix=".tmp")
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        try:
            handle.close()
        except Exception:
            pass
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print("OK - critique changes installed into %s" % target)
    print("     %d edits, %d -> %d characters" % (len(EDITS), len(original), len(text)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
