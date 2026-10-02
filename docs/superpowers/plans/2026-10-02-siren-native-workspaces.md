# Native Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detach multiple Docs/Code views and Presenter/Audience into coordinated native Windows windows usable across monitors.

**Architecture:** A native registry issues role/access/epoch grants; one domain/save owner serves typed intents and source subscriptions. Satellites render only their needed views. Access transitions and Quit drain all editors before final authority changes; geometries restore against current display work areas.

**Tech Stack:** Existing Electron BrowserWindow/screen/Menu and sandboxed local renderers; source contracts from the large-source plan. No new UI framework or AI dependency.

**Spec:** `docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md` — user approved in this session.

## Global Constraints

- Role set: workspace, code, docs, presenter, audience; IDs/permissions derive from native registry, not URLs/payloads.
- One authority for edits/save. Expected versions, epoch and operationId prevent stale overwrite and double application.
- Docs/Code: multiple native nonmodal windows, standard minimize/resize/maximize/move, attach-back, shared restore/focus list. Do not clone independent full-project mirrors.
- Present: readonly presentation-only Audience, private notes in Presenter, explicit deck-version refresh; no source/project/credentials in Audience payloads.
- Lock revokes grants and destroys data satellites before success; workspace reloads locked with null snapshot. PIN cannot override recovery/readonly. Failed drain does not become clean-close/Lock success.
- Ctrl+Alt+L global Lock, Ctrl+W close active view, Ctrl+Q coordinated Quit. Preserve ⌘ Code naming while using Windows-native conventions.
- Geometry is DIP; negative coordinates and display removal/mixed DPI are supported. No claimed multi-monitor qualification without physical probes.
- Main close means coordinated Quit; satellite close only closes that view. Draft bytes already received are recoverable; keystrokes never sent are not promised recovered.
- AI is last; no main merge/public release, baseline rewriting, broad popup allowance or fabricated independent approvals.

## Review Focus

- Forged same-origin role/window payload: no new grants or project read — Task 1.
- Project changes while delayed source/Docs edit is in flight: old epoch rejected and draft retained — Tasks 2/4.
- Minimized/unresponsive editor during Lock/Quit: preserve work or honest failure; no premature ACK — Task 3.
- Audience receives stale frame after Lock: no content reappears, no note/source leakage — Task 5.
- Monitor removal with negative coordinates or maximized window: titlebar reachable and work intact — Task 6.

## File map and prerequisites

Create `desktop/src/windows/{registry,coordinator,geometry,presentation}.mjs`, `desktop/src/ui/windows/{client,shelf,entry}.js` and scoped role entrypoints in generated output. Modify `main.mjs`, `preload.cjs`, `ipc.mjs`, `protocol.mjs`, `contracts.d.ts`, `build/renderer.mjs`, `scripts/package.mjs`, `src/ui/desktop.{js,css}`. Preserve strict local serving/CSP and deny arbitrary navigation.

Depends on SourceRepository/source receipts/TextModel and manifest contracts in Tasks 2–4 of `2026-10-02-siren-large-sources.md`. Registry/geometry tests may be prepared independently, but editable satellites cannot ship before these owner contracts. Shared types: `ViewRequest={role,entityId,version?}`; `ViewRecord={windowId,role,projectId,epoch,entityId,state}`; `Intent={operationId,epoch,entityId,expectedVersion,action,payload}`; `Receipt={operationId,epoch,entityId,version,sha256,outcome}`.

Integrated order: Sources 1–3 → this plan Task 1 → Sources 4–6 → this plan Tasks 2–6. No independent full-project renderer clones are shipped during the intermediate stages.

### Task 1: Native role registry and narrow entrypoints

**Files:** Create `desktop/src/windows/registry.mjs`, `desktop/src/ui/windows/entry.js`, `desktop/tests/window-registry.test.mjs`, `window-ipc.test.mjs`; modify main/preload/ipc/contracts/protocol/builder/package.

**Interfaces:** `WindowRegistry({createWindow,authorize}).openView(ViewRequest): Promise<ViewRecord>`, `.caller(event): Grant|null`, `.listViews()`, `.focusView(windowId)`, `.closeView(windowId)`, `.invalidateEpoch()`. `Grant={webContentsId,mainFrameUrl,windowId,role,projectId,epoch,entityIds}`.

- [ ] Write failing tests for forged ID/role/URL, unregistered/subframe caller, destroyed renderer, known entity from another project, locked/readonly grants and allowed role methods: `assert.equal(refused.code,'SENDER_REFUSED'); assert.equal(audienceReadSource.ok,false)`.
- [ ] Run `node --test tests/window-registry.test.mjs tests/window-ipc.test.mjs`; confirm RED.
- [ ] Implement role-local BrowserWindow entrypoints with sandbox/contextIsolation/no Node, show only once ready without application-content flash, verify caller at every IPC. Maintain denied arbitrary popup/navigation/webview and exact source/module package allowlist. Windows are nonmodal, no forced parent-on-top relationship.
- [ ] Run focused tests and an actual native role-shell probe with two registered windows, failed forged caller and closed-window grant revocation. One same-origin URL never authorizes another renderer by itself.
- [ ] Run `npm test`; commit registry/entrypoints/bridge with tests.

### Task 2: Domain owner and satellite intent/subscription transport

**Files:** Create `desktop/src/windows/coordinator.mjs`, `desktop/src/ui/windows/client.js`, `desktop/tests/window-intents.test.mjs`, `window-subscriptions.test.mjs`; adapt source bridge and Docs domain intents at builder seams.

**Interfaces:** `WorkspaceCoordinator({sources,manifest,registry}).invoke(grant,Intent): Promise<Receipt>`, `.subscribe(grant,entityId,callback): Unsubscribe`, `.pause(reason)`, `.resume()`, `.drain(): Promise<Receipt[]>`. Consumes source and manifest APIs defined in the large-source plan.

- [ ] Write failing tests for distinct entities preserving both changes, same-entity stale refusal, duplicate operation returning prior receipt, out-of-order delivery, old epoch after project switch, disposed subscription and conflict draft recovery. Assert exact independent expected text/metadata/hash, not mock call counts alone.
- [ ] Run `node --test tests/window-intents.test.mjs tests/window-subscriptions.test.mjs`; confirm RED.
- [ ] Serialize typed source/Docs intents at one owner; preserve domain validation and private draft identity. Satellites request only needed entities/ranges and subscribe to version-bound results. Do not instantiate full mirror/autosave bags in satellites or retry stale full-envelope saves using a fresh baseRevision.
- [ ] Run tests and real concurrent native views; verify disk receipt/restart and explicit Docs commit. Caller/role/epoch is validated before jobs and after asynchronous completion.
- [ ] Run `npm test`; commit coordinator and transport.

### Task 3: All-window Lock, selection, close and crash barriers

**Files:** Extend `windows/coordinator.mjs`; modify main PIN/account/selection/close hooks, recovery journal and view client; create `desktop/tests/window-transitions.test.mjs`, `desktop/tests/native/window-transitions.mjs`.

**Interfaces:** `transition({kind:'lock'|'select'|'quit'|'close-view',windowId?,nextProjectId?}): Promise<{ok,code?,epoch}>`; each view exposes `flushView(): Promise<Receipt[]>` and `pauseView()/resumeView()`. Native authority completes transitions; UI animation follows ACK.

- [ ] Write failing tests for dirty/minimized view, failed flush, newer queued edit during drain, crashed/unresponsive renderer, stale delayed event, correct PIN with safety readonly and actual cancelled close. Assert `assert.equal(cleanCloseRecorded,false)` on failure and unchanged original work; Lock success requires all grants invalid and satellite count zero.
- [ ] Run `node --test tests/window-transitions.test.mjs`; confirm RED.
- [ ] Freeze new edits, cover views, drain every editor and owner queue, confirm exact latest receipts, then revoke/increment epoch and destroy satellites for Lock; reload workspace with locked null snapshot. On failure resume safely and show retained/exportable work. Project selection closes old views after drain. Main close = coordinated Quit; satellite close does not end app. Journal clean-close only after all ACKs.
- [ ] Run actual native probe for save-in-flight Lock/Quit, failed write, renderer kill and recovery; check every remaining window including minimized/Audience. Preserve unknown-process failure behavior. No delayed frame/event repopulates locked or newly selected workspace.
- [ ] Run `npm test`; commit transitions and tests.

### Task 4: Docs/Code native detach, attach-back and shared window shelf

**Files:** Create `desktop/src/ui/windows/shelf.js`; extend role entry/client; modify desktop UI/css and builder adapters; create `desktop/tests/window-views.test.mjs`, `desktop/tests/native/multi-workspaces.mjs`.

**Interfaces:** `detachView({role,entityId,version})`, `attachView(windowId)`, `renderWindowShelf(ViewRecord[])`; consumes registry/coordinator/client. `attachView` changes view ownership without source/draft duplication and waits for a receipt.

- [ ] Write failing tests for draft identity preserved after detach/attach, restore from any mode, minimized status, closing one of several windows, independent split resize, immutable A/B refs and explicit Docs save. Test keyboard routing reserves Lock, Ctrl+W active view and Ctrl+Q all views; no duplicate action from native menu plus renderer shortcut.
- [ ] Run `node --test tests/window-views.test.mjs`; confirm RED.
- [ ] Add context menu commands and restrained window list beside common project/navigation controls. Remap Code library's colliding shortcut. Standard native titlebar handles move/minimize/maximize/resize; source/map/explanation panels resize within the view. Update guide/tour to describe existing delivered commands only.
- [ ] Run native 2 Code + 2 Docs, light/dark/reduced motion/focus/keyboard/IME and source recovery. Measure renderer/process memory and ensure no independent full-project copies or duplicate subscriptions.
- [ ] Run `npm test`; commit native editors/navigation/guide.

### Task 5: Presenter/Audience roles and bounded presentation transport

**Files:** Create `desktop/src/windows/presentation.mjs`, `desktop/tests/presentation-transport.test.mjs`, `desktop/tests/native/presentation-windows.mjs`; extend role entry/client and builder presentation adapter.

**Interfaces:** `PresentationSession({deckRef,registry}).open({presenterDisplayId,audienceDisplayId})`, `.navigate({epoch,sequence,slideId})`, `.refreshDeck(deckRef)`, `.close()`; `AudienceFrame={epoch,sequence,deckVersion,slideId,publicSlide}`. No full workspace or notes fields.

- [ ] Write failing tests for note/source/credential/private-draft payload rejection, stale sequence/epoch, slow audience backpressure, deck-version refresh preserving slide ID, unsupported media budget and Lock destroying cached frames. Assert `assert.equal('notes' in audienceFrame,false)` plus planted forbidden-content checks in actual payload/DOM.
- [ ] Run `node --test tests/presentation-transport.test.mjs`; confirm RED.
- [ ] Replace opener/document.write/BroadcastChannel fallback with registered bounded transport. Presenter controls and Audience output are separate roles; explicit deck refresh, native monitor selection/fullscreen/Escape, limited preloading of adjacent slides and coalesced visual frames.
- [ ] Run actual native presentation with diagrams/images/text, refresh, navigate, minimize/restore and Lock; verify public slide hash and absence of private notes/source in Audience. Preserve export and source deck bytes on refusal.
- [ ] Run `npm test`; commit native presentation.

### Task 6: Display geometry, restore and complete package qualification

**Files:** Create `desktop/src/windows/geometry.mjs`, `desktop/tests/window-geometry.test.mjs`, `desktop/tests/native/multi-monitor.mjs`; integrate screen events, settings/window shelf; create `desktop/reviews/native-workspaces-qualification.md`.

**Interfaces:** `restoreBounds({normalBounds,displayId,maximized,fullscreen},displays): RestoredBounds`; `rememberBounds(windowId,bounds)`, `recoverVisibleWindows(displays)`. Bounds use DIP and workArea, stored outside content/save snapshots.

- [ ] Write failing geometry tests for monitor left of origin, 100/150/200% scaling, missing display, tiny workArea, malformed stored bounds, maximized normal-bounds restoration and taskbar changes: titlebar/control area must intersect a current workArea; content/draft state must remain unchanged.
- [ ] Run `node --test tests/window-geometry.test.mjs`; confirm RED.
- [ ] Handle display-removed/metrics-changed and restart layout; accept negative coordinates, clamp/rehome unreachable windows. Add “Move to monitor…” and “Bring all windows back”; persist normal/maximized/fullscreen states without serializing source text.
- [ ] Run actual two-monitor movement/unplug/mixed-DPI/Fullscreen probes. If only one physical monitor is available, mark physical coverage unqualified; simulated bounds tests do not replace it.
- [ ] Run full `npm test`, existing native groups and final committed-source package. Run packaged multi-view save/restart/Lock/recovery probes; independent reviewer checks exact source/ASAR/binary identities and actual evidence. Record all failed/skipped scopes, close owned processes, commit qualification and update private draft PR without main merge/public release.

## Self-review and handoff

Spec coverage: role/privacy = Task 1; one owner/versions = Task 2; Lock/close/crash/selection = Task 3; Docs/Code/window shelf/shortcuts/attach = Task 4; Present/versioned transport = Task 5; geometry/display/full qualification = Task 6. All five Review Focus cases map to explicit adverse tests. The user must review this written plan before implementation. Use the preserved execution choice: implementation here in batches for coupled interfaces, with scoped independent agent review/probes and final review.
