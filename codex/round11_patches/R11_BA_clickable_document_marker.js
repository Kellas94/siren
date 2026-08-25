#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'A4ECD8BD60784D0E6CBAA1C539F3034596387581FC4685F53FA31C18CFAF0A08';
const EXPECTED_OUTPUT_SHA256 = '539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 120)}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`    #diagram .t-comment-badge text { fill:var(--primary-text); font-size:9px; font-weight:900; pointer-events:none; }`,
`    #diagram .t-comment-badge text { fill:var(--primary-text); font-size:9px; font-weight:900; pointer-events:none; }
    /* This outer rule affects only the running app. Exported SVG carries no dead
       button role or tabindex and therefore makes no interaction promise. */
    #diagram [data-t-workpaper-node] { cursor:pointer; }`);

  text = replaceExact(text,
`            const marker = root.ownerDocument.createElementNS(ns, 'text');
            marker.setAttribute('x', String(box.x + box.width - 13));
            marker.setAttribute('y', String(box.y + 15));`,
`            const marker = root.ownerDocument.createElementNS(ns, 'g');
            marker.setAttribute('data-t-workpaper-node', id);
            const markerHit = root.ownerDocument.createElementNS(ns, 'rect');
            markerHit.setAttribute('x', String(box.x + box.width - 18));
            markerHit.setAttribute('y', String(box.y + 1));
            markerHit.setAttribute('width', '18');
            markerHit.setAttribute('height', '18');
            markerHit.setAttribute('fill', 'transparent');
            markerHit.setAttribute('pointer-events', 'all');
            const markerGlyph = root.ownerDocument.createElementNS(ns, 'text');
            markerGlyph.setAttribute('x', String(box.x + box.width - 13));
            markerGlyph.setAttribute('y', String(box.y + 15));
            markerGlyph.setAttribute('fill', preset.nodeAccentBorder);
            markerGlyph.setAttribute('font-family', family);
            markerGlyph.setAttribute('font-size', '11.5');
            markerGlyph.setAttribute('font-weight', '900');
            markerGlyph.setAttribute('pointer-events', 'none');
            markerGlyph.textContent = '\\u25a4';
            marker.append(markerHit, markerGlyph);`);

  text = replaceExact(text,
`            marker.setAttribute('fill', preset.nodeAccentBorder);
            marker.setAttribute('font-family', family);
            marker.setAttribute('font-size', '11.5');
            marker.setAttribute('font-weight', '900');
            marker.textContent = '\\u25a4';
            const docTitle = root.ownerDocument.createElementNS(ns, 'title');`,
`            const docTitle = root.ownerDocument.createElementNS(ns, 'title');`);

  text = replaceExact(text,
`            docTitle.textContent = docsHere.length === 1
              ? \`\${docsHere[0].ref} \\u00b7 \${docsHere[0].title} \\u2014 open it from this block's inspector\`
              : \`\${docsHere.length} workpapers document this step \\u2014 open them from this block's inspector\`;`,
`            docTitle.textContent = docsHere.length === 1
              ? \`\${docsHere[0].ref} \\u00b7 \${docsHere[0].title} \\u2014 click to open\`
              : \`\${docsHere.length} workpapers document this step \\u2014 click to choose\`;`);

  text = replaceExact(text,
`      function handlePreviewNodeClick(event) {
        // The click that ends a body drag on the canvas is the drag's release, not a click.`,
`      function handlePreviewNodeClick(event) {
        const workpaperMarker = event.target instanceof Element
          ? event.target.closest('[data-t-workpaper-node]') : null;
        if (workpaperMarker) {
          const nodeId = workpaperMarker.getAttribute('data-t-workpaper-node') || '';
          const linkedDocs = workpaperDocsByNode(state.activeDiagramId).get(nodeId) || [];
          event.preventDefault();
          event.stopImmediatePropagation();
          // One named destination can open directly. With several, choosing the first
          // would be arbitrary, so reveal the inspector's complete document list.
          if (linkedDocs.length === 1) {
            openNodeWorkpaper(linkedDocs[0]);
            return;
          }
          const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
          if (anchor) {
            openNodeInspector(nodeId, anchor);
            const documentation = el.nodeDocList && el.nodeDocList.closest('details');
            if (documentation) {
              documentation.open = true;
              requestAnimationFrame(() => documentation.scrollIntoView({ block: 'nearest' }));
            }
          }
          return;
        }
        // The click that ends a body drag on the canvas is the drag's release, not a click.`);

  text = replaceExact(text,
`          'button, input, select, a, #diagram [data-handle-for], #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key], #diagram path.t-edge-hitarea, #diagram path.flowchart-link, #diagram path[id*="L_"], #diagram path[id*="L-"], #diagram .edgePath, #diagram .edgeLabel'`,
`          'button, input, select, a, #diagram [data-handle-for], #diagram [data-t-workpaper-node], #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key], #diagram path.t-edge-hitarea, #diagram path.flowchart-link, #diagram path[id*="L_"], #diagram path[id*="L-"], #diagram .edgePath, #diagram .edgeLabel'`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/#diagram \[data-t-workpaper-node\] \{ cursor:pointer; \}/g) || []).length === 1,
    'live-only document marker cursor missing');
  requireTrue((text.match(/marker\.setAttribute\('data-t-workpaper-node', id\)/g) || []).length === 1,
    'document marker node identity missing');
  requireTrue((text.match(/markerHit\.setAttribute\('pointer-events', 'all'\)/g) || []).length === 1,
    'document marker has no forgiving physical hit target');
  requireTrue((text.match(/markerGlyph\.setAttribute\('pointer-events', 'none'\)/g) || []).length === 1,
    'hollow glyph can still steal the hit from its target');
  requireTrue(text.includes('workpapers document this step \\u2014 click to choose'),
    'multi-document marker tooltip is not truthful');
  requireTrue(text.includes('title} \\u2014 click to open'),
    'single-document marker tooltip is not truthful');
  requireTrue(!text.includes("open it from this block's inspector"),
    'stale single-document marker tooltip remains');
  requireTrue((text.match(/target\.closest\('\[data-t-workpaper-node\]'\)/g) || []).length === 1,
    'delegated document marker route missing');
  requireTrue((text.match(/linkedDocs\.length === 1/g) || []).length === 1,
    'sole-document direct route missing');
  requireTrue((text.match(/openNodeWorkpaper\(linkedDocs\[0\]\)/g) || []).length === 1,
    'sole linked document does not use the shared opener');
  requireTrue((text.match(/documentation\.open = true/g) || []).length === 1,
    'multi-document disclosure is not expanded');
  requireTrue((text.match(/event\.stopImmediatePropagation\(\)/g) || []).length >= 5,
    'marker click can leak into another canvas action');
  requireTrue((text.match(/#diagram \[data-t-workpaper-node\], #diagram g\.node/g) || []).length === 1,
    'preview pan can still capture the marker press and retarget its click');
  requireTrue(!text.includes("workpaperMarker.setAttribute('role'"), 'document marker exports a dead button role');
  requireTrue(!text.includes("workpaperMarker.setAttribute('tabindex'"), 'document marker exports a dead tab stop');
  requireTrue((text.match(/function nodeWorkpapersFor\(/g) || []).length === 1,
    'required AZ node-document helper missing');
  requireTrue((text.match(/function openNodeWorkpaper\(doc\)/g) || []).length === 1,
    'required AZ document opener missing');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r11ba-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R11_BA applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
