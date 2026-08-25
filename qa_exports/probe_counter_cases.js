#!/usr/bin/env node
/* Where exactly does the type-aware Guided counter stop telling the truth?
 *
 * Two failures are already confirmed (implicit sequence participants, mindmap ::icon lines) and one
 * claimed failure did not reproduce (a %% comment counted as a gantt task). Before writing a fix,
 * measure the whole set, so the patch addresses what is real rather than what was asserted.
 *
 * Every source is ordinary Mermaid somebody would actually write.
 *
 * Usage: node probe_counter_cases.js [--port 9684]
 */
const { openApp, setSource, openGuided, report, check } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/replay.html');
const PORT = Number(arg('port', '9684'));

const READ = `(() => {
  const c = document.getElementById('structureCount');
  return JSON.stringify({ counter: c ? c.textContent.replace(/\\s+/g, ' ').trim() : null, hidden: c ? c.hidden : null });
})()`;

const CASES = [
  ['sequence.implicit', 'sequenceDiagram\n  Alice->>Bob: Ask\n  Bob->>Carol: Escalate\n  Carol->>Alice: Approve', '3 participants · 3 messages'],
  ['sequence.declared', 'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: Ask\n  Bob->>Alice: Reply', '2 participants · 2 messages'],
  ['sequence.mixed', 'sequenceDiagram\n  participant Alice\n  Alice->>Bob: Ask\n  Bob->>Carol: Escalate', '3 participants · 2 messages'],
  ['sequence.withComment', 'sequenceDiagram\n  %% agreed with the client\n  Alice->>Bob: Ask\n  Bob->>Alice: Reply', '2 participants · 2 messages'],
  ['mindmap.icon', 'mindmap\n  root((Root))\n    A\n    ::icon(fa fa-book)\n    B', '3 nodes · 2 links'],
  ['mindmap.plain', 'mindmap\n  root((Root))\n    A\n      A1\n    B', '4 nodes · 3 links'],
  ['mindmap.comment', 'mindmap\n  root((Root))\n  %% a note\n    A\n    B', '3 nodes · 2 links'],
  ['gantt.comment', 'gantt\n  title Plan\n  %% not a task\n  section One\n  Task A :a1, 2026-01-01, 30d\n  Task B :after a1, 20d', '2 tasks · 1 dependency'],
  ['kanban.plain', 'kanban\n  Todo\n    Card one\n    Card two\n  Doing\n    Card three', '2 columns · 3 cards'],
  ['kanban.metadata', 'kanban\n  Todo\n    Card one@{ assigned: "sam" }\n    Card two\n  Doing\n    Card three', '2 columns · 3 cards'],
  ['block.plain', 'block-beta\n  columns 3\n  A B C\n  D E F', '6 blocks'],
  ['flowchart.control', 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]\n  C --> A', '3 blocks · 3 connections'],
];

(async () => {
  const { page, errors, close } = await openApp(APP, PORT);
  const rows = [];
  for (const [id, src, expected] of CASES) {
    await setSource(page, src, 3500);
    await openGuided(page);
    await page.waitForTimeout(400);
    const r = JSON.parse(await page.evaluate(READ));
    rows.push({ id, got: r.counter, expected, ok: r.counter === expected });
  }
  console.log('\n  case                    expected                        got');
  rows.forEach(r => console.log(`  ${r.ok ? ' ' : '!'} ${r.id.padEnd(20)}  ${String(r.expected).padEnd(30)}  ${JSON.stringify(r.got)}`));
  console.log();
  rows.forEach(r => check(r.id, r.ok, r.expected, JSON.stringify(r.got)));
  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  report('counter cases');
  process.exit(0);
})();
