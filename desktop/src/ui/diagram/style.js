function styleTargets(root,appearance){
 const ids=[...appearance.nodes.keys()].filter(id=>/^[A-Za-z_][\w.-]*$/.test(id)).slice(0,250),groups=[...root.querySelectorAll('g.node,g.stateGroup,[data-node-id]')],result=[];
 for(const id of ids){const semanticId=appearance.nodes.get(id).domId,rootId=root.getAttribute('id');const matches=groups.filter(group=>{const direct=group.getAttribute('data-id')||group.getAttribute('data-node-id');if(direct)return direct===id;const actual=group.getAttribute('id')||'';if(semanticId)return actual===semanticId||Boolean(rootId)&&actual===rootId+'-'+semanticId;return actual===id||actual.startsWith('flowchart-'+id+'-')&&/^\d+$/.test(actual.slice(('flowchart-'+id+'-').length));});
  if(matches.length){for(const group of matches)group.setAttribute('data-native-node-id',id);result.push({id,groups:matches,protected:{...appearance.global,...appearance.nodes.get(id)}});}
 }return result;
}
function safeSurfaceColour(value){
 if(typeof value!=='string'||value.length>80||['inherit','initial','unset','revert','revertlayer','currentcolor'].includes(value.toLowerCase()))return null;
 const hex=/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
 if(!hex&&!/^(?:(?:rgb|hsl)a?\([\d.,%\s+-]+\)|[a-z]{1,24})$/i.test(value))return null;
 // Actual renderers validate with Chromium. A non-browser test can prove only
 // the exact hex grammar; unknown names/functions never become a surface.
 return (typeof CSS!=='undefined'?CSS.supports('color',value):hex)?value:null;
}
async function prepareStyle(config,source,diagram={},appearanceDescriptor){
 // The native render queue serializes this stateful Mermaid adapter. Keep only
 // the current bounded render's provenance, never a source history/cache.
 if(appearanceDescriptor!==undefined)config={...config,...renderAppearance.config(appearanceDescriptor)};
 const typography={};if(diagram.fontFamily&&ALLOWED_FONTS.includes(diagram.fontFamily))typography.fontFamily=fontStack(diagram.fontFamily);if(Number.isFinite(diagram.fontSize)&&diagram.fontSize>=10&&diagram.fontSize<=28)typography.fontSize=diagram.fontSize+'px';
 const chosenConfig={...config,...(typography.fontFamily?{fontFamily:typography.fontFamily}:{}),...(Object.keys(typography).length?{themeVariables:{...config.themeVariables,...typography}}:{})};
 window.mermaid.initialize(chosenConfig);const parsedLayout=await window.mermaid.parse(source),layout=nativeLayout.resolve(parsedLayout?.config,parsedLayout?.diagramType,diagram.sirenNativeLayoutEngine);
 sourceAppearance.clear();await configureMermaidSource(layout.layout?{...chosenConfig,layout:layout.layout}:chosenConfig,source);const appearance=sourceAppearance.get(source)||{nodes:new Map()};sourceAppearance.clear();
 const parsed=await window.mermaid.parse(source),declared=parsed?.config||{},keys={'flowchart-v2':'flowchart',flowchart:'flowchart',classDiagram:'class','classDiagram-v2':'class',stateDiagram:'state','stateDiagram-v2':'state',sequence:'sequence',er:'er',requirement:'requirement'},scoped=declared[keys[parsed.diagramType]||parsed.diagramType]||{},variables={...declared.themeVariables,...scoped.themeVariables},chosen=typeof declared.theme==='string'||typeof scoped.theme==='string';
 const surfaceBackground=chosen||Object.hasOwn(variables,'background')?safeSurfaceColour(variables.background??window.mermaid.mermaidAPI.getConfig().themeVariables?.background):null;
 return {...appearance,layout,surfaceBackground,global:{fill:chosen||['primaryColor','secondaryColor','tertiaryColor','mainBkg','noteBkg','actorBkg','background'].some(key=>Object.hasOwn(variables,key)),border:chosen||['primaryBorderColor','secondaryBorderColor','nodeBorder','actorBorder'].some(key=>Object.hasOwn(variables,key)),text:chosen||Object.keys(variables).some(key=>/textcolor$/i.test(key))},fontDeclared:[declared,scoped,variables].some(bag=>['fontFamily','fontSize','fontWeight'].some(key=>Object.hasOwn(bag,key)))};
}
function applyStyle(root,diagram,appearance){
 const targets=styleTargets(root,appearance),styles=sanitizeNodeStyles(diagram.nodeStyles||{}),family=diagram.fontFamily?fontStack(diagram.fontFamily):null,size=diagram.fontSize?clamp(Number(diagram.fontSize),10,28):null,weight=diagram.fontWeight?normalizeFontWeight(diagram.fontWeight):null;
 const protectedTexts=new Set(targets.filter(target=>target.protected.font).flatMap(target=>target.groups.flatMap(group=>[...group.querySelectorAll('text,tspan')])));
 const typography=(container,style,protect)=>{for(const text of container.querySelectorAll('text,tspan')){
  if(!appearance.fontDeclared&&!protectedTexts.has(text)){if(style.fontFamily||family)text.style.setProperty('font-family',style.fontFamily?fontStack(style.fontFamily):family,'important');if(style.fontSize||size)text.style.setProperty('font-size',(style.fontSize||size)+'px','important');if(style.fontWeight||weight)text.style.setProperty('font-weight',String(style.fontWeight||weight),'important');}
  if(style.text&&!protect.text){text.style.setProperty('fill',style.text,'important');text.style.setProperty('color',style.text,'important');}
 }};
 typography(root,{},{});
 for(const target of targets){const className=diagram.nodeClasses?.[target.id],fromClass=className?sanitizeNodeStyles({[target.id]:diagram.styleClasses?.[className]||{}})[target.id]:{},style={...fromClass,...styles[target.id]},protect={fill:appearance.global.fill||target.protected.fill,border:appearance.global.border||target.protected.border,text:appearance.global.text||target.protected.text,font:appearance.fontDeclared||target.protected.font===true,fontGlobal:appearance.fontDeclared===true};target.protected=protect;
  for(const group of target.groups){for(const shape of group.querySelectorAll('rect,polygon,circle,ellipse,path')){if(style.fill&&!protect.fill){shape.setAttribute('fill',style.fill);shape.style.setProperty('fill',style.fill,'important');}if(style.border&&!protect.border){shape.setAttribute('stroke',style.border);shape.style.setProperty('stroke',style.border,'important');}}typography(group,style,protect);}
 }
 return targets;
}
window.SirenNativeDiagramStyle=Object.freeze({prepare:prepareStyle,apply:applyStyle,appearance:renderAppearance,fonts:Object.freeze([...ALLOWED_FONTS]),weights:Object.freeze([...ALLOWED_WEIGHTS])});
