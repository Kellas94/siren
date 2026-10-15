import {parseSourceBundle,verifyParsedSourceBundle,verifyBundleMetadata} from '../sources/bundle-import.mjs';
import {validateImportedProject,validateImportedBundleMetadata} from './import-validation.mjs';
import {parseLegacyImport} from './migration.mjs';
import {isDeepStrictEqual} from 'node:util';
import {parseEmbedBundle,qualifyEmbedBundle} from '../documents/diagram-embed-bundle.mjs';

const refused=code=>Object.assign(Error(code),{code});
/** Native chosen bytes only. The renderer never chooses a path, validation
 * method, source identity or write target. Admission itself writes no project. */
export async function admitImportedProject({bytes,fileName},{createValidator,isCurrent}) {
 let revoked=false;
 const current=()=>{let live=false;try{live=isCurrent()===true;}catch{}if(!live)revoked=true;return !revoked;};
 const guard=()=>{if(!current())throw refused('ACCESS_REFUSED');};
 guard();if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>64*1024*1024)throw refused('BUNDLE_WIRE_BUDGET');const embedded=parseEmbedBundle(Buffer.from(bytes));const bundle=embedded?.bundle??parseSourceBundle(bytes);guard();
 if(bundle){
  const json=await validateImportedBundleMetadata({json:bundle.snapshot.json,fileName},{createValidator,isCurrent:current});guard();
  const verified=verifyParsedSourceBundle(bundle),metadata=verifyBundleMetadata(JSON.parse(json),verified);guard();
  if(embedded){if(!isDeepStrictEqual(metadata,embedded.bundle.metadata))throw refused('BUNDLE_METADATA_MISMATCH');const diagramAdmission=await qualifyEmbedBundle({parsed:embedded,createValidator,isCurrent:current});guard();return {kind:'sources',bundle:verified,metadata,diagramAdmission};}
  return {kind:'sources',bundle:verified,metadata};
 }
 const validated=await validateImportedProject({bytes,fileName},{createValidator,isCurrent:current});guard();
 const json=parseLegacyImport(Buffer.from(validated));if((JSON.parse(json).diagramEmbedAssets?.refs?.length??0)>0)throw refused('BUNDLE_DIAGRAM_ASSETS_REQUIRED');guard();return {kind:'legacy',json};
}
