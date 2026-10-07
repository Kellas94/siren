/** Desktop Home owns automatic onboarding; keep the retained Studio tour explicit. */
export function patchDesktopTour(html){
 const marker="if (!state.tourDone) setTimeout(() => { if (!state.tourDone && document.body.dataset.presenting !== 'on') startWelcomeTour(); }, introPlaying ? 1900 : 1100);";
 if(html.split(marker).length!==2)throw Error('Desktop automatic tour marker mismatch');
 return html.replace(marker,marker.replace('if (!state.tourDone)','if (!window.sirenDesktop && !state.tourDone)'));
}
