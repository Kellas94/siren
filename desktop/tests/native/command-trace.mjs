import {writeFile} from 'node:fs/promises';

// Observe only bounded method/stage/timing metadata. Never retain arguments,
// expressions, credentials, source text or returned workspace values.
export function traceNativeCommands(owned,{diagnostic,path}){
 diagnostic.sequence??=0;
 diagnostic.ownedPid=owned.pid;
 diagnostic.commands??=[];
 const retain=()=>writeFile(path,JSON.stringify(diagnostic,null,2));
 for(const method of ['evaluate','waitFor','click','send','screenshot','waitForExit']){
  const execute=owned[method].bind(owned);
  owned[method]=async(...args)=>{
   const command={sequence:++diagnostic.sequence,ownedPid:owned.pid,phase:diagnostic.phase,method,started:new Date().toISOString()};
   diagnostic.commands.push(command);if(diagnostic.commands.length>32)diagnostic.commands.shift();
   await retain();
   try{const value=await execute(...args);command.finished=new Date().toISOString();return value;}
   catch(cause){command.error=String(cause.message).startsWith('CDP timeout:')?cause.message:'COMMAND_FAILED';diagnostic.failedCommand??={...command};throw cause;}
  };
 }
 return owned;
}
