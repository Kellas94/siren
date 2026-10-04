import assert from 'node:assert/strict';
/** Delay a real metadata read, retaining all native grants and replies. */
export async function verifyHomeRefresh({driver,result}){
 await driver.evaluate(`(async()=>{
  document.getElementById('homeRoot').hidden=true;
  const host=document.createElement('main');host.id='refreshHome';document.body.append(host);
  let release,hold=false;const gate=new Promise(resolve=>{release=resolve;});window.__ownedHomeRefresh={entered:false,release};
  const bridge={...window.sirenHome,getHomeState:async payload=>{if(hold){window.__ownedHomeRefresh.entered=true;await gate;}return window.sirenHome.getHomeState(payload);}};
  const home=window.renderSirenHome({container:host,bridge,desktop:window.sirenDesktop,bootstrap:window.sirenDesktopBootstrap});window.__ownedHomeRefresh.home=home;
  await home.refresh();hold=true;window.__ownedHomeRefresh.pending=home.refresh();
 })()`);
 await driver.waitFor('window.__ownedHomeRefresh.entered===true');
 assert.equal(await driver.evaluate('document.querySelector("#refreshHome #homeModule-docs").disabled'),true,'Home refresh must cover navigation until its genuine metadata read finishes');
 await driver.click('#refreshHome #homeModule-docs');assert.equal(await driver.evaluate('document.querySelector("#refreshHome .home-library")!=null'),false);
 await driver.evaluate('(async()=>{window.__ownedHomeRefresh.release();await window.__ownedHomeRefresh.pending;})()');
 assert.equal(await driver.evaluate('document.querySelector("#refreshHome #homeModule-docs").disabled'),false);
 await driver.evaluate('(async()=>{window.__ownedHomeRefresh.home.dispose();document.getElementById("refreshHome").remove();delete window.__ownedHomeRefresh;await window.sirenHomeView.refresh();})()');
 result.cases.push({name:'actual Home keeps controls disabled throughout a held real metadata refresh and restores admission only after the read completes',ok:true});
}
/** Owned UI fixture holds only the metadata record promise. The native open,
 * grants and saved document are real; no authority or save receipt is mocked. */
export async function verifyLibraryHandoff({driver,documentId,result}){
 await driver.evaluate(`(async()=>{
  document.getElementById('homeRoot').hidden=true;
  const host=document.createElement('main');host.id='raceHome';document.body.append(host);
  let release;const gate=new Promise(resolve=>{release=resolve;});window.__ownedHomeRace={entered:false,release};
  const bridge={...window.sirenHome,recordLocation:async payload=>{window.__ownedHomeRace.entered=true;await gate;return window.sirenHome.recordLocation(payload);}};
  window.__ownedHomeRace.home=window.renderSirenHome({container:host,bridge,desktop:window.sirenDesktop,bootstrap:window.sirenDesktopBootstrap});await window.__ownedHomeRace.home.refresh();
 })()`);
 await driver.click('#raceHome #homeModule-docs');const selector='#raceHome .home-library [data-entity-id="'+documentId+'"]';await driver.waitFor('document.querySelector('+JSON.stringify(selector)+')!=null');await driver.click(selector);await driver.waitFor('window.__ownedHomeRace.entered===true');
 // Real Home remains covered until the record/refresh handoff is finished. A
 // second dialog cannot be silently removed by the first callback's refresh.
 assert.equal(await driver.evaluate('document.querySelector("#raceHome #homeModule-docs").disabled'),true,'Library handoff must keep Home controls disabled while native navigation metadata is pending');
 await driver.evaluate('window.__ownedHomeRace.release()');await driver.waitFor('document.querySelector("#raceHome #homeModule-docs")?.disabled===false&&document.querySelector("#raceHome .home-library")==null');
 await driver.click('#raceHome #homeModule-docs');await driver.waitFor('document.querySelector('+JSON.stringify(selector)+')!=null');assert.equal(await driver.evaluate('document.querySelector("#raceHome .home-library").open'),true);await driver.click('#raceHome .home-library .home-secondary:last-child');
 await driver.evaluate('(async()=>{window.__ownedHomeRace.home.dispose();document.getElementById("raceHome").remove();delete window.__ownedHomeRace;await window.sirenHomeView.refresh();})()');
 result.cases.push({name:'actual rendered Home with a held native metadata handoff keeps navigation busy; next library remains usable and cannot be erased by the prior callback',ok:true});
}
