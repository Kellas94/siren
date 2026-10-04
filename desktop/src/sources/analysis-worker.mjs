import {parentPort,workerData} from 'node:worker_threads';
import {diffSourceText} from './diff-worker.mjs';
import {mapSelectedSyntax} from './map-worker.mjs';
const fail=reason=>{throw Object.assign(Error(reason),{reason});};
const boundary=(text,p)=>p===0||p===text.length||!(text.charCodeAt(p-1)>=0xd800&&text.charCodeAt(p-1)<=0xdbff&&text.charCodeAt(p)>=0xdc00&&text.charCodeAt(p)<=0xdfff);

/** Trusted parser only. Python source is literal parser input, never evaluated. */
export function runAnalysisWorker(parser){
 const {bytes,request}=workerData;
 try{
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),budget=request.budget;
  if(request.kind==='diff'){const right=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(workerData.rightBytes);parentPort.postMessage(diffSourceText(text,right,budget));return;}
  const from=request.range?.from??0,requestedTo=request.range?.to??text.length;
  if(from>requestedTo||requestedTo>text.length||!boundary(text,from)||!boundary(text,requestedTo))fail('INVALID_RANGE');
  let to=Math.min(requestedTo,from+budget.maxUnits);if(!boundary(text,to))to--;
  const input=text.slice(from,to),lines=[from];let baseLine=1;
  if(from)for(const match of text.matchAll(/\r\n|\r|\n/g)){if(match.index+match[0].length>from)break;baseLine++;}
  for(const match of input.matchAll(/\r\n|\r|\n/g))lines.push(from+match.index+match[0].length);
  const lineFor=offset=>{let a=0,b=lines.length;while(a<b){const m=(a+b)>>>1;if(lines[m]<=offset)a=m+1;else b=m;}return baseLine+a-1;};
  const started=performance.now(),parse=parser.startParse(input);let tree;
  while(!(tree=parse.advance()))if(performance.now()-started>budget.wallMs)fail('PARSE_BUDGET');
  if(request.kind==='map'){
   const result=mapSelectedSyntax(tree,{input,from,to,lineFor,budget}),truncated=to<requestedTo,status=truncated||result.limited||result.errors.length?'partial':'complete';
   parentPort.postMessage({status,coverage:{from,to,totalUnits:text.length,truncated,syntaxErrors:result.errors.length,limited:result.limited,labelTruncated:result.labelTruncated},result,...(result.limited?{reason:'GRAPH_BUDGET'}:truncated?{reason:'RANGE_BUDGET'}:result.errors.length?{reason:'SYNTAX_ERRORS'}:{})});return;
  }
  const definitions=[],errors=[],parents=[];let visited=0,limited=false;
  try{tree.iterate({enter(node){
   if(++visited>budget.maxNodes)fail('INDEX_BUDGET');
   if(node.type.isError){if(errors.length<128)errors.push({from:from+node.from,to:from+node.to});}
   if(node.name!=='ClassDefinition'&&node.name!=='FunctionDefinition')return;
   if(definitions.length>=budget.maxDefinitions){limited=true;return false;}
   const name=node.node.getChild('VariableName');if(!name)return;if(name.to-name.from>512){limited=true;return false;}
   const parent=parents.length?parents.at(-1).index:null,index=definitions.length;
   definitions.push({kind:node.name==='ClassDefinition'?'class':'function',name:input.slice(name.from,name.to),async:Boolean(node.node.getChild('async')),from:from+node.from,to:from+node.to,nameFrom:from+name.from,nameTo:from+name.to,line:lineFor(from+name.from),parent});
   parents.push({from:node.from,to:node.to,index});
  },leave(node){if(parents.at(-1)?.from===node.from&&parents.at(-1)?.to===node.to&&['ClassDefinition','FunctionDefinition'].includes(node.name))parents.pop();}});}catch(error){if(error.reason!=='INDEX_BUDGET')throw error;limited=true;}
  const truncated=to<requestedTo,status=truncated||limited||errors.length?'partial':'complete';
  parentPort.postMessage({status,coverage:{from,to,totalUnits:text.length,truncated,syntaxErrors:errors.length,limited},result:{definitions,errors,visited},...(limited?{reason:'INDEX_BUDGET'}:truncated?{reason:'RANGE_BUDGET'}:errors.length?{reason:'SYNTAX_ERRORS'}:{})});
 }catch(error){const reason=error.reason??(/^DIFF_[A-Z_]+$/.test(error.message)?error.message:'ANALYSIS_FAILED');parentPort.postMessage({status:['PARSE_BUDGET','DIFF_WALL_BUDGET','DIFF_LINE_BUDGET'].includes(reason)?'budget-exceeded':'error',reason,coverage:null});}
}
