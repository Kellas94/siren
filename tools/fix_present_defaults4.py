r"""The fourth place, and this one was a defect rather than a stale default.

Opening Present ran `el.presentDecisionMode.value = 'ask'` unconditionally, before any
diagram was chosen - so the panel announced "Ask me" whatever the app's default was and
whatever the last diagram had. A literal in a reset path is how a default acquires a
fourth home; this one reads the default instead of restating it.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8').read()
orig = s

anchor = "        if (el.presentDecisionMode) el.presentDecisionMode.value = 'ask';"
assert s.count(anchor) == 1, s.count(anchor)
s = s.replace(anchor,
    """        // The Map has no diagram yet, so it shows the app's default rather than a
        // literal that quietly outranked it.
        if (el.presentDecisionMode) el.presentDecisionMode.value = makeDefaultPresentation().decisionMode;""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_presentdefaults4.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('reset path aligned: %d -> %d chars' % (len(orig), len(s)))
