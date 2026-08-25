"""fix-docx: the .docx package had no word/settings.xml, so Word opened every file in
"Compatibility Mode" (CompatibilityMode 12 = Word 2007). Add the settings part with
compatibilityMode 15 (Word 2013+), its content-type Override and its relationship.

Apply AFTER patch_docx.py (the anchors below only exist in the patched file).
Usage: python patch_docx_settings.py <path to app html>
"""
import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# 1. buildWorkpaperDocxBlob: register the settings part as rId4; picture rels start at rId5.
rep("""          media: [], numbering: [], nextRel: 4, nextDocPr: 1,
          rels: [
            { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
            { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', target: 'numbering.xml' },
            { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', target: 'footer1.xml' }
          ]""",
"""          media: [], numbering: [], nextRel: 5, nextDocPr: 1,
          rels: [
            { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
            { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', target: 'numbering.xml' },
            { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', target: 'footer1.xml' },
            { id: 'rId4', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings', target: 'settings.xml' }
          ]""")

# 2. docxPackageEntries: content type for the settings part.
rep("""          + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
          + '<Override PartName="/docProps/core.xml" """,
"""          + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
          + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
          + '<Override PartName="/docProps/core.xml" """)

# 3. docxPackageEntries: the settings part itself, declared next to the numbering part.
rep("""        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: rootRels },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
          { name: 'word/document.xml', data: documentXml },
          { name: 'word/styles.xml', data: styles },
          { name: 'word/numbering.xml', data: numbering },
          { name: 'word/footer1.xml', data: docxFooterXml(doc) },""",
"""        // Without a settings part Word treats the file as a Word 2007 document and shows
        // "Compatibility Mode" in the title bar; compatibilityMode 15 = current Word.
        const settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
          + '<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>'
          + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>'
          + '<w:compatSetting w:name="overrideTableStyleFontSizeAndJustification" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>'
          + '<w:compatSetting w:name="enableOpenTypeFeatures" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>'
          + '<w:compatSetting w:name="doNotFlipMirrorIndents" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>'
          + '<w:compatSetting w:name="differentiateMultirowTableHeaders" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/></w:compat>'
          + '</w:settings>';
        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: rootRels },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
          { name: 'word/document.xml', data: documentXml },
          { name: 'word/styles.xml', data: styles },
          { name: 'word/numbering.xml', data: numbering },
          { name: 'word/settings.xml', data: settings },
          { name: 'word/footer1.xml', data: docxFooterXml(doc) },""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
