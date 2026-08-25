const fs = require('fs');
const B = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/bf2_base.json', 'utf8'));
const M = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/bf2_merged.json', 'utf8'));
const L = console.log;

for (const k of Object.keys(B.fixtures)) {
  const b = B.fixtures[k], m = M.fixtures[k];
  L('===== ' + k + ' =====');
  L(' srcOK b=' + b.sourceMatches + ' m=' + m.sourceMatches);
  L(' svg nodes base: ' + JSON.stringify(b.svgNodeDump));
  L(' svg nodes merg: ' + JSON.stringify(m.svgNodeDump));
  L(' downloadFailed b=' + b.downloadFailed + ' m=' + m.downloadFailed);
  L(' exportStatus b=' + JSON.stringify(b.exportStatus));
  L(' exportStatus m=' + JSON.stringify(m.exportStatus));
  if (b.toasts && b.toasts.length) L(' toasts b=' + JSON.stringify(b.toasts));
  if (m.toasts && m.toasts.length) L(' toasts m=' + JSON.stringify(m.toasts));
  if (!b.shapes || !m.shapes) { L(''); continue; }
  L(' slideBytes b=' + b.slideBytes + ' m=' + m.slideBytes + ' delta=' + (m.slideBytes - b.slideBytes));
  const summarise = (s, tag) => {
    const rects = s.shapes.filter(x => !x.txBox);
    const lbl = s.shapes.filter(x => x.txBox);
    L('  ' + tag + ' sp=' + s.shapes.length + ' boxes=' + rects.length + ' labels=' + lbl.length
      + ' boxWrap=' + Array.from(new Set(rects.map(x => x.wrap))).join(',')
      + ' labelWrap=' + Array.from(new Set(lbl.map(x => x.wrap))).join(','));
  };
  summarise(b, 'BASE  '); summarise(m, 'MERGED');
  const sample = (s, tag, filter) => {
    const shapes = s.shapes.filter(filter);
    if (!shapes.length) return;
    const sh = shapes[0];
    const c = sh.paras.map(p => p.calc).filter(Boolean)[0];
    L('  ' + tag + ' ' + sh.name + ' [' + sh.prst + (sh.txBox ? ' txBox' : '') + '] wrap=' + sh.wrap
      + (c ? ' | "' + c.text + '" ' + c.pt + 'pt box=' + c.boxWidthPt + ' avail=' + c.availPt
        + ' run=' + c.fullRunPt + ' longestWord=' + c.longestWordPt
        + ' overVsBox=' + c.overhangVsBoxPt + ' overVsAvail=' + c.overhangVsAvailPt
        + ' linesIfSquare=' + c.wrapLinesIfSquare + ' wordTooWide=' + c.wordLongerThanAvail
        + ' boxH=' + c.boxHeightPt + ' textH=' + c.textHeightIfWrappedPt : ''));
  };
  sample(b, 'BASE   label ', x => x.txBox);
  sample(m, 'MERGED label ', x => x.txBox);
  sample(b, 'BASE   box   ', x => !x.txBox);
  sample(m, 'MERGED box   ', x => !x.txBox);
  // aggregate over all labels
  const agg = (s, tag) => {
    const lbl = s.shapes.filter(x => x.txBox);
    const cs = lbl.flatMap(x => x.paras.map(p => p.calc).filter(Boolean));
    if (!cs.length) return;
    L('  ' + tag + ' labels n=' + cs.length
      + ' overflowVsBox=' + cs.filter(c => c.overhangVsBoxPt > 0).length
      + ' overflowVsAvail=' + cs.filter(c => c.overhangVsAvailPt > 0).length
      + ' wouldWrapTo2plus=' + cs.filter(c => c.wrapLinesIfSquare > 1).length
      + ' wordWiderThanAvail=' + cs.filter(c => c.wordLongerThanAvail).length
      + ' textTallerThanBoxIfWrapped=' + cs.filter(c => c.textHeightIfWrappedPt > c.boxHeightPt).length);
  };
  agg(b, 'BASE  '); agg(m, 'MERGED');
  // text preservation
  const all = s => s.shapes.flatMap(x => x.paras.flatMap(p => p.runs.map(r => r.text))).sort();
  const ab = all(b), am = all(m);
  L('  runs base=' + ab.length + ' merged=' + am.length + ' identical=' + (JSON.stringify(ab) === JSON.stringify(am)));
  if (JSON.stringify(ab) !== JSON.stringify(am)) {
    L('   base-only ' + JSON.stringify(ab.filter(x => !am.includes(x))));
    L('   merg-only ' + JSON.stringify(am.filter(x => !ab.includes(x))));
  }
  L('');
}
L('base errors: ' + JSON.stringify(B.errors));
L('merged errors: ' + JSON.stringify(M.errors));
