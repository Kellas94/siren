const guidedFail=code=>Object.freeze({ok:false,code});
function inspectGuided(source){
 if(typeof source!=='string'||!source.isWellFormed())return guidedFail('GUIDED_SOURCE_REFUSED');
 if(source.length>50000)return guidedFail('GUIDED_BUDGET');
 const pieces=source.split(/(\r\n|\n|\r)/);if(pieces.length>10001)return guidedFail('GUIDED_BUDGET');
 const lines=[];let offset=0;
 for(let i=0;i<pieces.length;i+=2){const text=pieces[i],ending=pieces[i+1]??'';lines.push({text,ending,start:offset,end:offset+text.length});offset+=text.length+ending.length;}
 // The inherited chain parser is recursive. Keep long/complex lines as exact
 // raw text before calling it, rather than running unbounded recursion/regexes.
 const raw=new Set(lines.flatMap((line,index)=>line.text.length>2048||(line.text.match(/-->|==>|-\.->|---|~~~|--o|--x|<-->/g)||[]).length>64?[index]:[]));
 const safe=lines.map((line,index)=>raw.has(index)?'%% bounded native raw line':line.text).join('\n');
 const frontmatter=mermaidFrontmatterEnd(safe);let parsed;try{parsed=parseStructureRows(safe);}catch{return guidedFail('GUIDED_PARSE_REFUSED');}
 const rows=parsed.map((row,index)=>({...row,...lines[index],...(raw.has(index)||frontmatter>=0&&index<=frontmatter?{kind:'code'}:{})}));
 return {ok:true,rows};
}
const guidedShapes=['rect','rounded','diamond','circle','doublecircle','stadium','cylinder','subroutine','hexagon','parallelogram','parallelogramAlt','trapezoid','trapezoidAlt','flag'];
function editGuided(source,request){
 const read=inspectGuided(source);if(!read.ok)return read;
 if(!request||!Number.isSafeInteger(request.index)||request.index<0||request.index>=read.rows.length||typeof request.expectedLine!=='string')return guidedFail('GUIDED_EDIT_REFUSED');
 const original=read.rows[request.index];if(original.text!==request.expectedLine)return guidedFail('GUIDED_LINE_CHANGED');
 const {field,value}=request;if(typeof value!=='string'||!value.isWellFormed()||value.length>512)return guidedFail('GUIDED_EDIT_REFUSED');
 const row={...original};let line;
 if(field==='text'&&['code','blank','chain','group','groupEnd'].includes(row.kind)&&!/[\r\n]/.test(value))line=value;
 else if(row.kind==='header'&&field==='direction'&&['TD','TB','BT','LR','RL'].includes(value))line=row.indent+row.keyword+' '+value;
 else if(row.kind==='note'&&field==='body'&&!/[\r\n]/.test(value))line=row.indent+'%% '+value;
 else if(row.kind==='block'&&['id','label','shape'].includes(field)){
  if(field==='id'&&!/^[A-Za-z_][\w.-]*$/.test(value)||field==='shape'&&!guidedShapes.includes(value))return guidedFail('GUIDED_EDIT_REFUSED');
  row[field]=value;line=structureBlockLine(row);
 }else if(row.kind==='link'&&['fromId','toId','fromLabel','toLabel','arrow','label'].includes(field)){
  if(['fromId','toId'].includes(field)&&!/^[A-Za-z_][\w.-]*$/.test(value)||field==='arrow'&&!['<-->','-.->','-.-','==>','===','--o','--x','-->','---','~~~'].includes(value))return guidedFail('GUIDED_EDIT_REFUSED');
  if(['fromLabel','toLabel'].includes(field)){const key=field==='fromLabel'?'fromToken':'toToken',id=field==='fromLabel'?row.fromId:row.toId;row[key]=makeShapeToken(parseNodeShape(row[key],id).shape,structureEncodeLabel(value));}
  else row[field]=value;line=structureLinkLine(row);
 }else return guidedFail('GUIDED_EDIT_REFUSED');
 const result=source.slice(0,row.start)+line+source.slice(row.end);if(result.length>50000)return guidedFail('GUIDED_BUDGET');
 return Object.freeze({ok:true,source:result});
}
window.SirenNativeGuided=Object.freeze({inspect:inspectGuided,edit:editGuided,shapes:Object.freeze(guidedShapes)});
