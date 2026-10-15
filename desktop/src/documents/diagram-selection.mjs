// Shared by main, Docs and the Guided/Build capability probe. This deliberately
// qualifies fewer constructs than the editor can preserve as exact raw code.
// The fragment retains source tokens, never reconstructs labels from pixels.
export function inspectDiagramSelection({source,nodeIds}={}){
 const unsupported=()=>({ok:false,code:'DIAGRAM_EMBED_SELECTION_UNSUPPORTED',missingNodeIds:[],wholeDiagramAvailable:true});
 try{
  const id=v=>typeof v==='string'&&/^[A-Za-z_][\w.-]{0,127}$/.test(v);
  if(typeof source!=='string'||!source.isWellFormed()||source.length>50000||!Array.isArray(nodeIds)||nodeIds.length>250||new Set(nodeIds).size!==nodeIds.length||nodeIds.some(v=>!id(v)))return unsupported();
  const lines=source.split(/\r\n|\n|\r/);if(lines.length>5000||lines.some(v=>v.length>2048))return unsupported();
  const nodes=new Map(),edges=[],styles=[],classes=[],definitions=new Map();let header=null;
  const shapes=[['(((',')))'],['[[',']]'],['([','])'],['[(',')]'],['((','))'],['{{','}}'],['[/','\\]'],['[\\','/]'],['[/','/]'],['[\\','\\]'],['>',']'],['{','}'],['[',']'],['(',')']];
  function node(text){
   const match=text.trim().match(/^([A-Za-z_][\w.-]{0,127})(.*)$/);if(!match)throw Error();const [,name,tail]=match,token=tail.trim();let label=name;
   if(token){const shape=shapes.find(([a,b])=>token.startsWith(a)&&token.endsWith(b));if(!shape)throw Error();label=token.slice(shape[0].length,-shape[1].length);if(!label||/[\u0000-\u001f]/.test(label))throw Error();
    if(label.startsWith('"')){if(!/^"(?:[^"\\]|\\["\\])*"$/.test(label))throw Error();}
    else if(/[\[\]{}()"\\<>;|&]/.test(label))throw Error();
   }
   if(!nodes.has(name))nodes.set(name,{id:name,token:name,label:name,declared:false});const n=nodes.get(name);if(token){if(n.declared)throw Error();n.token=name+token;n.label=label.startsWith('"')?label.slice(1,-1):label;n.declared=true;}return name;
  }
  function connectors(text){
   const found=[];let quote=false,depth=0,pipe=false;
   for(let i=0;i<text.length;i++){
    const c=text[i];if(quote&&c==='\\'){i++;continue;}if(c==='"'){quote=!quote;continue;}if(quote)continue;
    if(!depth&&c==='|'){pipe=!pipe;continue;}if(pipe)continue;
    if('[({'.includes(c)){depth++;continue;}if('])}'.includes(c)){depth--;if(depth<0)throw Error();continue;}
    if(!depth){const arrow=text.slice(i).match(/^(<-->|-\.->|-\.-|==>|===|--o|--x|-->|---|~~~)/);if(arrow){found.push({at:i,arrow:arrow[0]});i+=arrow[0].length-1;}}
   }
   if(quote||pipe||depth)throw Error();return found;
  }
  function style(value){if(!value||/[\\@{}<>]|url\s*\(|expression|https?:|\/\//i.test(value))throw Error();for(const declaration of value.split(',')){const m=declaration.trim().match(/^(fill|stroke|color|stroke-width|stroke-dasharray|opacity|fill-opacity|stroke-opacity|font-weight):\s*([^;]+)$/);if(!m||!/^[-#\w.()%\s]+$/.test(m[2]))throw Error();}return value;}
  for(const raw of lines){
   const text=raw.trim();if(!text)continue;if(/^%%\{/.test(text))return unsupported();if(/^%%/.test(text))continue;
   if(!header){if(!/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)$/i.test(text))return unsupported();header=text;continue;}
   let m;
   if((m=text.match(/^classDef\s+([A-Za-z_][\w-]*)\s+(.+)$/))){if(definitions.has(m[1]))return unsupported();definitions.set(m[1],style(m[2]));continue;}
   if((m=text.match(/^style\s+([A-Za-z_][\w.-]*)\s+(.+)$/))){styles.push({id:m[1],value:style(m[2])});continue;}
   if((m=text.match(/^class\s+([A-Za-z_][\w.,-]*)\s+([A-Za-z_][\w-]*)$/))){classes.push({ids:m[1].split(','),name:m[2]});continue;}
   if(/^(?:subgraph|end|direction|click|linkStyle|classDef|style|class)\b|:::/i.test(text))return unsupported();
   const links=connectors(text);if(links.length>1)return unsupported();
   if(!links.length){node(text);continue;}const link=links[0],from=node(text.slice(0,link.at));let rest=text.slice(link.at+link.arrow.length).trim(),label='';
   if(rest.startsWith('|')){const end=rest.indexOf('|',1);if(end<2)throw Error();label=rest.slice(1,end);if(label.startsWith('"')&&!/^"(?:[^"\\]|\\["\\])*"$/.test(label)||/[<>\u0000-\u001f]/.test(label))throw Error();rest=rest.slice(end+1).trim();}
   const to=node(rest);edges.push({from,to,arrow:link.arrow,label});if(nodes.size>250||edges.length>500)return unsupported();
  }
  if(!header||!nodes.size||nodes.size>250||styles.some(v=>!nodes.has(v.id))||classes.some(v=>!definitions.has(v.name)||v.ids.some(i=>!nodes.has(i))))return unsupported();
  const missingNodeIds=nodeIds.filter(v=>!nodes.has(v));if(missingNodeIds.length)return {ok:false,code:'DIAGRAM_EMBED_SELECTION_MISSING',missingNodeIds,wholeDiagramAvailable:true};
  const selected=new Set(nodeIds.length?nodeIds:nodes.keys()),kept=[...nodes.values()].filter(v=>selected.has(v.id)),internal=edges.filter(e=>selected.has(e.from)&&selected.has(e.to)),boundary=edges.filter(e=>selected.has(e.from)!==selected.has(e.to)).map(e=>({...e,direction:selected.has(e.from)?'outgoing':'incoming'}));
  const needed=new Set(classes.filter(c=>c.ids.some(v=>selected.has(v))).map(c=>c.name));if(definitions.has('default'))needed.add('default');
  const fragment=[header,...kept.map(n=>n.token),...internal.map(e=>e.from+' '+e.arrow+(e.label?'|'+e.label+'|':'')+' '+e.to),...styles.filter(v=>selected.has(v.id)).map(v=>'style '+v.id+' '+v.value),...[...definitions].filter(([name])=>needed.has(name)).map(([name,value])=>'classDef '+name+' '+value),...classes.filter(c=>c.ids.some(v=>selected.has(v))).map(c=>'class '+c.ids.filter(v=>selected.has(v)).join(',')+' '+c.name)].join('\n');
  return {ok:true,nodes:kept.map(({id,token,label})=>({id,token,label})),edges:internal,boundary,source:fragment};
 }catch{return unsupported();}
}
