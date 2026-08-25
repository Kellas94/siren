# -*- coding: utf-8 -*-
"""
FIX 1 - Presenter view: NOW is the dominant frame, NEXT the supporting one.

The presenter display is a same-origin popup built from PRESENTER_WINDOW_HTML
(document.write, real addEventListener handlers, no inline script). Its two
frames sit in one grid row:

    .pv-panes{grid-template-columns:minmax(0,.6fr) minmax(0,1fr)}
                                    ^ NOW (col 1)   ^ NEXT (col 2)

At the popup's own 1180x780 that resolved to NOW 424px and NEXT 708px - the
slide the room is actually looking at rendered as the smaller of the two.
Nothing else caused the difference: both frames take the same
`width:100%;height:100%;object-fit:contain` <img>, so the split is purely
these two fr values and swapping them cannot distort either picture.

WHAT THIS CHANGES (three edits, all inside the presenter-view block):

  1. The column split is reversed - NOW 1fr, NEXT .6fr. That is the plain
     swap rather than a bigger number for NOW, and deliberately so: the pane
     row is ~312px tall, so a 16:9 slide stops gaining from extra width at
     about 555px. 708px already clears that with headroom for wide LR
     flowcharts; every pixel past it would be letterbox bought out of NEXT.
     424px is meanwhile the size NOW itself used to run at, so NEXT keeps a
     width already proven to carry a recognisable slide.

  2. The brighter frame border moves from the NEXT pane to the NOW pane, so
     the emphasised frame is the dominant one. The accent CAPTION stays on
     "Next" - accent means "next" everywhere in this window, including the
     primary Next button - and the blanked rules keep winning on NOW because
     they are #pvRoot-qualified.

  3. One stale comment: the step preview no longer lands in a "700px panel".

The notes row, its 21px type and the plate markup are untouched.

Usage:  python fix_pv_frames.py <target.html>
Anchor-guarded; writes nothing at all if any anchor has drifted.
"""
import io
import os
import sys
import tempfile

EDITS = [
    (
        "pv-panes column split: NOW dominant, NEXT supporting",
        ".pv-panes{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:14px;min-height:0}",
        ".pv-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.6fr);gap:14px;min-height:0}",
    ),
    (
        "emphasised frame border follows the dominant pane",
        "+ '.pv-pane.is-next .pv-frame{border-color:#41586b}'",
        "+ '.pv-pane.is-now .pv-frame{border-color:#41586b}'",
    ),
    (
        "step-preview comment names the supporting frame's real width",
        "// diagram in a 700px panel is a picture of nothing - the block the walk is",
        "// diagram in a 420px panel is a picture of nothing - the block the walk is",
    ),
]


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("usage: fix_pv_frames.py <target.html>\n")
        return 2
    path = sys.argv[1]
    if not os.path.isfile(path):
        sys.stderr.write("ABORT: no such file: %s\n" % path)
        return 2

    src = io.open(path, encoding="utf-8", newline="").read()

    # Guard first, write later: every anchor must be present exactly once, and
    # no replacement may already be in the file (a re-run must not double up).
    problems = []
    for name, old, new in EDITS:
        n_old = src.count(old)
        n_new = src.count(new)
        if n_old != 1:
            problems.append("%s: anchor found %d times, expected 1\n    %s" % (name, n_old, old))
        if n_new:
            problems.append("%s: replacement already present %d times (already patched?)" % (name, n_new))
    if problems:
        sys.stderr.write("ABORT - drift, nothing written:\n  " + "\n  ".join(problems) + "\n")
        return 1

    out = src
    for name, old, new in EDITS:
        out = out.replace(old, new, 1)

    # Sanity: nothing but these three substitutions may have moved. The expected
    # delta is the sum of the per-edit length differences (-1: "is-next" -> "is-now").
    expected = sum(len(new) - len(old) for _, old, new in EDITS)
    if len(out) - len(src) != expected:
        sys.stderr.write("ABORT: length delta %d, expected %d\n" % (len(out) - len(src), expected))
        return 1

    directory = os.path.dirname(os.path.abspath(path)) or "."
    handle, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    os.close(handle)
    try:
        with io.open(tmp, "w", encoding="utf-8", newline="") as fh:
            fh.write(out)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise

    for name, old, new in EDITS:
        print("OK  %s" % name)
    print("PATCHED %s (%d bytes)" % (path, len(out.encode("utf-8"))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
