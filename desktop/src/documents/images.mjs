export const DOCUMENT_IMAGE_IMPORT_BYTES=512*1024;
export function inspectDocumentImage(value,{maxBytes=2*1024*1024}={}){
 const no={ok:false};if(typeof value!=='string'||value.length>Math.ceil(maxBytes/3)*4+80)return no;
 const match=/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match||match[2].length%4)return no;
 const payload=match[2],bytes=payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0);if(bytes>maxBytes)return no;
 try{const head=atob(payload.slice(0,32)),tail=atob(payload.slice(-32)),u=i=>head.charCodeAt(i);if(match[1]==='image/png'){if(bytes<33||[137,80,78,71,13,10,26,10].some((v,i)=>u(i)!==v)||!tail.endsWith('IEND\xaeB`\x82'))return no;const header=atob(payload.slice(0,48)),n=at=>header.charCodeAt(at)*16777216+header.charCodeAt(at+1)*65536+header.charCodeAt(at+2)*256+header.charCodeAt(at+3),w=n(16),h=n(20);if(header.slice(12,16)!=='IHDR'||!w||!h||w*h>16*1024*1024)return no;}else {if(bytes<4||u(0)!==255||u(1)!==216||u(2)!==255||!tail.endsWith('\xff\xd9'))return no;const raw=atob(payload),b=i=>raw.charCodeAt(i);let at=2,found=false;
   while(at+3<raw.length){if(b(at++)!==255)return no;while(b(at)===255)at++;const marker=b(at++);if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const length=b(at)*256+b(at+1);if(length<2||at+length>raw.length)return no;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(found||length<8)return no;const h=b(at+3)*256+b(at+4),w=b(at+5)*256+b(at+6);if(!w||!h||w*h>16*1024*1024)return no;found=true;}at+=length;}if(!found)return no;
  }
  return {ok:true,mime:match[1],bytes};
 }catch{return no;}
}
export function editDocumentImage(before,changes){
 const fail=()=>{throw Error('DOCUMENT_IMAGE_REFUSED');};if(!before||before.kind!=='image'||typeof before.id!=='string'||!changes||typeof changes!=='object'||Array.isArray(changes))fail();
 const descriptors=Object.getOwnPropertyDescriptors(changes),keys=Reflect.ownKeys(descriptors);if(!keys.length||keys.some(k=>!['dataUri','caption','fileName'].includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')))fail();
 for(const key of keys){const v=descriptors[key].value;if(typeof v!=='string'||!v.isWellFormed()||key==='dataUri'&&!inspectDocumentImage(v).ok||key==='caption'&&v.length>1000||key==='fileName'&&v.length>160)fail();}
 return {...structuredClone(before),...Object.fromEntries(keys.map(k=>[k,descriptors[k].value]))};
}
