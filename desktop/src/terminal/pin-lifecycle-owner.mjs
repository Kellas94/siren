// SOURCE_ONLY optional MAIN composition; intentionally outside package closure.
// No graph/native loader, IPC registration or Terminal activation occurs here.
import {types} from 'node:util';
import {createPinLifecycleServices} from '../account/pin-lifecycle.mjs';
import {TerminalProductionAccessTransitions} from './production-access-transitions.mjs';

const apply=Reflect.apply;
const captured=Object.freeze(Object.fromEntries(['stats','beginLock','reopen'].map(name=>[name,Object.getOwnPropertyDescriptor(TerminalProductionAccessTransitions.prototype,name).value])));
export function createTerminalPinLifecycleServices(options,...extra){
 if(extra.length||!options||typeof options!=='object'||types.isProxy(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw TypeError('Private MAIN hooks and genuine Terminal owner required');
 const hooks=Object.create(null);let access;
 for(const key of Reflect.ownKeys(options)){
  const d=Object.getOwnPropertyDescriptor(options,key);
  if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value')||key==='terminalCoordination')throw TypeError('Private MAIN hooks and genuine Terminal owner required');
  if(key==='terminalAccess')access=d.value;else hooks[key]=d.value;
 }
 if(!access||typeof access!=='object'||types.isProxy(access)||Object.getPrototypeOf(access)!==TerminalProductionAccessTransitions.prototype)throw TypeError('Genuine Terminal access owner required');
 apply(captured.stats,access,[]); // Actual private-field brand, not role/method shape.
 hooks.terminalCoordination=Object.freeze({
  beginLock:reason=>apply(captured.beginLock,access,[reason]),
  reopen:event=>apply(captured.reopen,access,[event]),
 });
 return createPinLifecycleServices(hooks);
}
