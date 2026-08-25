r"""Present opens the way it should be seen.

The owner's call: framing on Context, motion Cinematic, decisions Follow. The old
defaults - block / smooth / ask - meant every new diagram opened with the camera tight
on one block, and stopped at the first decision to ask a question the presenter did
not want asked in front of a room.

Existing diagrams are the interesting half. A stored 'block' cannot be told apart from
a chosen 'block', so the migration is deliberately conservative: it moves a
presentation only when ALL THREE are still at the old defaults, which means nobody has
ever opened that panel. Change one and the whole thing is left alone - someone who has
been in there has opinions, and they keep them. It runs once, behind a marker.
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


# ---- 1. the new defaults ----------------------------------------------------
rep("""          cameraMode: 'block',
          transition: 'smooth',
          decisionMode: 'ask',""",
    """          // A presentation is watched, not operated: the camera opens wide enough to
          // show what a step leads to, moves like a camera rather than a cut, and
          // carries on through decisions instead of stopping to ask in front of a room.
          cameraMode: 'context',
          transition: 'cinematic',
          decisionMode: 'continue',""")

# ---- 2. carry untouched presentations across, once --------------------------
rep("        state.diagrams.forEach(migrateLegacyEdgeStyles);",
    """        state.diagrams.forEach(migrateLegacyEdgeStyles);
        // Diagrams made before the defaults changed. A stored value cannot say whether
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
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_presentdefaults.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('present defaults changed: %d -> %d chars' % (len(orig), len(s)))
