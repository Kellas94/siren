r"""Move every existing presentation, not just the untouched ones.

The first pass was conservative - it moved a presentation only when all three settings
still sat on the old defaults, on the grounds that a stored value cannot say whether it
was chosen or inherited. The owner's answer: the diagrams in the tool are experimental,
not final, so move them all. That is his call to make and it costs nothing to reverse,
because the panel is one click away.
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


rep("""        // Diagrams made before the defaults changed. A stored value cannot say whether
        // it was chosen or inherited, so only a presentation still sitting on ALL THREE
        // old defaults is moved - that is one nobody has ever opened. Touch any of them
        // and the set is left exactly as it is.
        if (!state.presentDefaultsMigrated) {
          state.presentDefaultsMigrated = true;
          state.diagrams.forEach(diagram => {
            const presentation = diagram.presentation;
            if (!presentation || typeof presentation !== 'object') return;
            if (presentation.cameraMode === 'block'
              && presentation.transition === 'smooth'
              && presentation.decisionMode === 'ask') {
              presentation.cameraMode = 'context';
              presentation.transition = 'cinematic';
              presentation.decisionMode = 'continue';
            }
          });
        }""",
    """        // Diagrams made before the defaults changed are carried across in full, once.
        // The cautious version moved only presentations still sitting on all three old
        // values; the owner asked for all of them, and the setting is one click away for
        // anyone who disagrees with a particular diagram.
        if (!state.presentDefaultsMigrated) {
          state.presentDefaultsMigrated = true;
          state.diagrams.forEach(diagram => {
            const presentation = diagram.presentation;
            if (!presentation || typeof presentation !== 'object') return;
            presentation.cameraMode = 'context';
            presentation.transition = 'cinematic';
            presentation.decisionMode = 'continue';
          });
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_presentdefaults2.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('migration widened: %d -> %d chars' % (len(orig), len(s)))
