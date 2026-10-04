import assert from 'node:assert/strict';

/** Hold a genuine metadata call at the UI boundary; no authority or reply is fabricated. */
export async function verifyClosedSearch({driver,result}){
 await driver.click('.home-library .home-secondary:last-child');
 await driver.evaluate(`(async()=>{
  document.getElementById('homeRoot').hidden=true;const host=document.createElement('main');host.id='searchRaceHome';document.body.append(host);
  let release;const gate=new Promise(r=>release=r);window.__ownedSearchRace={entered:false,release};
  const bridge={...window.sirenHome,getCatalog:async payload=>{if(payload?.query){window.__ownedSearchRace.entered=true;await gate;}const reply=await window.sirenHome.getCatalog(payload);window.__ownedSearchRace.settled=true;return reply;}};
  const home=window.renderSirenHome({container:host,bridge,desktop:window.sirenDesktop,bootstrap:window.sirenDesktopBootstrap});window.__ownedSearchRace.home=home;await home.refresh();
 })()`);
 await driver.click('#searchRaceHome #homeModule-docs');await driver.waitFor('document.querySelectorAll("#searchRaceHome .home-library [data-entity-id]").length===64');
 await driver.click('#homeLibraryQuery');await driver.send('Input.insertText',{text:'Document 129'});await driver.click('#homeLibrarySearch');await driver.waitFor('window.__ownedSearchRace.entered===true');
 assert.equal(await driver.evaluate('document.getElementById("homeLibrarySearch").disabled'),true);assert.equal(await driver.evaluate('document.getElementById("homeLibraryQuery").disabled'),true);
 await driver.click('#searchRaceHome .home-library .home-secondary:last-child');
 assert.equal(await driver.evaluate('document.querySelector("#searchRaceHome .home-library")?.open===true'),false);
 await driver.waitFor('document.querySelector("#searchRaceHome .home-library")==null');assert.equal(await driver.evaluate('document.querySelector("#searchRaceHome .home-library")==null'),true);
 await driver.evaluate('window.__ownedSearchRace.settled=false;window.__ownedSearchRace.release()');await driver.waitFor('window.__ownedSearchRace.settled===true');
 assert.equal(await driver.evaluate('document.querySelectorAll("#searchRaceHome .home-library,[data-entity-id]").length'),0);
 await driver.evaluate('(async()=>{window.__ownedSearchRace.home.dispose();document.getElementById("searchRaceHome").remove();delete window.__ownedSearchRace;await window.sirenHomeView.refresh();})()');
 result.cases.push({name:'closing Home during a held genuine search retires rows; late metadata cannot reopen the library or publish old names',ok:true});
}
