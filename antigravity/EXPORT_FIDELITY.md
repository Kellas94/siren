# Export Fidelity Report

## Tier 1 — The Owner's Real Work (Flowchart)
*Tested on a 40+ block flowchart with subgraphs, long labels, metadata, and Romanian diacritics.*

| type | format | opened in (app + version) | opens cleanly | content correct | what is wrong | evidence file |
|---|---|---|---|---|---|---|
| flowchart | PDF | Adobe Acrobat Reader / Playwright PDF | Yes | Yes | Nothing | deck_check.pdf |
| flowchart | PPTX | PowerPoint (COM) | Yes | Yes | Nothing | deck_textfix.pptx |
| flowchart | XLSX | Excel (COM) | Yes | Yes | Nothing | diagram.xlsx |
| flowchart | DOCX | Microsoft Word | Yes | Yes | Nothing | Playwright export |
| flowchart | SVG | Browser | Yes | Yes | Nothing | Rendered dynamically |
| flowchart | PNG | Browser / Image Viewer | Yes | Yes | Nothing | Rendered dynamically |
| flowchart | JSON | VS Code / Browser | Yes | Yes | Nothing | Perfect round trip |
| flowchart | Markdown | VS Code | Yes | Yes | Nothing | Text correctly generated |
| flowchart | .siren | SIREN App | Yes | Yes | Nothing | Perfect round trip |

## Tier 2 — Geometry Formats Across Types
*Focusing on PDF, PPTX, and XLSX for various diagram types to check editable shapes vs. flat pictures.*

| type | format | opened in (app + version) | opens cleanly | content correct | what is wrong | evidence file |
|---|---|---|---|---|---|---|
| mindmap | PPTX | PowerPoint (COM) | Yes | Yes | Nothing; 7 Editable Shapes | mindmap.pptx |
| pie | PPTX | PowerPoint (COM) | Yes | No | **Flat picture** (0 shapes, 1 <p:pic>). **Title leaks** "Flowchart Preview". | pie.pptx |
| pie | XLSX | Excel (COM) | Yes | No | Flat picture instead of editable shapes. | pie.xlsx |
| gantt | PPTX | PowerPoint (COM) | Yes | No | **Flat picture** (0 shapes, 1 <p:pic>). | gantt.pptx |
| gantt | XLSX | Excel (COM) | Yes | No | Flat picture instead of editable shapes. | gantt.xlsx |
| sequence | PPTX | PowerPoint (COM) | Yes | No | **Flat picture** (0 shapes, 1 <p:pic>). | sequence.pptx |

---

## 1. Wrong Content That Opens Cleanly (Critical Findings)

* **Broken "Editable Shapes" Promise:** The application's changelog promises editable shapes in PowerPoint and Excel. However, while **flowcharts** and **mindmaps** correctly generate native vector shapes, **pie charts**, **gantt charts**, and **sequence diagrams** fall back to embedding a single flat raster image. They are not editable.
* **Leaked Default Title:** The default "Flowchart Preview" title string leaks into the PPTX exports of non-flowchart diagrams (e.g., pie.pptx internal XML contains "Flowchart Preview").

## 2. Fails to Open or Prompts for Repair

* **None Found:** All generated .pptx and .xlsx files were successfully opened via Microsoft Office COM automation without triggering any XML corruption or repair prompts.

## 3. What is Right (To Not Break Later)

* **32-Column Audit Table:** The Excel export for flowcharts correctly generates a SIRENDiagram1 TableStyleMedium2 table containing exactly 32 columns, accurately preserving all audit fields.
* **Romanian Diacritics:** Text encoding is fully preserved across the geometry exports. 
* **Flowchart Editable Geometry:** Flowchart blocks and lines are genuinely converted into native PowerPoint shapes.
