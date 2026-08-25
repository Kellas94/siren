const fs = require('fs');
const B = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/sk_base.json', 'utf8'));
const M = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/sk_merged.json', 'utf8'));

const keys = Object.keys(B.fixtures);
for (const k of keys) {
  const b = B.fixtures[k], m = M.fixtures[k];
  console.log('\n================ ' + k + ' ================');
  console.log('sourceMatches base=' + b.sourceMatches + ' merged=' + (m && m.sourceMatches));
  if (b.exportError || (m && m.exportError)) console.log('exportError base=' + b.exportError + ' merged=' + (m && m.exportError));
  console.log('exportStatus base=' + JSON.stringify(b.exportStatus) + '\n             merged=' + JSON.stringify(m && m.exportStatus));
  console.log('slideBytes base=' + b.slideBytes + ' merged=' + (m && m.slideBytes) + '  hasPicture base=' + b.hasPicture + ' merged=' + (m && m.hasPicture));
  if (b.svg) {
    b.svg.nodes.forEach((n, i) => {
      const mn = m.svg && m.svg.nodes[i];
      console.log('  SVG node "' + n.text.slice(0, 60) + '" visualLines=' + n.visualLines + '/' + (mn && mn.visualLines) +
        ' widestPaintedPx=' + n.widestPaintedLinePx + ' nodeBoxPx=' + n.nodeBoxPx + ' p=' + n.pTagCount + ' tspan=' + n.tspanCount + ' font=' + n.fontFamily + ' ' + n.fontSizePx);
    });
    b.svg.edges.forEach(e => console.log('  SVG edgeLabel "' + e.text.slice(0, 60) + '" w=' + e.w + ' h=' + e.h));
  }
  if (!b.shapes) continue;
  const wrapB = {}, wrapM = {};
  b.shapes.forEach(s => { wrapB[s.wrap] = (wrapB[s.wrap] || 0) + 1; });
  (m.shapes || []).forEach(s => { wrapM[s.wrap] = (wrapM[s.wrap] || 0) + 1; });
  console.log('  wrap histogram base=' + JSON.stringify(wrapB) + ' merged=' + JSON.stringify(wrapM));
  const show = b.shapes.length > 12 ? b.shapes.slice(0, 4) : b.shapes;
  show.forEach((s, i) => {
    const ms = m.shapes[i];
    s.paras.forEach((p, j) => {
      if (!p.measured) return;
      const mp = ms && ms.paras[j] && ms.paras[j].measured;
      console.log('   [' + s.name + '] prst=' + s.prst + ' txBox=' + s.txBox + ' paras=' + s.paras.length +
        ' wrap ' + s.wrap + ' -> ' + (ms && ms.wrap));
      console.log('      text="' + p.measured.text.slice(0, 70) + '" pt=' + p.measured.pt +
        ' run=' + p.measured.runWidthPt + ' longestWord=' + p.measured.longestWordPt +
        ' box=' + p.measured.boxWidthPt + 'x' + p.measured.boxHeightPt +
        ' availBox=' + p.measured.availBoxPt + ' availPreset=' + p.measured.availPresetPt);
      console.log('      overhang vs box=' + p.measured.overhangVsBoxPt + ' vs preset=' + p.measured.overhangVsPresetPt +
        ' word-vs-preset=' + p.measured.wordOverhangVsPresetPt +
        (mp ? ('  |MERGED run=' + mp.runWidthPt + ' box=' + mp.boxWidthPt + ' overhangBox=' + mp.overhangVsBoxPt) : ''));
    });
  });
  // text preservation
  const tb = b.shapes.map(s => s.paras.map(p => p.runs.map(r => r.text).join('')).join('|')).join('~');
  const tm = (m.shapes || []).map(s => s.paras.map(p => p.runs.map(r => r.text).join('')).join('|')).join('~');
  console.log('  TEXT IDENTICAL base==merged: ' + (tb === tm) + '  (shapes ' + b.shapes.length + '/' + (m.shapes || []).length + ')');
}
console.log('\nerrors base=' + JSON.stringify(B.errors) + ' merged=' + JSON.stringify(M.errors));
