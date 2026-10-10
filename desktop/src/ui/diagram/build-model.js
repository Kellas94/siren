function inspectBuild(source){
 const read=inspectGuided(source);if(!read.ok)return read;if(!/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i.test(mermaidSourceDeclaration(source)))return guidedFail('BUILD_CODE_FIRST');
 const nodes=new Map();let edgeCount=0;const add=(id,label,shape,index,side,explicit)=>{if(!nodes.has(id))nodes.set(id,{id,label,shape,sites:[]});const node=nodes.get(id);if(explicit){node.label=label;node.shape=shape;}node.sites.push({index,side,explicit});};
 for(const row of read.rows){if(row.kind==='block')add(row.id,row.label,row.shape,row.index,'block',true);if(row.kind==='link'){edgeCount++;for(const side of ['from','to']){const token=row[side+'Token'],id=row[side+'Id'],shape=parseNodeShape(token,id).shape;add(id,row[side+'Label']||id,shape,row.index,side,Boolean(token));}}}
 if(nodes.size>250||edgeCount>500)return guidedFail('BUILD_BUDGET');const header=read.rows.find(row=>row.kind==='header');if(!header)return guidedFail('BUILD_CODE_FIRST');
 return {ok:true,nodes:[...nodes.values()],rows:read.rows,direction:header.direction,header,edgeCount};
}
function editBuild(source,request){
 const read=inspectBuild(source);if(!read.ok)return read;if(!request||request.expectedSource!==source)return guidedFail('BUILD_SOURCE_CHANGED');
 const label=value=>typeof value==='string'&&value.isWellFormed()&&value.length<=160&&!/[\r\n]/.test(value),id=value=>typeof value==='string'&&/^[A-Za-z_][\w.-]*$/.test(value),shape=value=>guidedShapes.includes(value);
 const finish=result=>result.length<=50000?Object.freeze({ok:true,source:result}):guidedFail('BUILD_BUDGET');
 const append=text=>{const ending=read.rows.find(row=>row.ending)?.ending||'\n';return finish(source+(/[\r\n]$/.test(source)?'':ending)+text+ending);};
 if(request.action==='direction')return editGuided(source,{index:read.header.index,expectedLine:read.header.text,field:'direction',value:request.direction});
 if(request.action==='add-node'){
  if(!id(request.id)||!label(request.label)||!shape(request.shape)||read.nodes.length>=250)return guidedFail('BUILD_EDIT_REFUSED');
  const escaped=request.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('(^|[^\\w.-])'+escaped+'([^\\w.-]|$)').test(source))return guidedFail('BUILD_ID_USED');
  return append(request.id+makeShapeToken(request.shape,structureEncodeLabel(request.label)));
 }
 if(request.action==='connect'){
  if(!read.nodes.some(node=>node.id===request.from)||!read.nodes.some(node=>node.id===request.to)||!label(request.label)||!['-->','-.->','==>','---'].includes(request.arrow)||read.edgeCount>=500)return guidedFail('BUILD_EDIT_REFUSED');
  return append(request.from+' '+request.arrow+(request.label?'|"'+structureEncodeLabel(request.label)+'"|':'')+' '+request.to);
 }
 if(request.action!=='edit-node'||!id(request.id)||!label(request.label)||!shape(request.shape))return guidedFail('BUILD_EDIT_REFUSED');
 const node=read.nodes.find(node=>node.id===request.id);if(!node)return guidedFail('BUILD_EDIT_REFUSED');
 const rows=new Map();for(const site of node.sites){if(!rows.has(site.index))rows.set(site.index,{...read.rows[site.index]});const row=rows.get(site.index);if(site.side==='block'){row.label=request.label;row.shape=request.shape;}else row[site.side+'Token']=makeShapeToken(request.shape,structureEncodeLabel(request.label));}
 let result=source;for(const row of [...rows.values()].sort((a,b)=>b.index-a.index)){const text=row.kind==='block'?structureBlockLine(row):structureLinkLine(row);result=result.slice(0,row.start)+text+result.slice(row.end);}return finish(result);
}
window.SirenNativeDiagramBuild=Object.freeze({inspect:inspectBuild,inspectSelection:inspectDiagramSelection,edit:editBuild,shapes:Object.freeze([...guidedShapes])});
