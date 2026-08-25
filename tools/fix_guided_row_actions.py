r"""The guided editor's line controls come back inside the pane.

Measured: 0 of 18 buttons reachable. .structure-rows is an implicit single-column
grid, so its tracks size to content; .struct-code is `white-space: pre`, so a row's
intrinsic width is the full length of the Mermaid line it holds, and the up / down /
delete cluster sits at the end of that width. On a 432px pane the buttons were
painted at x 526-602 - on top of the preview - and every click landed on
`diagram-stage`. They carry no id, so the command palette answers "No matching
command" too: reordering or deleting a line had no route at all on a desktop.

One declaration fixes it, because the row already knows how to behave: the code text
carries `flex: 1 1 auto; min-width: 0; overflow-x: auto`, so once the track can no
longer grow past the pane, the code scrolls inside its own row and the controls stay
pinned where they were always meant to be.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)


rep("""    .structure-rows {
      display: grid;
      align-content: start;""",
    """    .structure-rows {
      display: grid;
      /* Without an explicit track the implicit column sizes to content, and a
         `white-space: pre` row is as wide as its longest line - which put the line
         controls outside the pane and on top of the preview. */
      grid-template-columns: minmax(0, 1fr);
      align-content: start;""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_guidedrows.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('guided row actions fixed: %d -> %d chars' % (len(orig), len(s)))
