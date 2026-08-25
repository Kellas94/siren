import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
before = len(s)

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

rep("APP_VERSION = '1.64.0'", "APP_VERSION = '1.65.0'")

NOTES = [
    "A slide deck exported as PDF is now about half the size it was. The same nine-page deck went from 134,701 bytes to 72,267 — same pages, same fonts, same words, nothing left out. Fonts are subset to the characters actually used, so Romanian diacritics still come out as Romanian diacritics.",
    "Monospace stays monospace and italic stays italic in an exported PDF. A gradient is written as a real PDF gradient instead of a picture of one, a transparent background stays transparent instead of turning into a grid of tiles, and arrowheads that sit in the middle of a line are drawn.",
    "A diagram too large to draw is now refused before it is attempted rather than half-written: the limit was measured at about 24,000 shapes on a page, and you are told which diagram is over it.",
    "The Excel export is finished: three sheets — blocks, connections and the workspace — each a real Excel table you can sort and filter, not a grid of loose cells.",
    "A file that cannot be imported is refused with the reason, and your workspace is left exactly as it was. Twenty-three broken files were tried — duplicate ids, a truncated archive, a draw.io drawing that would have lost half its shapes, a spreadsheet bomb — and not one of them took anything away from what was already open.",
    "Saving survives a full disk and two tabs. If the browser runs out of room the app says so and keeps working from memory instead of failing silently, and a second tab that saved a newer copy no longer overwrites your work without asking.",
    "In Docs, “Turn into → Heading” used to cut a long block at 300 characters without a word. It now tells you first, in numbers — what fits becomes the heading, the rest stays as a paragraph underneath, and one Undo puts it back. Where nothing can be saved, it refuses and changes nothing rather than shortening your writing for you.",
    "Turning a checklist into text used to clear every tick without asking. It now says how many ticks will go before it does it. Confirming a change after switching to another document no longer paints the first document’s blocks onto the second one’s page.",
    "A heading field stops at its limit instead of accepting more and quietly keeping the first 300 characters. If a paste is too long, you are told how much did not fit."
]

BLOCK = """      const CHANGELOG = [
        {
          version: '1.65.0',
          notes: [
"""
for i, n in enumerate(NOTES):
    BLOCK += "            '" + n.replace("\\", "\\\\").replace("'", "\\'") + "'" + ("," if i < len(NOTES) - 1 else "") + "\n"
BLOCK += """          ]
        },
        {
          version: '1.64.0',"""

rep("""      const CHANGELOG = [
        {
          version: '1.64.0',""", BLOCK)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied %d -> %d delta %d' % (before, len(s), len(s) - before))
