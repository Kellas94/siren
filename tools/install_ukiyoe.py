# -*- coding: utf-8 -*-
"""
SIREN - Ukiyo-e "ultra" rework: combined installer (palette + ambient scene + intro).

Usage: python install_ukiyoe.py <target.html>

- Idempotent: each of the three parts is skipped if its new content is already
  in place; running twice is a no-op.
- Anchor-guarded: every anchor is re-found in the target at run time and must
  occur exactly once; any drift aborts BEFORE anything is written.
- Payload files (scene_ukiyoe_v2.js / intro_ukiyoe.css / intro_ukiyoe.html,
  read from this script's own directory) are sha256-pinned; a modified payload
  aborts the install.
- The patched inline script is extracted and node --check'ed before the target
  is touched; the original is backed up and restored if the final write fails.
"""
import hashlib, io, os, re, shutil, subprocess, sys

def die(msg):
    print("INSTALL FAILED: " + msg)
    sys.exit(1)

if len(sys.argv) != 2:
    die("usage: install_ukiyoe.py <target.html>")
target = sys.argv[1]
if not os.path.isfile(target):
    die("target not found: " + target)
HERE = os.path.dirname(os.path.abspath(__file__))

PAYLOAD_SHA = {'scene_ukiyoe_v2.js': '25676bb8e721f82adc0447e7e053585ce37ce36179f05ff2db645888d21f355c', 'intro_ukiyoe.css': '1f30872bb45ce120303db4cf39fc0baa9dea188b01b818cbb2acbbe69177eada', 'intro_ukiyoe.html': '13601b4c08e5405505c7c9f10c69ff635f2556a4d8e0fbaa56b9badc50565658'}

def load(name):
    p = os.path.join(HERE, name)
    if not os.path.isfile(p):
        die("payload missing: " + p)
    data = io.open(p, "r", encoding="utf-8", newline="").read()
    h = hashlib.sha256(data.encode("utf-8")).hexdigest()
    if h != PAYLOAD_SHA[name]:
        die("payload %s modified since install_ukiyoe.py was built (sha %s)" % (name, h))
    return data

src = io.open(target, "r", encoding="utf-8", newline="").read()
orig = src
applied, skipped = [], []

def once(needle, label):
    n = src.count(needle)
    if n != 1:
        die("anchor %r found %d times (expected 1)" % (label, n))
    return src.index(needle)

# ======================================================================
# PART 1 - PALETTE (tokens, washi surfaces, ambient tints, preset, swatch)
# ======================================================================
REPL = []

# ---------------------------------------------------------------- 1. tokens
old_tokens = '''    [data-theme="ukiyoe"] {
      color-scheme: light;
      --canvas-bg: #f7f0e0;
      --app-bg: #efe6d0;
      --panel-bg: #f7f0e0;
      --panel-alt: #ece3cc;
      --panel-elevated: #fbf6ea;
      --sidebar-start: #f7f0e0;
      --sidebar-end: #eadfc5;
      --input-bg: #fbf6ea;
      --text: #23303f;
      --muted: #4f5b68;
      --subtle: #68727e;
      --border: #d9cdb0;
      --border-strong: #8f8266;
      --field-border: #77705d;
      --primary: #1d4f8a;
      --primary-hover: #163e6e;
      --primary-text: #f5f9ff;
      --secondary: #eee4cb;
      --secondary-hover: #e3d5b2;
      --secondary-text: #33302a;
      --danger: #b02a20;
      --danger-strong: #8f1d15;
      --danger-bg: #fbe9e7;
      --success: #2c6b3a;
      --success-bg: #e6f2e8;
      --warning: #7a5410;
      --warning-bg: #f7ead0;
      --focus-ring: #1d4f8a;
      --code-text: #3c4654;
      --pill-text: #1d4f8a;
      --pill-bg: #dfe8f2;
      --code-bg: #f1ead6;
      --deco-gold: #c0392b;
      --shadow: 0 18px 50px rgba(60, 70, 90, .16);
      --shadow-soft: 0 8px 24px rgba(60, 70, 90, .11);
      --node-fill: #fbf6ea;
      --node-text: #23303f;
      --node-border: #35597f;
      --node-accent: #dfe8f2;
      --node-accent-border: #1d4f8a;
      --line-color: #46586c;
      --edge-label-bg: #ece3cc;
    }'''

new_tokens = '''    [data-theme="ukiyoe"] {
      color-scheme: light;
      --canvas-bg: #f6efdd;
      --app-bg: #ece1c8;
      --panel-bg: #f6efdd;
      --panel-alt: #eadec1;
      --panel-elevated: #fbf6e8;
      --sidebar-start: #f6efdd;
      --sidebar-end: #e7daba;
      --input-bg: #faf4e3;
      --text: #282520;
      --muted: #57503f;
      --subtle: #675f4c;
      --border: #d6c8a6;
      --border-strong: #8b7c5c;
      --field-border: #746a4f;
      --primary: #1c4d7c;
      --primary-hover: #143a5f;
      --primary-text: #f2f7fd;
      --secondary: #ecdfc2;
      --secondary-hover: #dfcda4;
      --secondary-text: #322e24;
      --danger: #a3341c;
      --danger-strong: #832712;
      --danger-bg: #f7e5da;
      --success: #2f6540;
      --success-bg: #e3efdf;
      --warning: #775110;
      --warning-bg: #f4e7c8;
      --focus-ring: #1c4d7c;
      --code-text: #443f30;
      --pill-text: #1b466f;
      --pill-bg: #dbe5ec;
      --code-bg: #f0e8d1;
      --deco-gold: #a52c15;
      --shadow: 0 18px 50px rgba(72, 58, 30, .16);
      --shadow-soft: 0 8px 24px rgba(72, 58, 30, .11);
      --node-fill: #faf4e3;
      --node-text: #282520;
      --node-border: #2e5178;
      --node-accent: #d8e4ed;
      --node-accent-border: #1c4d7c;
      --line-color: #45525f;
      --edge-label-bg: #ecdfc2;
    }

    /* Ukiyo-e surface: the ground is a sheet of washi - fine laid lines from
       the drying screen, a faint chain line every few centimetres - and the
       band over the header is a hand-wiped bokashi of bero-ai, the flooded
       sky at the top of every Hokusai print. The one vermilion in the UI is
       the artist's seal (--deco-gold on the brand lockup); misregistration
       stays in the ambient scene, never in the chrome. */
    body[data-theme="ukiyoe"] {
      background-image:
        repeating-linear-gradient(90deg, rgba(88, 70, 38, .028) 0 1px, transparent 1px 88px),
        repeating-linear-gradient(180deg, rgba(88, 70, 38, .022) 0 1px, rgba(255, 250, 236, .4) 1px 2px, transparent 2px 7px),
        radial-gradient(135% 100% at 50% 0%, #f1e7d0 0%, #ece1c8 55%, #e3d5b2 100%);
    }
    [data-theme="ukiyoe"] .app-header {
      background-image:
        linear-gradient(180deg, rgba(28, 77, 124, .12) 0%, rgba(28, 77, 124, .05) 62%, rgba(28, 77, 124, 0) 100%),
        linear-gradient(180deg, var(--panel-bg), var(--panel-alt));
      border-bottom: 1px solid rgba(28, 77, 124, .38);
    }
    /* With the ambient scene running the system clears surface patterns off the
       bars (background shorthand above ambient veils). The bokashi is the
       theme's signature, so it alone returns as a translucent tint over the
       veil - the scene still reads through both layers. */
    body[data-ambient="on"][data-theme="ukiyoe"] .app-header {
      background-image: linear-gradient(180deg, rgba(28, 77, 124, .10) 0%, rgba(28, 77, 124, .04) 62%, rgba(28, 77, 124, 0) 100%);
    }
    [data-theme="ukiyoe"] .preview-pane {
      background-image:
        repeating-linear-gradient(180deg, rgba(88, 70, 38, .02) 0 1px, rgba(255, 250, 236, .36) 1px 2px, transparent 2px 7px),
        linear-gradient(180deg, #eee3ca, #e9dcbd);
    }
    [data-theme="ukiyoe"] .preview-card {
      background-image:
        repeating-linear-gradient(180deg, rgba(88, 70, 38, .016) 0 1px, rgba(255, 252, 242, .45) 1px 2px, transparent 2px 8px);
    }
    [data-theme="ukiyoe"] .wp-surface {
      background-image:
        repeating-linear-gradient(90deg, rgba(88, 70, 38, .028) 0 1px, transparent 1px 88px),
        repeating-linear-gradient(180deg, rgba(88, 70, 38, .022) 0 1px, rgba(255, 250, 236, .4) 1px 2px, transparent 2px 7px),
        linear-gradient(180deg, #efe4cd, #e8dbbc);
    }'''
REPL.append(("theme tokens + surfaces", old_tokens, new_tokens))

# ------------------------------------------------------- 2. ambient tints
old_ambient = '''    [data-theme="ukiyoe"]    { --ambient-opacity: .95; --ambient-card: rgba(247, 240, 224, .6); --ambient-bar: rgba(247, 240, 224, .74); --ambient-pane: rgba(247, 240, 224, .68); }'''
new_ambient = '''    [data-theme="ukiyoe"]    { --ambient-opacity: .95; --ambient-card: rgba(246, 239, 221, .6); --ambient-bar: rgba(246, 239, 221, .74); --ambient-pane: rgba(246, 239, 221, .68); }'''
REPL.append(("ambient card tints", old_ambient, new_ambient))

# --------------------------------------------------- 3. themePresets.ukiyoe
old_preset = '''        ukiyoe: {
          canvasBg: '#f7f0e0', text: '#23303f', muted: '#4f5b68',
          nodeFill: '#fbf6ea', nodeText: '#23303f', nodeBorder: '#35597f',
          nodeAccent: '#dfe8f2', nodeAccentBorder: '#1d4f8a', line: '#46586c', edgeLabel: '#ece3cc'
        },'''
new_preset = '''        ukiyoe: {
          canvasBg: '#f6efdd', text: '#282520', muted: '#57503f',
          nodeFill: '#faf4e3', nodeText: '#282520', nodeBorder: '#2e5178',
          nodeAccent: '#d8e4ed', nodeAccentBorder: '#1c4d7c', line: '#45525f', edgeLabel: '#ecdfc2'
        },'''
REPL.append(("themePresets.ukiyoe", old_preset, new_preset))

# ------------------------------------------------------ 4. theme-menu swatch
old_swatch = '''--swatch-a:#efe6d0;--swatch-b:#1d4f8a'''
new_swatch = '''--swatch-a:#ece1c8;--swatch-b:#1c4d7c'''
REPL.append(("theme-menu swatch", old_swatch, new_swatch))

for name, old, new in REPL:
    if new in src and old not in src:
        skipped.append("palette: " + name)
        continue
    n = src.count(old)
    if n != 1:
        die("palette anchor '%s' found %d times (expected 1)" % (name, n))
    if src.count(new):
        die("palette '%s': both old and new content present - refusing to guess" % name)
    src = src.replace(old, new)
    applied.append("palette: " + name)

# ======================================================================
# PART 2 - AMBIENT SCENE (structural replacement of the ukiyoe entry)
# ======================================================================
SCENE_SIG = "Kanagawa-oki nami ura as a finished museum impression"
scene = load("scene_ukiyoe_v2.js").rstrip("\n")
if SCENE_SIG not in scene:
    die("scene payload lost its signature comment")
if not scene.endswith("},"):
    die("scene payload must end with '},'")
if scene.count("{") != scene.count("}"):
    die("scene payload braces unbalanced")

if SCENE_SIG in src:
    skipped.append("scene")
else:
    amb = once("const AMBIENT_SCENES = {", "AMBIENT_SCENES table")
    key_sig = "\n        ukiyoe: {\n          settleFrames:"
    k = once(key_sig, "ukiyoe scene key")
    if k < amb:
        die("ukiyoe scene key sits before AMBIENT_SCENES")
    # walk BACK to the entry's leading /* comment
    cpos = src.rfind("/*", amb, k)
    if cpos < 0:
        die("no /* comment before the ukiyoe scene entry")
    if "Ukiyo-e" not in src[cpos:k]:
        die("comment before the ukiyoe scene entry does not mention Ukiyo-e")
    line_start = src.rfind("\n", 0, cpos) + 1
    if src[line_start:cpos].strip():
        die("unexpected text before the scene comment on its own line")
    # walk FORWARD to the first closer at exactly 8-space indent;
    # accept both "        }," and the comma-less last-entry "        }"
    m = re.compile(r"\n        \}(,)?(?=\s)").search(src, k)
    if not m:
        die("no 8-space closer found after the ukiyoe scene key")
    end = m.end()
    has_comma = bool(m.group(1))
    old_block = src[line_start:end]
    if "settleFrames" not in old_block or "draw(" not in old_block:
        die("removed block does not look like a scene entry")
    if old_block.count("{") != old_block.count("}"):
        die("removed scene block braces unbalanced (%d vs %d)"
            % (old_block.count("{"), old_block.count("}")))
    new_entry = scene if has_comma else scene[:-1]
    src = src[:line_start] + new_entry + src[end:]
    applied.append("scene (removed %d chars incl. settleFrames:300=%s, inserted %d)"
                   % (len(old_block), "settleFrames: 300" in old_block, len(new_entry)))

# ======================================================================
# PART 3 - INTRO (overlay markup + CSS block, "the print is pulled")
# ======================================================================
INTRO_SIG = "===== Ukiyo-e arrival: the print is pulled ====="
new_css = load("intro_ukiyoe.css").rstrip("\n")
new_html = load("intro_ukiyoe.html").rstrip("\n")
if INTRO_SIG not in new_css:
    die("intro css payload lost its signature comment")

if INTRO_SIG in src:
    skipped.append("intro")
else:
    css_start = '    .ukiyoe-intro-overlay { background: linear-gradient(165deg, #f2ead6, #e5d8ba); }'
    css_end = '    .ukiyoe-intro-overlay .theme-intro-progress i { background: linear-gradient(90deg, #1d4f8a, #c0392b); }'
    i0 = once(css_start, "intro css start")
    i1 = once(css_end, "intro css end")
    if i0 >= i1:
        die("intro css anchors out of order")
    i1_end = i1 + len(css_end)
    old_css_block = src[i0:i1_end]
    if len(old_css_block) >= 1200:
        die("old intro css block unexpectedly large: %d" % len(old_css_block))
    src = src[:i0] + new_css + src[i1_end:]

    html_start = '  <div class="theme-intro-overlay ukiyoe-intro-overlay" id="ukiyoeIntroOverlay" hidden aria-live="polite" aria-label="ukiyoe theme loading">'
    j0 = once(html_start, "intro overlay open")
    close = '\n  </div>'
    j1 = src.index(close, j0)
    j1_end = j1 + len(close)
    old_html_block = src[j0:j1_end]
    if len(old_html_block) >= 600:
        die("old overlay block unexpectedly large: %d" % len(old_html_block))
    if 'theme-intro-progress' not in old_html_block:
        die("old overlay block missing progress bar")
    src = src[:j0] + new_html + src[j1_end:]
    applied.append("intro (css %d -> %d chars, overlay %d -> %d chars)"
                   % (len(old_css_block), len(new_css), len(old_html_block), len(new_html)))

# ======================================================================
# POST-CONDITIONS + node --check + guarded write
# ======================================================================
if src == orig:
    print("install_ukiyoe: already fully applied - nothing to do")
    print("  skipped: " + ", ".join(skipped))
    sys.exit(0)

if src.count('id="ukiyoeIntroOverlay"') != 1:
    die("post-condition: overlay id count != 1")
if src.count('uk-seal-press') < 2:
    die("post-condition: intro seal animation missing")
if "settleFrames: 8," not in src:
    die("post-condition: new scene settleFrames missing")
if SCENE_SIG not in src:
    die("post-condition: scene signature missing")

# node --check the single inline script
if src.count("</script>") != 1:
    die("expected exactly one </script> in the app")
op = src.index("<script>")
cl = src.index("</script>")
if op >= cl:
    die("script tags out of order")
js = src[op + len("<script>"):cl]
tmp = os.path.join(HERE, "_install_ukiyoe_check.js")
io.open(tmp, "w", encoding="utf-8", newline="").write(js)
try:
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, shell=(os.name == "nt"))
except Exception as e:
    die("could not run node --check: %r" % e)
if r.returncode != 0:
    die("node --check FAILED - nothing written:\n" + (r.stderr or r.stdout)[:1200])

bak = target + ".pre_ukiyoe_install.bak"
shutil.copyfile(target, bak)
try:
    io.open(target, "w", encoding="utf-8", newline="").write(src)
    back = io.open(target, "r", encoding="utf-8", newline="").read()
    if back != src:
        raise IOError("read-back mismatch")
except Exception as e:
    shutil.copyfile(bak, target)
    die("write failed, original restored from %s: %r" % (bak, e))

print("install_ukiyoe OK -> %s" % target)
for a in applied:
    print("  applied: " + a)
for s in skipped:
    print("  skipped (already in place): " + s)
print("  backup: " + bak)
