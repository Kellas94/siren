import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {HELP_ARTICLES,validateHelpCatalog} from '../src/help/catalog.mjs';
export async function readHelpBrowser(){
 if(!validateHelpCatalog(HELP_ARTICLES).ok)throw Error('INVALID_HELP_CATALOG');
 const result=await build({stdin:{contents:"import {HELP_ARTICLES,HELP_CATALOG_VERSION} from './src/help/catalog.mjs';import {createHelpResolver} from './src/help/resolve.mjs';window.SirenHelpCatalog=HELP_ARTICLES;window.SirenHelpCatalogVersion=HELP_CATALOG_VERSION;window.SirenHelpResolver=createHelpResolver(HELP_ARTICLES);",resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',legalComments:'none',charset:'utf8'});
 const source=result.outputFiles[0].text;if(Buffer.byteLength(source)>256*1024||/<\/script/i.test(source))throw Error('HELP_BUNDLE_REFUSED');return source;
}
