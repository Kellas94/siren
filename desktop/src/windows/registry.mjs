import { randomUUID } from 'node:crypto';
import {navigationFields} from '../navigation/contracts.mjs';
import {WORKSPACE_ENTRIES,workspaceEntryURL} from '../navigation/entries.mjs';
import {workspaceSurfaceFor,ownsWorkspaceWindow} from './surface.mjs';
import {surfaceWindowLabel} from '../navigation/window-labels.mjs';

const roles = new Set(['workspace', 'docs', 'code', 'diagram', 'presenter', 'audience']);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const refuse = (code, message) => Object.assign(new Error(message), { code });

function normalizeRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['role', 'entityId', 'version'].includes(key))
    || !Object.hasOwn(value, 'role') || !Object.hasOwn(value, 'entityId')
    || !roles.has(value.role)
    || !(validId(value.entityId) || value.role === 'workspace' && value.entityId === null)
    || Object.hasOwn(value, 'version') && (!Number.isSafeInteger(value.version) || value.version < 0)) {
    throw refuse('REQUEST_REFUSED', 'Invalid native view request');
  }
  return Object.freeze({ role: value.role, entityId: value.entityId,
    ...(Object.hasOwn(value, 'version') ? { version: value.version } : {}) });
}

function authorized(value, request) {
  if (!value || !validId(value.projectId) || !['normal', 'readonly', 'recovery'].includes(value.mode)
    || !['read', 'write', 'presentation'].includes(value.access)
    || !Array.isArray(value.entityIds) || ![...value.entityIds].every(validId)
    || request.entityId !== null && !value.entityIds.includes(request.entityId)
    || value.mode !== 'normal' && value.access === 'write'
    || request.role === 'audience' && value.access !== 'presentation'
    || request.role !== 'audience' && value.access === 'presentation') {
    throw refuse('ACCESS_REFUSED', 'Native view access refused');
  }
  return { projectId: value.projectId, mode: value.mode, access: value.access, entityIds: [...value.entityIds] };
}

/**
 * Main-process authority. authorize(request) is synchronous and supplies trusted
 * {projectId, mode, access, entityIds}; it must never copy permissions from IPC.
 * createWindow(options) returns a ready, hidden BrowserWindow; the adapter owns
 * sandbox/CSP/navigation policy and shows content only after openView succeeds.
 * Revocation cannot cancel an unresolved factory: its returned window is checked
 * and destroyed before the pending open can publish a grant.
 */
export class WindowRegistry {
  #createWindow;
  #authorize;
  #epoch = 1;
  #views = new Map();
  #retiredContents = new WeakSet();
  #destructionFailed = false;
  #unclosedWindows = new Set();
  #workspace = null;
  #closeTimeoutMs;
  #closedCallers = new WeakMap();
  #captures = new WeakMap();
  #roster = null;
  #membershipGeneration = 0;
  #admissionGeneration = 0;
  #workspaceNavigation = null;
  #navigationTickets = new WeakMap();
  #navigationCommits = new WeakMap();
  #selectedSurface = null;

  constructor({ createWindow, authorize, closeTimeoutMs = 10000 }) {
    if (typeof createWindow !== 'function' || typeof authorize !== 'function') throw new TypeError('Native factory and authorization required');
    if (!Number.isSafeInteger(closeTimeoutMs) || closeTimeoutMs < 1 || closeTimeoutMs > 10000) throw new TypeError('Bounded native close deadline required');
    this.#createWindow = createWindow;
    this.#authorize = authorize;
    this.#closeTimeoutMs = closeTimeoutMs;
  }

  #policy(request) {
    try { return authorized(this.#authorize(request), request); }
    catch { throw refuse('ACCESS_REFUSED', 'Native view access refused'); }
  }

  // Main binds the one genuine workspace owner before loading a locked page.
  // This creates no grant. IPC cannot select or substitute the native owner.
  bindWorkspace(window) {
    if(this.#roster)throw refuse('ROSTER_FROZEN','Native view admission paused');
    const wc = window?.webContents;
    if (this.#workspace || !window || !wc || !Number.isSafeInteger(window.id) || window.id < 1
      || !Number.isSafeInteger(wc.id) || wc.id < 1 || window.isDestroyed() || wc.isDestroyed()
      || [...this.#views.values()].some(entry => entry.record.role === 'workspace' || entry.window === window || entry.webContents === wc || entry.nativeId === window.id || entry.webContentsId === wc.id)) {
      throw refuse('ACCESS_REFUSED', 'Workspace owner binding refused');
    }
    this.#workspace = Object.freeze({ window, webContents: wc, nativeId: window.id, webContentsId: wc.id });
  }

  // Explicit native activation after a successful PIN unlock/reload. Unlike
  // satellite factories, only the permanently pinned owner can be reactivated.
  activateWorkspace(options={}) {
    let entryUrl;try{const values=navigationFields(options,['entryUrl'],[]);entryUrl=workspaceEntryURL(Object.hasOwn(values,'entryUrl')?values.entryUrl:WORKSPACE_ENTRIES.module);}catch{throw refuse('ACCESS_REFUSED','Workspace entry refused');}
    if(this.#roster||this.#workspaceNavigation)throw refuse('ROSTER_FROZEN','Native view admission paused');
    const bound = this.#workspace; const request = normalizeRequest({ role: 'workspace', entityId: null });
    if (!bound || this.#destructionFailed) throw refuse('ACCESS_REFUSED', 'Workspace activation refused');
    const scope = this.#policy(request); const { window, webContents: wc } = bound;
    if (window.isDestroyed() || wc.isDestroyed() || window.id !== bound.nativeId || window.webContents !== wc
      || wc.id !== bound.webContentsId || wc.getURL() !== entryUrl || wc.mainFrame?.url !== entryUrl) {
      throw refuse('ACCESS_REFUSED', 'Workspace native identity unavailable');
    }
    const existing = [...this.#views.values()].find(entry => entry.window === window);
    if (existing) {
      if (!this.caller({ sender: wc, senderFrame: wc.mainFrame })) throw refuse('ACCESS_REFUSED', 'Workspace must retire its previous epoch');
      return existing.record;
    }
    const record = Object.freeze({ windowId: randomUUID(), role: 'workspace', projectId: scope.projectId,
      epoch: this.#epoch, entityId: null, state: 'active' });
    this.#register({ window, request, scope, record, mainFrameUrl: entryUrl });
    return record;
  }

  async openView(value) {
    if(this.#roster||this.#workspaceNavigation)throw refuse('ROSTER_FROZEN','Native view admission paused');
    const admissionGeneration=this.#admissionGeneration;
    const request = normalizeRequest(value);
    if (request.role === 'workspace' && this.#workspace) throw refuse('REQUEST_REFUSED', 'The native workspace owner is already bound');
    if (this.#destructionFailed) throw refuse('ACCESS_REFUSED', 'Native window destruction still incomplete');
    const scope = this.#policy(request);
    const windowId = randomUUID();
    const mainFrameUrl = request.role === 'workspace' ? 'siren://app/app.html'
      : `siren://app/windows/${request.role}.html?windowId=${windowId}`;
    const record = Object.freeze({ windowId, role: request.role, projectId: scope.projectId,
      epoch: this.#epoch, entityId: request.entityId, state: 'active' });
    let window;
    try{window=await this.#createWindow(Object.freeze({ ...record,
      ...(Object.hasOwn(request, 'version') ? { version: request.version } : {}), mainFrameUrl, modal: false }));}
    catch(error){
      const failed=error&&(typeof error==='object'||typeof error==='function')?Object.getOwnPropertyDescriptor(error,'nativeWindow')?.value:null;
      const reused=failed===this.#workspace?.window||failed?.webContents===this.#workspace?.webContents
        ||[...this.#views.values()].some(entry=>entry.window===failed||entry.webContents===failed?.webContents);
      if(ownsWorkspaceWindow(failed)&&!reused){
        if(failed.webContents)this.#retiredContents.add(failed.webContents);
        this.#unclosedWindows.add(failed);this.#destructionFailed=true;
        if(!await this.#destroyWindowAsync(failed))throw refuse('WINDOW_DESTROY_FAILED','Unadmitted native surface destruction incomplete');
        this.#destructionFailed=this.#unclosedWindows.size>0;
      }
      throw error;
    }
    const webContents = window?.webContents;
    const reused = window === this.#workspace?.window || webContents === this.#workspace?.webContents
      || [...this.#views.values()].some(entry => entry.window === window || entry.webContents === webContents);
    if (reused || webContents && this.#retiredContents.has(webContents)) {
      throw refuse('ACCESS_REFUSED', 'Native renderer already used');
    }
    try {
      const current = this.#policy(request);
      if (this.#roster || admissionGeneration!==this.#admissionGeneration || request.role === 'workspace' && this.#workspace || this.#destructionFailed || record.epoch !== this.#epoch || current.projectId !== scope.projectId || current.mode !== scope.mode
        || current.access !== scope.access || !scope.entityIds.every(id => current.entityIds.includes(id))
        || !window || !Number.isSafeInteger(window.id) || window.id < 1
        || !webContents || !Number.isSafeInteger(webContents.id) || webContents.id < 1
        || !['isDestroyed', 'isMinimized', 'restore', 'focus', 'close', 'destroy', 'on', 'off'].every(key => typeof window[key] === 'function')
        || !['isDestroyed', 'getURL', 'on', 'off'].every(key => typeof webContents[key] === 'function')
        || window.isDestroyed() || webContents.isDestroyed()
        || window.id === this.#workspace?.nativeId || webContents.id === this.#workspace?.webContentsId
        || [...this.#views.values()].some(entry => entry.nativeId === window.id || entry.webContentsId === webContents.id)) {
        throw refuse('ACCESS_REFUSED', 'Native view no longer authorized');
      }
    } catch (error) {
      if (webContents && typeof webContents === 'object') this.#retiredContents.add(webContents);
      if (!await this.#destroyWindowAsync(window)) throw refuse('WINDOW_DESTROY_FAILED', 'Native rejected window destruction incomplete');
      throw error;
    }
    this.#register({ record, window, request, scope, mainFrameUrl });
    return record;
  }

  #register({ record, window, request, scope, mainFrameUrl }) {
    const webContents = window.webContents;
    const entry = { record, window, request, scope, mainFrameUrl,
      nativeId: window.id, webContents, mainFrame: webContents.mainFrame, webContentsId: webContents.id, revoked: false, listeners: [] };
    this.#views.set(record.windowId, entry);
    this.#membershipGeneration++;
    const listen = (target, name, callback) => {
      target.on(name, callback);
      entry.listeners.push([target, name, callback]);
    };
    const forget = () => {
      const surface=workspaceSurfaceFor(window);
      if(surface&&!surface.isDestroyed()){
        // Native shell and renderer lifetimes differ. A direct system close
        // cannot lose the remaining handle or clear the admission fence.
        entry.revoked=true;this.#retiredContents.add(webContents);
        this.#unclosedWindows.add(window);this.#destructionFailed=true;
        void this.#destroyWindowAsync(window).then(disposed=>{
          if(disposed){this.#forget(entry);this.#destructionFailed=this.#unclosedWindows.size>0;}
        });
      }else this.#forget(entry);
    };
    const revoke = () => {
      entry.closeInvalidated = true;
      if (this.#workspace?.window === window) {
        try { this.invalidateEpoch({ preserveWorkspace: true }); } catch { /* Failed handles remain fenced and retained. */ }
        return;
      }
      entry.revoked = true;
      this.#retiredContents.add(webContents);
      if (this.#destroyWindow(window)) this.#forget(entry);
    };
    listen(window, 'closed', forget);
    listen(webContents, 'destroyed', forget);
    listen(webContents, 'render-process-gone', revoke);
    listen(webContents, 'will-navigate', revoke);
    listen(webContents, 'did-start-navigation', (details, _url, _inPlace, isMainFrame) => { if ((details?.isMainFrame ?? isMainFrame) === true) revoke(); });
  }

  #destroyWindow(window) {
    if (typeof window?.destroy !== 'function' || typeof window?.isDestroyed !== 'function') return true;
    try {
      const surface=workspaceSurfaceFor(window);
      if(surface)void surface.dispose().catch(()=>{});
      else if (!window.isDestroyed()) window.destroy();
      if (window.isDestroyed() && (!surface||surface.isDestroyed())) {
        this.#unclosedWindows.delete(window);
        return true;
      }
    } catch { /* Retain the native handle for the next epoch destruction attempt. */ }
    this.#unclosedWindows.add(window);
    this.#destructionFailed = true;
    return false;
  }

  async #destroyWindowAsync(window){
    try{const surface=workspaceSurfaceFor(window);if(surface)await surface.dispose();}
    catch{this.#unclosedWindows.add(window);this.#destructionFailed=true;return false;}
    return this.#destroyWindow(window);
  }

  #forget(entry) {
    entry.revoked = true;
    this.#retiredContents.add(entry.webContents);
    if (this.#views.get(entry.record.windowId) === entry) {this.#views.delete(entry.record.windowId);this.#membershipGeneration++;}
    for (const [target, name, callback] of entry.listeners) target.off(name, callback);
    entry.listeners = [];
  }

  #live(entry) {
    const { window, webContents } = entry;
    return !entry.revoked && entry.record.epoch === this.#epoch && !window.isDestroyed() && !webContents.isDestroyed()
      && window.id === entry.nativeId && window.webContents === webContents && webContents.id === entry.webContentsId;
  }

  listViews() {
    return [...this.#views.values()].filter(entry => this.#live(entry)).map(({ record, window }) => ({
      ...record, state: window.isMinimized() ? 'minimized' : 'active',
    }));
  }

  surfaceRecords(){
    return this.listViews().flatMap(record=>{
      const surface=workspaceSurfaceFor(this.#views.get(record.windowId)?.window);
      return surface&&['code','docs','diagram'].includes(record.role)?[{windowId:record.windowId,role:record.role,
        entityId:record.entityId,placement:surface.placement(),selected:this.#selectedSurface===record.windowId&&surface.isVisible()}]:[];
    });
  }

  surfaceSummary(windowId){
    const entry=this.#views.get(windowId);
    if(!entry||!workspaceSurfaceFor(entry.window)||!['code','docs','diagram'].includes(entry.record.role))return null;
    const current=()=>this.#live(entry)&&!!this.caller({sender:entry.webContents,senderFrame:entry.webContents.mainFrame});
    if(!current())return null;
    try{
      const label=surfaceWindowLabel(entry.record.role,entry.webContents.getTitle?.(),entry.record.entityId);
      const visibleHost=workspaceSurfaceFor(entry.window).placement()==='attached'?this.#workspace?.window:entry.window;
      if(!visibleHost||visibleHost.isDestroyed())return null;
      const state=visibleHost.isMinimized()?'minimized':'open';
      return current()?{label,state}:null;
    }catch{return null;}
  }

  #surfaceAction(entry,method,...args){
    try{return workspaceSurfaceFor(entry.window)?.[method](...args)===true;}
    catch{
      entry.revoked=true;this.#retiredContents.add(entry.webContents);
      this.#unclosedWindows.add(entry.window);this.#destructionFailed=true;
      void this.#destroyWindowAsync(entry.window).then(disposed=>{
        if(disposed){this.#forget(entry);this.#destructionFailed=this.#unclosedWindows.size>0;}
      });return false;
    }
  }
  #surfaceReady(entry){
    return !this.#roster&&!this.#workspaceNavigation&&!this.#destructionFailed&&entry
      &&['code','docs','diagram'].includes(entry.record.role)&&workspaceSurfaceFor(entry.window)
      &&!!this.caller({sender:entry.webContents,senderFrame:entry.webContents.mainFrame});
  }
  #selectSurface(windowId){
    if(this.#roster||this.#workspaceNavigation||this.#destructionFailed)return false;
    if(windowId!==null&&!this.#surfaceReady(this.#views.get(windowId)))return false;
    for(const entry of this.#views.values())if(workspaceSurfaceFor(entry.window)?.placement()==='attached'&&!this.#surfaceReady(entry))return false;
    for(const entry of this.#views.values()){
      const surface=workspaceSurfaceFor(entry.window);
      if(surface?.placement()==='attached'&&entry.record.windowId!==windowId
        &&(!this.#surfaceReady(entry)||!this.#surfaceAction(entry,'setAttachedVisible',false)))return false;
    }
    if(windowId!==null){
      const entry=this.#views.get(windowId);
      if(!this.#surfaceReady(entry)||!this.#surfaceAction(entry,'setAttachedVisible',true))return false;
    }
    this.#selectedSurface=windowId;return true;
  }
  attachView(windowId){
    const entry=this.#views.get(windowId);
    if(!this.#surfaceReady(entry))return false;
    for(const peer of this.#views.values())if(workspaceSurfaceFor(peer.window)?.placement()==='attached'&&!this.#surfaceReady(peer))return false;
    if(!this.#surfaceAction(entry,'attach'))return false;
    return this.#selectSurface(windowId)&&this.#surfaceAction(entry,'focus');
  }
  detachView(windowId){
    const entry=this.#views.get(windowId);
    if(!this.#surfaceReady(entry)||!this.#surfaceAction(entry,'detach'))return false;
    if(this.#selectedSurface===windowId)this.#selectedSurface=null;
    return this.#surfaceAction(entry,'focus');
  }
  showWorkspace(){
    const owner=this.#workspace;
    if(!owner||!this.caller({sender:owner.webContents,senderFrame:owner.webContents.mainFrame})||!this.#selectSurface(null))return false;
    try{if(owner.window.isMinimized())owner.window.restore();owner.window.show();owner.window.focus();owner.webContents.focus();return true;}catch{return false;}
  }
  resizeAttached(){
    if(this.#roster||this.#workspaceNavigation||this.#destructionFailed)return false;
    let result=true;
    for(const entry of this.#views.values())if(workspaceSurfaceFor(entry.window)?.placement()==='attached')
      result=this.#surfaceReady(entry)&&this.#surfaceAction(entry,'resize')&&result;
    return result;
  }

  // Main-only roster proof: no identifiers from IPC can stand in for captured
  // native frames. Freeze before the first await; even an older pending factory
  // is refused after a later release. Closing/crashing a member invalidates it.
  freezeRoster() {
    if(this.#roster)throw refuse('ROSTER_BUSY','Native roster already captured');
    if(this.#destructionFailed)throw refuse('ACCESS_REFUSED','Native destruction incomplete');
    if(this.#views.size>64)throw refuse('ROSTER_LIMIT','Native roster limit exceeded');
    const grants=[];
    for(const entry of this.#views.values()) {
      const grant=this.capture({sender:entry.webContents,senderFrame:entry.mainFrame});
      if(!grant)throw refuse('ACCESS_REFUSED','Native roster contains a retired frame');
      grants.push(grant);
    }
    this.#admissionGeneration++;
    const proof=Object.freeze({epoch:this.#epoch,grants:Object.freeze(grants)});
    this.#roster={proof,generation:this.#membershipGeneration};return proof;
  }

  isRosterCurrent(proof) {
    return Boolean(proof && this.#roster?.proof===proof && !this.#destructionFailed &&
      proof.epoch===this.#epoch && this.#roster.generation===this.#membershipGeneration &&
      proof.grants.length===this.#views.size && proof.grants.every(grant=>this.isCurrent(grant)));
  }

  releaseRoster(proof) {
    if(!proof || this.#roster?.proof!==proof)return false;
    if(this.#workspaceNavigation?.roster===this.#roster)return false;
    this.#roster=null;return true;
  }

  // Native identity primitive only. The shared barrier must first prove actual
  // flush/drain/quiescence; a roster itself is not a persistence approval.
  // Same-project entry navigation preserves satellites while replacing the
  // primary record. Changing project/Lock still invalidates the whole epoch.
  beginWorkspaceNavigation(roster,options) {
    let entryUrl;try{entryUrl=workspaceEntryURL(navigationFields(options,['entryUrl']).entryUrl);}catch{throw refuse('ACCESS_REFUSED','Workspace navigation entry refused');}
    if(this.#workspaceNavigation||!this.isRosterCurrent(roster))throw refuse('ACCESS_REFUSED','Current native roster required');
    const bound=this.#workspace;
    const primary=bound&&[...this.#views.values()].find(entry=>entry.window===bound.window&&entry.record.role==='workspace');
    if(!primary||!this.caller({sender:primary.webContents,senderFrame:primary.mainFrame}))throw refuse('ACCESS_REFUSED','Current bound workspace required');
    const retained=roster.grants.filter(grant=>grant.windowId!==primary.record.windowId);
    if(retained.length!==roster.grants.length-1)throw refuse('ACCESS_REFUSED','Single primary roster required');
    const ticket=Object.freeze({entryUrl,epoch:this.#epoch});
    const state={ticket,bound,scope:primary.scope,request:primary.request,roster:this.#roster,retained,entryUrl,epoch:this.#epoch,invalidated:false,listeners:[]};
    this.#workspaceNavigation=state;this.#navigationTickets.set(ticket,state);
    this.#forget(primary);state.membershipGeneration=this.#membershipGeneration;
    const listen=(target,name,callback)=>{target.on(name,callback);state.listeners.push([target,name,callback]);};
    const invalidate=()=>{state.invalidated=true;};
    const navigation=(details,url,_inPlace,isMainFrame)=>{
      if((details?.isMainFrame??isMainFrame)===false)return;
      const actual=details?.url??url;
      if(actual!==entryUrl)invalidate();
    };
    listen(bound.window,'closed',invalidate);listen(bound.webContents,'destroyed',invalidate);
    listen(bound.webContents,'render-process-gone',invalidate);
    listen(bound.webContents,'will-navigate',navigation);listen(bound.webContents,'did-start-navigation',navigation);
    listen(bound.webContents,'did-navigate-in-page',navigation);
    return ticket;
  }

  #navigationCurrent(state) {
    try {
      const {bound}=state,window=bound.window,wc=bound.webContents;
      if(this.#workspaceNavigation!==state||state.invalidated||this.#workspace!==bound||this.#roster!==state.roster||this.#epoch!==state.epoch||this.#destructionFailed||
        this.#membershipGeneration!==state.membershipGeneration||this.#views.size!==state.retained.length||!state.retained.every(grant=>this.isCurrent(grant))||
        window.isDestroyed()||wc.isDestroyed()||window.id!==bound.nativeId||window.webContents!==wc||wc.id!==bound.webContentsId)return false;
      const policy=this.#policy(state.request);
      return policy.projectId===state.scope.projectId&&policy.mode===state.scope.mode&&policy.access===state.scope.access&&state.scope.entityIds.every(id=>policy.entityIds.includes(id));
    }catch{return false;}
  }
  #retireNavigation(state) {
    for(const [target,name,listener] of state.listeners)target.off(name,listener);
    state.listeners=[];this.#navigationTickets.delete(state.ticket);
    if(this.#workspaceNavigation===state)this.#workspaceNavigation=null;
  }
  finishWorkspaceNavigation(ticket) {
    const state=ticket&&this.#navigationTickets.get(ticket);
    if(!state||!this.#navigationCurrent(state)||state.bound.webContents.getURL()!==state.entryUrl||state.bound.webContents.mainFrame?.url!==state.entryUrl||
      typeof state.bound.webContents.isLoadingMainFrame!=='function'||state.bound.webContents.isLoadingMainFrame()!==false)
      throw refuse('ACCESS_REFUSED','Workspace navigation no longer current');
    const record=Object.freeze({windowId:randomUUID(),role:'workspace',projectId:state.scope.projectId,epoch:this.#epoch,entityId:null,state:'active'});
    this.#retireNavigation(state);
    this.#register({record,window:state.bound.window,request:state.request,scope:this.#policy(state.request),mainFrameUrl:state.entryUrl});
    const grant=this.capture({sender:state.bound.webContents,senderFrame:state.bound.webContents.mainFrame});
    if(!grant)throw refuse('ACCESS_REFUSED','New workspace identity refused');
    this.#navigationCommits.set(record,{grant,retained:state.retained});
    return record;
  }
  isWorkspaceNavigationCurrent(record) {
    const commit=record&&this.#navigationCommits.get(record);
    return Boolean(commit&&!this.#workspaceNavigation&&this.isCurrent(commit.grant)&&commit.retained.every(grant=>this.isCurrent(grant)));
  }
  cancelWorkspaceNavigation(ticket) {
    const state=ticket&&this.#navigationTickets.get(ticket);if(!state)return false;
    state.invalidated=true;this.#retireNavigation(state);return true;
  }

  focusView(windowId) {
    const entry = this.#views.get(windowId);
    if (!entry || !this.caller({ sender: entry.webContents, senderFrame: entry.webContents.mainFrame })) return false;
    const surface=workspaceSurfaceFor(entry.window);if(surface){
      if(!this.#surfaceReady(entry))return false;
      return (surface.placement()!=='attached'||this.#selectSurface(windowId))&&this.#surfaceAction(entry,'focus');
    }
    if(entry.record.role==='workspace'&&this.#workspace&& !this.#selectSurface(null))return false;
    if (entry.window.isMinimized()) entry.window.restore();
    entry.window.focus();
    return true;
  }

  closeView(windowId, { caller } = {}) {
    const entry = this.#views.get(windowId);
    if (!entry || !this.#live(entry)) return false;
    const captured = caller && this.caller(caller);
    if (caller && !captured) return false;
    const sender = caller?.sender; const frame = caller?.senderFrame;
    const destroyed=()=>entry.window.isDestroyed()&&(!workspaceSurfaceFor(entry.window)||workspaceSurfaceFor(entry.window).isDestroyed());
    // The intentional self-close loses its grant. Prove that exact native close
    // under the unchanged epoch/policy instead of accepting any revoked sender.
    const authorizedClose = () => {
      if (entry.closeInvalidated || !destroyed() || entry.record.epoch !== this.#epoch) return false;
      if (!captured || captured.windowId !== windowId) return true;
      if (caller.sender !== sender || caller.senderFrame !== frame || sender !== entry.webContents || frame !== entry.mainFrame) return false;
      try {
        const policy = this.#policy(entry.request);
        return policy.projectId === entry.scope.projectId && policy.mode === entry.scope.mode
          && policy.access === entry.scope.access && captured.entityIds.every(id => policy.entityIds.includes(id));
      } catch { return false; }
    };
    const confirm = closed => {
      if (!closed || !authorizedClose()) return false;
      if (captured?.windowId === windowId) this.#closedCallers.set(caller, { grant: captured, authorizedClose });
      return true;
    };
    if (entry.pendingClose) return entry.pendingClose.then(confirm);
    let resolve; let reject; let timer; let settled = false; let closeEvent;
    const pending = new Promise((done, fail) => { resolve = done; reject = fail; });
    const finish = (closed, timedOut = false) => {
      if (settled) return; settled = true;
      clearTimeout(timer);
      entry.window.off('closed', onClosed); entry.window.off('close', onClose);
      entry.webContents.off('will-prevent-unload', onPreventUnload);
      entry.webContents.off('destroyed',onContentsDestroyed);
      entry.pendingClose = null;
      if (timedOut) reject(refuse('WINDOW_CLOSE_TIMEOUT', 'Native window close confirmation timed out'));
      else resolve(closed);
    };
    const onClosed = () => {if(destroyed())finish(true);};
    const onContentsDestroyed=()=>{if(destroyed())finish(true);};
    const onClose = event => {
      closeEvent = event;
      queueMicrotask(() => { if (event.defaultPrevented === true && !entry.window.isDestroyed()) finish(false); });
    };
    const onPreventUnload = event => {
      // Electron's preventDefault here permits unloading; an unoverridden
      // renderer veto leaves the window and its grant intact.
      queueMicrotask(() => { if (event.defaultPrevented !== true && !entry.window.isDestroyed()) finish(false); });
    };
    entry.window.on('closed', onClosed); entry.window.on('close', onClose);
    entry.webContents.on('will-prevent-unload', onPreventUnload);
    entry.webContents.on('destroyed',onContentsDestroyed);
    entry.pendingClose = pending;
    timer = setTimeout(() => finish(false, true), this.#closeTimeoutMs);
    try { entry.window.close(); }
    catch (error) { finish(false); throw error; }
    if (destroyed()) { finish(true); return confirm(true); }
    if (closeEvent?.defaultPrevented === true) { finish(false); return false; }
    return pending.then(confirm);
  }

  // One-use native proof at the IPC return boundary. No renderer can create it,
  // and a closed renderer cannot inherit a grant or bypass a later Lock/switch.
  confirmClosedCaller(event, expected) {
    const proof = this.#closedCallers.get(event);
    this.#closedCallers.delete(event);
    return Boolean(proof && expected && ['windowId', 'role', 'projectId', 'epoch', 'webContentsId', 'mainFrameUrl']
      .every(key => proof.grant[key] === expected[key]) && proof.authorizedClose());
  }

  discardView(windowId) {
    const entry = this.#views.get(windowId);
    if (!entry || entry.window === this.#workspace?.window) return false;
    entry.revoked = true; entry.closeInvalidated = true; this.#retiredContents.add(entry.webContents);
    if (!this.#destroyWindow(entry.window)) return false;
    this.#forget(entry); return true;
  }

  async discardViewAsync(windowId){
    const entry=this.#views.get(windowId);
    if(!entry||entry.window===this.#workspace?.window)return false;
    entry.revoked=true;entry.closeInvalidated=true;this.#retiredContents.add(entry.webContents);
    this.#unclosedWindows.add(entry.window);this.#destructionFailed=true;
    if(!await this.#destroyWindowAsync(entry.window))return false;
    this.#forget(entry);this.#destructionFailed=this.#unclosedWindows.size>0;return true;
  }

  invalidateEpoch({ preserveWorkspace = false } = {}) {
    const navigation=this.#workspaceNavigation;
    if(navigation){navigation.invalidated=true;this.#retireNavigation(navigation);}
    this.#epoch += 1;
    const entries = [...this.#views.values()];
    for (const entry of entries) {
      entry.revoked = true;
      this.#retiredContents.add(entry.webContents);
    }
    let failed = false;
    const windows = new Set([...entries.map(entry => entry.window), ...this.#unclosedWindows]);
    if(navigation)windows.add(navigation.bound.window);
    for (const window of windows) {
      if (preserveWorkspace && window === this.#workspace?.window && !this.#unclosedWindows.has(window)) continue;
      if (!this.#destroyWindow(window)) failed = true;
    }
    for (const entry of entries) if (entry.window.isDestroyed() || preserveWorkspace && entry.window === this.#workspace?.window) this.#forget(entry);
    this.#destructionFailed = failed;
    if (failed) throw refuse('WINDOW_DESTROY_FAILED', 'Native data window destruction incomplete');
    return this.#epoch;
  }

  // Revocation/concealment begins synchronously. The awaited native surface
  // disposal proves both handles gone; shell destruction alone cannot admit
  // another epoch. Failed handles remain retained and all admission fenced.
  async invalidateEpochAsync(options={}){
    try{return this.invalidateEpoch(options);}
    catch(error){if(error?.code!=='WINDOW_DESTROY_FAILED')throw error;}
    const epoch=this.#epoch;
    const results=await Promise.all([...this.#unclosedWindows].map(window=>this.#destroyWindowAsync(window)));
    this.#destructionFailed=this.#unclosedWindows.size>0;
    if(results.some(result=>result!==true)||this.#destructionFailed)
      throw refuse('WINDOW_DESTROY_FAILED','Native data window destruction incomplete');
    if(this.#epoch!==epoch)throw refuse('ACCESS_REFUSED','Native retirement superseded');
    return epoch;
  }

  // Native-only queued-operation proof. Identifiers projected to renderers are
  // insufficient: only this registry can associate a grant with real handles.
  capture(event) {
    const pinned=Object.freeze({sender:event?.sender,senderFrame:event?.senderFrame});
    const grant=this.caller(pinned);
    if(grant)this.#captures.set(grant,pinned);
    return grant;
  }
  // A primary whole-workspace save is scoped to the genuine frame/project,
  // not every entity that happened to exist when the frame was opened. This
  // capture grants no source/domain entity access and is never renderer-issued.
  capturePrimary(event) {
    const pinned=Object.freeze({sender:event?.sender,senderFrame:event?.senderFrame}),caller=this.caller(pinned);
    if(caller?.role!=='workspace'||pinned.sender!==this.#workspace?.webContents)return null;
    const grant=Object.freeze({...caller,entityIds:Object.freeze([])});this.#captures.set(grant,pinned);return grant;
  }

  isCurrent(grant) {
    const event=grant && this.#captures.get(grant);
    if(!event)return false;
    const current=this.caller(event);
    return Boolean(current && ['windowId','role','projectId','epoch','webContentsId','mainFrameUrl'].every(key=>current[key]===grant[key]) && grant.entityIds.every(id=>current.entityIds.includes(id)));
  }

  // Main-only monotonic admission fence. Freeze/rollback cannot revive an
  // already queued creation, even if its original native frame remains live.
  captureAdmissionGuard(grant){
    if(!this.isCurrent(grant)||this.#roster||this.#workspaceNavigation||this.#destructionFailed)return null;
    const epoch=this.#epoch,generation=this.#admissionGeneration;let revoked=false;
    return Object.freeze({isCurrent:()=>{
      if(revoked)return false;
      if(epoch!==this.#epoch||generation!==this.#admissionGeneration||this.#roster||this.#workspaceNavigation||this.#destructionFailed||!this.isCurrent(grant)){revoked=true;return false;}
      return true;
    }});
  }

  // Trusted native adapters only; no preload or IPC exposes captured handles.
  eventFor(grant) {return this.isCurrent(grant)?this.#captures.get(grant):null;}
  // Main-only lookup of the exact owned shell, including pending/retired
  // factory handles. No IPC/preload projects native surfaces or this method.
  surfaceFor(window){return workspaceSurfaceFor(window);}

  // Main-only source scope preserves the version requested when this genuine
  // native Code window was admitted. Projected IDs cannot recreate it.
  sourceScope(grant) {
    if(!this.isCurrent(grant)||grant.role!=='code')return null;
    const request=this.#views.get(grant.windowId)?.request;
    return request?Object.freeze({sourceId:request.entityId,...(Object.hasOwn(request,'version')?{version:request.version}:{})}):null;
  }

  // Main-only requested deck identity. Audience deliberately retains zero
  // entity read grants; its public frame binding cannot become source access.
  presentationScope(grant) {
    if(!this.isCurrent(grant)||!['presenter','audience'].includes(grant.role))return null;
    const request=this.#views.get(grant.windowId)?.request;
    return request?Object.freeze({deckId:request.entityId}):null;
  }

  caller(event) {
    try {
      for (const entry of this.#views.values()) {
        const { webContents, record, mainFrameUrl, request, scope } = entry;
        if (event?.sender !== webContents) continue;
        if (!this.#live(entry)
          || !event.senderFrame || event.senderFrame !== entry.mainFrame || event.senderFrame !== webContents.mainFrame
          || event.senderFrame.url !== mainFrameUrl || webContents.getURL() !== mainFrameUrl) return null;
        const current = this.#policy(request);
        if (current.projectId !== scope.projectId || current.mode !== scope.mode || current.access !== scope.access) return null;
        const entityIds = request.role === 'audience' || mainFrameUrl===WORKSPACE_ENTRIES.home ? []
          : request.entityId === null ? (entry.window===this.#workspace?.window?current.entityIds:scope.entityIds) : [request.entityId];
        if (!entityIds.every(id => current.entityIds.includes(id))) return null;
        return Object.freeze({ webContentsId: entry.webContentsId, mainFrameUrl, windowId: record.windowId,
          role: record.role, projectId: record.projectId, epoch: record.epoch, entityIds: Object.freeze([...entityIds]) });
      }
    } catch { /* Unavailable native identity or policy fails closed. */ }
    return null;
  }
}
