import io, os
LF = chr(10)
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (repr(a[:80]), s.count(a))
    s = s.replace(a, b)

old = ("          const blob = new Blob([buildXlsxWorkbook([{ name: 'Document', xml: docsSheetXml(doc) }])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });" + LF +
       "          await deliverExportBlob(blob, { format: 'xlsx', fileName: base + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel workbook', extensions: ['.xlsx'] }, null);")
new = ("          // One document, one worksheet - the same package the multi-doc export writes." + LF +
       "          const used = new Set();" + LF +
       "          const sheet = { doc, name: docsSheetName(doc, used), file: 'sheet1.xml', rid: 'rId1' };" + LF +
       "          const entries = [" + LF +
       "            { name: '[Content_Types].xml', data: XLSX_DOC_CONTENT_TYPES(sheet) }," + LF +
       "            { name: '_rels/.rels', data: XLSX_ROOT_RELS }," + LF +
       "            { name: 'xl/workbook.xml', data: XLSX_DOC_WORKBOOK(sheet) }," + LF +
       "            { name: 'xl/_rels/workbook.xml.rels', data: XLSX_DOC_WB_RELS(sheet) }," + LF +
       "            { name: 'xl/styles.xml', data: XLSX_DOC_STYLES }," + LF +
       "            { name: 'xl/worksheets/sheet1.xml', data: docsSheetXml(doc) }" + LF +
       "          ];" + LF +
       "          const blob = new Blob([buildZip(entries)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });" + LF +
       "          await deliverExportBlob(blob, { format: 'xlsx', fileName: base + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel workbook', extensions: ['.xlsx'] }, null);")
rep(old, new)

# the shared package fragments, lifted from the multi-doc exporter
X = []
A = X.append
A("      const XLSX_ROOT_RELS = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>';")
A("      const XLSX_DOC_STYLES = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs></styleSheet>';")
A("      const XLSX_DOC_CONTENT_TYPES = sheet => '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/' + sheet.file + '\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>';")
A("      const XLSX_DOC_WORKBOOK = sheet => '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"' + escapeXml(sheet.name) + '\" sheetId=\"1\" r:id=\"' + sheet.rid + '\"/></sheets></workbook>';")
A("      const XLSX_DOC_WB_RELS = sheet => '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"' + sheet.rid + '\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/' + sheet.file + '\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>';")
A("")
rep("      function workpaperMarkdown(doc) {", LF.join(X) + "      function workpaperMarkdown(doc) {")

io.open(P + '.tmp', 'w', encoding='utf-8').write(s)
os.replace(P + '.tmp', P)
print('single-doc xlsx package fixed')
