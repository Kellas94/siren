import {navigationFields} from './contracts.mjs';
import {validId} from '../projects/paths.mjs';
import {validEntityId} from '../windows/entities.mjs';

export const WORKSPACE_ENTRIES=Object.freeze({home:'siren://app/home.html',module:'siren://app/app.html'});
const refuse=code=>Object.assign(new Error(code),{code});
export function workspaceEntryURL(value) {
 if(typeof value!=='string'||!Object.values(WORKSPACE_ENTRIES).includes(value))throw refuse('INVALID_ENTRY');
 return value;
}
export function normalizeRoute(input) {
 try {
  const route=navigationFields(input,['surface','entityId','sourceRef'],['surface']);
  if(!['home','diagrams','docs','code','present'].includes(route.surface))throw refuse('INVALID_ROUTE');
  if(Object.hasOwn(route,'entityId')&&!(route.surface==='code'?validId(route.entityId):validEntityId(route.entityId)))throw refuse('INVALID_ROUTE');
  if(route.surface==='home'&&Object.keys(route).length!==1)throw refuse('INVALID_ROUTE');
  if(Object.hasOwn(route,'sourceRef')) {
   const ref=navigationFields(route.sourceRef,['sourceId','version','sha256']);
   if(route.surface!=='code'||route.entityId!==ref.sourceId||!validId(ref.sourceId)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))throw refuse('INVALID_ROUTE');
   route.sourceRef=Object.freeze(ref);
  }
  return Object.freeze(route);
 }catch{throw refuse('INVALID_ROUTE');}
}
