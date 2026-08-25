r"""Find and replace stops destroying the source on the commonest Mermaid rename.

Measured: Match case and Whole word both default OFF, and Mermaid ids are single
letters. Typing "C" to rename a node reported "1 of 49 matches"; one click of Replace
all - no confirmation - produced `flowMAThart TD`, `ReMATompute`, and a diagram that
would not parse. Undo recovers it, if you notice 49 silent edits.

Three changes, none of which takes an ability away:

  * A find string of one or two characters turns Match case and Whole word ON, and the
    panel says why. Anything that short in this language is an identifier; someone who
    genuinely wants every "c" inside every label unticks a box that is right there.
  * Replace all asks first once it would change more than a handful, naming the count.
    A confirm on 49 edits is not friction, it is the difference between an edit and an
    accident.
  * The two buttons swap prominence. Replace acts on one match and was the quiet one;
    Replace all is irreversible-in-feel and was styled as the obvious thing to press.
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


# ---- 1. a short needle is an identifier -------------------------------------
rep("""      function buildFindRegex() {
        const needle = el.findInput.value;
        if (!needle) return null;""",
    """      // A one- or two-character search in Mermaid is a node id, not a substring: ids
      // are single letters, so "C" otherwise matches every c inside every label. The
      // guard turns the two options on the first time such a needle is typed and says
      // so; unticking either afterwards is respected, because the user has now made a
      // choice about this search rather than inheriting a default.
      let findIdentifierGuardFor = '';
      function guardShortFindNeedle() {
        const needle = String(el.findInput.value || '');
        if (needle.length === 0 || needle.length > 2) { findIdentifierGuardFor = ''; return; }
        if (findIdentifierGuardFor === needle) return;
        findIdentifierGuardFor = needle;
        if (el.findCaseSensitive.checked && el.findWholeWord.checked) return;
        el.findCaseSensitive.checked = true;
        el.findWholeWord.checked = true;
        showToast('Searching for a block id, so Match case and Whole word are on. Untick either to search inside labels too.', 'info');
      }

      function buildFindRegex() {
        const needle = el.findInput.value;
        if (!needle) return null;""")

rep("""      function recomputeFindMatches() {""",
    """      function recomputeFindMatches() {
        guardShortFindNeedle();""")

# ---- 2. Replace all asks once it is a sweep ---------------------------------
rep("""      function replaceAllMatches() {
        const regex = buildFindRegex();
        if (!regex || !findMatches.length) return;
        const count = findMatches.length;
        const replacement = el.replaceInput.value;""",
    """      function replaceAllMatches(confirmed = false) {
        const regex = buildFindRegex();
        if (!regex || !findMatches.length) return;
        const count = findMatches.length;
        // Beyond a handful this stops being an edit and becomes a sweep, and a sweep
        // over a diagram's source is worth one sentence first.
        if (!confirmed && count > 5) {
          const needle = el.findInput.value;
          requestConfirmation({
            title: `Replace ${count} occurrences?`,
            message: `Every “${needle}” in this diagram becomes “${el.replaceInput.value}”, including any inside block labels. Undo restores it.`,
            confirmText: `Replace all ${count}`,
            action: () => replaceAllMatches(true)
          });
          return;
        }
        const replacement = el.replaceInput.value;""")

# ---- 3. the quiet action was the safe one -----------------------------------
rep("""                <button class="btn secondary compact" id="replaceOneButton" type="button">Replace</button>
                <button class="btn compact" id="replaceAllButton" type="button">Replace all</button>""",
    """                <button class="btn compact" id="replaceOneButton" type="button">Replace</button>
                <button class="btn secondary compact" id="replaceAllButton" type="button">Replace all</button>""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_findreplace.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('find and replace guarded: %d -> %d chars' % (len(orig), len(s)))
