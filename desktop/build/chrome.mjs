import {readFile} from 'node:fs/promises';
/** Styles only: no grants, bootstrap, remote resources or scripts. */
export async function readDesktopChrome(){
 const css=await readFile(new URL('../src/ui/shared/chrome.css',import.meta.url),'utf8');
 if(/<\/style|@import\b|url\s*\(/i.test(css))throw Error('DESKTOP_CHROME_BOUNDARY_REFUSED');
 return css;
}
