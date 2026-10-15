// Filesystem adapter for the fixed CI test only. Native external Safety and
// atomic Session owner must exist before its worker is started. No authority
// originates from these file names, records, PIDs or directory checks.
import assert from 'node:assert/strict';import {resolve,join,isAbsolute} from 'node:path';
export function createShellFlowMailbox({directory,fs,now,delay,isAlive}={}){
 assert.ok(typeof directory==='string'&&isAbsolute(directory));directory=resolve(directory);
 for(const key of ['lstat','writeFile','rename','readFile'])assert.equal(typeof fs?.[key],'function');
 assert.ok([now,delay,isAlive].every(f=>typeof f==='function'));let next=0,pending=0,lost=false;
 return Object.freeze({
  async exchange(packet){
   assert.ok(!lost&&isAlive()===true&&pending<3,'TEST_MAILBOX_UNAVAILABLE');
   assert.ok(packet&&packet.sequence===next&&next<128,'TEST_MAILBOX_SEQUENCE');
   const bytes=JSON.stringify(packet);assert.ok(Buffer.byteLength(bytes)<=65536,'TEST_MAILBOX_PACKET_BUDGET');
   next++;pending++;const deadline=now()+3000,name=String(packet.sequence).padStart(6,'0'),control=join(directory,'control-'+name+'.json'),reply=join(directory,'reply-'+name+'.json');
   try{
    await fs.writeFile(control+'.pending',bytes,{flag:'wx'});await fs.rename(control+'.pending',control);
    for(;;){
     assert.ok(isAlive()===true&&!lost,'TEST_MAILBOX_HOST_LOST');assert.ok(now()<deadline,'TEST_MAILBOX_DEADLINE');
     try{
      const st=await fs.lstat(reply);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=262144,'TEST_MAILBOX_REPLY_REFUSED');
      const bytes=await fs.readFile(reply);assert.ok(bytes.length<=262144,'TEST_MAILBOX_REPLY_BUDGET');
      assert.ok(now()<deadline,'TEST_MAILBOX_DEADLINE');const value=JSON.parse(bytes);
      assert.ok(value.admitted===false&&value.sequence===packet.sequence&&value.kind===packet.kind,'TEST_MAILBOX_REPLY_BINDING');return value;
     }catch(e){if(e.code!=='ENOENT')throw e;}await delay(5);
    }
   }catch(error){lost=true;throw error;}finally{pending--;}
  },
  stats:()=>Object.freeze({nativeExecutionAdmitted:false,nextSequence:next,pending,lost}),
 });
}
