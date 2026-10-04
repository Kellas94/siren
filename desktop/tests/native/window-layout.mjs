import assert from 'node:assert/strict';
import {waitForNativeCondition} from './condition.mjs';
const contained=(b,areas)=>areas.some(({workArea:a})=>b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height);
/** Real native handles and workAreas, deliberately displaced through owned
 * PID-checked instrumentation. Screen events are synthesized, not physical
 * monitor removal/mixed-DPI qualification. Project/source oracles stay in caller. */
export async function exerciseNativeLayout({native,driver,code,docs,diagram,result}){
 const areas=await native.displayAreas();assert.ok(areas.length>0);
 await native.displaceView(code.url,'minimized');const before=await native.windowState(code.url);assert.equal(before.minimized,true);assert.equal(contained(before.normalBounds,areas),false);
 assert.equal(await native.layoutMetricsEvent(),true,'Actual automatic controller must complete before the manual operation');await waitForNativeCondition(async()=>{const s=await native.windowState(code.url);return contained(s.normalBounds,areas)&&s.minimized;},'Actual metrics handler must rehome normal bounds without unminimizing Code');
 result.cases.push({name:'actual synthesized screen metrics rehomes displaced minimized Code while keeping it minimized',ok:true});
 await native.displaceView(docs.url,'maximized');await native.displaceView(diagram.url,'fullscreen');await native.traceLayout();assert.equal(await native.layoutCommand(),true,'Actual native command must reach its final focus boundary; geometry is verified independently');
 const snapshot=async()=>({docs:await native.windowState(docs.url),diagram:await native.windowState(diagram.url),code:await native.windowState(code.url)});result.layoutAfterCommand=await snapshot();
 try{await waitForNativeCondition(async()=>{const d=await native.windowState(docs.url),g=await native.windowState(diagram.url),c=await native.windowState(code.url);return contained(d.normalBounds,areas)&&d.maximized&&contained(g.normalBounds,areas)&&g.fullScreen&&!c.minimized;},'Actual Bring all windows back must recover normal bounds and preserve maximize/fullscreen');}catch(cause){result.layoutAtFailure=await snapshot();result.layoutAreas=areas;result.layoutNativeTrace=await native.readLayoutTrace();result.layoutSeparateTurnExperiment=await native.deferredGeometryExperiment(diagram.url);throw cause;}result.layoutNativeTrace=await native.readLayoutTrace();
 result.cases.push({name:'actual native bring-back restores minimized Code and recovers Docs/Diagram normal geometry with maximize/fullscreen retained',ok:true});
 await native.displaceView('siren://app/home.html','normal');assert.equal(await native.layoutCommand(),true);await waitForNativeCondition(async()=>contained((await native.windowState('siren://app/home.html')).normalBounds,areas),'Actual Home brought into a current workArea');
 result.cases.push({name:'permanent main window can be brought back through the native Window command',ok:true});
 await native.displaceView(code.url,'minimized');assert.equal(await native.windowShortcut('siren://app/home.html','B'),true);const shortcutState=await native.windowState(code.url);assert.equal(shortcutState.minimized,false);assert.equal(contained(shortcutState.normalBounds,areas),true);assert.equal((await native.windowState(docs.url)).maximized,true);assert.equal((await native.windowState(diagram.url)).fullScreen,true);
 result.cases.push({name:'actual native Ctrl+Alt+B restores displaced minimized Code while retaining Docs maximize and Diagram fullscreen',ok:true});
 result.layoutScope={actualDisplayCount:areas.length,physicalMonitorRemovalQualified:false,physicalMixedDPIQualified:false};
}
