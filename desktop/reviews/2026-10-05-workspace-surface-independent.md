# Independent scoped review — initial frozen workspace-surface lot

Author: Codex independent review agent `/root/workspace_surface_review` (separate from implementation/root agent).

Date: 2026-10-05. Review target: uncommitted foundation lot, BASE and HEAD `bb73f818363ae7f89322122548fc19a525f557fe`. This is the **initial review**, before corrective edits. Preserve this report and its original findings; a later corrective review must identify its own new hashes and qualification.

Verdict: **CHANGES REQUIRED within the foundation scope**. One P1 and one P2 independently reproduced. Existing positive tests and native evidence do not cover these adverse lifetime paths.

## Exact reviewed SHA-256 hashes

Paths are relative to `C:/Claude/SIREN_WORK/portable/desktop`.

| File | SHA-256 |
| --- | --- |
| `src/windows/surface.mjs` | `49518e411ba677a57904012187769fcb2e7ca05867573f1001f79aea67ca9027` |
| `src/windows/registry.mjs` | `c159137eac4536f53b4a0547ba03c88ee8b29d646020b7beaa2baee93ebfce74` |
| `scripts/package.mjs` | `8ed8e25d41a2765401d444fa763f0b1ad44bb0976c471330b8b26aa6319fcfda` |
| `tests/workspace-surface.test.mjs` | `fcb823bc1ec06badd22c148e8bc9663099bb6efc14e1e133685bfe4f5d6182b1` |
| `tests/workspace-surface-registry.test.mjs` | `c27c67369de773ca3342e5421455d7ca0de3dffa8af82d1157ffbe1b6bdc38d2` |
| `tests/native/workspace-surface.mjs` | `8de2e32a6fefbcb417cb8e9af698a914a758925cb4ddd75f3131b0a5256fcef8` |
| `tests/native/workspace-surface-app.mjs` | `f02b732ab1ba310abfce32cd914607bc73105755aa4fbf06b96aceb998e1dc11` |

## P1 — externally closed shell loses the renderer retirement fence

Location: `src/windows/registry.mjs:164-176`, interacting with `invalidateEpochAsync` at lines 440-449 and `surface.mjs` emergency disposal at lines 106-111.

`#register` binds both shell `closed` and contents `destroyed` directly to `#forget(entry)`. A BaseWindow shell can close while its WebContentsView renderer survives. The surface lifetime observer starts asynchronous disposal and immediately removes confidential pixels, but the registry's subsequent `closed` observer removes the only entry without retaining its window in `#unclosedWindows` or setting `#destructionFailed`. If disposal hangs or fails, no registry-owned handle remains to await or retry.

Independently reproduced sequence: admit a Code surface, attach it, destroy the shell externally, leave native contents close pending, then await `invalidateEpochAsync({preserveWorkspace:true})`. Retirement resolves and `activateWorkspace()` succeeds while the actual renderer is still alive. After disposal times out with `WINDOW_DESTROY_FAILED`, activation still succeeds. The same gap can be reached between an intentional shell close and a subsequent epoch transition before its asynchronous contents destruction finishes.

Observed initial probe output:

```json
{"epoch":2,"rendererAlive":true,"shellDestroyed":true,"retirementConfirmed":true,"activated":"workspace","hostChildren":0}
{"timeoutFailures":["WINDOW_DESTROY_FAILED"],"rendererAlive":true,"activatedAfterTimeout":"workspace"}
```

Old authority is revoked and confidential pixels were removed. The defect concerns the explicit receipt guarantee: both native handles must be gone before retirement confirmation or new admission. It does not establish renderer authority reuse or a visible pixel leak.

Required correction: make both lifetime observers surface-aware; revoke and retain incomplete surfaces synchronously, fence admission, and clear retained failure state only after real contents and shell destruction are proved. Test shell-first, contents-first with failed shell destruction, disposal timeout/retry, and Lock/epoch transition during a pending self-close.

## P2 — initialization failure loses unconfirmed native handles before registration

Location: `src/windows/surface.mjs:112-128`, interacting with `WindowRegistry.openView` awaiting the factory at line 120.

If initial child attachment or bounds setup fails, the constructor calls `emergency()` and throws `SURFACE_MOVE_FAILED` before constructing/registering/returning its surface. Asynchronous disposal may subsequently time out. The factory rejection prevents the registry from receiving any shell/renderer handle, while `onFailure` receives only an error. The registry therefore cannot retain or retry these actual native handles, and can confirm epoch retirement while both survive.

Independently reproduced by making initial native `view.setBounds` throw and leaving `webContents.close` pending:

```json
{"rejected":"SURFACE_MOVE_FAILED","timeoutFailures":["WINDOW_DESTROY_FAILED"],"shellAlive":true,"rendererAlive":true,"retirementConfirmed":true,"epoch":2,"activated":"workspace"}
```

This path occurs before the factory can load project content, hence P2 rather than P1. It still violates the native lifetime retention foundation and can strand an unowned shell/renderer. Required correction: retain/register the controller before fallible initialization and provide the main owner a concrete retryable cleanup handle on rejection, or otherwise await and prove complete cleanup before allowing factory rejection to lose ownership. A cleanup timeout must preserve a registry admission fence.

## Independent validation and retained native evidence

- Ran `node --test tests/workspace-surface.test.mjs tests/workspace-surface-registry.test.mjs` from desktop: **21 passed, 0 failed**. These positives were not interpreted as adverse lifetime coverage.
- Both adverse probes ran independently through `node --input-type=module`, importing the reviewed product modules. Only the native boundary was doubled; the actual registry and surface logic ran. No product or test source was edited. Original reproducible probe is preserved below in this report.
- Inspected `evidence/workspace-surface/2026-10-05T16-30-05.502Z/{result,native-result}.json` and both native fixture programs. Recorded result is `COMPLETE`, exit 0, no timeout, `inputsUnchanged:true`, five complete cases, 12 attach/detach cycles, Code undo/redo, exact native role/frame binding, and zero remaining windows after final cleanup. The four reviewed surface/registry/native-program hashes match the evidence input hashes and their after-input hashes. This is inspected evidence, **not a fresh native rerun by this reviewer**.
- The retained initial adverse native fixture at `2026-10-05T16-29-31.038Z` reports the wrong fixture project JSON field (`undefined` JSON) and zero remaining windows. It remains adverse original evidence; the later successful fixture does not overwrite it.
- Root's original full suite was still running/frozen when this report was authored. This report makes no independent full-suite result claim.

## Scope and limits

The primitive reparents one actual WebContentsView, preserves native contents/frame identity, forces sandbox/context isolation/no Node integration/web security, and checks a trusted main-process authority predicate. Source lookup confirms creation is not activated through production main/factory/preloads/UI. Registry changes are foundation integration; package change adds only the source-module whitelist entry.

Native positive evidence supports the isolated real Code editor and real Docs draft model fixture. The Docs probe uses a textarea plus the draft model, not production Docs UI. It grants no fixture document save authority. This review does not qualify production docking, common dirty save, Lock persistence, tab UI, restart, multiple physical monitors, all Task 4 acceptance, or release. Evidence existence is not user approval.

## Original independent adverse probe (two cases)

Run from desktop with `node --input-type=module`. The two cases intentionally hang contents destruction until the final cleanup step. Random window IDs are immaterial to the assertions.

```js
import {EventEmitter} from 'node:events';
import {WindowRegistry} from './src/windows/registry.mjs';
import {createWorkspaceSurface} from './src/windows/surface.mjs';
let id=1;
class V {
  children=[];
  addChildView(v){v.parent?.removeChildView(v);this.children.push(v);v.parent=this;}
  removeChildView(v){this.children=this.children.filter(x=>x!==v);v.parent=null;}
  setBounds(){} setVisible(v){this.visible=v;}
}
class C extends EventEmitter {
  id=id++; destroyed=false; mainFrame={url:'about:blank'};
  isDestroyed(){return this.destroyed;} getURL(){return this.mainFrame.url;}
  close(){} complete(){this.destroyed=true;this.emit('destroyed');}
}
class CV extends V {webContents=new C();}
class W extends EventEmitter {
  id=id++; contentView=new V(); destroyed=false;
  isDestroyed(){return this.destroyed;} isMinimized(){return false;}
  restore(){} focus(){} hide(){} show(){}
  getContentBounds(){return {width:900,height:650};}
  destroy(){this.destroyed=true;this.emit('closed');} close(){this.destroy();}
}
function host(){const h=new W();h.webContents=new C();h.webContents.mainFrame.url='siren://app/app.html';return h;}
const authorize=()=>({projectId:'project_a',mode:'normal',access:'write',entityIds:['code_a']});

// P1: shell-first external destruction before registry epoch retirement.
{
  const h=host(),failures=[];let surface;
  const registry=new WindowRegistry({authorize,createWindow:options=>{
    surface=createWorkspaceSurface({BaseWindow:W,WebContentsView:CV,host:h,
      isCurrent:()=>!!registry.caller({sender:surface.webContents,senderFrame:surface.webContents.mainFrame}),
      destructionTimeoutMs:20,onFailure:e=>failures.push(e.code)});
    surface.webContents.mainFrame.url=options.mainFrameUrl;return surface.window;
  }});
  registry.bindWorkspace(h);registry.activateWorkspace();
  await registry.openView({role:'code',entityId:'code_a'});surface.attach();surface.window.destroy();
  const epoch=await registry.invalidateEpochAsync({preserveWorkspace:true});
  console.log({epoch,rendererAlive:!surface.webContents.isDestroyed(),shellDestroyed:surface.window.isDestroyed(),
    retirementConfirmed:true,activated:registry.activateWorkspace().role,hostChildren:h.contentView.children.length});
  await new Promise(r=>setTimeout(r,30));
  console.log({timeoutFailures:failures,rendererAlive:!surface.webContents.isDestroyed(),activatedAfterTimeout:registry.activateWorkspace().role});
  surface.webContents.complete();await surface.dispose();h.destroy();
}

// P2: initial bounds failure before factory returns actual native handles.
{
  let shell,wc;const h=host(),failures=[];
  class BrokenCV extends CV {constructor(){super();wc=this.webContents;}setBounds(){throw Error('native initial bounds');}}
  class CapturedW extends W {constructor(){super();shell=this;}}
  const registry=new WindowRegistry({authorize,createWindow:()=>createWorkspaceSurface({
    BaseWindow:CapturedW,WebContentsView:BrokenCV,host:h,isCurrent:()=>true,
    destructionTimeoutMs:10,onFailure:e=>failures.push(e.code)}).window});
  registry.bindWorkspace(h);registry.activateWorkspace();let rejected;
  try{await registry.openView({role:'code',entityId:'code_a'});}catch(e){rejected=e.code;}
  await new Promise(r=>setTimeout(r,20));
  const epoch=await registry.invalidateEpochAsync({preserveWorkspace:true});
  console.log({rejected,timeoutFailures:failures,shellAlive:!shell.isDestroyed(),rendererAlive:!wc.isDestroyed(),
    retirementConfirmed:true,epoch,activated:registry.activateWorkspace().role});
  wc.complete();await Promise.resolve();await Promise.resolve();h.destroy();
}
```
