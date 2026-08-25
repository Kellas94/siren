r"""Present opened with the presenter's control room facing the audience.

Measured on a three-block diagram at 1440x900: pressing Present put **44 controls** on screen -
a stopwatch, a pen colour, Loop the deck, plus-and-minus Camera, Clear drawings, Snapshot PNG,
Record, Export notes, and seven more panels down the left - and squeezed the diagram into what
was left. That rail is the presenter's console. It has no business being the first thing a room
sees, and the door to it was already in the bar: the "Studio" button, one press away.

So Present now opens clean: the diagram, the bar, nothing else. The first press of Studio opens
the rail, and the choice is remembered - a person who builds presentations gets it back every
time, and a person who just presents never shows the room their pen colour.
"""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else None
if not APP:
    print(__doc__); sys.exit(2)
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- the button starts unpressed
rep("""          <button class="btn ghost compact" id="presentSidebarToggle" type="button" aria-pressed="true">☰ Studio</button>""",
    """          <button class="btn ghost compact" id="presentSidebarToggle" type="button" aria-pressed="false">☰ Studio</button>""")

# ---------------------------------------------------------------- the rail starts collapsed
rep("""      <div class="present-body" id="presentBody">""",
    """      <div class="present-body sidebar-collapsed" id="presentBody">""")

# ---------------------------------------------------------------- remember the choice
rep("""      function togglePresentationSidebar() {
        const collapsed = !el.presentBody.classList.contains('sidebar-collapsed');
        el.presentBody.classList.toggle('sidebar-collapsed', collapsed);
        el.presentSidebarToggle.setAttribute('aria-pressed', String(!collapsed));
        el.presentSidebarToggle.textContent = collapsed ? '☰ Studio' : '× Studio';""",
    """      function togglePresentationSidebar() {
        const collapsed = !el.presentBody.classList.contains('sidebar-collapsed');
        el.presentBody.classList.toggle('sidebar-collapsed', collapsed);
        el.presentSidebarToggle.setAttribute('aria-pressed', String(!collapsed));
        el.presentSidebarToggle.textContent = collapsed ? '☰ Studio' : '× Studio';
        // Whoever builds presentations wants the console every time; whoever only presents
        // never wants it. Remember which one this is.
        state.presentStudioOpen = !collapsed;
        scheduleSave();""")

# ---------------------------------------------------------------- apply it when Present opens
# (openPresentation forced the rail open here, and mislabelled the button while doing it)
rep("""        el.presentBody.classList.remove('sidebar-collapsed');
        // A new presentation starts from the fit this screen allows, not from the
        // arrangement the last one happened to be left in.
        presentRailPlan = null;
        el.presentSidebarToggle.setAttribute('aria-pressed', 'true');
        el.presentSidebarToggle.textContent = '☰ Studio';""",
    """        // The console is closed unless this person has opened it before: a room should see
        // the diagram, not the pen colour and the stopwatch. The door is the Studio button.
        const studioOpen = state.presentStudioOpen === true;
        el.presentBody.classList.toggle('sidebar-collapsed', !studioOpen);
        // A new presentation starts from the fit this screen allows, not from the
        // arrangement the last one happened to be left in.
        presentRailPlan = null;
        el.presentSidebarToggle.setAttribute('aria-pressed', String(studioOpen));
        el.presentSidebarToggle.textContent = studioOpen ? '× Studio' : '☰ Studio';""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('present studio closed by default: %d -> %d chars' % (len(orig), len(s)))
