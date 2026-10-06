import {parseSourceBundle,verifyParsedSourceBundle,verifyBundleMetadata} from '../sources/bundle-import.mjs';
import {validateImportedProject,validateImportedBundleMetadata} from './import-validation.mjs';
import {parseLegacyImport} from './migration.mjs';

const refused=code=>Object.assign(Error(code),{code});
/** Native chosen bytes only. The renderer never chooses a path, validation
 * method, source identity or write target. Admission itself writes no project. */
export async function admitImportedProject({bytes,fileName},{createValidator,isCurrent}) {
 let revoked=false;
 const current=()=>{let live=false;try{live=isCurrent()===true;}catch{}if(!live)revoked=true;return !revoked;};
 const guard=()=>{if(!current())throw refused('ACCESS_REFUSED');};
 guard();const bundle=parseSourceBundle(bytes);guard();
 if(bundle){
  const json=await validateImportedBundleMetadata({json:bundle.snapshot.json,fileName},{createValidator,isCurrent:current});guard();
  const verified=verifyParsedSourceBundle(bundle),metadata=verifyBundleMetadata(JSON.parse(json),verified);guard();
  return {kind:'sources',bundle:verified,metadata};
 }
 const validated=await validateImportedProject({bytes,fileName},{createValidator,isCurrent:current});guard();
 const json=parseLegacyImport(Buffer.from(validated));guard();return {kind:'legacy',json};
}
