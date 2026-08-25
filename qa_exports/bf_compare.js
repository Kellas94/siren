const fs = require('fs');
const B = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/bf_base.json', 'utf8'));
const M = JSON.parse(fs.readFileSync('C:/Claude/SIREN/qa_exports/bf_merged.json', 'utf8'));

function line(s) { console.log(s); }

line('=== FIXTURE SANITY ===');
for (const k of Object.keys(B.fixtures)) {
  const b = B.fixtures[k], m = M.fixtures[k];
  line([k,
    'srcOK b=' + b.sourceMatches + ' m=' + m.sourceMatches,
    'nodes b=' + b.svgNodes + ' m=' + m.svgNodes,
    'shapes b=' + (b.shapes ? b.shapes.length : 'ERR:' + b.exportError) + ' m=' + (m.shapes ? m.shapes.length : 'ERR:' + m.exportError),
    'pic b=' + b.hasPicture + ' m=' + m.hasPicture,
    'font=' + b.themeMinorFont + '/' + m.themeMinorFont].join(' | '));
}

line('');
line('=== PER-SHAPE wrap / overflow / sz / overhang ===');
for (const k of Object.keys(B.fixtures)) {
  const b = B.fixtures[k], m = M.fixtures[k];
  if (!b.shapes || !m.shapes) continue;
  line('--- ' + k + ' (base ' + b.shapes.length + ' sp, merged ' + m.shapes.length + ' sp) ---');
  const n = Math.max(b.shapes.length, m.shapes.length);
  for (let i = 0; i < n; i++) {
    const bs = b.shapes[i], ms = m.shapes[i];
    const txt = s => s ? s.paras.map(p => p.runs.map(r => r.text).join('')).join(' / ') : '(missing)';
    const meas = s => {
      if (!s) return '';
      const ms2 = s.paras.map(p => p.measured).filter(Boolean);
      if (!ms2.length) return 'no-text';
      const worst = ms2.reduce((a, x) => x.overhangPt > a.overhangPt ? x : a);
      return 'sz=' + worst.pt + 'pt run=' + worst.runWidthPt + 'pt avail=' + worst.availablePt + 'pt over=' + worst.overhangPt + 'pt brk=' + worst.hasBreakOpportunity;
    };
    const changed = !bs || !ms || bs.wrap !== ms.wrap || txt(bs) !== txt(ms) ||
      bs.vertOverflow !== ms.vertOverflow || bs.horzOverflow !== ms.horzOverflow;
    line((changed ? ' * ' : '   ') + (bs ? bs.name : ms.name) + ' [' + (bs ? bs.prst : ms.prst) + (bs && bs.txBox ? ' txBox' : '') + ']');
    line('      BASE   wrap=' + (bs ? bs.wrap : '-') + ' vOv=' + (bs ? bs.vertOverflow : '-') + ' hOv=' + (bs ? bs.horzOverflow : '-') + ' paras=' + (bs ? bs.paras.length : '-') + ' "' + txt(bs) + '" ' + meas(bs));
    line('      MERGED wrap=' + (ms ? ms.wrap : '-') + ' vOv=' + (ms ? ms.vertOverflow : '-') + ' hOv=' + (ms ? ms.horzOverflow : '-') + ' paras=' + (ms ? ms.paras.length : '-') + ' "' + txt(ms) + '" ' + meas(ms));
  }
}

line('');
line('=== TEXT PRESERVATION (every <a:t> string, base vs merged) ===');
for (const k of Object.keys(B.fixtures)) {
  const b = B.fixtures[k], m = M.fixtures[k];
  if (!b.shapes || !m.shapes) continue;
  const all = s => s.shapes.flatMap(sh => sh.paras.flatMap(p => p.runs.map(r => r.text))).sort();
  const ab = all(b), am = all(m);
  const same = JSON.stringify(ab) === JSON.stringify(am);
  line(k + ': runs base=' + ab.length + ' merged=' + am.length + ' identical=' + same);
  if (!same) {
    line('   base-only: ' + JSON.stringify(ab.filter(x => !am.includes(x))));
    line('   merged-only: ' + JSON.stringify(am.filter(x => !ab.includes(x))));
  }
}

line('');
line('=== DENSE44 REGRESSION DETAIL ===');
for (const key of ['dense44']) {
  const b = B.fixtures[key], m = M.fixtures[key];
  if (!b.shapes || !m.shapes) { line('missing'); continue; }
  const stat = s => {
    const rects = s.shapes.filter(x => x.prst === 'rect' && !x.txBox);
    const labels = s.shapes.filter(x => x.txBox);
    const szs = s.shapes.flatMap(x => x.paras.flatMap(p => p.runs.map(r => r.sz)));
    const overs = s.shapes.flatMap(x => x.paras.map(p => p.measured).filter(Boolean).map(mm => mm.overhangPt));
    return {
      totalSp: s.shapes.length, rects: rects.length, txBox: labels.length,
      wrapVals: Array.from(new Set(s.shapes.map(x => x.wrap))).join(','),
      rectWrap: Array.from(new Set(rects.map(x => x.wrap))).join(','),
      labelWrap: Array.from(new Set(labels.map(x => x.wrap))).join(','),
      vOv: Array.from(new Set(s.shapes.map(x => x.vertOverflow))).join(','),
      hOv: Array.from(new Set(s.shapes.map(x => x.horzOverflow))).join(','),
      minSz: Math.min(...szs), maxSz: Math.max(...szs),
      maxOverhang: Math.max(...overs).toFixed(2),
      clipped: s.shapes.filter(x => x.vertOverflow === 'clip' || x.horzOverflow === 'clip').length
    };
  };
  line('BASE   ' + JSON.stringify(stat(b)));
  line('MERGED ' + JSON.stringify(stat(m)));
  line('slideBytes base=' + b.slideBytes + ' merged=' + m.slideBytes);
}

line('');
line('=== EXCEL drawing1.xml ===');
line('base   ' + JSON.stringify({ bytes: B.xlsx.drawing1Bytes, sha: B.xlsx.drawing1Sha, err: B.xlsx.error }));
line('merged ' + JSON.stringify({ bytes: M.xlsx.drawing1Bytes, sha: M.xlsx.drawing1Sha, err: M.xlsx.error }));
line('byte-identical: ' + (B.xlsx.drawing1Sha === M.xlsx.drawing1Sha));
if (B.xlsx.drawing1Text && M.xlsx.drawing1Text && B.xlsx.drawing1Text !== M.xlsx.drawing1Text) {
  const a = B.xlsx.drawing1Text, c = M.xlsx.drawing1Text;
  let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
  line('first divergence at char ' + i);
  line('  base   ...' + a.slice(Math.max(0, i - 80), i + 120));
  line('  merged ...' + c.slice(Math.max(0, i - 80), i + 120));
}
if (B.xlsx.shapes && M.xlsx.shapes) {
  line('xlsx shape wraps base=' + JSON.stringify(Array.from(new Set(B.xlsx.shapes.map(s => s.wrap + '/' + s.vertOverflow + '/' + s.horzOverflow)))));
  line('xlsx shape wraps merged=' + JSON.stringify(Array.from(new Set(M.xlsx.shapes.map(s => s.wrap + '/' + s.vertOverflow + '/' + s.horzOverflow)))));
  line('xlsx texts base=' + JSON.stringify(B.xlsx.shapes.flatMap(s => s.texts)));
  line('xlsx texts merged=' + JSON.stringify(M.xlsx.shapes.flatMap(s => s.texts)));
}

line('');
line('=== CONSOLE / PAGE ERRORS ===');
line('base: ' + JSON.stringify(B.errors));
line('merged: ' + JSON.stringify(M.errors));
