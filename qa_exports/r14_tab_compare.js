const b = require('C:/Claude/SIREN/qa_exports/r14_tab_base.json');
const m = require('C:/Claude/SIREN/qa_exports/r14_tab_merged.json');
const by = j => Object.fromEntries(j.scenarios.map(s => [s.name, s]));
const B = by(b), M = by(m);
const KEYS = [
  'tabsToCard', 'startFocus', 'focusAtEnd', 'tourStillUp',
  'up_editorIndented', 'up_editorLenBefore', 'up_editorLenAfter', 'up_editorFocusAfterTab',
  'up_visualPanel', 'up_labelTyped', 'up_labelAfterTab', 'up_focusAfterTabInBuilder',
  'up_tabsToAddBlock', 'up_labelAtAddBlock', 'up_nodesBefore', 'up_nodesAfter', 'up_sourceHasBlock',
  'up_of19', 'up_missing19', 'up_stopsInCard', 'up_distinctAppStops',
  'up_menuFocusAfterTab', 'up_menuStillOpenAfterTab', 'tourAtEnd',
  'gone_editorIndented', 'gone_focusAfterTabInBuilder', 'gone_tabsToAddBlock', 'gone_nodesAfter',
  'gone_sourceHasBlock', 'gone_of19', 'gone_stopsInCard', 'gone_menuFocusAfterTab',
  'visualPanel', 'labelTyped', 'focusAfterTab', 'labelAfterTab', 'tourAfterEnter',
  'labelAfterEnter', 'nodesAfterEnter', 'sourceHasBlock', 'labelSurvived',
  'lenBefore', 'lenAfter', 'outdented', 'focusAfter', 'errors', 'threw'
];
for (const name of Object.keys(B)) {
  console.log('\n=== ' + name);
  const sb = B[name], sm = M[name] || {};
  for (const k of KEYS) {
    if (sb[k] === undefined && sm[k] === undefined) continue;
    const x = JSON.stringify(sb[k]), y = JSON.stringify(sm[k]);
    const same = x === y;
    console.log('  ' + (same ? '[same] ' : '[DIFF] ') + k.padEnd(26) + ' base=' + x + (same ? '' : '   merged=' + y));
  }
}
