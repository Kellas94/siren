# SIREN Architectural Recommendations & Production Extensions

This directory contains standalone, production-ready modules implementing advanced architectural, security, and document-formatting enhancements for **T-Industries SIREN**.

These modules are decoupled from the core frozen deliverables and can be integrated into the main application whenever the engineering team decides.

---

## Catalog of Modules

| Module File | Name | Scope / Impact |
|---|---|---|
| [`01_audit_binder_bundle.js`](file:///C:/Claude/SIREN/antigravity/recommendations/01_audit_binder_bundle.js) | **Audit Engagement Binder Package** | Single-click `.zip` export bundling Vector PDF, Editable PPTX, Workpapers DOCX, Matrix XLSX, and a cryptographic `MANIFEST_INTEGRITY.txt` (SHA-256). |
| [`02_pdf_flatedecode_compression.js`](file:///C:/Claude/SIREN/antigravity/recommendations/02_pdf_flatedecode_compression.js) | **PDF Stream Deflate Compression** | Browser-native `CompressionStream('deflate')` for `/Filter /FlateDecode`, shrinking Vector PDF deck sizes from 533 KB to ~65 KB without npm dependencies. |
| [`03_audit_provenance_metadata.js`](file:///C:/Claude/SIREN/antigravity/recommendations/03_audit_provenance_metadata.js) | **Cryptographic Provenance Metadata** | Injects diagram SHA-256 hashes, snapshot IDs, and reviewer sign-offs into OOXML `docProps/custom.xml` and PDF `/Info`. |
| [`04_docx_professional_headers_tables.js`](file:///C:/Claude/SIREN/antigravity/recommendations/04_docx_professional_headers_tables.js) | **DOCX Headers & Repeating Tables** | Dynamic `Page X of Y` field codes, classification banners in `word/header1.xml`, and `<w:tblHeader/>` for multi-page tables. |
| [`05_pptx_shape_grouping.js`](file:///C:/Claude/SIREN/antigravity/recommendations/05_pptx_shape_grouping.js) | **PowerPoint `<p:grpSp>` Node Grouping** | Groups flowchart node shapes, risk badges, and control pins into unified DrawingML groups so they drag together in PowerPoint. |
| [`06_dynamic_watermarking.js`](file:///C:/Claude/SIREN/antigravity/recommendations/06_dynamic_watermarking.js) | **Multi-Format Dynamic Watermarking** | Configurable diagonal watermarks (*"DRAFT - FOR REVIEW"*, *"CONFIDENTIAL"*) across PDF vector streams, PPTX shapes, and DOCX headers. |
| [`07_roundtrip_excel_sync.js`](file:///C:/Claude/SIREN/antigravity/recommendations/07_roundtrip_excel_sync.js) | **Round-Trip Excel $\leftrightarrow$ Diagram Sync** | Re-imports edited Risk and Control Matrices from Excel/CSV and updates node metadata in-place without disrupting diagram layout. |
| [`08_offline_mermaid_cache.js`](file:///C:/Claude/SIREN/antigravity/recommendations/08_offline_mermaid_cache.js) | **Offline IndexedDB Mermaid Caching** | Persists the Full Mermaid CDN bundle into browser IndexedDB so sequence and ER diagrams work 100% offline in client archives. |
| [`09_monochrome_accessible_themes.js`](file:///C:/Claude/SIREN/antigravity/recommendations/09_monochrome_accessible_themes.js) | **Accessible & Monochrome Print Palettes** | Shape borders, textures (double border, dashed, dotted) and Okabe-Ito palettes ensuring risk matrices remain distinct on B&W printouts. |

---

## Detailed Technical Specifications & Integration Guides

### 1. One-Click Engagement Binder (`01_audit_binder_bundle.js`)
- **Use Case:** Audit sign-off and archiving.
- **How it works:**
  Invoking `exportAuditEngagementBinder({ projectName: 'FY26_Financial_Audit', auditorName: 'Senior Auditor' })` generates all 4 deliverables, calculates the SHA-256 hash of each file in real-time, builds `MANIFEST_INTEGRITY.txt`, and downloads a timestamped ZIP archive.
- **Code:** See [`01_audit_binder_bundle.js`](file:///C:/Claude/SIREN/antigravity/recommendations/01_audit_binder_bundle.js).

---

### 2. PDF Stream Deflate Compression (`02_pdf_flatedecode_compression.js`)
- **Use Case:** Ultra-compact PDF exports.
- **How it works:**
  Wraps `PdfBuilder.addStream` with `compressFlateStream`. Utilizes the native browser `CompressionStream('deflate')` API. Emits standard `/Filter /FlateDecode` dictionaries.
- **Code:** See [`02_pdf_flatedecode_compression.js`](file:///C:/Claude/SIREN/antigravity/recommendations/02_pdf_flatedecode_compression.js).

---

### 3. Cryptographic Provenance Metadata (`03_audit_provenance_metadata.js`)
- **Use Case:** Chain of custody and tamper detection.
- **How it works:**
  Generates `docProps/custom.xml` for PPTX and DOCX, and injects `/AuditSnapshotId` and `/AuditDiagramHash` into the PDF trailer dictionary.
- **Code:** See [`03_audit_provenance_metadata.js`](file:///C:/Claude/SIREN/antigravity/recommendations/03_audit_provenance_metadata.js).

---

### 4. Professional DOCX Headers & Tables (`04_docx_professional_headers_tables.js`)
- **Use Case:** Client-ready Word documents without post-formatting.
- **How it works:**
  Emits `<w:tblHeader/>` inside `<w:trPr>` for the first row of any table, ensuring column headers repeat when tables span across page breaks. Injects `word/header1.xml` and `word/footer1.xml` with dynamic `PAGE` / `NUMPAGES` field codes.
- **Code:** See [`04_docx_professional_headers_tables.js`](file:///C:/Claude/SIREN/antigravity/recommendations/04_docx_professional_headers_tables.js).

---

### 5. DrawingML Compound Node Grouping (`05_pptx_shape_grouping.js`)
- **Use Case:** Ergonomic PowerPoint editing for audit clients.
- **How it works:**
  Wraps node boxes and attached risk badges into `<p:grpSp>` with unified bounding boxes (`<a:chOff>` / `<a:chExt>`), making multi-part shapes drag as single units in PowerPoint.
- **Code:** See [`05_pptx_shape_grouping.js`](file:///C:/Claude/SIREN/antigravity/recommendations/05_pptx_shape_grouping.js).

---

### 6. Dynamic Watermarking Engine (`06_dynamic_watermarking.js`)
- **Use Case:** Preliminary and confidential audit draft protection.
- **How it works:**
  Injects rotated, semi-transparent watermark layers across all three target formats: PDF (`Tm` rotation + `/ExtGState`), PPTX (`<p:sp rot="...">`), and DOCX (`<v:shape type="#_x0000_t136">`).
- **Code:** See [`06_dynamic_watermarking.js`](file:///C:/Claude/SIREN/antigravity/recommendations/06_dynamic_watermarking.js).

---

### 7. Round-Trip Excel / CSV Metadata Synchronizer (`07_roundtrip_excel_sync.js`)
- **Use Case:** Tabular metadata editing in Excel without breaking diagrams.
- **How it works:**
  Parses CSV/Excel matrix rows, matches blocks by ID or label, and updates `targetDiagram.nodeMetadata` in-place while keeping layout geometry untouched.
- **Code:** See [`07_roundtrip_excel_sync.js`](file:///C:/Claude/SIREN/antigravity/recommendations/07_roundtrip_excel_sync.js).

---

### 8. Offline IndexedDB Mermaid Caching (`08_offline_mermaid_cache.js`)
- **Use Case:** 100% offline diagramming in airgapped environments.
- **How it works:**
  Caches the Full Mermaid bundle in IndexedDB on first load; loads directly from local database when offline.
- **Code:** See [`08_offline_mermaid_cache.js`](file:///C:/Claude/SIREN/antigravity/recommendations/08_offline_mermaid_cache.js).

---

### 9. Accessible & Monochrome Print Palettes (`09_monochrome_accessible_themes.js`)
- **Use Case:** Physical laser printing and color-blind stakeholder accessibility.
- **How it works:**
  Provides distinct border textures (thick double borders, dashed lines, dotted lines) for risk levels so they can be identified without color.
- **Code:** See [`09_monochrome_accessible_themes.js`](file:///C:/Claude/SIREN/antigravity/recommendations/09_monochrome_accessible_themes.js).
