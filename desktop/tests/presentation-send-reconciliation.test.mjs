import test from 'node:test';
import assert from 'node:assert/strict';
import {presentFixture,deferred,tick} from './helpers/docs-present-source-fixtures.mjs';

const coherentSecond=f=>{
 assert.equal(f.body.dataset.slideId,'second');assert.equal(f.body.dataset.deckVersion,f.version);assert.equal(f.body.dataset.sequence,'2');
 assert.equal(f.nodes.get('presenterNotes').textContent,'NOTES_SECOND');assert.equal(f.nodes.get('position').textContent,'2 / 2');
 assert.equal(f.nodes.get('publicSlide').textContent,'SecondPublic Second');assert.equal(f.nodes.get('nextSlide').disabled,false);
};
// Break caught: treating a committed partial send as a precommit render failure.
test('one failed Audience send reconciles actual committed preview, notes and position without rerender',async()=>{
 const f=await presentFixture();f.windows[2].webContents.failSend=true;f.next();await tick();
 assert.equal(f.requests.length,2);assert.equal(f.requests.at(-1).result.code,'PRESENTATION_SEND_FAILED');
 assert.equal(f.session.getPresenter(f.grants[0]).slideId,'second');assert.equal(f.session.getFrame(f.grants[1]).frame.slideId,'second');assert.equal(f.session.getFrame(f.grants[2]).frame.slideId,'first');
 coherentSecond(f);assert.match(f.status(),/Audience/i);assert.match(f.status(),/may|some|failed|not updated/i);assert.doesNotMatch(f.status(),/last public slide.*retained|could not be rendered/i);
});
test('throw after committed navigation reconciles authoritatively and discloses uncertain delivery',async()=>{
 const f=await presentFixture(),navigate=f.bridge.navigate;f.bridge.navigate=async request=>{await navigate(request);throw Error('Inert lost navigation response');};f.next();await tick();coherentSecond(f);assert.match(f.status(),/uncertain|could not be confirmed|may differ/i);assert.equal(f.requests.length,2);
});
test('a queued appearance update cannot rerender after partial send and hide its failure warning',async()=>{
 const f=await presentFixture(),held=deferred(),navigate=f.bridge.navigate;f.windows[2].webContents.failSend=true;f.bridge.navigate=async request=>{await held.promise;return navigate(request);};
 f.next();f.callbacks['siren-appearance']({detail:{theme:'matrix',mode:'dark'}});held.resolve();await tick();
 assert.equal(f.requests.length,2,'A partial-send response must not trigger an automatic rerender');coherentSecond(f);assert.match(f.status(),/Audience/);
});
for(const method of ['getPresenter','getPreview'])for(const outcome of ['refusal','rejection'])test(`failed navigation with ${method} ${outcome} discloses unverified delivery and releases controls`,async()=>{
 const f=await presentFixture();f.windows[2].webContents.failSend=true;f.bridge[method]=async()=>{if(outcome==='rejection')throw Error('Inert readback rejection');return {ok:false,code:'ACCESS_REFUSED'};};f.next();await tick();
 assert.equal(f.body.dataset.slideId,'first');assert.equal(f.nodes.get('presenterNotes').textContent,'NOTES_FIRST');assert.equal(f.nodes.get('nextSlide').disabled,false);assert.match(f.status(),/could not be verified|unable to verify/i);assert.match(f.status(),/Audience|delivery/i);assert.doesNotMatch(f.status(),/last public slide.*retained|could not be rendered/i);assert.equal(f.requests.length,2);
});
for(const field of ['epoch','deckVersion','slideId','sequence'])test(`mismatching readback ${field} cannot pair new private notes with unrelated public content`,async()=>{
 const f=await presentFixture(),preview=f.bridge.getPreview;f.windows[2].webContents.failSend=true;f.bridge.getPreview=async()=>{const result=await preview();result.frame[field]=field==='sequence'?999:field==='epoch'?999:'unrelated';return result;};f.next();await tick();
 assert.equal(f.body.dataset.slideId,'first');assert.equal(f.nodes.get('presenterNotes').textContent,'NOTES_FIRST');assert.equal(f.nodes.get('position').textContent,'1 / 2');assert.match(f.status(),/could not be verified|unable to verify/i);assert.equal(f.requests.length,2);
});
for(const method of ['getPresenter','getPreview'])test(`cover during ${method} readback retires the old navigation across resume`,async()=>{
 const f=await presentFixture(),read=f.bridge[method],held=deferred();let reads=0;f.windows[2].webContents.failSend=true;f.bridge[method]=()=>{reads++;return held.promise;};f.next();await tick();assert.equal(reads,1);
 f.callbacks.prepare();assert.equal(f.body.dataset.publicReady,'false');assert.equal(f.nodes.get('presenterNotes').textContent,'');
 f.bridge[method]=read;f.windows[2].webContents.failSend=false;f.callbacks.resume();await tick();const status=f.status(),notes=f.nodes.get('presenterNotes').textContent,slide=f.body.dataset.slideId,count=f.requests.length;
 held.resolve(await read());await tick();assert.equal(f.status(),status);assert.equal(f.nodes.get('presenterNotes').textContent,notes);assert.equal(f.body.dataset.slideId,slide);assert.equal(f.requests.length,count);
});
test('cover during inert preview decode cannot restore late public content or private notes',async()=>{
 const f=await presentFixture(),gate=f.holdImage();f.windows[2].webContents.failSend=true;f.next();await tick();
 assert.equal(f.requests.at(-1).result.code,'PRESENTATION_SEND_FAILED');assert.equal(f.imageDecodeCalls,1);f.callbacks.prepare();gate.resolve();await tick();
 assert.equal(f.body.dataset.publicReady,'false');assert.equal(f.nodes.get('publicSlide').children.length,0);assert.equal(f.nodes.get('presenterNotes').textContent,'');assert.equal(f.nodes.get('slideList').children.length,0);assert.equal(f.nodes.get('nextSlide').disabled,true);assert.equal(f.requests.length,2);
});
test('rejected inert preview decode discloses unverified delivery without pairing new notes',async()=>{
 const f=await presentFixture(),gate=f.holdImage();f.windows[2].webContents.failSend=true;f.next();await tick();assert.equal(f.imageDecodeCalls,1);gate.reject(Error('Inert decoder refusal'));await tick();
 assert.equal(f.body.dataset.slideId,'first');assert.equal(f.nodes.get('presenterNotes').textContent,'NOTES_FIRST');assert.match(f.status(),/could not be verified|unable to verify/i);assert.equal(f.nodes.get('nextSlide').disabled,false);assert.equal(f.requests.length,2);
});
