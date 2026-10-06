/** Owned test observer only: no writes, control replacement, retries or PIN/data capture. */
export async function installThemeObservation(driver){
 await driver.evaluate(`(()=>{
  const menu=document.getElementById('themeMenu'),button=document.getElementById('themeMenuButton');if(!menu||!button)return;
  const start=performance.now(),events=[],record=(kind,target=null,user=null)=>{events.push({kind,elapsedMs:Math.round(performance.now()-start),target,theme:document.body.dataset.theme,menuHidden:menu.hidden,expanded:button.getAttribute('aria-expanded'),barHidden:document.getElementById('sirenAppNavigation')?.hidden,user});if(events.length>64)events.shift();};
  for(const name of ['pointerdown','click'])document.addEventListener(name,event=>{const node=event.target;record(name,(node?.id||node?.closest?.('[data-theme-value]')?.dataset.themeValue||node?.tagName||'unknown').slice(0,80));},true);
  document.addEventListener('siren-classic-appearance',event=>record('classic-appearance',null,event.detail?.user===true));
  new MutationObserver(records=>{for(const item of records)record(item.target===menu?'menu-visibility':item.target===button?'menu-expanded':'body-theme');}).observe(menu,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>record('menu-expanded')).observe(button,{attributes:true,attributeFilter:['aria-expanded']});
  new MutationObserver(()=>record('body-theme')).observe(document.body,{attributes:true,attributeFilter:['data-theme']});
  window.sirenOwnedThemeObservation=()=>events.slice();record('installed');
 })()`);
}
export const readThemeObservation=driver=>driver.evaluate('window.sirenOwnedThemeObservation?.()??[]').catch(()=>[]);
