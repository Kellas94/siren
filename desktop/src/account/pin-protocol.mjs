// Private main-to-main protocol. Never exported through a renderer bridge.
const MAX_FRAME=32768,MAX_CIPHER=16374;
const refused=()=>{throw Object.assign(new Error('Protected PIN protocol refused'),{code:'PIN_PROTOCOL_REFUSED'});};
const shape=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&Buffer.byteLength(v,'utf8')<=4096;
const cipher=v=>{if(typeof v!=='string'||!v.length||v.length>21832||/[^A-Za-z0-9+/=]/.test(v))return false;const b=Buffer.from(v,'base64');return b.length>0&&b.length<=MAX_CIPHER&&b.toString('base64')===v;};
const common=v=>v?.schema===1&&typeof v.nonce==='string'&&/^[a-f0-9]{32}$/.test(v.nonce)&&['encrypt','decrypt'].includes(v.operation);
export function pinRequest(v){
 if(!common(v)||typeof v.requireKey!=='boolean'||v.operation==='decrypt'&&!v.requireKey||!shape(v,['schema','nonce','operation','requireKey',v.operation==='encrypt'?'text':'cipher64'])||!(v.operation==='encrypt'?text(v.text):cipher(v.cipher64)))refused();return v;
}
export function pinResponse(v,request){
 pinRequest(request);const field=request.operation==='encrypt'?'cipher64':'text';
 if(!common(v)||v.nonce!==request.nonce||v.operation!==request.operation||!shape(v,['schema','nonce','operation',field])||!(field==='text'?text(v.text):cipher(v.cipher64)))refused();return v;
}
export function encodePinFrame(v){const payload=Buffer.from(JSON.stringify(v));if(!payload.length||payload.length>MAX_FRAME)refused();const size=Buffer.alloc(4);size.writeUInt32BE(payload.length);return Buffer.concat([size,payload]);}
export function writePinFrame(write,frame){
 if(typeof write!=='function'||!Buffer.isBuffer(frame)||frame.length>MAX_FRAME+4)refused();
 for(let offset=0;offset<frame.length;){const count=write(frame,offset,frame.length-offset);if(!Number.isSafeInteger(count)||count<1||count>frame.length-offset)refused();offset+=count;}
}
export function decodePinFrame(frame){
 if(!Buffer.isBuffer(frame)||frame.length<5||frame.length>MAX_FRAME+4||frame.readUInt32BE(0)!==frame.length-4)refused();
 try{const text=new TextDecoder('utf-8',{fatal:true}).decode(frame.subarray(4)),value=JSON.parse(text);if(JSON.stringify(value)!==text)refused();return value;}catch{refused();}
}
