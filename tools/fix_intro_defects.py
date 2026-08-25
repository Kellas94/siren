r"""Three defects found by verifying the brand intro, and the changelog's own history.

1. The opening is skippable. It was pointer-events: none, house standard for the 25
   theme overlays - but those play after a deliberate theme choice, whereas this one
   plays unbidden on the very first launch. Measured: clicking Export ~600ms in put a
   dialog in the top layer above the plate, so a first-time user's first sight of
   SIREN was a dialog on a bare navy field with the app hidden behind it for another
   second. Making the plate swallow clicks would trade one trap for another, so it
   takes the click instead and gets out of the way - which is what an opening should
   do anyway.

2. A theme chosen while the opening runs used to show through as the plate dissolved.
   Two overlays, neither aware of the other, and the brand mark ended up revealing a
   theme's watermark rather than the app. The brand moment belongs to no theme.

3. With browser storage denied, the opening could never play at all. sirenFirstRun is
   set only where no saved workspace is found, but a SecurityError skips that line
   entirely - and such a user is a first-run user on every single launch, so "first
   run only" degraded silently to "never".

Plus: the Guide's changelog still had one entry, so everything since 1.44.0 shipped
under a heading that named the wrong version.
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


# ---- 1. the opening takes a click and leaves --------------------------------
rep("""      display: grid;
      place-items: center;
      pointer-events: none;
      opacity: 0;""",
    """      display: grid;
      place-items: center;
      /* The theme overlays let clicks through because they follow a deliberate choice.
         This one arrives unbidden on the first launch, so a live but invisible toolbar
         underneath is a trap - it takes the click and ends instead. */
      pointer-events: auto;
      cursor: default;
      opacity: 0;""")

rep("""        overlay.classList.add('is-running');
        sirenIntroEndsAt = Date.now() + 1750;
        sirenIntroTimer = setTimeout(stopSirenIntro, 1750);
        return true;""",
    """        overlay.classList.add('is-running');
        sirenIntroEndsAt = Date.now() + 1750;
        sirenIntroTimer = setTimeout(stopSirenIntro, 1750);
        // An opening you cannot leave is a wait. Any click or key ends it at once, and
        // the listeners retire with it so a second play is not double-armed.
        if (!sirenIntroSkipBound) {
          sirenIntroSkipBound = true;
          overlay.addEventListener('pointerdown', skipSirenIntro);
          document.addEventListener('keydown', skipSirenIntro, true);
        }
        // A theme arriving mid-opening used to show through as the plate dissolved.
        Object.keys(themeIntroTimers).forEach(stopThemeIntroSequence);
        return true;""")

rep("""      function stopSirenIntro() {
        if (sirenIntroTimer) { clearTimeout(sirenIntroTimer); sirenIntroTimer = null; }""",
    """      function skipSirenIntro(event) {
        const overlay = el.sirenIntroOverlay;
        if (!overlay || overlay.hidden) return;
        if (event && event.type === 'keydown' && (event.metaKey || event.ctrlKey || event.altKey)) return;
        stopSirenIntro();
      }

      function stopSirenIntro() {
        if (sirenIntroSkipBound) {
          sirenIntroSkipBound = false;
          if (el.sirenIntroOverlay) el.sirenIntroOverlay.removeEventListener('pointerdown', skipSirenIntro);
          document.removeEventListener('keydown', skipSirenIntro, true);
        }
        if (sirenIntroTimer) { clearTimeout(sirenIntroTimer); sirenIntroTimer = null; }""")

rep("      let sirenFirstRun = false;",
    "      let sirenFirstRun = false;\n      let sirenIntroSkipBound = false;")

# ---- 2. a denied store is a first run, every time ----------------------------
rep("""          if (error && (error.name === 'SecurityError' || /localStorage|storage access/i.test(String(error.message || error)))) {
            showToast('Local autosave is unavailable in this preview. Use Project (.siren) export to keep a portable copy.', 'warning');
            return;""",
    """          if (error && (error.name === 'SecurityError' || /localStorage|storage access/i.test(String(error.message || error)))) {
            // Nothing can be remembered here, so every launch is this person's first.
            sirenFirstRun = true;
            showToast('Local autosave is unavailable in this preview. Use Project (.siren) export to keep a portable copy.', 'warning');
            return;""")

# ---- 3. the changelog tells its own history ---------------------------------
rep("""      const CHANGELOG = [
        {
          version: '1.44.0',""",
    """      const CHANGELOG = [
        {
          version: '1.44.4',
          notes: [
            'Clicking a diagram on the workspace board opens it again.',
            'The board now opens showing every project, whatever you filtered it to last time \u2014 except when you arrive from the folder chip, which still takes you straight to that project.'
          ]
        },
        {
          version: '1.44.3',
          notes: [
            'SIREN introduces itself the first time you open it, and the Guide can play that opening again.'
          ]
        },
        {
          version: '1.44.1',
          notes: [
            'The Guide now lists what changed in each version.'
          ]
        },
        {
          version: '1.44.0',""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_introfixes.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('intro fixes prepared: %d -> %d chars' % (len(orig), len(s)))
