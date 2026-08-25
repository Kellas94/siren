#!/usr/bin/env node
/* Does the rendered SVG say WHICH nodes each edge joins?
 *
 * The nodeoffset spike's central finding was that edges must be identified from the graph, not from
 * geometry - a tolerance wide enough to catch a node's own edges is wide enough to catch its
 * neighbours'. That finding is only actionable if graph identity is actually recoverable at the
 * point where a drag happens. If Mermaid stamps its edge paths with the two node ids, the next spike
 * is straightforward; if it does not, the whole direction needs a different foothold and the brief
 * has to say so.
 *
 * Also measures whether edge LABELS are recoverable the same way, since they were the other thing
 * that broke.
 *
 * Usage: node probe_edge_identity.js [--app <path>] [--port 9688]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/replay.html');
const PORT = Number(arg('port', '9688'));

const SRC = 'flowchart TD\n  A[Purchase request] --> B{Approved}\n  B -->|yes| C[Raise order]\n'
          + '  B -->|no| D[Return to requester]\n  C --> E[Goods received]\n  D --> A\n  E --> F[Invoice matched]';

const INSPECT = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return JSON.stringify({ error: 'no svg' });

  // SIREN adds an invisible wider .t-edge-hitarea path beside each connector so it is easier to
  // click. Those are not edges and carry no id; counting them made a first run of this probe
  // report '6 of 12 identifiable' and look like a finding when it was a filter mistake.
  const paths = Array.from(svg.querySelectorAll('g.edgePaths path, path.flowchart-link'))
    .filter(p => !p.classList.contains('t-edge-hitarea'));
  const edges = paths.map(p => ({
    id: p.id || null,
    cls: p.getAttribute('class') || '',
    dataFrom: p.dataset ? (p.dataset.from || null) : null,
    dataTo: p.dataset ? (p.dataset.to || null) : null,
    parentId: p.parentElement ? (p.parentElement.id || null) : null,
    dHead: (p.getAttribute('d') || '').slice(0, 24)
  }));

  const nodes = Array.from(svg.querySelectorAll('g.node')).map(n => ({
    id: n.id || null,
    dataId: n.dataset ? (n.dataset.id || null) : null,
    cls: n.getAttribute('class') || ''
  }));

  // edge labels - the other thing that broke in the spike
  const labels = Array.from(svg.querySelectorAll('g.edgeLabel, .edgeLabel')).map(l => ({
    id: l.id || null,
    text: (l.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 20),
    tag: l.tagName,
    transform: l.getAttribute('transform') || (l.parentElement && l.parentElement.getAttribute('transform')) || null
  })).filter(l => l.text);

  return JSON.stringify({ edges, nodes, labels });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  await setSource(page, SRC, 4500);
  const r = JSON.parse(await page.evaluate(INSPECT));

  if (r.error) { check('svg.present', false, 'a rendered svg', r.error); await close(); process.exit(1); }

  console.log('--- edges ---');
  r.edges.forEach(e => console.log(`   id=${JSON.stringify(e.id)} class=${JSON.stringify(e.cls)} data=${e.dataFrom}/${e.dataTo}`));
  console.log('--- nodes ---');
  r.nodes.forEach(n => console.log(`   id=${JSON.stringify(n.id)} data-id=${JSON.stringify(n.dataId)}`));
  console.log('--- edge labels ---');
  r.labels.forEach(l => console.log(`   <${l.tag}> id=${JSON.stringify(l.id)} text=${JSON.stringify(l.text)} transform=${JSON.stringify(l.transform)}`));
  console.log();

  // The decisive question: can we name an edge's two endpoints WITHOUT touching coordinates?
  const named = r.edges.filter(e => {
    const s = `${e.id || ''} ${e.cls || ''}`;
    return (e.dataFrom && e.dataTo) || /(^|[_-])[A-F]([_-])[A-F]([_-]|$)/.test(s);
  });
  check('edge.identityInDom', named.length === r.edges.length && r.edges.length > 0,
    'every edge path names its two endpoints in the DOM',
    `${named.length} of ${r.edges.length} identifiable | sample id=${JSON.stringify(r.edges[0] && r.edges[0].id)}`);

  check('node.identityInDom', r.nodes.length > 0 && r.nodes.every(n => n.id || n.dataId),
    'every node carries an id',
    `${r.nodes.length} nodes | sample=${JSON.stringify(r.nodes[0])}`);

  check('label.recoverable', r.labels.length >= 2,
    'edge labels are findable as elements (yes/no captions)',
    `${r.labels.length} labels: ${r.labels.map(l => l.text).join(', ')}`);

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  process.exit(report('edge identity') ? 1 : 0);
})();
