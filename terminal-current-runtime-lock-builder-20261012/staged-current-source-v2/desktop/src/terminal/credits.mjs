import {TERMINAL_LIMITS as limits} from './contracts.mjs';
// Pure host-side accounting. No IPC sender, process or renderer authority.
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const fail=code=>({ok:false,code});
const pass=value=>({ok:true,value});
export class TerminalOutputCredits {
  #leases=new Map();#outstanding=0;
  attach(leaseId,fromSequence=0){
    if(!id(leaseId)||!integer(fromSequence)||this.#leases.has(leaseId))return fail('REQUEST_REFUSED');
    if(this.#leases.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
    this.#leases.set(leaseId,{next:fromSequence,acked:fromSequence,bytes:0,frames:[]});return pass({leaseId,fromSequence});
  }
  reserve(leaseId,{sequence,utf8Bytes}={}){
    const l=this.#leases.get(leaseId);if(!l)return fail('LEASE_STALE');
    if(!integer(sequence)||sequence!==l.next||!integer(utf8Bytes)||utf8Bytes<1||utf8Bytes>limits.outputBytes||!integer(sequence+utf8Bytes))return fail('REQUEST_REFUSED');
    // Bound metadata too, including a stream of one-byte deliveries.
    if(l.frames.length>=256||l.bytes+utf8Bytes>limits.attachmentOutputBytes||this.#outstanding+utf8Bytes>limits.hostOutputBytes)return fail('CAPACITY_EXCEEDED');
    l.next=sequence+utf8Bytes;l.bytes+=utf8Bytes;this.#outstanding+=utf8Bytes;l.frames.push({end:l.next,bytes:utf8Bytes});return pass({nextSequence:l.next});
  }
  ack(leaseId,throughSequence){
    const l=this.#leases.get(leaseId);if(!l)return fail('LEASE_STALE');
    if(!integer(throughSequence)||throughSequence<l.acked||throughSequence>l.next)return fail('REQUEST_REFUSED');
    if(throughSequence===l.acked)return pass({throughSequence,releasedUtf8Bytes:0});
    const index=l.frames.findIndex(f=>f.end===throughSequence);if(index<0)return fail('REQUEST_REFUSED');
    let bytes=0;for(const f of l.frames.splice(0,index+1))bytes+=f.bytes;
    l.acked=throughSequence;l.bytes-=bytes;this.#outstanding-=bytes;return pass({throughSequence,releasedUtf8Bytes:bytes});
  }
  advanceToRetained(leaseId,sequence){
    const l=this.#leases.get(leaseId);if(!l)return fail('LEASE_STALE');
    if(!integer(sequence)||sequence<l.next||l.frames.length)return fail('REQUEST_REFUSED');
    l.next=sequence;l.acked=sequence;return pass({resumeSequence:sequence});
  }
  detach(leaseId){const l=this.#leases.get(leaseId);if(!l)return fail('LEASE_STALE');this.#leases.delete(leaseId);this.#outstanding-=l.bytes;return pass({releasedUtf8Bytes:l.bytes});}
  stats(){return Object.freeze({attachments:this.#leases.size,outstandingUtf8Bytes:this.#outstanding,frames:[...this.#leases.values()].reduce((n,l)=>n+l.frames.length,0)});}
}
