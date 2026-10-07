const names=new Set(['undo','redo','find','wrap','save','select-all']);
const writes=new Set(['undo','redo','save']);
/** One finite local dispatch for toolbar, menu and owned shortcuts. The editor
 * adapter remains responsible for serialized edits and Save receipts. */
export function createCodeCommands({stateFor,handlers,isDisposed=()=>false}){
 const enabled=name=>{const state=stateFor();return names.has(name)&&!isDisposed()&&state?.ready===true&&!state.paused&&(!writes.has(name)||!state.readonly&&!state.fenced&&!state.saving);};
 return Object.freeze({enabled,run(name){if(!enabled(name)||typeof handlers[name]!=='function')return false;handlers[name]();return true;}});
}
