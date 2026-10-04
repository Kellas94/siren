/** A workspace timer can retire the real toast between separate CDP reads.
 * Establish and observe the required top-layer precondition synchronously,
 * keeping real CSS/visibility and restoring only owned fixture changes. */
export async function observeAccessToast(driver){
 return driver.evaluate(`(()=>{
  const screen=document.getElementById('desktopAccessScreen'),toast=document.getElementById('toast');
  if(!screen?.isConnected||!toast)throw Error('Actual PIN overlay and toast required');
  const before={style:toast.getAttribute('style'),text:toast.textContent,visibleClass:toast.classList.contains('is-visible'),topLayer:toast.matches(':popover-open')};
  try{
   // Only the owned synthetic toast transition is suspended. The real access
   // screen visibility rule and actual popover/opacity observations remain.
   toast.style.transition='none';toast.textContent='Synthetic workspace notification';toast.classList.add('is-visible');toast.style.opacity='1';if(!before.topLayer)toast.showPopover();
   const style=getComputedStyle(toast);return {topLayer:toast.matches(':popover-open'),visible:toast.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),opacity:Number(style.opacity),visibility:style.visibility};
  }finally{
   if(!before.topLayer&&toast.matches(':popover-open'))toast.hidePopover();if(before.style===null)toast.removeAttribute('style');else toast.setAttribute('style',before.style);toast.textContent=before.text;if(!before.visibleClass)toast.classList.remove('is-visible');
  }
 })()`);
}
