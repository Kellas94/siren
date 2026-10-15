// Display palette only. It grants no project, native or account authority.
import {THEME_IDS} from '../appearance/contracts.mjs';
export function terminalPalette(theme='system',systemDark=true){
 const chosen=theme==='system'?(systemDark?'dark':'light'):THEME_IDS.includes(theme)?theme:'dark';
 const light=['light','paper','kpmg','cupertino','sakura','zen','koi','grandhotel','kawaii'].includes(chosen);
 const accents={kpmg:'#005eb8',navy:'#65aaff',matrix:'#42df80',hacker:'#42df80',amber:'#ffbf56',solarized:'#2aa198',sakura:'#df78a2',kintsugi:'#d8b365',synthwave:'#e887ff',cyberpunk:'#e887ff',blueprint:'#70afff',oled:'#94b7ff'};
 return Object.freeze({background:chosen==='oled'?'#000000':light?'#f6f8fc':chosen==='navy'?'#101b30':'#171719',foreground:light?'#20283a':'#e9ebf3',cursor:accents[chosen]??(light?'#245ac4':'#90aaff'),selectionBackground:light?'#c5d8ff':'#38466b'});
}
