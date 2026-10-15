// Pure fixture DATA check, not native authority or process membership proof.
export function validateLocalSessionCapture({captured,ready,node,conhost}){
 let ok=false;
 try{
  const rows=captured.held,ids=new Set(),fixed=[ready.creatorPid,ready.shellPid];
  const pid=v=>Number.isInteger(v)&&v>0&&v<=0xffffffff;
  ok=typeof node==='string'&&typeof conhost==='string'&&fixed.every(pid)&&fixed[0]!==fixed[1]&&
   Array.isArray(rows)&&rows.length>=2&&rows.length<=4&&captured.active===rows.length&&rows.every(p=>{
    if(!pid(p.pid)||ids.has(p.pid)||p.alive!==true||typeof p.image!=='string')return false;
    ids.add(p.pid);return p.image.toLowerCase()===(fixed.includes(p.pid)?node:conhost).toLowerCase();
   })&&fixed.every(p=>ids.has(p));
 }catch{}
 return Object.freeze({ok,nativeExecutionAdmitted:false,actualSettlementEstablished:false,scope:'LOCAL_FIXTURE_DATA_ONLY'});
}
