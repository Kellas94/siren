import {readSourceBundleImportStatus} from '../navigation/source-bundle-copy.mjs';
/** External bundle copies remain quarantined until their durable completion
 * record and selected manifest agree. Ordinary projects have no such record. */
export async function assertImportComplete(projects,projectId){
 const status=await readSourceBundleImportStatus({projects,projectId});
 if(status?.state==='incomplete')throw Object.assign(Error('Source bundle import is incomplete'),{code:'BUNDLE_IMPORT_INCOMPLETE'});
}
