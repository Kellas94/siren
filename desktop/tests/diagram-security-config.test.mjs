import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('native Mermaid protects its security policy and finite renderer budgets from imported init directives',async()=>{
 const code=await readFile(new URL('../src/ui/windows/diagram.js',import.meta.url),'utf8');let adapters,config;
 const element=()=>({addEventListener(){},append(){},remove(){},replaceChildren(){},setAttribute(){},style:{},dataset:{}}),elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const {buildDiagramGuided}=await import('../build/diagram-guided.mjs');const guided=await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)}),guidedView=await readFile(new URL('../src/ui/diagram/guided-view.js',import.meta.url),'utf8');
 const {buildDiagramStyle}=await import('../build/diagram-style.mjs'),styling=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
 const window={SirenPresentationAuthoring:{create:()=>({paint(){},reset(){},dispose(){}})},sirenDeckNavigation:{onAuthoring:()=>()=>{}},SirenNativeDiagramBuildView:{create:()=>({paint(){}})},SirenNativeDiagramStyleView:{create:()=>({paint(){}})},SirenNativeDiagramSession:{create(value){adapters=value;return {refresh:()=>Promise.resolve(false)};}},mermaid:{initialize(value){config=value;},parse:async()=>({diagramType:'flowchart',config:{}}),mermaidAPI:{getDiagramFromText:async()=>({db:{getData:()=>({nodes:[]})}})},render:async()=>{throw Error('Intentional stopped render');}},sirenDiagramRead:{},sirenDiagramEdit:{onReferenceChanged:()=>()=>{}},sirenViewControl:{onPrepare(){},onResume(){}},sirenWindow:{onReady(){}},addEventListener(){}};
 const historyView=await readFile(new URL('../src/ui/diagram/history-view.js',import.meta.url),'utf8');
 const walkthrough=await readFile(new URL('../src/ui/diagram/walkthrough.js',import.meta.url),'utf8');
 runInNewContext(guided.script+'\n'+guidedView+'\n'+styling.script+'\n'+historyView+'\n'+walkthrough+'\n'+code,{window,document:{getElementById:get,createElement:element,documentElement:{style:{}},body:{dataset:{}}},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}disconnect(){}}});
 await assert.rejects(adapters.render({source:'%%{init:{"secure":[],"maxEdges":999999,"securityLevel":"loose"}}%%\nflowchart TD\nA-->B',token:1}));
 assert.equal(config.securityLevel,'strict');assert.equal(config.startOnLoad,false);assert.equal(config.maxTextSize,50000);assert.equal(config.maxEdges,500);assert.equal(config.htmlLabels,false);
 for(const key of ['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','suppressErrorRendering'])assert.equal(config.secure.includes(key),true,key+' must be a protected native policy field');
});
