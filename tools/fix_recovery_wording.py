r"""The recovery prompt stops asserting a crash that did not happen.

`offerCrashRecovery` reads whether the previous session closed cleanly - it even
falls back to a legacy key to be sure - and then never consults the answer. The
decision is made purely by comparing content, and the message is a fixed sentence:
"The previous session ended unexpectedly." So a clean close whose draft merely differs
is announced as a crash, on every reload, until something makes the two agree.

Offering the draft after a clean close is still right, and the existing comment says
why: the last IndexedDB put can die with the page, so the synchronous draft is ground
truth. What is wrong is only the story told about it. A prompt that cries wolf on every
reload gets dismissed by reflex, and then the one time it matters it is dismissed too.

So the offer stands and the wording follows the fact. And when the exit was clean, the
likeliest reason the two disagree is a save that did not complete - which is worth
saying, because it points at the real problem instead of at a phantom crash.
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


rep("""        const draftDocuments = Array.isArray(draft.workpapers) ? draft.workpapers.length : 0;
        requestConfirmation({
          title: 'Recover unsaved work?',
          message: `The previous session ended unexpectedly. A draft from ${formatDate(draft.savedAt)} contains ${draft.diagrams.length} ${draft.diagrams.length === 1 ? 'diagram' : 'diagrams'} and ${draftDocuments} ${draftDocuments === 1 ? 'document' : 'documents'}. Recovering replaces the current workspace; the current one is saved in the restore points first.`,""",
    """        const draftDocuments = Array.isArray(draft.workpapers) ? draft.workpapers.length : 0;
        const contents = `${draft.diagrams.length} ${draft.diagrams.length === 1 ? 'diagram' : 'diagrams'} and ${draftDocuments} ${draftDocuments === 1 ? 'document' : 'documents'}`;
        const consequence = 'Recovering replaces the current workspace; the current one is saved in the restore points first.';
        // The clean-exit flag was read and then thrown away, so every reload whose draft
        // merely differed was announced as a crash. Offering the draft is still right -
        // the last write can die with the page - but the reason has to be the true one,
        // or the prompt gets dismissed by reflex and is useless the day it matters.
        const crashed = cleanExit !== 'yes';
        requestConfirmation({
          title: crashed ? 'Recover unsaved work?' : 'A draft does not match this workspace',
          message: crashed
            ? `The previous session ended unexpectedly. A draft from ${formatDate(draft.savedAt)} contains ${contents}. ${consequence}`
            : `The last session closed normally, but a draft saved at ${formatDate(draft.savedAt)} does not match what is open now - usually because a save did not finish. It contains ${contents}. ${consequence}`,""")

rep("          confirmText: 'Recover draft',",
    "          confirmText: crashed ? 'Recover draft' : 'Use the draft',", 1)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_recovery.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('recovery wording fixed: %d -> %d chars' % (len(orig), len(s)))
