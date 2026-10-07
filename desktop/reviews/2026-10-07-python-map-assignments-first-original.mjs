const kinds=Object.freeze({ClassDefinition:'class',FunctionDefinition:'function',IfStatement:'branch',ForStatement:'loop',WhileStatement:'loop',TryStatement:'try',WithStatement:'with',MatchStatement:'match',ReturnStatement:'return',YieldStatement:'yield',RaiseStatement:'raise',BreakStatement:'break',ContinueStatement:'continue',AssignmentStatement:'assignment',CallExpression:'call',AwaitExpression:'await',LambdaExpression:'lambda'});
const boundary=(text,p)=>p===0||p===text.length||!(text.charCodeAt(p-1)>=0xd800&&text.charCodeAt(p-1)<=0xdbff&&text.charCodeAt(p)>=0xdc00&&text.charCodeAt(p)<=0xdfff);

/** A bounded projection of the actual parser tree. Contains edges describe
 * syntax nesting, never runtime order, executed branches or resolved calls. */
export function mapSelectedSyntax(tree,{input,from,to,lineFor,budget}){
 const nodes=[{id:0,kind:'selection',label:'Selected code',from,to,line:lineFor(from),parent:null}],edges=[],errors=[],parents=[];let visited=0,limited=false,labelTruncated=false;
 const label=node=>{let end=Math.min(node.to,node.from+160);if(!boundary(input,end))end--;const text=input.slice(node.from,end),newline=text.search(/\r|\n/);if(newline<0&&end<node.to)labelTruncated=true;return (newline<0?text:text.slice(0,newline)).trim();};
 try{tree.iterate({enter(node){
  if(++visited>budget.maxNodes)throw Error('MAP_VISIT_BUDGET');
  if(node.type.isError&&errors.length<128)errors.push({from:from+node.from,to:from+node.to});
  const kind=kinds[node.name];if(!kind)return;
  if(nodes.length>=budget.maxGraphNodes||edges.length>=budget.maxGraphEdges){limited=true;return false;}
  const parent=parents.at(-1)?.id??0,id=nodes.length;nodes.push({id,kind,label:label(node),from:from+node.from,to:from+node.to,line:lineFor(from+node.from),parent});edges.push({from:parent,to:id,kind:'contains'});parents.push({id,from:node.from,to:node.to,name:node.name});
 },leave(node){const parent=parents.at(-1);if(parent?.from===node.from&&parent?.to===node.to&&parent?.name===node.name)parents.pop();}});}catch(error){if(error.message!=='MAP_VISIT_BUDGET')throw error;limited=true;}
 return {semantics:'syntax-containment',nodes,edges,errors,visited,limited,labelTruncated};
}
