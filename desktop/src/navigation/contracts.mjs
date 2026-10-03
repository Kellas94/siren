import { validId } from '../projects/paths.mjs';

export const NAVIGATION_BYTES = 64 * 1024;
const error = code => Object.assign(new Error(code), { code });
const invalid = () => { throw error('INVALID_NAVIGATION'); };
const limit = () => { throw error('NAVIGATION_LIMIT'); };

// Descriptor checks reject accessors, hidden/unknown/symbol fields and inherited
// authority before reading values. These are data records, never live UI objects.
function fields(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key) || !('value' in descriptors[key])) ||
      required.some(key => !Object.hasOwn(descriptors,key))) invalid();
  return Object.fromEntries(Object.entries(descriptors).map(([key,descriptor]) => [key,descriptor.value]));
}
function array(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length.value;
  if (length > maximum) limit();
  if (Reflect.ownKeys(descriptors).length !== length + 1) invalid();
  const result=[];
  for (let i=0;i<length;i++) {
    const item=descriptors[String(i)];
    if (!item || !('value' in item)) invalid();
    result.push(item.value);
  }
  return result;
}
const offset = value => Number.isSafeInteger(value) && value >= 0;
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
function layout(input) {
  const item=fields(input,['role','entityId','version','normalBounds','displayId','maximized','fullscreen'],['role','entityId','normalBounds','displayId','maximized','fullscreen']);
  if (!['diagram','docs','code','presenter','audience'].includes(item.role) || !validId(item.entityId) ||
      Object.hasOwn(item,'version') && (!offset(item.version) || item.version < 1) ||
      !(Number.isSafeInteger(item.displayId) || typeof item.displayId === 'string' && item.displayId.length > 0 && item.displayId.length <= 128) ||
      typeof item.maximized !== 'boolean' || typeof item.fullscreen !== 'boolean') invalid();
  const bounds=fields(item.normalBounds,['x','y','width','height']);
  if (!Object.values(bounds).every(finite) || bounds.width <= 0 || bounds.height <= 0 || !finite(bounds.x+bounds.width) || !finite(bounds.y+bounds.height)) invalid();
  return {...item,normalBounds:bounds};
}
export function normalizeLocation(input,{projectId}) {
  if (!validId(projectId)) invalid();
  const item=fields(input,['surface','entityId','sourceRef','cursor','scroll','layouts'],['surface']);
  if (!['diagrams','docs','code','present'].includes(item.surface) || Object.hasOwn(item,'entityId') && !validId(item.entityId)) invalid();
  const result={schema:1,projectId,surface:item.surface};
  if (Object.hasOwn(item,'entityId')) result.entityId=item.entityId;
  if (Object.hasOwn(item,'sourceRef')) {
    const ref=fields(item.sourceRef,['sourceId','version','sha256']);
    if (!validId(ref.sourceId) || !offset(ref.version) || ref.version < 1 || typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256)) invalid();
    result.sourceRef=ref;
  }
  if (Object.hasOwn(item,'cursor')) {
    const cursor=fields(item.cursor,['anchor','head']);if (!Object.values(cursor).every(offset)) invalid();result.cursor=cursor;
  }
  if (Object.hasOwn(item,'scroll')) {
    const scroll=fields(item.scroll,['x','y']);if (!Object.values(scroll).every(finite)) invalid();result.scroll=scroll;
  }
  if (Object.hasOwn(item,'layouts')) result.layouts=array(item.layouts,16).map(layout);
  return result;
}
export function normalizeNavigationRequest(input) {
  const item=fields(input,['projectId','label','location','visitedAt']);
  if (!validId(item.projectId) || typeof item.label !== 'string' || item.label.length > 256 ||
      typeof item.visitedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.visitedAt) ||
      !Number.isFinite(Date.parse(item.visitedAt)) || new Date(item.visitedAt).toISOString() !== item.visitedAt) invalid();
  return {...item,location:normalizeLocation(item.location,{projectId:item.projectId})};
}
export function normalizeRecord(input) {
  const record=fields(input,['schema','entries']);if(record.schema!==1) invalid();
  const seen=new Set();
  const entries=array(record.entries,64).map(value=>{
    const entry=fields(value,['projectId','label','location','visitedAt']);
    const saved=fields(entry.location,['schema','projectId','surface','entityId','sourceRef','cursor','scroll','layouts'],['schema','projectId','surface']);
    if(saved.schema!==1 || saved.projectId!==entry.projectId || seen.has(entry.projectId)) invalid();
    const {schema,projectId,...location}=saved;
    const normalized=normalizeNavigationRequest({...entry,location});seen.add(entry.projectId);return normalized;
  });
  return {schema:1,entries};
}
