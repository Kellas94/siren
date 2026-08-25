r"""Right-click is an authoring accelerator. Presenting is not authoring.

The owner's rule, stated 2026-08-21: while you are presenting, right-click should do
nothing; while you are editing, creating and arranging, it should be there helping.

That makes Present the single deliberate exception to the house rule "only suppress
the browser's menu where you put one in its place". Here we suppress and offer
nothing - because the alternative is Chrome's own menu, with Save image as, Reload
and View page source, painted over a slide in front of a room. Silence is the
feature; the browser's menu is the defect.

The deck editor keeps its menu: mapBuilding is exactly the authoring half of Present.
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


# ---- 1. the dispatcher learns to suppress without offering -------------------
# Two dispatch sites: the pointer path, and Shift+F10 which raises no contextmenu
# event of its own. Both must honour the suppression or the keyboard reopens what the
# mouse was told to leave alone.
rep("""        const built = buildContextMenu(target);
        if (!built || !contextMenuHasActions(built.rows)) return;
        event.preventDefault();""",
    """        const built = buildContextMenu(target);
        // The one surface that suppresses and offers nothing. Everywhere else, having
        // nothing to say means stepping aside; while a room is watching a slide it
        // means staying quiet, because the browser's own menu is the worse outcome.
        if (built && built.suppress) { event.preventDefault(); return; }
        if (!built || !contextMenuHasActions(built.rows)) return;
        event.preventDefault();""", 2)

# ---- 2. presenting says nothing ---------------------------------------------
rep("""      function buildPresentContextMenu(target) {
        if (mapBuilding) return buildPresentBuildContextMenu(target);
        return buildPresentingContextMenu(target);
      }""",
    """      function buildPresentContextMenu(target) {
        // mapBuilding is the authoring half of Present, and authoring is what this
        // gesture is for. The other half is a person standing in front of a client.
        if (mapBuilding) return buildPresentBuildContextMenu(target);
        return { suppress: true };
      }""")

# ---- 3. remove what it replaced ---------------------------------------------
old_fn_start = "      function buildPresentingContextMenu(target) {"
start = s.index(old_fn_start)
end = s.index("\n        return { rows, anchor: routeRow || stepRow || block || tile || el.presentOverlay, label: 'Presentation actions' };\n      }\n", start)
end += len("\n        return { rows, anchor: routeRow || stepRow || block || tile || el.presentOverlay, label: 'Presentation actions' };\n      }\n")
removed = s[start:end]
assert 'buildPresentingContextMenu' in removed and len(removed) < 3000, len(removed)
s = s[:start] + s[end:]
assert s.count('buildPresentingContextMenu') == 0, s.count('buildPresentingContextMenu')

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_presentmenu.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('present suppression installed: %d -> %d chars (removed %d)' % (len(orig), len(s), len(removed)))
