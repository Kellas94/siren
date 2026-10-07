const limit=64*1024*1024;
const error=code=>Object.assign(new Error(code),{code});
const live=callback=>{try{return callback()===true;}catch{return false;}};

/** Inputs originate exclusively from the native selected-file reader. The
 * factory is native-owned; this is never a renderer-callable path authority. */
export async function validateImportedProject({bytes,fileName},{createValidator,isCurrent}) {
  if(!live(isCurrent))throw error('ACCESS_REFUSED');
  if(!(bytes instanceof Uint8Array) || bytes.byteLength===0 || bytes.byteLength>limit)throw error('IMPORT_TOO_LARGE');
  if(typeof fileName!=='string' || !fileName.length || fileName.length>256 || /[\\/:\x00-\x1f]/.test(fileName) || fileName==='.' || fileName==='..')throw error('IMPORT_NAME_REFUSED');
  let text;
  try {text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(bytes));}catch{throw error('IMPORT_ENCODING_REFUSED');}
  let validator,result,problem;
  try {
    validator=await createValidator();
    if(!live(isCurrent))throw error('ACCESS_REFUSED');
    if(typeof validator?.validate!=='function' || typeof validator?.dispose!=='function')throw error('IMPORT_VALIDATOR_UNAVAILABLE');
    result=await validator.validate(text,fileName);
    if(!live(isCurrent))throw error('ACCESS_REFUSED');
    if(typeof result!=='string' || !result.isWellFormed() || Buffer.byteLength(result)>limit)throw error('IMPORT_INVALID');
    const parsed=JSON.parse(result);if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))throw error('IMPORT_INVALID');
  } catch(cause) {problem=error(!live(isCurrent)?'ACCESS_REFUSED':cause.code==='IMPORT_VALIDATOR_UNAVAILABLE'?cause.code:'IMPORT_INVALID');}
  finally {
    if(validator)try {await validator.dispose();}catch {problem=error('IMPORT_DISPOSAL_FAILED');}
  }
  if(!live(isCurrent) && !problem)problem=error('ACCESS_REFUSED');
  if(problem)throw problem;
  return result;
}

// This door receives only the verified bundle's metadata JSON. Source bytes,
// base64 and filesystem paths never enter the isolated semantic validator.
export async function validateImportedBundleMetadata({json,fileName},{createValidator,isCurrent}) {
  if(!live(isCurrent))throw error('ACCESS_REFUSED');
  const metadata=text=>{
    if(typeof text!=='string'||!text.isWellFormed()||Buffer.byteLength(text)>limit)throw error('IMPORT_INVALID');
    const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw error('IMPORT_INVALID');
    let nodes=0;
    const visit=(item,depth=0)=>{
      if(depth>64||++nodes>1000000)throw error('IMPORT_INVALID');
      if(typeof item==='string'&&!item.isWellFormed())throw error('IMPORT_INVALID');
      if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){if(!key.isWellFormed())throw error('IMPORT_INVALID');visit(child,depth+1);}
    };
    visit(value);return text;
  };
  if(typeof fileName!=='string'||!fileName.length||fileName.length>256||/[\\/:\x00-\x1f]/.test(fileName)||fileName==='.'||fileName==='..')throw error('IMPORT_NAME_REFUSED');
  try{metadata(json);}catch{throw error('IMPORT_INVALID');}
  let validator,result,problem;
  try{
    validator=await createValidator();
    if(!live(isCurrent))throw error('ACCESS_REFUSED');
    if(typeof validator?.validateBundleMetadata!=='function'||typeof validator?.dispose!=='function')throw error('IMPORT_VALIDATOR_UNAVAILABLE');
    result=await validator.validateBundleMetadata(json,fileName);
    if(!live(isCurrent))throw error('ACCESS_REFUSED');
    metadata(result);
  }catch(cause){problem=error(!live(isCurrent)?'ACCESS_REFUSED':cause.code==='IMPORT_VALIDATOR_UNAVAILABLE'?cause.code:'IMPORT_INVALID');}
  finally{if(validator)try{await validator.dispose();}catch{problem=error('IMPORT_DISPOSAL_FAILED');}}
  if(!live(isCurrent)&&!problem)problem=error('ACCESS_REFUSED');
  if(problem)throw problem;
  return result;
}
