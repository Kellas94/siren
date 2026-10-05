# Independent review — initial production docking integration

Author: Codex independent review agent `/root/workspace_surface_review`, separate from root/implementation author.

Date: 2026-10-05. Target: uncommitted integration relative to HEAD `437bfd7b670b2e1c6a3af5c08d72c3d85cd0b560`. This records the integration snapshot reviewed before correction of the two findings below. Foundation reports were not modified; no product/test/build source was edited by this reviewer.

Verdict: **CHANGES REQUIRED: two independently reproduced P2 findings.** Positive unit/native evidence remains valid for the cases it executes, and does not cover these adverse cases. This is not a whole Task 4 or release verdict.

## Exact SHA-256 snapshot

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`. The current guide/shelf changes were inspected and included in the final snapshot. Root was separately editing native monitor fixture/layout routing during this review; native attribution below explicitly records that drift.

| File | SHA-256 |
| --- | --- |
| `build/renderer.mjs` | `18568c61299531d1ecda92be67373a46d2ef740428709cf7c36167fb9429899b` |
| `build/workspace.mjs` | `779c7280d80addf24bc31c6f2b33d222e8658af7876fc19f01dcd201ae3d7a4c` |
| `scripts/package.mjs` | `6bbc5506c1161005e2c3b46c68b59ed790ee3a3f87666f22a46faeb9c696a746` |
| `src/main.mjs` | `7d2fdfa97485cd5b5d93088e1ef709671be899e440752c8d714f1bdf116a452c` |
| `src/preload.cjs` | `841b1ba10fd272a768db4b3251c5e60fe5a5a968965664a6f20af14cdff334b0` |
| `src/ui/desktop.js` | `c9f2ff34c0c0d4a7e9193519183080f5c3d3c67e3e50b5cb87d0062c8600ec3d` |
| `src/ui/workspace/home.js` | `d66f010aff11c157e2afeba6fd5eabb21731c0b447885eb16f154a99223ff8dd` |
| `src/ui/windows/entry.js` | `1d4bde2a474524c0bf05a7c8da70f72643984b917d017ff7f4031408ee085b66` |
| `src/ui/windows/shelf.js` | `24e5f34c9ff2ac5edfc5802c7a3b1e4bc21064816c88ecbf193a90979d8c3edb` |
| `src/ui/windows/shelf.css` | `4548cb39c35fa33076c05cd164694873fc1a3c062bd68ba4174dc34a80919dcf` |
| `src/windows/dock-ipc.mjs` | `0c6bf197851aa74409f23a836e1401243a73ef0d167d648121bc17bedbd7ac31` |
| `src/windows/docs-sources.mjs` | `f4e0c55ab6ef5f764c95429179f6222926e49ca8d96d42e230ab31f1760465b8` |
| `src/windows/factory.mjs` | `7fc62e3530c05e46342b972b00f10cbeac1e351b896fd1af68bce64ad103e053` |
| `src/windows/focus.mjs` | `dd54e497a0574067a8ff83ccb176e3abb14b057153aab2872fcd8cfbab0f85f7` |
| `src/windows/home-admission.mjs` | `5113dc98504f7ff883ecf634e991985cbb532f8dea2bb75235eb1f7b0128b4d5` |
| `src/windows/ipc.mjs` | `3346d7d880d26dba4ec51e8f46d694b41531bf3127f16c89bb10e0459dec08f3` |
| `src/windows/layout.mjs` | `63f512abf853704bc4dbc95c1f66174e134ef4aed8be80a13ce5120be6852545` |
| `src/windows/preload.cjs` | `9beb8c60916657b12238f7704c4c020daa809838acd361072bf928f582893042` |
| `src/windows/presentation-ipc.mjs` | `9141a114c6974978cbd020c61951de18fefab1bd432b731827590cb36f27af77` |
| `src/windows/registry.mjs` | `8a804252fe925e1531d517bc2b3b317f88bfb2a68181b9a486e40b7d165d23fd` |
| `src/windows/surface.mjs` | `131c8a66fffcf30f89eb768e77c993782d9cb422422f303045937d2d5aed456b` |
| `tests/native-window-integration.test.mjs` | `78a52d6b412f7d6366a6a56f87812832dda493d47636418163812ae8746b8267` |
| `tests/native-source-read-main.test.mjs` | `c1e3a73e6ae0c8de9c0da9847f95ebb203d59d649639b39691f2a2b7973697ea` |
| `tests/window-views.test.mjs` | `b513ae1cab7589c3bf7dc4a2711ffac0f543142413bb01768bfcb6e43e1dc778` |
| `tests/workspace-surface-factory.test.mjs` | `34f33063711b1eb36d8f48e112afe3a66681ce3ddb2c40794fd6178179d14fa9` |
| `tests/native/native-keyboard.mjs` | `058b02461e60d81b6e223ead6c4de4239a3e686feb604f947c8a6f2861648699` |
| `tests/native/workspace-dock.mjs` | `7ecae6c986ba87996875a82c0418f8082321a7f090e473dbd637b36fd7ab49b9` |

## P2 — host resize during preparation leaves attached geometry stale after resume

Location: `src/windows/registry.mjs:301-306`, `focusView` at lines 406-411, and `src/main.mjs` host `resize` binding.

`resizeAttached()` refuses changes during the frozen native writer roster/navigation barrier. That is appropriate during preparation, but the event is dropped. Releasing the roster or refocusing the attached view does not remeasure its host viewport. Production main has only the host `resize` event call; normal resume/release does not catch up the discarded resize. A user resizing the host during save/navigation preparation can therefore return to an editor with old dimensions, causing clipping or unused area until another resize or attachment.

Independent probe using real registry/surface modules and doubled native boundary: attach with host 1000x800, freeze the roster, change host content size to 1120x700, call the exact host resize route, release the roster, then focus the same view. Focus succeeds, but bounds remain 1000x752 instead of 1120x652.

```json
{"before":{"x":0,"y":48,"width":1000,"height":752},"hostAfter":{"width":1120,"height":700},"whileFrozen":false,"focused":true,"viewAfterResume":{"x":0,"y":48,"width":1000,"height":752},"expected":{"x":0,"y":48,"width":1120,"height":652},"matches":false}
```

Required correction: preserve/defer the requested resize and perform it once authority/preparation resumes, or remeasure when selecting/focusing an attached view. Keep the no-mutation fence while the roster is frozen. Add a regression for a host resize during preparation followed by successful release/refocus.

## P2 — failed attach changes native ownership and draws two views under mixed policy retirement

Location: `src/windows/registry.mjs:272-288`.

`attachView()` moves and reveals the incoming view before `#selectSurface()` checks the other attached members. If an existing attached peer has become unauthorized while the primary and incoming view remain current, selection refuses without hiding the old peer or undoing the incoming transfer. IPC returns `VIEW_REFUSED`, but two views are now drawn, and the incoming shell was already hidden/reparented. The selected shelf state still names the stale previous view.

Independent probe: open CodeA and DocsA; attach DocsA; have the trusted policy remove only `doc_a` while retaining primary/CodeA authority; invoke actual `invokeDock` attach(CodeA) from the genuine primary frame. The result refuses, yet both host children are visible. This is a main-policy change, not a forged renderer identity. No old renderer authority reuse was demonstrated; the finding concerns visibility exclusivity and mutation before policy refusal.

```json
{"result":{"ok":false,"code":"VIEW_REFUSED"},"drawn":[{"id":6,"visible":true},{"id":4,"visible":true}],"codePlacement":"attached","codeSelected":false,"staleDocsSelected":true,"canFreeze":false}
```

Required correction: preflight existing attached peers before moving/revealing the incoming view, or retire/conceal an unauthorized peer and establish a failure fence before any new view becomes visible. A refused transfer should preserve the incoming placement or prove its cleanup; it must not leave two drawn views.

## Reviewed behavior and scope

- Factory opts only Code/Docs into owned BaseWindow/WebContentsView, verifies private controller association and exact contents identity, uses secure preferences and role URL, and awaits both handles on factory cleanup. Diagram/Presenter/Audience retain their BrowserWindow path. Failed unregistered surface cleanup carries the concrete owned native handle into registry retention.
- Main Lock/account/selection/home transitions and Quit now await `retireNativeViews`; that path awaits registry async epoch retirement and any pending unregistered surfaces. Admission/send/show failure paths use async trusted discard. Existing source/draft/background drains precede retirement. Static inspection and VM/native-boundary tests establish these routes; they are not actual tenant or OS runtime proof.
- Registry controls selection visibility and focus for multiple attached views. Foundation closed/destroyed lifetime retention remains present; move exceptions retain/fence native cleanup. The two new P2 findings above identify additional integration edge cases rather than reopening the prior foundation findings.
- Dock IPC captures the actual caller/frame, rechecks epoch/policy synchronously, rejects payload accessors/extra fields, limits Code/Docs satellites to their own window, and gives primary metadata-only shelf access. The finite preload APIs expose no native handles or registry capability. Main and satellite preload method sets appropriately differ on `showWorkspace`.
- Shelf uses textContent for IDs/labels and routes selection through existing focus IPC. The 48px native view offset keeps the primary shelf reachable; selected native child controls remain in their original renderer. Native menu/right-click/Ctrl+Alt+A/D routes use trusted focus adapters, not renderer IDs as authority. Ctrl+Alt+1, focus cycling and display recovery were inspected with attached-host mapping. No physical-keyboard or physical-monitor execution was initiated by this reviewer.
- Home/app guide changes were inspected. Their native 300,000-line statement is previously tested scale context; pre-docking large-source probes are historical, not qualification of the activated docking UI.

## Independent tests executed

```text
node --test tests/window-views.test.mjs tests/workspace-surface-factory.test.mjs tests/workspace-surface.test.mjs tests/workspace-surface-registry.test.mjs tests/window-registry.test.mjs tests/native-window-integration.test.mjs tests/native-source-read-main.test.mjs tests/window-focus.test.mjs tests/window-layout.test.mjs
```

Result: **117 passed, 0 failed**, exit 0. The actual-main tests execute selected production source in a VM with native boundary doubles; they are not a launched Electron integration run. The two adverse probes above ran separately using `node --input-type=module`; only native handles were doubled. No full-suite result is claimed here.

## Root-owned native evidence inspected, with exact attribution

I inspected `evidence/workspace-dock/2026-10-05T17-14-36.596Z/result.json` and the native driver. This is **root's execution, not an execution initiated by this reviewer**. It records COMPLETE, four successful cases, and unchanged captured inputs: 12 attachments across two Code/two Docs preserving native contents/frame/DOM/dirty title/selection; one drawn selected view; real attached Undo/detached Redo with exact immutable source bytes; normal host resize using actual contentBounds; explicit Docs save; and common Lock destroying all four renderer targets while preserving original source bytes.

At my comparison, current main/surface/registry/factory/dock/focus/preloads/entry/shelf/build and generated Code/Docs/Home/app hashes matched that native run. Current `src/windows/layout.mjs`, `tests/native/native-keyboard.mjs`, and `tests/native/workspace-dock.mjs` had changed after the run, while each run's input and after-input hashes still matched internally. The earlier native result therefore does not qualify those revised monitor/input paths. The two findings above are not exercised by the four positive native cases.

Initial `evidence/workspace-dock/2026-10-05T17-12-26.007Z` remains ADVERSE with two completed cases, unchanged inputs, and `innerWidth===1120` condition failure. The later fixture uses actual host contentBounds rather than outer window width. The original adverse evidence is retained; it was not converted into a product pass. Large native Code/Docs probes before activation and the historical full foundation suite are not substituted for final docking qualification.

No complete Task 4 PASS, release admission, physical monitor validation, comprehensive Save/Close/Lock failure qualification, or approval is inferred from evidence existence. Corrections require separate follow-up review and current-source validation.

## Reproducible independent probe setup and triggers

Run the following from desktop via `node --input-type=module`. IDs are intentionally irrelevant to the assertions. Both cases clean up their actual test handles afterward.

```js
import {EventEmitter} from 'node:events';
import {WindowRegistry} from './src/windows/registry.mjs';
import {createWorkspaceSurface} from './src/windows/surface.mjs';
import {invokeDock} from './src/windows/dock-ipc.mjs';
let id=1;
class V {
  children=[];visible=true;
  addChildView(v){v.parent?.removeChildView(v);this.children.push(v);v.parent=this;}
  removeChildView(v){this.children=this.children.filter(x=>x!==v);v.parent=null;}
  setBounds(b){this.bounds={...b};}setVisible(v){this.visible=v;}
}
class C extends EventEmitter {
  id=id++;destroyed=false;mainFrame={url:'about:blank'};
  isDestroyed(){return this.destroyed;}getURL(){return this.mainFrame.url;}focus(){}
  close(){this.destroyed=true;this.emit('destroyed');}
}
class CV extends V {webContents=new C();}
class W extends EventEmitter {
  id=id++;contentView=new V();destroyed=false;bounds={width:1000,height:800};
  isDestroyed(){return this.destroyed;}isMinimized(){return false;}
  restore(){}focus(){}hide(){}show(){}getContentBounds(){return this.bounds;}
  destroy(){this.destroyed=true;this.emit('closed');}close(){this.destroy();}
}
async function fixture(){
  const host=new W();host.webContents=new C();host.webContents.mainFrame.url='siren://app/app.html';
  let entities=['code_a','doc_a'];const surfaces=new Map();
  const registry=new WindowRegistry({authorize:()=>({projectId:'p',mode:'normal',access:'write',entityIds:entities}),
    createWindow:options=>{let surface;surface=createWorkspaceSurface({BaseWindow:W,WebContentsView:CV,host,
      isCurrent:()=>!!registry.capture({sender:surface.webContents,senderFrame:surface.webContents.mainFrame})});
      surface.webContents.mainFrame.url=options.mainFrameUrl;surfaces.set(options.windowId,surface);return surface.window;}});
  registry.bindWorkspace(host);registry.activateWorkspace();
  const code=await registry.openView({role:'code',entityId:'code_a'}),docs=await registry.openView({role:'docs',entityId:'doc_a'});
  return {host,registry,surfaces,code,docs,retireDocs:()=>{entities=['code_a'];}};
}
{
  const f=await fixture(),surface=f.surfaces.get(f.code.windowId);f.registry.attachView(f.code.windowId);
  const before=surface.view.bounds,roster=f.registry.freezeRoster();f.host.bounds={width:1120,height:700};
  const whileFrozen=f.registry.resizeAttached();f.registry.releaseRoster(roster);
  const focused=f.registry.focusView(f.code.windowId);
  console.log({before,hostAfter:f.host.bounds,whileFrozen,focused,viewAfterResume:surface.view.bounds,
    expected:{x:0,y:48,width:1120,height:652},matches:surface.view.bounds.width===1120&&surface.view.bounds.height===652});
  await f.registry.invalidateEpochAsync({preserveWorkspace:true});f.host.destroy();
}
{
  const f=await fixture();f.registry.attachView(f.docs.windowId);f.retireDocs();
  const result=invokeDock({registry:f.registry,event:{sender:f.host.webContents,senderFrame:f.host.webContents.mainFrame},
    method:'attach',payload:{windowId:f.code.windowId}});
  console.log({result,drawn:f.host.contentView.children.map(v=>({id:v.webContents.id,visible:v.visible})),rows:f.registry.surfaceRecords()});
  await f.registry.invalidateEpochAsync({preserveWorkspace:true});f.host.destroy();
}
```
