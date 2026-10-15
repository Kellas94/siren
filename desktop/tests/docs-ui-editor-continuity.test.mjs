import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import * as images from '../src/documents/images.mjs';

// Finite inert DOM: runs the real adapters and draft, not a browser or raster decoder.
const scripts=Object.fromEntries(await Promise.all(['draft','structured','images'].map(async name=>[name,await readFile(new URL('../src/ui/docs/'+name+'.js',import.meta.url),'utf8')])));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1kAAAAASUVORK5CYII=';
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.dataset={};this.listeners={};this.disabled=false;this.value='';}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 get isConnected(){return this===this.ownerDocument.root||!!this.parent?.isConnected;}
 contains(node){return this===node||this.children.some(child=>child.contains(node));}
 setAttribute(key,value){this[key]=String(value);}
 removeAttribute(key){delete this[key];}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 async fire(name='click'){if(name==='click'&&this.disabled)return;for(const fn of this.listeners[name]??[])await fn({target:this});}
 focus(){if(this.isConnected&&!this.disabled)this.ownerDocument.activeElement=this;}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
 querySelectorAll(selector){return this.all().filter(node=>selector==='input,textarea'?['INPUT','TEXTAREA'].includes(node.tagName):selector==='[data-structured-action]'?node.dataset.structuredAction!==undefined:false);}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
function fixture(block){
 const document={createElement(tag){return new Element(tag,this);},defaultView:{confirm:()=>true}};
 document.root=new Element('main',document);const outside=new Element('textarea',document);document.root.append(outside);outside.focus();
 const window={SirenDocumentImages:images};let bitmapClosed=0,writes=0;
 const context={window,document,structuredClone,crypto:webcrypto,TextEncoder,Uint8Array,Blob,btoa,
  createImageBitmap:async()=>({width:1,height:1,close(){bitmapClosed++;}})};
 for(const script of Object.values(scripts))runInNewContext(script,context);
 const saved={id:'doc-a',title:'Working document',blocks:[block],future:{exact:'UNCHANGED'}},sha256=createHash('sha256').update(JSON.stringify(saved)).digest('hex');
 const draft=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document:saved,version:'a'.repeat(64),sha256,projectRevision:1},bridge:{applyDocument:async()=>{writes++;throw Error('No saves expected');}}});
 const parent=new Element('section',document);document.root.append(parent);const rejected=[];
 const canEdit=()=>!draft.getStatus().paused;
 if(block.kind==='image')window.SirenNativeDocsImages.renderEditor({parent,draft,index:0,canEdit,onRemove(){},onRejected:message=>rejected.push(message)});
 else{const detail=window.SirenStructuredDocs.renderEditor({parent,draft,index:0,canEdit,onRemove(){},onOpen(){},preserved(){}});detail.open=true;void detail.fire('toggle');}
 const find=(key,value)=>parent.all().find(node=>node.dataset[key]===value);
 const click=async action=>{const node=find('structuredAction',action);assert.ok(node,action);node.focus();await node.fire();return node;};
 const choose=async name=>{const bytes=Buffer.from(png.split(',')[1],'base64'),file=find('imageFile',block.id);file.files=[{name,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer}];await file.fire('change');};
 return {document,parent,draft,outside,find,click,choose,rejected,get writes(){return writes;},get bitmapClosed(){return bitmapClosed;}};
}
const table=rows=>({id:'table-a',kind:'table',headerRow:true,rows:Array.from({length:rows},(_,i)=>['row '+i,'exact '+i])});

// Break caught: repainting a structured page detaches its focused navigation button.
test('structured pagination keeps keyboard focus on the replacement action while it remains available',async()=>{
 const f=fixture(table(45)),previous=await f.click('next');
 assert.equal(previous.isConnected,false);assert.equal(f.document.activeElement,f.find('structuredAction','next'));
 assert.equal(f.document.activeElement.isConnected,true);assert.equal(f.find('structuredField','cell:20:0').value,'row 20');
 assert.equal(f.draft.getStatus().dirty,false);assert.equal(f.writes,0);
});

// Break caught: focus ends on a detached/disabled Next or Previous at a page boundary.
test('structured page boundaries move focus to an editable visible field',async()=>{
 const f=fixture(table(21));await f.click('next');assert.equal(f.find('structuredAction','next').disabled,true);
 assert.equal(f.document.activeElement,f.find('structuredField','headerRow'));
 await f.click('previous');assert.equal(f.find('structuredAction','previous').disabled,true);
 assert.equal(f.document.activeElement,f.find('structuredField','headerRow'));assert.equal(f.writes,0);
});

// Break caught: Add/Remove row and column discard the active keyboard control on repaint.
test('structured row and column edits keep a usable focused action and retain off-page values',async()=>{
 const f=fixture(table(21));
 for(const action of ['add-row','add-column','remove-row','remove-column']){
  await f.click(action);assert.equal(f.document.activeElement,f.find('structuredAction',action),action);
  assert.equal(f.document.activeElement.isConnected,true,action);
 }
 assert.deepEqual(f.draft.getContent().blocks[0].rows[20],['row 20','exact 20']);
 assert.deepEqual(f.draft.getDocument().future,{exact:'UNCHANGED'});assert.equal(f.writes,0);
 assert.equal(f.draft.undo().ok,true);assert.equal(f.draft.getContent().blocks[0].rows[0].length,3);
});

test('structured repaint does not steal focus from an editor outside the section',async()=>{
 const f=fixture(table(21));await f.find('structuredAction','next').fire();
 assert.equal(f.document.activeElement,f.outside);assert.equal(f.draft.getStatus().dirty,false);
});

test('structured removal at the last permitted row or column retains usable field focus',async()=>{
 const f=fixture(table(2));await f.click('remove-row');assert.equal(f.find('structuredAction','remove-row').disabled,true);
 assert.equal(f.document.activeElement,f.find('structuredField','headerRow'));
 await f.click('remove-column');assert.equal(f.find('structuredAction','remove-column').disabled,true);
 assert.equal(f.document.activeElement,f.find('structuredField','headerRow'));
 assert.deepEqual(f.draft.getContent().blocks[0].rows,[['row 0']]);assert.equal(f.writes,0);
});

// Break caught: replacement import updates the image data/name but leaves old name in img.alt.
test('replacement image description follows the new filename when no caption is supplied',async()=>{
 const f=fixture({id:'image-a',kind:'image',dataUri:png,caption:'',fileName:'old.png',future:{exact:'kept'}});
 await f.choose('new-Ș😀.png');assert.equal(f.draft.getContent().blocks[0].fileName,'new-Ș😀.png');
 assert.equal(f.parent.all().find(node=>node.tagName==='IMG').alt,'new-Ș😀.png');
 assert.deepEqual(f.draft.getContent().blocks[0].future,{exact:'kept'});assert.equal(f.bitmapClosed,1);assert.deepEqual(f.rejected,[]);assert.equal(f.writes,0);
});

// Break caught: clearing a caption after import restores the filename captured before import.
test('clearing the image caption uses the current replacement filename and preserves caption priority',async()=>{
 const f=fixture({id:'image-a',kind:'image',dataUri:png,caption:'Review evidence',fileName:'old.png'});
 await f.choose('replacement.png');const image=f.parent.all().find(node=>node.tagName==='IMG');assert.equal(image.alt,'Review evidence');
 const caption=f.find('imageCaption','image-a');caption.value='';await caption.fire('input');
 assert.equal(image.alt,'replacement.png');assert.equal(f.draft.getContent().blocks[0].caption,'');assert.equal(f.writes,0);
});
