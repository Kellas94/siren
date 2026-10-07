import {waitForNativeCondition} from './condition.mjs';
/** Observe real admission before ONE module click. A registered child window
 * does not imply its parent's recordLocation/refresh handoff has completed. */
export async function waitForHomeModule(driver,role,options){
 if(!['docs','code','diagram','presenter'].includes(role))throw TypeError('Unknown Home module role');
 const expression=`(()=>{const home=document.getElementById('homeRoot'),module=document.getElementById('homeModule-${role}');return !!home&&!home.hidden&&home.getAttribute('aria-busy')==='false'&&document.body.inert===false&&!!module&&module.disabled===false;})()`;
 return waitForNativeCondition(value=>driver.evaluate(value),expression,options);
}
