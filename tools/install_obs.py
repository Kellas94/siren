import io, os

SC = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

def read(name):
    return io.open(os.path.join(SC, name), encoding='utf-8').read()

# ---- replace the observatory scene with a dispatcher over the three decks
i = s.index('\n        observatory: {\n          settleFrames:')
pos = i + 1
while True:
    eol = s.index('\n', pos)
    if s[pos:eol] in ('        },', '        }'):
        break
    pos = eol + 1
end = eol + 1
head = s.rindex('/* ', 0, i)
line_start = s.rindex('\n', 0, head) + 1

new_entry = """        /* Sol Observatory - three decks, three different things to observe. The deck
           picker used to recolour one solar system three times; now Deep Field holds a
           hundred hours on one blank patch of sky, Aurora Station looks down across the
           night side from low orbit, and Sol Flare stops the instrument down and points
           it straight at the star. */
        observatory: {
          settleFrames: 34,
          frameMs: 42,
          init(context, width, height, ratio) {
            const variant = (state.observatory && state.observatory.variant) || 'deepfield';
            const bits = variant === 'aurora' ? observatoryInitAurora(context, width, height, ratio)
              : variant === 'solflare' ? observatoryInitSolflare(context, width, height, ratio)
              : observatoryInitDeepfield(context, width, height, ratio);
            bits.deck = variant;
            return bits;
          },
          draw(context, bits, width, height, ratio, frame) {
            if (!bits) return;
            if (bits.deck === 'aurora') observatoryDrawAurora(context, bits, width, height, ratio, frame);
            else if (bits.deck === 'solflare') observatoryDrawSolflare(context, bits, width, height, ratio, frame);
            else observatoryDrawDeepfield(context, bits, width, height, ratio, frame);
          }
        },
"""
s = s[:line_start] + new_entry + s[end:]

# ---- the deck functions live beside the engine
rep("\n      /* ---------------- engine ---------------- */",
    "\n" + read('obs_deepfield.js').rstrip('\n') + "\n\n"
    + read('obs_aurora.js').rstrip('\n') + "\n\n"
    + read('obs_solflare.js').rstrip('\n') + "\n\n      /* ---------------- engine ---------------- */")

# ---- changing deck rebuilds the sky
rep("""        if (state.theme === 'observatory') {
          playObservatoryBootSequence();
          renderDiagram({ reason: 'theme', saveVersion: false });
        }""",
    """        if (state.theme === 'observatory') {
          // A different deck observes a different object, so the scene is rebuilt
          // rather than recoloured.
          stopAmbientScene();
          syncAmbientScene();
          playObservatoryBootSequence();
          renderDiagram({ reason: 'theme', saveVersion: false });
        }""")

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d' % (len(orig), len(s)))
