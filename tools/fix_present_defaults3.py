r"""The same three settings, in three places.

Changing makeDefaultPresentation() looked like it did nothing, and the reason is the
pattern five audits have already found on other surfaces: one concept with several
homes. Camera framing, motion and decisions are each declared THREE times -

  1. makeDefaultPresentation()          the stored default          (already changed)
  2. `let presentCameraMode = 'block'`  the live variable's start value
  3. `selected` / `aria-checked="true"` hardcoded into the markup

- and the panel reads (2) and (3), so the stored default never showed. All three move
together here. They should not be three, but collapsing them is a separate change; what
matters today is that they agree.
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


# ---- 2. the live variables --------------------------------------------------
rep("""      let presentCameraMode = 'block';
      let presentTransition = 'smooth';
      let presentDecisionMode = 'ask';""",
    """      // These start where makeDefaultPresentation() starts. They are read by the build
      // panel before any diagram is entered, so a disagreement here shows the stored
      // default never taking effect.
      let presentCameraMode = 'context';
      let presentTransition = 'cinematic';
      let presentDecisionMode = 'continue';""")

# ---- 3. the markup ----------------------------------------------------------
rep('<option value="block" selected>Camera · Block</option>', '<option value="block">Camera · Block</option>')
rep('<option value="context">Camera · Context</option>', '<option value="context" selected>Camera · Context</option>')
rep('<option value="smooth" selected>Smooth</option>', '<option value="smooth">Smooth</option>')
rep('<option value="cinematic">Cinematic</option>', '<option value="cinematic" selected>Cinematic</option>')

rep('role="radio" aria-checked="true" data-value="block">Block</button>',
    'role="radio" aria-checked="false" data-value="block">Block</button>')
rep('role="radio" aria-checked="false" data-value="context">Context</button>',
    'role="radio" aria-checked="true" data-value="context">Context</button>')
rep('role="radio" aria-checked="true" data-value="smooth">Smooth</button>',
    'role="radio" aria-checked="false" data-value="smooth">Smooth</button>')
rep('role="radio" aria-checked="false" data-value="cinematic">Cinematic</button>',
    'role="radio" aria-checked="true" data-value="cinematic">Cinematic</button>')
rep('role="radio" aria-checked="true" data-value="ask">Ask me</button>',
    'role="radio" aria-checked="false" data-value="ask">Ask me</button>')
rep('role="radio" aria-checked="false" data-value="continue">Follow</button>',
    'role="radio" aria-checked="true" data-value="continue">Follow</button>')

# the decision select, if it carries a hardcoded selection too
for old, new in [('<option value="ask" selected>', '<option value="ask">'),
                 ('<option value="continue">', '<option value="continue" selected>')]:
    if s.count(old) == 1:
        s = s.replace(old, new)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_presentdefaults3.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('all three sources aligned: %d -> %d chars' % (len(orig), len(s)))
