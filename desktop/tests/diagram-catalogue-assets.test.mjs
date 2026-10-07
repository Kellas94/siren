import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {parse} from 'parse5';
import {resolveLocalResource} from '../src/protocol.mjs';
import {allowedAppFile} from '../scripts/package.mjs';
const helper=await import('../build/home-catalogue.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('Home catalogue assets have exact local SRI/CSP and do not enlarge the inline startup',async()=>{
 assert.equal(typeof helper.addHomeCatalogue,'function');const root=await mkdtemp(join(tmpdir(),'siren-catalogue-assets-')),html=await helper.addHomeCatalogue('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-test\'; style-src \'unsafe-inline\';"></head><body></body></html>',root);
 const nodes=[];const walk=n=>{nodes.push(n);for(const c of n.childNodes??[])walk(c);};walk(parse(html));
 for(const [tag,name]of [['script','home-workspace.js'],['link','diagram-catalogue.css']]){const n=nodes.find(n=>n.tagName===tag),attrs=Object.fromEntries(n.attrs.map(a=>[a.name,a.value])),bytes=await readFile(join(root,'assets',name));assert.equal(attrs[tag==='script'?'src':'href'],'siren://app/assets/'+name);assert.equal(attrs.integrity,'sha384-'+createHash('sha384').update(bytes).digest('base64'));assert.equal(attrs.crossorigin,'anonymous');assert(html.includes('siren://app/assets/'+name));assert.equal(allowedAppFile('generated/assets/'+name,new Set()),true);assert.equal(await resolveLocalResource({url:'siren://app/assets/'+name,rendererRoot:root}),join(root,'assets',name));}
 assert((await readFile(join(root,'assets/home-workspace.js'),'utf8')).includes('renderSirenHome'));assert((await readFile(join(root,'assets/home-workspace.js'),'utf8')).includes('SirenDiagramCatalogueView'));assert(html.length<1500);
});
test('new local resources reject queries, hashes, encoding aliases, traversal and unrelated assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-catalogue-routes-'));await mkdir(join(root,'assets'));for(const n of ['home-workspace.js','diagram-catalogue.css'])await writeFile(join(root,'assets',n),'owned');
 for(const url of ['siren://app/assets/home-workspace.js?x=1','siren://app/assets/home-workspace.js#x','siren://app/assets/%68ome-workspace.js','siren://app/assets/diagram-catalogue.css?x=1','siren://app/assets/../home-workspace.js','siren://app/assets/home-other.js'])await assert.rejects(resolveLocalResource({url,rendererRoot:root}));assert.equal(allowedAppFile('generated/assets/home-other.js',new Set()),false);
});
