r"""1.63.0 - the round-4 release: the owner's morning list, the three export formats, and
the two defects found on the way (PDF diacritics, PowerPoint captions)."""
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

rep("const APP_VERSION = '1.62.0';", "const APP_VERSION = '1.63.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.62.0',""",
    """      const CHANGELOG = [
        {
          version: '1.63.0',
          notes: [
            'PDF keeps its words. Romanian text used to come out as \\u201c?edin?? ?ar?\\u201d because the PDF carried no font that had \\u0219 \\u021b \\u0103; the font travels inside the file now, so a PDF you send a client reads the way you typed it.',
            'PDF diagram pages are drawn, not photographed: real shapes and selectable text, sharp at any zoom, and about a tenth of the old file size. A page the converter cannot draw stays a picture and the message says which.',
            'PowerPoint decks come out as editable shapes \\u2014 boxes, diamonds, connectors, captions you can click and change \\u2014 instead of a picture per slide. Diagram types the writer cannot shape (sequence, gantt and the rest) stay pictures, and the message names them.',
            'A subgraph called \\u201cAccounts payable\\u201d used to export as \\u201cAccounts\\u201d, and a connector labelled \\u201cNot approved yet\\u201d stacked one word per line. Every export that draws shapes \\u2014 PowerPoint and Excel \\u2014 now carries the whole caption.',
            'Word export writes a real .docx instead of an HTML file wearing a Word extension: Word opens it without repairing, and the diagrams arrive as pictures (the old file lost them silently).',
            'The guided editor keeps your place: \\u201c+ Block\\u201d adds the step under the line you are on with the name ready to type, editing a chip no longer shoves the row or hides the block id, Tab walks the chips and Delete removes a line. The \\u2191 \\u2193 \\u00d7 on every row are gone \\u2014 the right-click menu, Alt+\\u2191 / Alt+\\u2193 and dragging the line number already did all three.',
            'Right-click works inside Docs: on a block, between blocks and on the page, with the actions that were already there. Markdown no longer glues paragraphs together, an empty placeholder no longer leaks into exports, and PowerPoint no longer overwrites a table\\u2019s first heading.',
            'Fewer controls at rest: Guide, Import and Restore points live behind one \\u22ef, the status chips speak only when something is not current, Render hides while auto-render is on, and the walkthrough arrows appear when you are walking. Everything is still one click away.',
            'The pop-out editor goes anywhere in the window and remembers where you left it; Esc puts it back.',
            'A note on the canvas: a dotted, arrowless tag on a block that never joins the flow and is never swept up when you delete the block it belongs to. A step can be added beside a block as well as before and after, and right-clicking empty canvas offers \\u201cNew block\\u2026\\u201d.',
            'A map in the corner of a large diagram: drag the little window to move around it. It appears only when the diagram is bigger than the pane, and never lands in an export.',
            'A diagram can be put away from its own tab \\u2014 right-click it, or use the \\u00d7 that appears when you hover.'
          ]
        },
        {
          version: '1.62.0',""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('1.63.0 applied: %d -> %d chars' % (len(orig), len(s)))
