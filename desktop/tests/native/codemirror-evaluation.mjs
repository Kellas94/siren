import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { launchDesktop } from './drive.mjs';

// Isolated candidate measurement. No SIREN product dependency or editor is changed.
// Setup: install exact packages declared in the evaluation report into
// evidence/codemirror-evaluation with --ignore-scripts; esbuild is build-only.
const dependencies = resolve('evidence/codemirror-evaluation');
const { build } = await import(pathToFileURL(join(dependencies, 'node_modules/esbuild/lib/main.js')).href);
const evidence = resolve('evidence', `codemirror-native-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const result = { scope: 'Isolated native editor candidate, not SIREN integration or large-source persistence admission', completed: false, cases: [], outcomes: {}, sourceHashes: {} };
for (const path of ['generated/app.html', 'tests/native/drive.mjs', 'tests/native/codemirror-evaluation.mjs']) result.sourceHashes[path] = sha(await readFile(path));

// Extract SIREN's existing patched Python factory and its local helpers/terms.
// The trusted local factory literal is evaluated in a build-only empty VM, never
// in a product renderer. Shared Lezer modules use one installed module instance.
const renderer = await readFile('generated/app.html', 'utf8');
const prefix = 'const SirenPythonLanguage=(()=>{const factories=';
const from = renderer.indexOf(prefix); assert.ok(from >= 0);
const to = renderer.indexOf(';const cache={};function load', from); assert.ok(to > from);
const factories = vm.runInNewContext('(' + renderer.slice(from + prefix.length, to) + ')', {}, { timeout: 1000 });
const local = Object.keys(factories).filter(name => !['@lezer/common', '@lezer/lr', '@lezer/highlight'].includes(name));
const factorySource = '{' + local.map(name => JSON.stringify(name) + ':' + factories[name].toString()).join(',') + '}';
result.sourceHashes.patchedFactory = sha(factorySource);
await writeFile(join(dependencies, 'patched-probe.mjs'), `import * as common from '@lezer/common';import * as lr from '@lezer/lr';import * as highlight from '@lezer/highlight';
const factories=${factorySource};const externals={'@lezer/common':common,'@lezer/lr':lr,'@lezer/highlight':highlight},cache={};
function load(name){if(externals[name])return externals[name];if(cache[name])return cache[name].exports;if(!factories[name])throw Error('Unexpected parser module');const module={exports:{}};cache[name]=module;factories[name](module,module.exports,load);return module.exports;}
export const parser=load('@lezer/python').parser;`);
await writeFile(join(dependencies, 'editor-probe.mjs'), `
import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,drawSelection} from '@codemirror/view';
import {history,defaultKeymap,historyKeymap,indentWithTab} from '@codemirror/commands';
import {search,searchKeymap} from '@codemirror/search';
import {LRLanguage,LanguageSupport,indentNodeProp,foldNodeProp,languageDataProp,indentUnit,syntaxHighlighting,HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {pythonLanguage,python} from '@codemirror/lang-python';
import {parser} from './patched-probe.mjs';
const byName=new Map(pythonLanguage.parser.nodeSet.types.map(t=>[t.name,t]));
const patched=parser.configure({props:[indentNodeProp.add(t=>byName.get(t.name)?.prop(indentNodeProp)),foldNodeProp.add(t=>byName.get(t.name)?.prop(foldNodeProp)),languageDataProp.add(t=>t.isTop?pythonLanguage.data:undefined)]});
const language=new LRLanguage(pythonLanguage.data,patched,'python');
let view,latencies=[],began=0;const appearance=new Compartment();
function theme(dark){return EditorView.theme({'&':{height:'100%',backgroundColor:dark?'#181c24':'#fbfcff',color:dark?'#d9e0ed':'#182335'},'.cm-scroller':{overflow:'auto',fontFamily:'Consolas, monospace'},'.cm-content':{caretColor:dark?'#fff':'#172c49'},'.cm-gutters':{backgroundColor:dark?'#232936':'#edf1f8',color:dark?'#a7b4ca':'#51637f'},'.cm-line':{padding:'0 10px'}},{dark});}
function themed(dark){return [theme(dark),syntaxHighlighting(HighlightStyle.define([{tag:tags.keyword,color:dark?'#b6a2ff':'#7039a6'},{tag:[tags.string,tags.special(tags.string)],color:dark?'#a8d5a1':'#25683f'},{tag:tags.comment,color:dark?'#8f9daf':'#506179'},{tag:[tags.number,tags.bool],color:dark?'#e8bd79':'#986022'},{tag:[tags.typeName,tags.className,tags.function(tags.variableName)],color:dark?'#7baaf7':'#1d5dba'}]))];}
const extensions=[lineNumbers(),drawSelection(),history({newGroupDelay:0}),search({top:true}),indentUnit.of('    '),keymap.of([...defaultKeymap,...historyKeymap,...searchKeymap,indentWithTab]),new LanguageSupport(language,python().support),appearance.of(themed(false)),EditorView.domEventHandlers({beforeinput(){began=performance.now();return false;}}),EditorView.updateListener.of(update=>{if(update.docChanged&&began){const start=began;began=0;requestAnimationFrame(()=>latencies.push(performance.now()-start));}})];
window.probe={open(text){if(view)view.destroy();latencies=[];const start=performance.now();view=new EditorView({parent:document.getElementById('editor'),state:EditorState.create({doc:text,extensions})});view.focus();return performance.now()-start;},text(){return view.state.doc.toString();},metrics(){return {lines:view.state.doc.lines,utf16Units:view.state.doc.length,domLines:view.dom.querySelectorAll('.cm-line').length,viewport:view.viewport,latencies:[...latencies],hasFocus:view.hasFocus,selection:view.state.selection.main};},select(from,to=from){view.dispatch({selection:{anchor:from,head:to},scrollIntoView:true});view.focus();},dark(value){view.dispatch({effects:appearance.reconfigure(themed(value))});},grammar(text){const tree=patched.parse(text);let errors=[];tree.iterate({enter(n){if(n.type.isError)errors.push({from:n.from,to:n.to});}});return {errors,tree:tree.toString()};}};
document.getElementById('other').addEventListener('click',()=>document.getElementById('other').focus());
// The stock panel commits on keyup/change. A pasted query followed immediately
// by Enter used the old query in the retained first functional attempt. Bridge
// real input to its existing change contract, preserving regex/replace options.
document.addEventListener('input',event=>{if(event.target.closest?.('.cm-search'))event.target.dispatchEvent(new Event('change',{bubbles:true}));});
`);
await build({ entryPoints: [join(dependencies, 'editor-probe.mjs')], bundle: true, format: 'iife', platform: 'browser', target: 'chrome152', outfile: join(evidence, 'bundle.js'), minify: true, sourcemap: false, legalComments: 'eof' });
const bundle = await readFile(join(evidence, 'bundle.js')); result.bundle = { bytes: bundle.length, sha256: sha(bundle) };
const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'"><title>SIREN isolated editor candidate</title><style>html,body{margin:0;height:100%;font:14px system-ui}body{display:grid;grid-template-rows:44px 1fr}header{padding:8px;background:#dee7f6}#editor{height:100%;min-height:0;overflow:hidden}.cm-editor{height:100%}</style><header><button id="other">Other workspace control</button> Isolated candidate probe</header><div id="editor"></div><script src="bundle.js"></script>`;
await writeFile(join(evidence, 'app.html'), html);
await writeFile(join(evidence, 'package.json'), JSON.stringify({ type: 'module', main: 'main.mjs' }));
await writeFile(join(evidence, 'main.mjs'), `import {app,BrowserWindow,protocol} from 'electron';import {readFile,appendFile} from 'node:fs/promises';import {join} from 'node:path';
const root=${JSON.stringify(evidence)};app.setPath('userData',join(root,'user-data'));protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.whenReady().then(async()=>{protocol.handle('siren',async request=>{const u=new URL(request.url);if(u.host!=='app'||!['/app.html','/bundle.js'].includes(u.pathname))return new Response('',{status:404});return new Response(await readFile(join(root,u.pathname.slice(1))),{headers:{'Content-Type':u.pathname.endsWith('.js')?'text/javascript':'text/html'}});});
const window=new BrowserWindow({width:1440,height:940,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));await window.loadURL('siren://app/app.html');
const timer=setInterval(()=>appendFile(join(root,'process-metrics.jsonl'),JSON.stringify({at:Date.now(),processes:app.getAppMetrics()})+'\\n'),100);app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>clearInterval(timer));});
`);
const save = () => writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
let driver;
const key = async (key, code, virtual, modifiers = 0) => { await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, modifiers }); await driver.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers }); };
// Hash the complete actual document inside the renderer and return only64hex.
// Expected bytes/hash still come independently from this Node fixture. The
// retained full-string CDP read timed out despite an idle low-CPU renderer.
const check = async expected => assert.equal(await driver.evaluate(`(async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(window.probe.text()))),x=>x.toString(16).padStart(2,'0')).join(''))()`), sha(expected), 'Exact editor text hash');
try {
  driver = await launchDesktop({ root: evidence, executable: resolve('node_modules/electron/dist/electron.exe') }); result.pid = driver.pid;
  await driver.waitFor('typeof window.probe?.open === "function"');
  const grammars = ['match value:\n    case Point():\n        pass\n', 'with (open("x") as f, open("y") as g):\n    pass\n', 'if True:\n\f    x = 1\n', '@decorator\nasync def run(x: int) -> str:\n    return f"value={x}"\n'];
  result.outcomes.grammar = [];
  for (const text of grammars) { const observed = await driver.evaluate(`window.probe.grammar(${JSON.stringify(text)})`); result.outcomes.grammar.push(observed); assert.deepEqual(observed.errors, []); }
  for (const lines of [100000, 300000]) for (const kind of ['compact', 'representative', 'unicode']) {
    const content = kind === 'compact' ? 'x=1' : kind === 'representative' ? 'result = process(value, retry=3, enabled=True) # synthetic data' : 'label = "șir românesc 😀 漢字" # synthetic';
    const source = Array(lines - 1).fill(content).concat('# SIREN_SEARCH_SENTINEL').join('\n');
    const row = { lines, kind, utf8Bytes: Buffer.byteLength(source), utf16Units: source.length, sourceSha256: sha(source), completed: false, operations: [] }; result.cases.push(row); await save();
    const measure = async (name, action) => { const at = performance.now(); try { const value = await action(); row.operations.push({ name, status: 'completed', ms: performance.now() - at }); return value; } catch (error) { row.operations.push({ name, status: 'failed', ms: performance.now() - at, error: error.message }); throw error; } };
    row.constructMs = await measure('open', () => driver.evaluate(`window.probe.open(${JSON.stringify(source)})`)); await check(source);
    await measure('actual-keyboard-input', () => driver.send('Input.insertText', { text: '# inserted\n' })); await check('# inserted\n' + source);
    await measure('actual-keyboard-undo', () => key('z', 'KeyZ', 90, 2)); await check(source);
    await driver.evaluate(`window.probe.select(${Math.floor(source.length / 2)})`);
    const offset = Math.floor(source.length / 2); const left = source.charCodeAt(offset - 1), right = source.charCodeAt(offset);
    const safeOffset = left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff ? offset + 1 : offset;
    await driver.evaluate(`window.probe.select(${safeOffset})`);
    await measure('actual-middle-paste', () => driver.send('Input.insertText', { text: ' Ω😀 ' })); await check(source.slice(0, safeOffset) + ' Ω😀 ' + source.slice(safeOffset));
    await key('z', 'KeyZ', 90, 2); await check(source);
    await driver.evaluate('window.probe.select(0)');
    await measure('full-model-find-panel', async () => { await key('f', 'KeyF', 70, 2); await driver.waitFor('!!document.querySelector("input[name=search]")'); await driver.send('Input.insertText', { text: 'SIREN_SEARCH_SENTINEL' }); await key('Enter', 'Enter', 13); });
    row.findSelection = await driver.evaluate('window.probe.metrics().selection'); assert.equal(row.findSelection.from, source.lastIndexOf('SIREN_SEARCH_SENTINEL')); await key('Escape', 'Escape', 27);
    await driver.evaluate('window.probe.select(0)');
    for (let i = 0; i < 20; i++) { await driver.send('Input.insertText', { text: '#' }); await key('z', 'KeyZ', 90, 2); }
    await check(source); row.metrics = await driver.evaluate('window.probe.metrics()'); assert.ok(row.metrics.domLines < 1000, 'Viewport must not contain 100k/300k line nodes');
    await driver.evaluate('window.probe.dark(true)'); await driver.screenshot(join(evidence, `${lines}-${kind}-dark.png`));
    await driver.evaluate('window.probe.dark(false)'); row.completed = true; await save();
  }
  await driver.evaluate('window.probe.open("def run():\\n    return 1\\n")'); await driver.waitFor('document.querySelectorAll(".cm-content span[class]").length > 1'); result.outcomes.pythonHighlight = true;
  await driver.click('#other'); assert.equal(await driver.evaluate('window.probe.metrics().hasFocus'), false);
  await driver.evaluate('window.probe.select(11)'); await key('Tab', 'Tab', 9); await check('def run():\n        return 1\n'); result.outcomes.tabIndent = true;
  await driver.evaluate('window.probe.open("# ")'); await driver.evaluate('window.probe.select(2)');
  await driver.send('Input.imeSetComposition', { text: '漢', selectionStart: 1, selectionEnd: 1 }); await driver.send('Input.insertText', { text: '漢字' }); await check('# 漢字'); result.outcomes.imeCommit = true;
  await driver.screenshot(join(evidence, 'highlight-light.png')); result.completed = true;
} catch (error) { result.error = String(error.stack || error); if (driver) await writeFile(join(evidence, 'failure-events.json'), JSON.stringify(driver.events, null, 2)); process.exitCode = 1; }
finally { await save(); if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } console.log(JSON.stringify({ evidence, completed: result.completed, cases: result.cases.map(({lines,kind,completed,constructMs,operations,metrics}) => ({lines,kind,completed,constructMs,operations,metrics})), outcomes: result.outcomes, error: result.error })); }
