const live=callback=>{try{return callback()===true;}catch{return false;}};
import {applyPresentationEdits} from '../documents/presentation-edits.mjs';
/** Native-only adapter to the existing frozen product validators. Combined
 * Docs content is validated as title plus blocks before its single transaction.
 * The hidden validator has no project/PIN bridge or persistent profile. */
export async function validateDomainPatch(input,{isCurrent,createValidator}){
 if(!live(isCurrent)||typeof createValidator!=='function')return false;
 let validator,accepted=false;
 try{
  validator=await createValidator();if(!live(isCurrent)||typeof validator?.validatePatch!=='function'||typeof validator?.dispose!=='function')return false;
  const patches=input?.domain==='docs'&&['replace-content','replace-context-content'].includes(input.action)?
   [{...input,action:'rename',payload:{title:input.payload.title}},{...input,action:'replace-blocks',payload:{blocks:input.payload.blocks}},...(input.action==='replace-context-content'?[{...input,action:'update-context',payload:input.payload.context}]:[])]:input?.domain==='diagram'&&input.action==='replace-content'?
   [{...input,action:'replace-source',payload:{source:input.payload.source}},...(Object.keys(input.payload).some(k=>!['source','resetStyleFields'].includes(k))?[{...input,action:'update-style',payload:Object.fromEntries(Object.entries(input.payload).filter(([key])=>!['source','resetStyleFields'].includes(key)))}]:[])]:input?.domain==='diagram'&&input.action==='replace-deck-content'?
   [{...input,action:'replace-source',payload:{source:input.payload.source}},...(Object.keys(input.payload).some(k=>!['source','presentationEdits','resetStyleFields'].includes(k))?[{...input,action:'update-style',payload:Object.fromEntries(Object.entries(input.payload).filter(([k])=>!['source','presentationEdits','resetStyleFields'].includes(k)))}]:[]),{...input,action:'edit-presentation',payload:{edits:input.payload.presentationEdits,presentation:applyPresentationEdits(input.before?.presentation,input.payload.presentationEdits)}}]:[input];
  accepted=true;
  for(const patch of patches)if(!live(isCurrent)||await validator.validatePatch(patch)!==true||!live(isCurrent)){accepted=false;break;}
 }catch{accepted=false;}
 finally{if(validator)try{await validator.dispose();}catch{accepted=false;}}
 return accepted&&live(isCurrent);
}
