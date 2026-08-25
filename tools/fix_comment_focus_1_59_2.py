r"""XS1 - "Add comment..." from a block's right-click menu never focused the comment box.

Measured cause (not the focus trap the queue guessed): the comment composer lives inside the
inspector's <details class="inspector-comments"> ("Documentation"), which is closed by
default. A field inside a closed <details> is not rendered for focus purposes - focus() is a
silent no-op and no focus event fires - so the six retries all failed, and the person had to
open the disclosure and click the box: two extra actions instead of none. The handler now
opens the disclosure before focusing. Measured: the box takes focus on the first try.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

rep("""            const focusComment = () => {
              const box = el.nodeCommentText;
              if (box && box.getBoundingClientRect().width > 0) { box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest' }); }""",
    """            const focusComment = () => {
              const box = el.nodeCommentText;
              // The composer sits inside the inspector's "Documentation" disclosure, and a
              // field inside a closed <details> cannot take focus - open it first.
              const disclosure = box ? box.closest('details') : null;
              if (disclosure && !disclosure.open) disclosure.open = true;
              if (box && box.getBoundingClientRect().width > 0) { box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'center' }); }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_comment_focus.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('comment focus fix applied: %d -> %d chars' % (len(orig), len(s)))
