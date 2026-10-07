import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';
const refuse=()=>{throw Error('PRESENTATION_NOTES_REFUSED');};
const text=(v,n)=>typeof v==='string'&&v.length<=n&&v.isWellFormed();
/** Serialize only the main-owned captured private projection. Count UTF-8 bytes
 * before joining/allocating; preserve note strings, including CR and blank text. */
export function formatPresentationNotes(input,{maximum=8*1024*1024}={}){
 if(!Number.isSafeInteger(maximum)||maximum<1||maximum>8*1024*1024)refuse();
 const deck=navigationFields(input,['deckId','version','title','slides']);
 if(!validId(deck.deckId)||!text(deck.title,256)||typeof deck.version!=='string'||!/^[a-f0-9]{64}$/.test(deck.version)||!Array.isArray(deck.slides)||Object.getPrototypeOf(deck.slides)!==Array.prototype)refuse();
 const fields=Object.getOwnPropertyDescriptors(deck.slides),count=fields.length.value;
 if(count<1||count>600||Reflect.ownKeys(fields).length!==count+1)refuse();
 const parts=[],ids=new Set();let bytes=0;
 const append=value=>{bytes+=Buffer.byteLength(value);if(bytes>maximum)throw Object.assign(Error('PRESENTATION_NOTES_BUDGET'),{code:'PRESENTATION_NOTES_BUDGET'});parts.push(value);};
 append('SIREN · Captured presenter notes\n'+deck.title+'\nDeck: '+deck.deckId+'\nVersion: '+deck.version+'\n\n');
 for(let i=0;i<count;i++){
  const descriptor=fields[i];if(!descriptor||!('value'in descriptor))refuse();
  const slide=navigationFields(descriptor.value,['id','title','notes']);
  if(!validId(slide.id)||ids.has(slide.id)||!text(slide.title,256)||!text(slide.notes,65536))refuse();ids.add(slide.id);
  append('Slide '+(i+1)+' · '+slide.id+' · '+slide.title+'\n\n');append(slide.notes);append('\n');
 }
 return Object.freeze({extension:'txt',bytes:Buffer.from(parts.join(''),'utf8')});
}
