import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./native/diagram-history-typography.mjs',import.meta.url),'utf8');
const functionSource=source.match(/async function choose\(page,selector,value,\{refusedValue\}=\{\}\)\{[\s\S]*?\n\}/)?.[0];assert.ok(functionSource);
let chooseNativeSelect;try{({chooseNativeSelect}=await import('./native/native-select-keyboard.mjs'));}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
function fixture({focused=true,neverFocus=false,loseOn=null,options=['Arial','Georgia','Verdana']}={}){
 const state={focused,index:0,events:[],clicks:0,tabs:0};
 const page={async evaluate(expression){if(expression.startsWith('Array.from'))return options;if(expression.includes('document.activeElement'))return state.focused;throw Error('Unexpected passive expression');},async waitFor(){assert.equal(options[state.index],'Verdana','Actual native value never reached');}};
 const keys=async(_page,key)=>{state.events.push(key);if(key==='Tab'){state.tabs++;state.focused=state.focused?false:!neverFocus;return;}if(state.focused){if(key==='Home')state.index=0;if(key==='End')state.index=options.length-1;if(key==='ArrowDown')state.index++;if(key==='ArrowUp')state.index--;}if(key===loseOn)state.focused=false;};
 const click=async()=>{state.clicks++;state.focused=false;};
 const choose=Function('assert','keys','click','chooseNativeSelect','return ('+functionSource+');')(assert,keys,click,chooseNativeSelect);
 return {state,run:()=>choose(page,'#font','Verdana')};
}
test('already focused native select receives navigation without the observed focus-losing click',async()=>{const f=fixture();await f.run();assert.equal(f.state.clicks,0);assert.equal(f.state.tabs,1);assert.ok(f.state.events.includes('Home')||f.state.events.includes('End'));});
test('unfocused select is acquired with bounded trusted Tab navigation',async()=>{const f=fixture({focused:false});await f.run();assert.equal(f.state.clicks,0);assert.equal(f.state.events[0],'Tab');assert.equal(f.state.tabs,2);});
test('focus loss after Escape refuses before selection commands',async()=>{const f=fixture({loseOn:'Escape'});await assert.rejects(f.run(),/NATIVE_SELECT_FOCUS_REQUIRED/);assert.equal(f.state.events.includes('Home')||f.state.events.includes('End'),false);});
test('unreachable focus refuses after bounded Tabs without selecting',async()=>{const f=fixture({focused:false,neverFocus:true});await assert.rejects(f.run(),/NATIVE_SELECT_FOCUS_REQUIRED/);assert.equal(f.state.tabs,64);assert.equal(f.state.events.includes('Home')||f.state.events.includes('End'),false);});
test('focus loss after boundary navigation refuses before Arrow keys',async()=>{const f=fixture({loseOn:'End'});await assert.rejects(f.run(),/NATIVE_SELECT_FOCUS_REQUIRED/);assert.equal(f.state.events.includes('ArrowUp')||f.state.events.includes('ArrowDown'),false);});
test('missing option refuses before any input',async()=>{const f=fixture({options:['Arial']});await assert.rejects(f.run(),/Bounded real select option must exist/);assert.deepEqual(f.state.events,[]);assert.equal(f.state.clicks,0);});
