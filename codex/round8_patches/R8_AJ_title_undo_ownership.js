#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EXPECTED_INPUT_SHA256 = '6885555CE62C50D030E0948439C9193AFADD45E7A82638A74862D92913CF5A3E';
const EXPECTED_OUTPUT_SHA256 = 'AC14DB72BC38EF72799B8A323DB649057F63227E84588FD18D79C438E824F844';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}
function main() {
  requireTrue(process.argv.length === 3, 'usage: node R8_AJ_title_undo_ownership.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target), beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8'); let text = original;

  text = replaceExact(text,
`            source: DEFAULT_SOURCE,
            diagramTitle: 'Flowchart Preview',
            direction: 'TD',`,
`            source: DEFAULT_SOURCE,
            diagramTitle: 'Flowchart Preview',
            diagramTitleTouched: false,
            direction: 'TD',`);

  text = replaceExact(text,
`        el.diagramTitle.addEventListener('input', () => {
          state.diagramTitle = el.diagramTitle.value;
          syncActiveDiagramFromAliases();
          updateTitlePreview();
          scheduleSave();
        });`,
`        el.diagramTitle.addEventListener('input', () => {
          state.diagramTitle = el.diagramTitle.value;
          syncActiveDiagramFromAliases();
          const diagram = getActiveDiagram();
          if (diagram) diagram.diagramTitleTouched = true;
          diagramTitleUndoPending = true;
          updateTitlePreview();
          scheduleSave();
          scheduleUndoSnapshot();
        });`);

  text = replaceExact(text,
`      function diagramTypeLabel(type) {
        return ({ flowchart:'Flowchart', swimlane:'Swimlane', state:'State diagram', sequence:'Sequence diagram',
          architecture:'Architecture', c4:'C4 context', er:'ER diagram', class:'Class diagram', block:'Block diagram',
          gantt:'Gantt', timeline:'Timeline', kanban:'Kanban', journey:'Journey map',
          mindmap:'Mindmap', ishikawa:'Ishikawa', requirement:'Requirement diagram',
          gitgraph:'Git graph', xy:'XY chart', pie:'Pie chart', advanced:'Advanced Mermaid' })[type] || 'Mermaid';
      }
`,
`      function diagramTypeLabel(type) {
        return ({ flowchart:'Flowchart', swimlane:'Swimlane', state:'State diagram', sequence:'Sequence diagram',
          architecture:'Architecture', c4:'C4 context', er:'ER diagram', class:'Class diagram', block:'Block diagram',
          gantt:'Gantt', timeline:'Timeline', kanban:'Kanban', journey:'Journey map',
          mindmap:'Mindmap', ishikawa:'Ishikawa', requirement:'Requirement diagram',
          gitgraph:'Git graph', xy:'XY chart', pie:'Pie chart', advanced:'Advanced Mermaid' })[type] || 'Mermaid';
      }

      // Saved diagrams predate the explicit ownership flag. Preserve every legacy
      // title except the generated family defaults that were designed to follow type.
      function diagramTitleWasTouched(diagram) {
        if (!diagram || typeof diagram !== 'object') return false;
        if (typeof diagram.diagramTitleTouched === 'boolean') return diagram.diagramTitleTouched;
        const title = String(diagram.diagramTitle || '').trim();
        const generated = ['flowchart','swimlane','state','sequence','architecture','c4','er','class','block',
          'gantt','timeline','kanban','journey','mindmap','ishikawa','requirement','gitgraph','xy','pie','advanced']
          .some(type => title === diagramTypeLabel(type) + ' Preview');
        return Boolean(title && !generated);
      }
`);

  text = replaceExact(text,
`          diagramTitle: diagram.diagramTitle || diagram.name || \`Diagram \${index + 1}\`,
          direction: diagram.direction || detectDirectionFromSource(diagram.source) || 'TD',`,
`          diagramTitle: diagram.diagramTitle || diagram.name || \`Diagram \${index + 1}\`,
          diagramTitleTouched: diagramTitleWasTouched(diagram),
          direction: diagram.direction || detectDirectionFromSource(diagram.source) || 'TD',`);

  text = replaceExact(text,
`          source: 'flowchart TD\\n    A[Start] --> B[Next step]',
          diagramTitle: name,
          direction: 'TD',`,
`          source: 'flowchart TD\\n    A[Start] --> B[Next step]',
          diagramTitle: name,
          diagramTitleTouched: true,
          direction: 'TD',`);

  text = replaceExact(text,
`        copy.diagramTitle = (active.diagramTitle || active.name) === active.name
          ? copy.name
          : \`\${active.diagramTitle || active.name} copy\`;
        state.diagrams.push(copy);`,
`        copy.diagramTitle = (active.diagramTitle || active.name) === active.name
          ? copy.name
          : \`\${active.diagramTitle || active.name} copy\`;
        copy.diagramTitleTouched = true;
        state.diagrams.push(copy);`);

  text = replaceExact(text,
`        copy.diagramTitle = (source.diagramTitle || source.name) === source.name
          ? copy.name
          : \`\${source.diagramTitle || source.name} copy\`;
        state.diagrams.splice(index + 1, 0, copy);`,
`        copy.diagramTitle = (source.diagramTitle || source.name) === source.name
          ? copy.name
          : \`\${source.diagramTitle || source.name} copy\`;
        copy.diagramTitleTouched = true;
        state.diagrams.splice(index + 1, 0, copy);`);

  text = replaceExact(text,
`      function handleSourceInput() {
        const previousType = detectMermaidDiagramType(state.source || '');`,
`      function handleSourceInput() {
        // Commit the title while the old source is still current. Otherwise the next
        // source snapshot groups both edits and one Undo erases the person's title.
        if (diagramTitleUndoPending) commitUndoSnapshot();
        const previousType = detectMermaidDiagramType(state.source || '');`);

  text = replaceExact(text,
`      function synchronizeDefaultDiagramTitle(previousType, source) {
        if (!el.diagramTitle) return;
        const current = String(el.diagramTitle.value || '').trim();`,
`      function synchronizeDefaultDiagramTitle(previousType, source) {
        if (!el.diagramTitle) return;
        const diagram = getActiveDiagram();
        if (diagram && diagram.diagramTitleTouched) return;
        const current = String(el.diagramTitle.value || '').trim();`);

  text = replaceExact(text,
`      // Undo covers the whole diagram, not just the Mermaid text: block styles, style
      // classes, connector styles, legend and typography are all part of an entry.
      let restoringUndo = false;`,
`      // Undo covers the whole diagram, not just the Mermaid text: block styles, style
      // classes, connector styles, legend and typography are all part of an entry.
      let restoringUndo = false;
      let diagramTitleUndoPending = false;`);

  text = replaceExact(text,
`      function commitUndoSnapshot() {
        clearTimeout(undoTimer);
        if (restoringUndo) return;`,
`      function commitUndoSnapshot() {
        diagramTitleUndoPending = false;
        clearTimeout(undoTimer);
        if (restoringUndo) return;`);

  text = replaceExact(text,
`      function applySource(source, { reason = 'Source replaced', recordUndo = true, saveVersion = false } = {}) {
        const previousType = detectMermaidDiagramType(el.source?.value || state.source || '');`,
`      function applySource(source, { reason = 'Source replaced', recordUndo = true, saveVersion = false } = {}) {
        if (diagramTitleUndoPending) commitUndoSnapshot();
        const previousType = detectMermaidDiagramType(el.source?.value || state.source || '');`);

  text = replaceExact(text,
`        return {
          diagramTitle: diagram.diagramTitle,
          direction: diagram.direction,`,
`        return {
          diagramTitle: diagram.diagramTitle,
          diagramTitleTouched: Boolean(diagram.diagramTitleTouched),
          direction: diagram.direction,`);

  text = replaceExact(text,
`        if (snapshot.diagramTitle) diagram.diagramTitle = snapshot.diagramTitle;
        if (snapshot.direction) diagram.direction = snapshot.direction;`,
`        if (snapshot.diagramTitle) diagram.diagramTitle = snapshot.diagramTitle;
        if (typeof snapshot.diagramTitleTouched === 'boolean') diagram.diagramTitleTouched = snapshot.diagramTitleTouched;
        if (snapshot.direction) diagram.direction = snapshot.direction;`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/diagramTitleTouched/g) || []).length >= 12, 'title ownership flag post-condition failed');
  requireTrue((text.match(/if \(diagramTitleUndoPending\) commitUndoSnapshot\(\);/g) || []).length === 2, 'source boundary commits missing');
  requireTrue(text.includes("if (diagram && diagram.diagramTitleTouched) return;"), 'generated-title synchronizer still ignores ownership');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8'), afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r8aj-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R8_AJ applied: ${beforeHash} -> ${afterHash}\n`);
}
main();
