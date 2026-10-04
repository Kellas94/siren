const limits=Object.freeze({maxUnits:2*1024*1024,maxCells:250000,maxLines:1000000,maxHunks:128,maxPreviewUnits:2048,maxTotalPreviewUnits:32768,wallMs:2500});
export function normalizeDiffBudget(input={}){
 if(!input||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('DIFF_BUDGET');
 const descriptors=Object.getOwnPropertyDescriptors(input),values={...limits};
 for(const key of Reflect.ownKeys(descriptors)){const descriptor=descriptors[key];if(typeof key!=='string'||!Object.hasOwn(limits,key)||!('value'in descriptor)||!descriptor.enumerable||!Number.isSafeInteger(descriptor.value)||descriptor.value<1||descriptor.value>limits[key])throw Error('DIFF_BUDGET');values[key]=descriptor.value;}
 return values;
}
const splitPair=(text,offset)=>offset>0&&offset<text.length&&text.charCodeAt(offset-1)>=0xd800&&text.charCodeAt(offset-1)<=0xdbff&&text.charCodeAt(offset)>=0xdc00&&text.charCodeAt(offset)<=0xdfff;

/** Literal immutable text comparison for owned workers. Full linear prefix/
 * suffix comparison precedes finite LCS; dense regions are explicitly coarse. */
export function diffSourceText(left,right,input={}){
 if(typeof left!=='string'||typeof right!=='string'||!left.isWellFormed()||!right.isWellFormed()||left.length>32*1024*1024||right.length>32*1024*1024)throw Error('DIFF_SOURCE_REFUSED');
 const budget=normalizeDiffBudget(input),started=performance.now(),check=()=>{if(performance.now()-started>budget.wallMs)throw Error('DIFF_WALL_BUDGET');};
 const starts=text=>{if(!text.length)return [];const rows=[0];let count=0;for(const match of text.matchAll(/\r\n|\r|\n/g)){if(match.index+match[0].length<text.length){if(rows.length>=budget.maxLines)throw Error('DIFF_LINE_BUDGET');rows.push(match.index+match[0].length);}if((++count&4095)===0)check();}return rows;};
 const a=starts(left),b=starts(right),offset=(rows,text,i)=>rows[i]??text.length,line=(rows,text,i)=>text.slice(offset(rows,text,i),offset(rows,text,i+1));
 const same=(i,j)=>line(a,left,i)===line(b,right,j);let prefix=0,suffix=0;
 while(prefix<a.length&&prefix<b.length&&same(prefix,prefix)){prefix++;if((prefix&4095)===0)check();}
 while(suffix<a.length-prefix&&suffix<b.length-prefix&&same(a.length-suffix-1,b.length-suffix-1)){suffix++;if((suffix&4095)===0)check();}
 const aEnd=a.length-suffix,bEnd=b.length-suffix,n=aEnd-prefix,m=bEnd-prefix,raw=[];
 let approximate=false;
 const add=(af,at,bf,bt,coarse=false)=>raw.push({af,at,bf,bt,approximate:coarse});
 if(n||m){
  const aUnits=offset(a,left,aEnd)-offset(a,left,prefix),bUnits=offset(b,right,bEnd)-offset(b,right,prefix);
  if(n*m>budget.maxCells||aUnits>budget.maxUnits||bUnits>budget.maxUnits){approximate=true;add(prefix,aEnd,prefix,bEnd,true);}
  else{
   const width=m+1,table=new Uint32Array((n+1)*width),aa=Array.from({length:n},(_,i)=>line(a,left,prefix+i)),bb=Array.from({length:m},(_,j)=>line(b,right,prefix+j));
   for(let i=n-1;i>=0;i--){check();for(let j=m-1;j>=0;j--)table[i*width+j]=aa[i]===bb[j]?table[(i+1)*width+j+1]+1:Math.max(table[(i+1)*width+j],table[i*width+j+1]);}
   let i=0,j=0,pending=null;
   const flush=()=>{if(pending){add(prefix+pending.i,prefix+i,prefix+pending.j,prefix+j);pending=null;}};
   while(i<n||j<m){
    if(i<n&&j<m&&aa[i]===bb[j]){flush();i++;j++;}
    else{pending??={i,j};if(i<n&&(j===m||table[(i+1)*width+j]>=table[i*width+j+1]))i++;else j++;}
    if(raw.length>budget.maxHunks){const first=raw[budget.maxHunks-1];raw.splice(budget.maxHunks-1);add(first.af,aEnd,first.bf,bEnd,true);approximate=true;pending=null;break;}
   }
   flush();if(raw.length>budget.maxHunks){const first=raw[budget.maxHunks-1];raw.splice(budget.maxHunks-1);add(first.af,aEnd,first.bf,bEnd,true);approximate=true;}
  }
 }
 let remaining=budget.maxTotalPreviewUnits,previewTruncated=false;
 const preview=(text,from,to)=>{let end=Math.min(to,from+Math.min(budget.maxPreviewUnits,remaining));if(splitPair(text,end))end--;remaining-=end-from;previewTruncated||=end<to;return text.slice(from,end);};
 const side=(rows,text,from,to)=>{const begin=offset(rows,text,from),end=offset(rows,text,to);return {from:begin,to:end,fromLine:from+1,toLine:to+1,preview:preview(text,begin,end)};};
 const hunks=raw.map(h=>({left:side(a,left,h.af,h.at),right:side(b,right,h.bf,h.bt),approximate:h.approximate}));check();
 return {status:approximate?'partial':'complete',coverage:{left:{from:0,to:left.length,totalUnits:left.length},right:{from:0,to:right.length,totalUnits:right.length},approximate,previewTruncated},result:{identical:n===0&&m===0,approximate,previewTruncated,hunks},...(approximate?{reason:'DIFF_APPROXIMATION'}:{})};
}
