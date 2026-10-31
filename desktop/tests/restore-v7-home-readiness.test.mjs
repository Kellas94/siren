import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';
import {waitForNativeCondition} from './native/condition.mjs';
import {stablePointerExpression} from './native/pointer.mjs';

// Inert source qualification only: no actor, driver or launcher module is imported.
// Execute the selected actor's exact pre-verification statements and the maintained
// driver click closure. DOM, animation frames, time and CDP input are explicit stubs.
const fault=process.env.SIREN_HOME_READINESS_FAULT??'';
assert(['','drop-release','wrong-hit-target'].includes(fault),'UNKNOWN_INERT_FAULT');
const drive=await readFile(new URL('./native/drive.mjs',import.meta.url),'utf8');
const actors=Object.fromEntries(await Promise.all(['development','package'].map(async mode=>[
 mode,await readFile(new URL(`./native/restore-v7/actor-${mode}.mjs`,import.meta.url),'utf8')
])));
function uniqueIndex(source,anchor){
 const index=source.indexOf(anchor);
 assert(index>=0&&source.indexOf(anchor,index+anchor.length)===-1,'EXACT_SOURCE_REGION_REQUIRED: '+anchor);
 return index;
}
const clickStart=uniqueIndex(drive,'const click = async selector => {')+'const click = '.length;
const clickEnd=uniqueIndex(drive,'    return { pid: child.pid, send, evaluate, waitFor, screenshot, click, events, logs: () => logs,');
const clickSource=drive.slice(clickStart,clickEnd).trim().replace(/;$/,'');
const preludes=Object.fromEntries(Object.entries(actors).map(([mode,source])=>{
 const start=uniqueIndex(source,'async function openRecoveredViews(number){');
 const end=uniqueIndex(source,' const verified=await verifyRestored(ctx,route,await ctx.projects.readProject(restored.project.id));');
 assert(end>start,'ACTOR_PRELUDE_ORDER_REQUIRED');
 return [mode,source.slice(start,end)+'\n}'];
}));

function fixture(mode,{surface='workspace',mountAt=0,settleAt=0,covered=false,moving=false}={}){
 let time=0,rectangleRead=0,pressed=false;
 const location={href:`siren://app/${surface==='home'?'home':'app'}.html`};
 const window={sirenHomeView:surface==='home'?{}:null};
 const seen={queries:0,absentQueries:0,rectangles:0,frames:0,scrolls:0,clicks:0,phases:[],packets:[],waits:[],error:null};
 const cover={id:'owned-overlay',className:'owned-cover',tagName:'DIV'};
 const control={id:'desktopHome',className:'owned-home',tagName:'BUTTON',parentElement:null,
  getAnimations:()=>[],contains:hit=>hit===control,
  scrollIntoView:options=>{seen.scrolls++;assert.deepEqual(JSON.parse(JSON.stringify(options)),{block:'nearest',inline:'nearest',behavior:'instant'});},
  getBoundingClientRect(){
   seen.rectangles++;
   const x=(moving||time<settleAt)?100+(++rectangleRead):100;
   return {x,y:120,width:80,height:40,left:x,right:x+80,top:120,bottom:160};
  }
 };
 const document={querySelector(selector){
  assert.equal(selector,'#desktopHome','Only the owned Home selector is admitted');seen.queries++;
  if(time<mountAt){seen.absentQueries++;return null;}return control;
 },elementFromPoint(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));return covered||fault==='wrong-hit-target'?cover:control;}};
 const context=createContext({location,window,document,innerWidth:900,innerHeight:600,scrollX:0,scrollY:0,
  getComputedStyle:()=>({transform:'none',animationName:'none'}),
  requestAnimationFrame:callback=>{seen.frames++;callback(time);}});
 const evaluate=async expression=>new Script(expression,{filename:'owned-inert-dom-expression'}).runInContext(context,{timeout:1000});
 const waitFor=async expression=>{
  const record={start:time,end:null,success:false};seen.waits.push(record);
  try{await waitForNativeCondition(evaluate,expression,{clock:()=>time,delay:async ms=>{assert.equal(ms,100);time+=ms;}});record.success=true;}
  finally{record.end=time;}
 };
 const send=async(method,packet)=>{
  assert.equal(method,'Input.dispatchMouseEvent','No native transport is available in this inert fixture');
  if(fault==='drop-release'&&packet.type==='mouseReleased')throw Error('OWNED_INERT_INPUT_ACK_DROPPED');
  assert.equal(packet.button,'left');assert.equal(packet.clickCount,1);assert.equal(packet.x,140);assert.equal(packet.y,140);
  seen.packets.push(JSON.parse(JSON.stringify(packet)));
  if(packet.type==='mousePressed'){assert.equal(pressed,false);pressed=true;}
  else{assert.equal(packet.type,'mouseReleased');assert.equal(pressed,true);pressed=false;location.href='siren://app/home.html';window.sirenHomeView={owned:true};}
 };
 const actualClick=new Script('('+clickSource+')',{filename:'selected-drive-click'}).runInNewContext({evaluate,waitFor,send,stablePointerExpression},{timeout:1000});
 const driver={evaluate,waitFor,click:async selector=>{seen.clicks++;return actualClick(selector);}};
 const actor=new Script('('+preludes[mode]+')',{filename:`selected-${mode}-actor-prelude`}).runInNewContext({driver,stablePointerExpression,phase:async value=>{seen.phases.push(value);}},{timeout:1000});
 return {seen,location,window,get time(){return time;},async run(directClick=false){
  try{if(directClick)await driver.click('#desktopHome');else await actor(2);}catch(error){seen.error=error;}
 }};
}
function success(f,{delayed=false,alreadyHome=false}={}){
 assert.equal(f.seen.error,null,f.seen.error?.message);
 assert.equal(f.location.href,'siren://app/home.html');assert(f.window.sirenHomeView);
 assert.equal(f.seen.clicks,alreadyHome?0:1);
 assert.deepEqual(f.seen.packets.map(p=>p.type),alreadyHome?[]:['mousePressed','mouseReleased']);
 assert.equal(f.seen.scrolls,alreadyHome?0:1);
 if(delayed){assert(f.seen.absentQueries>0);assert(f.time>=300&&f.time<30000);}
 assert(f.seen.waits.every(w=>w.success&&w.end-w.start<=30000));
}
function refusal(f,message,{clicks,deadline=false}={}){
 assert.match(f.seen.error?.message??'',message);assert.equal(f.location.href,'siren://app/app.html');
 assert.equal(f.window.sirenHomeView,null);assert.equal(f.seen.packets.length,0);
 if(clicks!==undefined)assert.equal(f.seen.clicks,clicks);
 if(deadline){assert.equal(f.time,30000);assert.equal(f.seen.waits.at(-1).success,false);assert.equal(f.seen.waits.at(-1).end-f.seen.waits.at(-1).start,30000);}
}
function scenario(name,mode,options,check,{directClick=false}={}){
 test(name,async t=>{
  const f=fixture(mode,options);await f.run(directClick);let passed=false;
  try{check(f);assert.deepEqual(f.seen.phases,directClick?[]:['recovered-views-2']);passed=true;}
  finally{t.diagnostic('SCENARIO_BASE64 '+Buffer.from(JSON.stringify({name,mode,fault,completed:true,semanticPassed:passed,virtualMilliseconds:f.time,
   actorPhases:f.seen.phases,clicks:f.seen.clicks,packets:f.seen.packets,queryCount:f.seen.queries,absentQueries:f.seen.absentQueries,
   rectangleReads:f.seen.rectangles,animationFrames:f.seen.frames,scrolls:f.seen.scrolls,waits:f.seen.waits,
   finalSurface:f.location.href,homeViewPresent:f.window.sirenHomeView!==null,operationError:f.seen.error?.message??null,
   operationErrorCount:f.seen.error===null?0:1,semanticErrorCount:passed?0:1})).toString('base64'));}
 });
}
for(const mode of ['development','package']){
 scenario(`${mode}: delayed Home mount reaches Home through one actual driver click`,mode,{mountAt:250},f=>success(f,{delayed:true}));
 scenario(`${mode}: immediately mounted Home retains one actual driver click`,mode,{},f=>success(f));
 scenario(`${mode}: already on Home skips the workspace control`,mode,{surface:'home',mountAt:Infinity},f=>success(f,{alreadyHome:true}));
 scenario(`${mode}: persistent absence refuses at the maintained 30s condition bound`,mode,{mountAt:Infinity},f=>{
  refusal(f,/UI condition not met/,{clicks:0,deadline:true});assert.equal(f.seen.frames,0);assert.equal(f.seen.absentQueries,300);
 });
 scenario(`${mode}: covered Home retains the actual click hit-test refusal`,mode,{covered:true},f=>{
  refusal(f,/Occluded control: #desktopHome by owned-overlay/,{clicks:1});assert.equal(f.seen.scrolls,1);
 });
 scenario(`${mode}: moving Home refuses without any input packet`,mode,{moving:true},f=>refusal(f,/UI condition not met/,{deadline:true}));
 scenario(`${mode}: settling Home becomes usable without changing its animation`,mode,{settleAt:500},f=>{
  success(f);assert.equal(f.time,500);assert(f.seen.frames>4);
 });
}
scenario('maintained driver: initial DOM lookup still refuses a missing control', 'development',{mountAt:Infinity},f=>{
 refusal(f,/^Missing control$/,{clicks:1});assert.equal(f.time,0);assert.equal(f.seen.waits.length,0);
},{directClick:true});
scenario('maintained driver: its own stability condition refuses a moving control', 'development',{moving:true},f=>{
 refusal(f,/UI condition not met/,{clicks:1,deadline:true});assert.equal(f.seen.scrolls,1);
},{directClick:true});
