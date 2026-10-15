import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {domainHelper} from '../build/import-validation.mjs';
import {normalizeDiagramEmbed} from '../src/documents/diagram-embeds.mjs';
const ref=kind=>({sha256:'a'.repeat(64),bytes:100,kind});
const block=()=>({id:'embed-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:'whole',nodeIds:[],caption:'Saved flow',display:{height:320,fit:'contain'},snapshot:{sourceHash:'a'.repeat(64),sourceVersion:1,sourceAsset:ref('diagram-source'),visualAsset:ref('svg'),rendererVersion:'fixture-only',styleHash:'a'.repeat(64)},status:'current',missingNodeIds:[]});
test('controlled domain validator admits exact typed embed data while retaining general rich SVG refusal',()=>{
 const window={SirenDiagramEmbedContract:{normalizeDiagramEmbed}};let legacyCalls=0;
 runInNewContext(domainHelper,{window,MAX_WP_BLOCKS:300,sanitizeWorkpaperBlock:()=>{legacyCalls++;return null;}});
 const patch={domain:'docs',action:'replace-blocks',payload:{blocks:[block()]},before:{blocks:[]}};
 assert.equal(window.sirenDesktopValidateDomainPatch(patch),true,'Missing typed embed support in frozen validator adapter');assert.equal(legacyCalls,0);
 patch.payload.blocks[0].snapshot.visualAsset.sha256='bad';assert.equal(window.sirenDesktopValidateDomainPatch(patch),false);
 patch.payload.blocks=[{id:'text-a',kind:'text',html:'<svg><script>bad</script></svg>'}];assert.equal(window.sirenDesktopValidateDomainPatch(patch),false);assert.equal(legacyCalls,1);
});
