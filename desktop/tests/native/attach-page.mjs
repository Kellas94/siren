import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
export async function attachNativePage(driver,url){
 const targets=await driver.send('Target.getTargets');const target=targets.targetInfos.find(t=>t.url===url);assert.ok(target,'Actual native target required');
 const {sessionId}=await driver.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let serial=0;
 const send=async(method,params={})=>{
  const id=++serial,from=driver.events.length;await driver.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});
  const until=Date.now()+20000;
  while(Date.now()<until){const event=driver.events.slice(from).find(e=>e.method==='Target.receivedMessageFromTarget'&&e.params.sessionId===sessionId&&JSON.parse(e.params.message).id===id);
   if(event){const message=JSON.parse(event.params.message);if(message.error)throw Error(JSON.stringify(message.error));return message.result;}await delay(20);}
  throw Error('Owned satellite CDP timeout: '+method);
 };
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const waitFor=async expression=>{const until=Date.now()+30000;while(Date.now()<until){if(await evaluate(expression))return;await delay(100);}throw Error('Native Code UI condition not met: '+expression);};
 const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing native Code control');const r=e.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),x=(left+right)/2,y=(top+bottom)/2;return {x,y,hit:right>left&&bottom>top&&e.contains(document.elementFromPoint(x,y))};})()`);assert.equal(point.hit,true,'Native Code control must be visible and hit-testable: '+selector);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});};
 const key=async(key,code=key,windowsVirtualKeyCode=13)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});};
 return {evaluate,waitFor,click,key,send,screenshot:async path=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(r.data,'base64'));}};
}