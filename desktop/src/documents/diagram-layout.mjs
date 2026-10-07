/** Finite native preference. Mermaid alone parses source configuration; absence
 * and auto deliberately leave the bundled engine's existing default intact. */
export function createDiagramLayoutContract(){
 const valid=value=>typeof value==='string'&&['auto','dagre','elk'].includes(value);
 const own=(value,key)=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):undefined;
 const scopes={'flowchart-v2':'flowchart',flowchart:'flowchart','classDiagram-v2':'class',classDiagram:'class','stateDiagram-v2':'state',stateDiagram:'state',er:'er',requirement:'requirement'};
 const resolve=(declared,type,choice)=>{
  const supported=Object.hasOwn(scopes,type),descriptor=own(declared,scopes[type]),scoped=descriptor&&'value'in descriptor?descriptor.value:undefined;
  const sourceOwned=Boolean(own(declared,'layout')||own(scoped,'layout')||own(scoped,'defaultRenderer')||descriptor&&!('value'in descriptor));
  return Object.freeze({supported,sourceOwned,layout:supported&&!sourceOwned&&valid(choice)&&choice!=='auto'?choice:undefined});
 };
 return Object.freeze({valid,validate:(value,before)=>(before===undefined||valid(before))&&(value===undefined||valid(value)),resolve});
}
