import {navigationFields} from '../navigation/contracts.mjs';
export const THEME_IDS=Object.freeze('dark light navy slate oled kpmg cupertino paper blueprint solarized quietnight kintsugi sakura tokyo anime ukiyoe zen koi shinkansen matrix artdeco synthwave cyberpunk kawaii aurora grandhotel abyss spacerace nosferatu hacker wasteland observatory grove ie wonders forest runeterra neural amber'.split(' '));
export function appearanceRequest(input){
 const data=navigationFields(input,['theme'],['theme']);
 if(data.theme!=='system'&&!THEME_IDS.includes(data.theme))throw Error('INVALID_APPEARANCE');
 return {theme:data.theme};
}
