#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'B9DEBE9491301526540C9672DC9A99C7EAD7C14C51E1C52CAA050936CA8DE511';
const EXPECTED_OUTPUT_SHA256 = '079C733BC0E38A031AA7210179C7D9BEE740A7C50A0B2CA488B0312BEBA46B72';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function occurrenceCount(text, needle) {
  return text.split(needle).length - 1;
}

function replaceExact(text, oldText, newText, expected = 1) {
  const count = occurrenceCount(text, oldText);
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 120)}`);
  return text.split(oldText).join(newText);
}

function uniqueLine(text, needle, label) {
  const lines = text.split(/\r?\n/).filter(line => line.includes(needle));
  requireTrue(lines.length === 1, `${label} line count ${lines.length}, expected 1`);
  return lines[0];
}

function protectedSlice(text, startAnchor, endAnchor, label) {
  requireTrue(occurrenceCount(text, startAnchor) === 1, `${label} start anchor is not unique`);
  requireTrue(occurrenceCount(text, endAnchor) === 1, `${label} end anchor is not unique`);
  const start = text.indexOf(startAnchor);
  const end = text.indexOf(endAnchor, start + startAnchor.length);
  requireTrue(start >= 0 && end > start, `${label} anchors are out of order`);
  return text.slice(start, end);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');

  const appVersionBefore = uniqueLine(original, 'const APP_VERSION =', 'APP_VERSION');
  const cspBefore = uniqueLine(original, 'http-equiv="Content-Security-Policy"', 'CSP');
  const changelogBefore = protectedSlice(original,
    '      const CHANGELOG = [',
    '      function themeIntroOverlayFor(key) {',
    'CHANGELOG');
  const excelTextWriterBefore = protectedSlice(original,
    '      function ooxmlTextBody(shape) {',
    '      function ooxmlLineProperties(colour, widthPx, dashed, arrow) {',
    'Excel text writer');
  const deckTextWriterBefore = protectedSlice(original,
    '      function deckShapeTextBody(shape, wrap) {',
    "      /* THE DECK'S SHAPE WRITER.",
    'deck text writer');

  let text = original;

  text = replaceExact(text,
`        const asSlideText = xml => xml.replace(/<(\\/?)xdr:txBody/g, '<$1p:txBody');
        let nextId = 3;

        return shapes.slice().sort((a, b) => a.z - b.z).map(shape => {`,
`        let nextId = 3;
        let minimumFontPt = Infinity;
        // Reuse the deck's proven PowerPoint-only text body. It keeps overflow visible
        // and permits true-size type down to PowerPoint's 1pt floor without changing
        // ooxmlTextBody, which remains the Excel writer.
        const slideText = (shape, wrap) => {
          const emittedFontPt = Math.round(clamp(Number(shape.fontSize) || 10, 1, 40) * 100) / 100;
          if (Array.isArray(shape.lines) && shape.lines.some(line => String(line || '').trim())) {
            minimumFontPt = Math.min(minimumFontPt, emittedFontPt);
          }
          return deckShapeTextBody(shape, wrap);
        };

        const xml = shapes.slice().sort((a, b) => a.z - b.z).map(shape => {`);

  text = replaceExact(text,
`          if (shape.kind === 'text') {
            return \`<p:sp><p:nvSpPr><p:cNvPr id="\${id}" name="\${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>\`
              + \`<p:spPr><a:xfrm><a:off x="\${toX(shape.x)}" y="\${toY(shape.y)}"/><a:ext cx="\${cx}" cy="\${cy}"/></a:xfrm>\`
              + \`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>\`
              + asSlideText(ooxmlTextBody(scaled)) + '</p:sp>';
          }`,
`          if (shape.kind === 'text') {
            return \`<p:sp><p:nvSpPr><p:cNvPr id="\${id}" name="\${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>\`
              + \`<p:spPr><a:xfrm><a:off x="\${toX(shape.x)}" y="\${toY(shape.y)}"/><a:ext cx="\${cx}" cy="\${cy}"/></a:xfrm>\`
              + \`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>\`
              + slideText(scaled, false) + '</p:sp>';
          }`);

  text = replaceExact(text,
`          return \`<p:sp><p:nvSpPr><p:cNvPr id="\${id}" name="\${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>\`
            + \`<p:spPr><a:xfrm><a:off x="\${toX(shape.x)}" y="\${toY(shape.y)}"/><a:ext cx="\${cx}" cy="\${cy}"/></a:xfrm>\`
            + \`\${geometry}\${fill}\${line}</p:spPr>\` + asSlideText(ooxmlTextBody(scaled)) + '</p:sp>';
        }).join('');
      }

      /* A diagram shape's words on the deck slide.`,
`          return \`<p:sp><p:nvSpPr><p:cNvPr id="\${id}" name="\${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>\`
            + \`<p:spPr><a:xfrm><a:off x="\${toX(shape.x)}" y="\${toY(shape.y)}"/><a:ext cx="\${cx}" cy="\${cy}"/></a:xfrm>\`
            + \`\${geometry}\${fill}\${line}</p:spPr>\`
            + slideText(scaled, !shape.pill && !Number.isFinite(shape.adjust)
              && (shape.preset === 'rect' || shape.preset === 'roundRect'))
            + '</p:sp>';
        }).join('');
        return {
          xml,
          minimumFontPt: Number.isFinite(minimumFontPt) ? minimumFontPt : 0
        };
      }

      /* A diagram shape's words on the deck slide.`);

  text = replaceExact(text,
`      async function buildPptxBlob() {
        let editableDiagramShapes = '';
        try {
          const drawing = collectDiagramDrawing();
          if (drawing && drawing.shapes.length) editableDiagramShapes = buildEditableSlideShapes(drawing.shapes, drawing.unit, 12192000, 6858000, 685800, 0);
        } catch (error) {
          console.warn('Editable PowerPoint geometry could not be read; exporting a picture instead.', error);
        }`,
`      async function buildPptxBlob() {
        let editableDiagramShapes = '';
        let editableDiagramMinimumFontPt = 0;
        try {
          const drawing = collectDiagramDrawing();
          if (drawing && drawing.shapes.length) {
            const editable = buildEditableSlideShapes(drawing.shapes, drawing.unit, 12192000, 6858000, 685800, 0);
            editableDiagramShapes = editable.xml;
            editableDiagramMinimumFontPt = editable.minimumFontPt;
          }
        } catch (error) {
          console.warn('Editable PowerPoint geometry could not be read; exporting a picture instead.', error);
        }`);

  text = replaceExact(text,
`        blob.sirenRasterFallbacks = editableDiagramShapes ? [] : [diagramTypeLabel(type)];
        return blob;`,
`        blob.sirenRasterFallbacks = editableDiagramShapes ? [] : [diagramTypeLabel(type)];
        blob.sirenMinimumFontPt = editableDiagramShapes ? editableDiagramMinimumFontPt : 0;
        return blob;`);

  text = replaceExact(text,
`          const officeFallbacks = blob && Array.isArray(blob.sirenRasterFallbacks) ? blob.sirenRasterFallbacks : [];
          const officeMessage = (format === 'pptx' || format === 'xlsx')
            ? (officeFallbacks.length
              ? \`\${formatLabel} export prepared as one picture for \${officeFallbacks.join(', ')}. The Mermaid source remains editable in Siren.\`
              : \`\${formatLabel} export prepared with editable shapes.\`)
            : '';`,
`          const officeFallbacks = blob && Array.isArray(blob.sirenRasterFallbacks) ? blob.sirenRasterFallbacks : [];
          const officeMinimumFontPt = format === 'pptx' ? Number(blob && blob.sirenMinimumFontPt) : 0;
          const officeSmallTypeNote = format === 'pptx'
            && !officeFallbacks.length
            && Number.isFinite(officeMinimumFontPt)
            && officeMinimumFontPt > 0
            && officeMinimumFontPt < PDF_MIN_FONT_PT
            ? \` The smallest text falls under \${PDF_MIN_FONT_PT}pt at this slide size: \${officeMinimumFontPt.toFixed(1)}pt. A horizontal layout, fewer blocks or a larger diagram font would lift it.\`
            : '';
          const officeMessage = (format === 'pptx' || format === 'xlsx')
            ? (officeFallbacks.length
              ? \`\${formatLabel} export prepared as one picture for \${officeFallbacks.join(', ')}. The Mermaid source remains editable in Siren.\`
              : \`\${formatLabel} export prepared with editable shapes.\` + officeSmallTypeNote)
            : '';`);

  text = replaceExact(text,
`          if (format === 'pdf' && pdfMetadata) {
            el.exportReadyText.textContent = (pdfMetadata.layout === 'tile'
              ? \`The diagram was exported on \${pdfPageLabel}.\`
              : 'The diagram fits legibly on one page.')
              + pdfFidelityNote
              + ' The browser was asked to download it automatically; use “Download now” if needed.';
            setExportStatus(successMessage, pdfMetadata.rasterFallback ? 'working' : 'good');
          }
          showToast(successMessage, 'success');`,
`          if (format === 'pdf' && pdfMetadata) {
            el.exportReadyText.textContent = (pdfMetadata.layout === 'tile'
              ? \`The diagram was exported on \${pdfPageLabel}.\`
              : 'The diagram fits legibly on one page.')
              + pdfFidelityNote
              + ' The browser was asked to download it automatically; use “Download now” if needed.';
            setExportStatus(successMessage, pdfMetadata.rasterFallback ? 'working' : 'good');
          } else if (format === 'pptx') {
            setExportStatus(successMessage, officeSmallTypeNote ? 'working' : 'good');
          }
          showToast(successMessage, 'success');`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/asSlideText/g) || []).length === 0, 'obsolete Excel-to-PowerPoint namespace shim remains');
  requireTrue((text.match(/slideText\(scaled,/g) || []).length === 2, 'PowerPoint text-body call census changed');
  requireTrue(text.includes('minimumFontPt: Number.isFinite(minimumFontPt) ? minimumFontPt : 0'), 'minimum emitted font metadata is missing');
  requireTrue((text.match(/sirenMinimumFontPt/g) || []).length === 2, 'PowerPoint minimum-font blob metadata census changed');
  requireTrue(text.includes('The smallest text falls under ${PDF_MIN_FONT_PT}pt at this slide size: ${officeMinimumFontPt.toFixed(1)}pt.'), 'under-9pt disclosure is missing');
  requireTrue(text.includes("setExportStatus(successMessage, officeSmallTypeNote ? 'working' : 'good');"), 'PowerPoint export status is not updated after delivery');
  requireTrue((text.match(/ooxmlTextBody\(scaled\)/g) || []).length === 2, 'Excel text writer call census changed');
  requireTrue(occurrenceCount(text, 'function deckShapeTextBody(shape, wrap) {') === 1, 'deck text writer definition changed');

  requireTrue(uniqueLine(text, 'const APP_VERSION =', 'APP_VERSION') === appVersionBefore, 'APP_VERSION changed');
  requireTrue(uniqueLine(text, 'http-equiv="Content-Security-Policy"', 'CSP') === cspBefore, 'CSP changed');
  requireTrue(protectedSlice(text,
    '      const CHANGELOG = [',
    '      function themeIntroOverlayFor(key) {',
    'CHANGELOG') === changelogBefore, 'CHANGELOG changed');
  requireTrue(protectedSlice(text,
    '      function ooxmlTextBody(shape) {',
    '      function ooxmlLineProperties(colour, widthPx, dashed, arrow) {',
    'Excel text writer') === excelTextWriterBefore, 'Excel text writer changed');
  requireTrue(protectedSlice(text,
    '      function deckShapeTextBody(shape, wrap) {',
    "      /* THE DECK'S SHAPE WRITER.",
    'deck text writer') === deckTextWriterBefore, 'deck text writer changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') {
    requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  }
  const temporary = path.join(path.dirname(target), `.r11aw-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R11_AW applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
