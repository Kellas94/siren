#!/usr/bin/env node
/* Is the new type-aware Guided counter honest one step away from its own fixtures?
 *
 * The verification claims it is not: "0 participants · 3 messages" beside a preview that visibly
 * draws three people. If true, that is worse than the lie it replaced - "0 blocks · 0 connections"
 * was uniformly, obviously wrong, and a specific wrong number reads as authoritative.
 *
 * Every source here is ordinary Mermaid a person would actually write, not a hostile edge case.
 *
 * Usage: node verify_counter_honesty.js [--port 9682]
 */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/replay.html');
const PORT = Number(arg('port', '9682'));

const READ = `(() => {
  const c = document.getElementById('structureCount');
  const svg = document.querySelector('#diagram svg');
  return JSON.stringify({
    counter: c ? c.textContent.replace(/\\s+/g, ' ').trim() : null,
    hidden: c ? c.hidden : null,
    // what the DRAWING actually contains, as the honest answer to compare against
    actors: svg ? svg.querySelectorAll('g.actor-man, .actor, rect.actor').length : 0,
    texts: svg ? Array.from(svg.querySelectorAll('text')).map(t => t.textContent.trim()).filter(Boolean).slice(0, 12) : []
  });
})()`;

const CASES = [
  {
    id: 'sequence.implicitParticipants',
    // The most common way anyone writes a sequence diagram: no participant lines at all.
    src: 'sequenceDiagram\n  Alice->>Bob: Request approval\n  Bob->>Carol: Escalate\n  Carol->>Alice: Approved',
    expect: /3 participants/,
    why: 'three people are drawn, so the count must not say 0',
  },
  {
    id: 'gantt.commentNotATask',
    src: 'gantt\n  title Plan\n  %% this is a note to myself, not a task\n  section One\n  Task A :a1, 2026-01-01, 30d\n  Task B :after a1, 20d',
    expect: /2 tasks/,
    why: 'a %% comment line is not a task',
  },
  {
    id: 'mindmap.iconNotANode',
    src: 'mindmap\n  root((Root))\n    A\n    ::icon(fa fa-book)\n    B',
    expect: /3 nodes/,
    why: 'an ::icon() line decorates a node, it is not one',
  },
  {
    id: 'flowchart.control',
    src: 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]\n  C --> A',
    expect: /3 blocks/,
    why: 'the fixture the patch was written for - the positive control',
  },
];

(async () => {
  const { page, errors, close } = await openApp(APP, PORT);

  for (const c of CASES) {
    await setSource(page, c.src, 3800);
    await openGuided(page);
    await page.waitForTimeout(500);
    const r = JSON.parse(await page.evaluate(READ));
    const ok = c.expect.test(r.counter || '');
    check(c.id, ok, `${c.why} → matches ${c.expect}`,
      `counter=${JSON.stringify(r.counter)}${r.actors ? ` | drawing shows ${r.actors} actors` : ''}` +
      `${r.texts.length ? ` | text in drawing: ${r.texts.slice(0, 6).join(', ')}` : ''}`);
  }

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/counter_honesty.png' });
  await close();
  process.exit(report('counter honesty') ? 1 : 0);
})();
