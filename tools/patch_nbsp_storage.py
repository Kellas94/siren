"""
A trailing non-breaking space stops reaching storage.

Round 9 fixed three ways typing after "/" in Docs destroyed what somebody wrote, which is the most
valuable thing in that round and is not in question here. To keep the caret in place it resumes the
paragraph as `editor.innerHTML = '/&nbsp;'`, and its own comment explains why: contenteditable
collapses a trailing ordinary space before the next key arrives, and .wp-text has no
`white-space: pre-wrap`. That reasoning is correct.

The consequence on storage is not. Measured on the shipped-candidate build, both halves:

    "/" space "word"   ->  codes [47, 32, ...]   html "/ limaword"   clean, and clean after a reload
    "/" space  STOP    ->  codes [47, 160]       html "/&nbsp;"      permanent, through blur and F5

So the handback's "normalising to an ordinary space" is true when more text follows and false when
the paragraph ends there. That is narrower than a review reported and wider than the handback
implied, and it matters for one specific reason: the entity is what gets SEARCHED and EXPORTED. A
person who types "/ " and moves on has a paragraph that does not match a search for what they can
see, while the literal string "nbsp" does match it.

The fix is placed at the persistence boundary rather than in the editor. wpBoundEditedHtml is the
only path that turns the live editor into the value the model keeps, so normalising there leaves the
caret behaviour Codex needed exactly as it is and cleans only what is stored, searched and exported.

Deliberately NOT done: adding `white-space: pre-wrap` to .wp-text. It would preserve the space in
display as well, and it would also start honouring newlines inside stored markup across every text
block in every existing document - a far larger change than the defect justifies.

Consequence worth stating plainly rather than hiding: a trailing space at the very end of a paragraph
is not preserved, which is how a trailing space behaves everywhere else in the app. What is fixed is
that it no longer leaves an invisible entity behind.

Anchor-guarded, not SHA-pinned. Apply AFTER Codex's AN.

Usage: python patch_nbsp_storage.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch(
    "1. the stored value carries a real space, not an entity",
    "      function wpBoundEditedHtml(editor) {\n"
    "        const raw = editor.innerHTML;\n",

    "      /* The slash affordance resumes a paragraph as '/&nbsp;' so the caret has something to sit\n"
    "         after - contenteditable collapses a trailing ordinary space before the next key, and\n"
    "         .wp-text does not preserve whitespace. That is right for the editor and wrong for the\n"
    "         model: measured, a paragraph left as \"/ \" stores the literal entity through blur and a\n"
    "         reload, so it never matches a search for what is on screen while the string \"nbsp\"\n"
    "         does. Normalising here, at the only path from the live editor to the stored value,\n"
    "         leaves the caret behaviour untouched and cleans what is kept, searched and exported. */\n"
    "      function wpNormalizeTrailingSpace(html) {\n"
    "        return String(html == null ? '' : html)\n"
    "          .replace(/(&nbsp;|\\u00a0)+$/, ' ')\n"
    "          .replace(/(&nbsp;|\\u00a0)+(<\\/?(?:div|p|br)\\b)/gi, ' $2');\n"
    "      }\n"
    "\n"
    "      function wpBoundEditedHtml(editor) {\n"
    "        const raw = wpNormalizeTrailingSpace(editor.innerHTML);\n",
)

patch(
    "2. and so does the blur path, which is what actually overwrote it",
    "      function sanitizeWorkpaperHtml(html, report) {\n"
    "        const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');",

    "      function sanitizeWorkpaperHtml(html, report) {\n"
    "        // Normalising in wpBoundEditedHtml alone was not enough, and the measurement said so:\n"
    "        // the stored value was clean until the paragraph lost focus, at which point this path\n"
    "        // re-read the live editor - still carrying the entity the caret needed - and wrote it\n"
    "        // back over the clean one. Both boundaries have to agree or the last one wins.\n"
    "        const doc = new DOMParser().parseFromString(`<div>${wpNormalizeTrailingSpace(html)}</div>`, 'text/html');",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
