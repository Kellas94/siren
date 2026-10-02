# SIREN Portable Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows portable SIREN with durable local projects, online activation and 30 days offline, and signed updates discoverable through “Check for Updates” and GitHub Releases.

**Architecture:** Keep the existing SIREN renderer behind a narrow Electron preload API; files, credentials, activation and updates belong to the privileged adapter. A small launcher/update helper selects immutable application versions independently of project data. The private source repository and public binary distribution repository have separate contents and permissions.

**Tech Stack:** JavaScript ESM with JSDoc contracts, Electron **44.5.1**, Node **24.16.0** for development, `@electron/packager` **20.3.0** for ZIP/folder packaging, Rust for the Windows launcher/helper, maintained OIDC/JOSE and ZIP implementations qualified before inclusion. Tests use Node's test runner, Rust tests and an actual Electron desktop driver. No new UI framework.

**Spec:** `C:/Claude/SIREN_WORK/docs/superpowers/specs/2026-10-02-siren-portable-foundation-design-v4.md`; v2 is the preserved document the user approved, v4 records the explicitly requested manual update button and GitHub/public-binary choice.

**Status:** Written plan revision 2 proposed for review on 2 October 2026; revision 1 is preserved. The user additionally requested a Disaster Recovery module for crashes. The user's “Aprob planul” answered the specification handoff before this implementation plan existed. Specification/scope are approved; this document has not yet been reviewed. No product code, product dependency installation or desktop package was created by writing this plan.

## Global Constraints

### User follow-up: opening sequence and PIN access (2 October 2026)

- [ ] Enforce the startup order **opening animation → access screen → workspace**.
  No workspace frame may appear before the opening animation or before access
  has been granted. Verify real frame order, replay, reduced-motion behavior and
  startup/recovery failures; do not hide a readiness failure behind an animation.
- [ ] Add an access screen using **username and PIN**, rather than a password
  field. The requested initial username is `tsinc`. The user supplied the initial
  PIN privately in the conversation; it must be configured separately, not
  copied into this plan, source, build receipt, logs or distributed package.
- [ ] Make the access view cover the entire application window. Keep one calm
  central form with two compact, clearly labelled fields (username and PIN).
  Use restrained, high-quality motion and theme-aware backgrounds illustrating
  diagrams, code, documentation and presentations. These are synthetic product
  illustrations, never the user's locked project content. Maintain readable
  contrast, keyboard/focus behavior, reduced motion and a clear error/working
  state. Avoid additional OS windows or a crowded command surface.
- [ ] Define the PIN/access integration with the approved online activation and
  30-day offline permit. A local convenience unlock must not manufacture an
  activation permit. Keep entry limits, safe credential storage, explicit reset,
  accessibility and recovery/export on expired activation in the implementation
  scope. The production account service remains unconfigured.
- [ ] The user explicitly allows the complete access screen to follow the current
  defect batch. Fix the reported pre-intro workspace flash now; record the
  access screen as pending rather than pretending it is already implemented.
  A separately labelled fullscreen design preview is now available from
  **Desktop → Sign in / access preview**: two central username/PIN fields,
  theme-aware synthetic diagram/Code/Docs/presentation cards, restrained motion,
  reduced-motion support and keyboard dismissal. PIN submission clears the field
  and explains that unlock is not configured; it never grants activation. Online
  activation uses the existing native account bridge. Startup gating, PIN
  verification/storage/rate limits/reset and production service integration remain
  pending. Do not equate this visual preview with completed authentication.
- [ ] Reproduce the missing **Mermaid Guided chip editor** in desktop using real
  pointer input, including its editable and read-only states. Check import and
  restart, preserving project source bytes and explicit editing permissions.

- “Windows x64 întâi”; initial qualification is Windows 11 25H2 x64, build 26200.9457 on the present machine, with clean-machine verification on another supported Windows 11 installation before a general portable claim. The registry's legacy ProductName string is not proof of Windows 10 support.
- “Electron și folder/ZIP portabil, cu Chromium inclus”; SIREN distributes runtime patches. Recheck support/security advisories before installing the pinned candidate; a required version change is recorded explicitly before qualification.
- “cont online, cu lucru offline după activare”; “30 de zile offline”. Save already-started work and allow recovery/read/export when activation expires.
- “dependențe open source, SIREN rămâne privat”; user explicitly selected “Pachete publice semnate, sursă privată”. Public distribution contains binaries, notices and release metadata only.
- Disaster Recovery is a first-class module for crash/power loss, corrupt data and failed startup/update; restore into a new verified project copy, never automatically overwrite the sole surviving original.
- Projects remain local; no automatic code/Docs upload, telemetry or crash-report upload. No client secret, publisher private key or GitHub source-access token is distributed.
- “Node integration este oprită”; sandbox and context isolation remain enabled. Imported Python is never executed. Native IPC validates sender, schema and current permission.
- Preserve Docs explicit save, shared draft ownership, source/agent/release identities, existing themes, multiple Code/Docs windows and keyboard/context-menu interactions.
- Live v1.131.0/R78 stays unchanged until a new build is qualified. Frozen baseline SHA-256: `5FCE39D9AFC9D8D9A7367647A23AA5B07A00C61BDC357E369805D0BD3754FAA4`, 13,626,609 bytes.
- Existing limits and T256 stay open; 300,000 lines/file and 1,000,000 lines/project are later targets, not acceptance claims for this foundation.
- Distinguish test issuer/keys/feed from production. Receive genuine independent review messages before admitting a public build; do not create approvals on a reviewer's behalf.

## Review Focus

1. Moving a USB/folder package, a path with Romanian/Unicode characters, or a read-only directory must not silently redirect or lose projects — Tasks 1, 2, 3 and 9.
2. Two application instances or a stale window must not overwrite a newer project or apply an update while another instance owns draft data — Tasks 2, 3 and 6.
3. Account changes, unavailable protected storage, clock rollback and an offline server must not leak secrets or destroy recovery access — Task 4.
4. A GitHub outage, API rate limit, edited/replayed manifest or malicious archive must never become “up to date” or a successful installation — Tasks 3, 5, 6 and 8.
5. A renderer/link IPC attack, incomplete driver run or forged review record must fail visibly rather than produce release evidence — Tasks 1, 3, 7 and 9.

---

## Files and shared contracts

All new product paths below are under a new private Git checkout `C:/Claude/SIREN_WORK/portable/` after plan review; do not initialize Git over the scratch workspace. Repository-relative prefix is `desktop/`. Existing local evidence outside that checkout is read-only. The source repository is verified private `Kellas94/siren`; default branch `main`. Documentation is being prepared in its own branch/PR separately from product implementation.

| Paths | Responsibility |
| --- | --- |
| `desktop/package.json`, `package-lock.json`, `build/renderer.mjs`, `patches/desktop-storage.py` | Reproducible build from the exact frozen renderer and guarded desktop adapter changes |
| `desktop/src/contracts.d.ts`, `main.mjs`, `preload.cjs`, `protocol.mjs`, `ipc.mjs` | Shared contracts, startup, trusted local protocol and narrow native bridge |
| `desktop/src/projects/{paths,store,migration,recovery}.mjs` | Project selection, exact import, single-writer durable save and crash recovery |
| `desktop/src/recovery/{catalog,checkpoints,sessions,restore}.mjs`, `desktop/src/ui/recovery.mjs` | Disaster Recovery catalog, validated checkpoints, abnormal shutdown detection and explicit restore UI |
| `desktop/src/account/{oidc,permit,credentials,access}.mjs` | Browser login, signed offline permits, OS-protected credentials and access policy |
| `desktop/src/updates/{github,manifest,download,service}.mjs` | Public feed resolution, publisher verification, download staging and state machine |
| `desktop/src/ui/{account,updates}.mjs`, `desktop/src/ui/desktop.css` | Discreet account/update controls using existing theme tokens |
| `desktop/launcher/Cargo.toml`, `Cargo.lock`, `src/{main,selection,apply,processes}.rs` | Windows launcher, version selection and recoverable apply/helper replacement |
| `desktop/scripts/{package,inventory,publish,admit}.mjs` | ZIP building, license inventory, protected publishing and evidence admission |
| `desktop/tests/{shell,projects,recovery,account,updates,ui,release}.test.mjs`, `tests/fixtures/` | Observable behavior, hostile inputs and test-only issuer/feed fixtures |
| `desktop/tests/native/{drive,portable,regression}.mjs` | Actual Electron pointer/keyboard, packaged update and regression probes |
| `.github/workflows/desktop-verify.yml`, `desktop-publish.yml` | Private CI verification and explicitly dispatched publication after qualification |

`contracts.d.ts` defines these names once; ESM implementations export the matching functions. Native bridge returns structured-clone-safe values, never raw handles, credentials or arbitrary paths.

```typescript
type Failure = { ok: false; code: string; message: string };
type ProjectRef = { id: string; label: string; external: boolean };
type Snapshot = { project: ProjectRef; revision: number; schema: 1; json: string; sha256: string };
type SaveRequest = { projectId: string; baseRevision: number; json: string; purpose: 'workspace' | 'recovery' };
type SaveResult = { ok: true; revision: number; sha256: string } | Failure;
type RecoveryPoint = { id: string; projectId: string; createdAt: string; revision: number; schema: 1; sha256: string; kind: 'saved' | 'draft' | 'emergency'; verified: boolean };
type RecoveryState = { mode: 'normal' | 'recovery' | 'readonly'; reason: string | null; points: RecoveryPoint[]; lastRecoverableAt: string | null };
type AccessState = { state: 'unactivated' | 'online' | 'offline' | 'reauth-required' | 'revoked'; offlineUntil: string | null; recoveryOnly: boolean };
type UpdateState = { phase: 'unconfigured' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'applying' | 'error'; version: string | null; bytesReceived: number; totalBytes: number | null; errorCode: string | null };
type UpdateConfig = { repository: string | null; channel: 'stable'; trustedKeys: Record<string, string>; maxPackageBytes: number };
type Manifest = { schema: 1; product: 'siren'; channel: 'stable'; version: string; platform: 'win32'; arch: 'x64'; dataSchema: 1; sequence: number; expiresAt: string; minAllowedVersion: string; keyId: string; asset: { name: string; bytes: number; sha256: string }; files: Array<{ path: string; bytes: number; sha256: string }> };
type VerifiedUpdate = { manifest: Manifest; manifestSha256: string; assetUrl: string };
```

Manifest is authenticated as exact UTF-8 bytes by a detached **Ed25519** signature. This avoids inventing JSON canonicalization. Keys come from the signed/trusted publisher configuration; unknown key IDs fail. Rust and Node use maintained verifiers and a shared test-vector corpus. One active root may authorize a signed key-ring revision; a key appearing in an unsigned server response grants no trust. Limits: manifest 1 MiB, 50,000 file entries, package and total extracted bytes 2 GiB; reject overflow and enforce streamed limits, not only advertised lengths. These are bounded updater limits, not source-code limits.

Renderer API `window.sirenDesktop` exposes only `pickProject(): Promise<Snapshot | Failure>`, `saveProject(SaveRequest): Promise<SaveResult>`, `exportProject(projectId): Promise<{ok:true} | Failure>`, `getAccess(): Promise<AccessState>`, `beginLogin(): Promise<AccessState | Failure>`, `logout(): Promise<AccessState>`, `getUpdate(): Promise<UpdateState>`, `checkForUpdates(): Promise<UpdateState>`, `downloadUpdate(): Promise<UpdateState>`, `restartAndUpdate(): Promise<{ok:true} | Failure>` plus `getRecovery(projectId): Promise<RecoveryState>`, `restoreRecovery(pointId): Promise<Snapshot | Failure>`, `exportRecovery(pointId): Promise<{ok:true} | Failure>`, and `onStatus(callback): unsubscribe`. The main process owns configuration and the selected project table; renderer-provided IDs never become filesystem paths. Task 2 additionally owns initial project preload through a validated bootstrap snapshot before the IIFE starts.

## Task 1: Package an isolated, reproducible desktop renderer

**Files:** Create package/build/patch/contracts/main/preload/protocol/ipc paths above and `tests/shell.test.mjs`. Generate `desktop/generated/app.html`; never commit generated renderer or mutate live/frozen HTML. Add precise allow-list entries to the private repo's deny-by-default `.gitignore` for desktop source, locks and tests; exclude generated/dist/profiles/credentials.

**Interfaces:** `buildRenderer({baselinePath, expectedSha256, outputDir}): Promise<{path,sha256}>`; `createMainWindow({portableRoot, bootstrap}): BrowserWindow`; `registerLocalProtocol({rendererRoot}): void`; `registerDesktopIpc({window, services}): void`. Produce a sandboxed packaged shell and bridge contracts; consume the pinned R78 baseline.

- [ ] Write `shell.test.mjs`: wrong baseline hash refuses without output; `siren://app/../secret` and encoded traversal refuse; remote navigation/window-open and hostile IPC cannot obtain filesystem/shell access; read-only portable root shows a directory choice with cancellation leaving no data change. Test that a deliberately exposed privileged IPC method is detected by the hostile probe.
- [ ] Run `node --test desktop/tests/shell.test.mjs`; expect failure for the missing build/bridge, not a missing test or zero tests.
- [ ] Implement guarded renderer generation and bridge. Resolve/pin maintained permissive OIDC and archive dependencies with recorded exact license evidence; pin Rust toolchain/crates in the lockfile at execution time. Read manifests and official license texts before retention. Use `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`, restrictive local CSP and no generic exec/read/write IPC. Preserve embedded Mermaid/parser notices. Adapt inline CSP with build-derived hashes without `unsafe-eval` or disabling CSP.
- [ ] Run the test above and `npm --prefix desktop run native:shell`; record actual runtime versions, OS/build, no setup requirement, clean-process ownership and screenshots. A shell is labeled prototype until later tasks pass.
- [ ] Commit only Task 1 source, locks, tests and recorded dependency decision in the private checkout; save a hash-pinned immutable evidence folder.

## Task 2: Import, save and recover local projects without false success

**Files:** Create `projects/*`, `tests/projects.test.mjs`; modify `patches/desktop-storage.py`, main/preload/ipc/contracts. Existing renderer seams: **`loadPersistedState()`**, **`saveState()`**, **`scheduleSave()`**, **`sirenStore`**. Locate and pin exact anchors on the frozen baseline; do not invent `loadState()` or expose IIFE internals on `window`.

**Interfaces:** `openProject({selection, accountScope}): Promise<Snapshot | Failure>`; `saveProject(SaveRequest): Promise<SaveResult>`; `importLegacyExport({selectedFile, destination}): Promise<Snapshot | Failure>`; `recoverProject(projectId): Promise<Snapshot | Failure>`. Native service holds path capabilities, revision and a single writer; current Code/Docs explicit save semantics remain renderer-owned.

- [ ] Write fixtures from a **real explicit SIREN export**, remove personal content before committing fixtures. Assert exact source text, Unicode/CRLF, source/Docs/agent/release IDs and snapshot hashes after import/readback. Assert stale revision conflict leaves both previous data and pending draft available; simulate disk-full, access denied and interrupted rename; no response reports `ok:true` before readback. Move `Data/`+`Projects/` and verify external missing links stay visibly unresolved.
- [ ] Run `node --test desktop/tests/projects.test.mjs`; observe the expected failures before implementation.
- [ ] Implement schema-1 project metadata + UTF-8 workspace/recovery files, per-project OS-backed writer exclusion, flushed temporary file/journal/atomic selection and verified readback. Validate Windows paths, reparse points, case aliases and permission at use. Hold directory/file handles across security-sensitive operations where necessary. Never use an imported label as a destination. A stale source version or second instance refuses the write; owned UI windows share the same draft authority.
- [ ] Replace desktop persistence via validated initial native bootstrap and acknowledged asynchronous saves; localStorage remains UI preferences/cache, not authority for desktop project durability. `exportProject(projectId)` uses native Save dialog, bounded validated project contents and exact readback. Recovery writes preserve already-started work while access becomes expired; no implicit Docs commit.
- [ ] Run project tests plus native import/edit/restart/crash-recovery probe; compare exported JSON/source values independently. Commit the task with preserved failed probes and final evidence.

## Task 3: Disaster Recovery after crashes, corruption and failed startup

**Files:** Create `desktop/src/recovery/{catalog,checkpoints,sessions,restore}.mjs`, `desktop/src/ui/recovery.mjs`, `desktop/tests/recovery.test.mjs` and fault fixtures. Modify main/ipc/contracts, project recovery integration and launcher session-selection logic. Catalog/snapshots stay under `Data/Recovery/`, outside updates and repository uploads.

**Interfaces:** `checkpointProject({snapshot,kind}): Promise<RecoveryPoint | Failure>`; `inspectRecovery({projectId,sessionJournal}): Promise<RecoveryState>`; `restoreRecovery({pointId,destination:'new-project'}): Promise<Snapshot | Failure>`; `exportRecovery(pointId): Promise<{ok:true} | Failure>`; `recordSession({event:'opened'|'ready'|'clean-close',version,processIdentity}): Promise<void>`. Native service resolves opaque point IDs against its owned catalog; imported IDs/labels never grant path access. Later activation policy preserves recovery/read/export of owned data.

- [ ] Write `recovery.test.mjs`: kill the actual owning process between temporary write, flush, rename, catalog commit and app readiness; restart and require either exact prior committed revision or exact new committed revision, never mixed data. Corrupt/truncate newest workspace/checkpoint/catalog and assert older independently valid points are offered while original bytes are retained. Fault injector must demonstrably crash the owned candidate; a normal exit cannot stand in for a crash.
- [ ] Run `node --test desktop/tests/recovery.test.mjs`; verify missing/wrong recovery behavior fails. Plant false “recovered” feedback with missing source bytes and confirm the source/hash oracle rejects it.
- [ ] Implement hash/schema/length-verified checkpoint catalog and last-known-good fallback. Keep the last **10 verified saved checkpoints per project**, latest verified private draft and unacknowledged emergency recovery points; prune older saved points only after a new point is verified. Never remove the sole valid point, a current draft, the original corrupt file or an emergency point awaiting user action. Insufficient space reports degraded recovery without claiming backup success. Existing editor/data capacity limits remain explicit.
- [ ] Implement session journal and crash-aware startup. Three unclean starts within five minutes offer Recovery Mode before automatically reopening the same project/windows; journal errors also offer safe read-only recovery. Do not infer crash merely from stale PID or a readiness timeout: check owning process creation/path identity. Recovery Mode suppresses automatic workspace/window restoration and nonessential analysis, retains account/update access and never executes imported code.
- [ ] Implement an accessible themed Recovery panel showing actual verified point time/revision and the last recoverable draft time. Actions: open a verified recovered **copy as a new project**, export point for safekeeping, choose another project or cancel. Restoring a Code draft keeps it private until explicit Docs save. If every point is invalid, offer export of original raw damaged files through native dialog with a truthful warning; do not manufacture an empty project as a successful recovery. Export only user-selected owned files, with permissions revalidated.
- [ ] Exercise native crash/power-loss fault injection and catalog/data corruption, expired/offline activation, two concurrent instances and a failed update/launcher selection. Compare byte/hash and source/Docs/release identities after recovered-copy save/restart. Export a local redacted diagnostic only on explicit user action; no code/token upload or automatic crash telemetry.
- [ ] Run all project/recovery tests and native Recovery panel in Dark/Warm Light with keyboard focus. Preserve killed/corrupt originals and failed runs in new evidence names; commit source/tests/evidence before integrating login/updater. `clean-close` is recorded only after acknowledged save/recovery writes complete; forced close reports the last verified recovery point, not an invented zero-loss guarantee.

## Task 4: Browser login and 30-day offline activation

**Files:** Create `account/*`, `tests/account.test.mjs`, test issuer/permit fixtures; modify main/ipc/contracts and add `ui/account.mjs`.

**Interfaces:** `beginLogin({issuer, clientId, entitlementEndpoint}): Promise<AccessState | Failure>`; `verifyPermit({signedPermit, keys, installationId, now, lastSeenTime}): AccessState | Failure`; `getAccess(): AccessState`; `canPerform({action, projectId, startedBeforeExpiry}): boolean`; `logout(): Promise<AccessState>`. Publisher config is native-owned; imported docs cannot select issuer or endpoints.

- [ ] Write actual protocol tests: PKCE S256, state/nonce mismatch, wrong issuer/audience/signature, replayed code/callback, denied login, 180-second callback timeout, unavailable protected storage and server outage. For permit issued at `2026-10-02T12:00:00Z`, allow offline at `2026-11-01T11:59:59Z`, require reauthentication at `2026-11-01T12:00:00Z`; reject permits extending beyond 30×24 hours. Clock rollback beyond five minutes of last known trusted/high-water time requires online revalidation, with recovery still available.
- [ ] Run `node --test desktop/tests/account.test.mjs`; demonstrate missing/incorrect verifier fails. Plant a token into diagnostic output/export and verify the leakage detector refuses admission.
- [ ] Implement maintained OIDC Authorization Code+PKCE in the system browser with ephemeral `127.0.0.1` listener, state/nonce and one-use callback. Verify a distinct server-signed entitlement permit containing account/install/product/issued/expiry/key. Use Electron `safeStorage` only when OS-protected storage is available; otherwise keep the current session in memory and require login next start. Do not retain plaintext refresh material.
- [ ] Enforce access on native operations as well as UI: expiry blocks new normal sessions but permits existing-project read/export and saving already-started work. On account switch, choose projects explicitly; do not auto-open the previous account's session. Logout clears credentials/permit without deleting projects; never claim remote revocation if offline. Moving to another PC/Windows user requires login, with data intact.
- [ ] Run native browser login against a real controlled test issuer, disconnect/reconnect, expire permit and export/save recovery. Production issuer/entitlement deployment requires real configuration; mocks do not certify production login. Commit source/tests and bounded results.

## Task 5: Verify and stage updates from public GitHub Releases

**Files:** Create `updates/*`, `tests/updates.test.mjs`, signed feed fixtures; modify main/ipc/contracts.

**Interfaces:** `resolveGitHubRelease(UpdateConfig): Promise<{manifestBytes,signatureBytes,assetUrl} | Failure>`; `verifyManifest({bytes,signature,config,currentVersion,lastSequence,now}): VerifiedUpdate | Failure`; `downloadVerifiedUpdate({update,stagingRoot,signal,onProgress}): Promise<{receiptPath} | Failure>`; `checkForUpdates(): Promise<UpdateState>`; `downloadUpdate(): Promise<UpdateState>`.

- [ ] Write tests for the actual detached signature corpus: changed field, unknown key, signature reuse on different bytes, expired/replayed manifest, lower high-water sequence, wrong product/arch/channel/data schema, malformed semver, duplicate fields/files, case collisions and size overflow refuse. GitHub 404/429/offline/timeout produces an error with retry, never `current`; missing publisher config produces `unconfigured`. Release draft/prerelease is excluded from stable selection.
- [ ] Run `node --test desktop/tests/updates.test.mjs`; mutate a signed fixture and observe refusal. Verify fake HTTP success without complete body fails the package hash/length checks.
- [ ] Implement anonymous HTTPS release discovery against a **publisher-fixed distribution repository**, `update-manifest.json`, `update-manifest.sig`, `SIREN-<version>-windows-x64.zip`; the API is a discovery transport, not signature authority. Bound metadata to 1 MiB, package to 2 GiB, timeouts to 15 seconds for metadata and 30 seconds of download inactivity; retry manually after rate limit using `Retry-After` when provided. Validate redirect destinations as GitHub-owned release hosts; never forward credentials. Production has no localhost/insecure-TLS override; test feed uses a separate non-production build config.
- [ ] Download complete packages to versioned staging, verify exact bytes/hash/signature before `ready`, preserve current app on failure, serialize concurrent checks/downloads and allow cancellation. Enforce signed minimum allowed version and durable highest accepted sequence. Publish signed trusted key-ring rotation/revocation; never trust a key supplied only by the transport.
- [ ] Run real test-release resolution/download and independent readback of staged bytes; test unavailable feed without valid login to confirm security updates remain accessible. Commit code/tests/evidence.

## Task 6: Apply updates safely with a Windows launcher/helper

**Files:** Create launcher Cargo/lock/source paths and `tests/fixtures/update-archives/`; modify `updates/service.mjs`. Test Rust `selection`, `apply`, `processes` plus native packaged-update probe.

**Interfaces:** Launcher reads only `App/current.json` within its resolved portable root and launches `App/versions/<validated-version>/SIREN.exe`. Helper input is a validated transaction descriptor file, not interpolated shell command text. `requestApply({receiptPath,portableRoot,ownedInstances}): Promise<{transactionId} | Failure>`. Journal phases: `downloaded`, `verified`, `prepared`, `applied`, `boot-confirmed`; Node/Rust share schema/signature corpus. App readiness acknowledgment carries transaction ID and launched version.

- [ ] Write Rust tests: ZIP traversal, absolute/UNC/drive paths, ADS, reserved names, symlink/reparse/hard-link escape, case alias, duplicate destination and decompression-limit violation refuse before version selection changes. Power-loss injection at each journal phase leaves either old or new validated version launchable. Invalid launcher selection never runs an arbitrary executable.
- [ ] Run `cargo test --manifest-path desktop/launcher/Cargo.toml`; observe missing implementation failures before implementing extraction/application.
- [ ] Implement maintained ZIP/Ed25519/SHA libraries and Windows identity/handle checks; whitelist manifest files and verify extracted hashes. Keep `Data/` and `Projects/` outside archive destinations. Wait for all instances belonging to this distribution using path, process creation identity and ownership, not name/PID alone. After 30 seconds of a blocking instance, abort with a retry message; never kill an unrelated process or discard drafts.
- [ ] Apply an atomic recoverable version-selection transaction from a separate helper executable. Upgrade launcher/helper through a temporary helper copy after target exit, re-verifying its signed hash; if locked, leave current launcher usable and report retry. Keep a validated compatible previous version. Schema remains 1 in this foundation; any later migration requires data backup and matching rollback, not merely reverting the executable. Honor the signed minimum allowed version; no normal fallback to a forbidden vulnerable build.
- [ ] Run old→new packaged update, blocked-instance retry, interrupted download/extraction/apply, old/new launch/readback and unchanged project hashes. A readiness timeout of 30 seconds offers retry/recovery; it is not by itself proof of a crash or permission to roll back/delete data. Commit source and observed results.

## Task 7: Add “Check for Updates” and account UI

**Files:** Create `ui/updates.mjs`, `ui/desktop.css`, `tests/ui.test.mjs`; modify renderer generation and Guide/Quick Tour desktop additions. Consume bridge UpdateState/AccessState only.

**Interfaces:** `mountDesktopControls({root,bridge}): {dispose():void}`. Expose “Check for Updates” in About/Help and a command-palette entry; no permanent large technical panel in the central canvas.

- [ ] Write visible behavior tests: button reachable by actual hit-test and keyboard; check→current/available/offline/error distinct; duplicate clicks coalesce; progress announces bounded bytes; close/minimize UI does not cancel a valid background download. `ready` shows “Restart and Update”, and no button reports an installed version before native boot confirmation.
- [ ] Run `node --test desktop/tests/ui.test.mjs`; run the probe with an intentionally occluded button and incomplete completion sentinel to prove the sensor rejects both.
- [ ] Implement the manual control, retry, cancel-download and restart action using existing theme tokens. Automatic check runs 10 seconds after startup and at most once per 24 hours while online; no automatic restart. A downloaded package applies next safe startup or by the explicit restart action. Show honest `unconfigured` state until distribution setup exists. Account status shows offline validity date without token/technical details.
- [ ] Add concise Guide/Quick Tour copy explaining portable data, activation and update actions; preserve Code's existing navigation/windows. Verify Dark/Warm Light at desktop sizes, pointer/keyboard, focus return, multiple Code/Docs windows and unsaved-draft recovery through update. Read screenshots yourself.
- [ ] Run native UI probes and commit evidence/source. Do not claim a visual test from selectors/configuration alone.

## Task 8: Private CI and public signed binary distribution

**Files:** Create `scripts/{package,inventory,publish,admit}.mjs` and workflow paths; add `desktop/DISTRIBUTION.md`, third-party notices and machine-readable dependency inventory. Repository name for distribution is configured after checking available names; do not write an invented live feed into the client.

**Interfaces:** `buildPackage({version,sourceCommit,evidenceDir}): Promise<{zipPath,manifestPath,inventoryPath}>`; `admitRelease({candidate,reviewReceipts,testReceipts}): Promise<{admitted:true} | Failure>`; `publishVerifiedRelease({repository,artifacts,approvalReceipt}): Promise<{tag,assetHashes}>`. Build identity includes Electron/Chromium/Node, launcher, source commit, artifact SHA-256 and data schema.

- [ ] Write release tests: an absent notice/unidentified distributed component, bundled secret/source map/private credential, fabricated review, wrong candidate hash or incomplete test sentinel refuses admission. A report's author label/hash alone does not establish independence. Validate original actual reviewer receipts/conversation evidence and exact candidate scope before publishing.
- [ ] Run `node --test desktop/tests/release.test.mjs`; demonstrate deliberate corrupt admission fails.
- [ ] Implement private verification/build workflow with explicit source allow-list, pinned Actions commit SHAs, lockfile builds, runtime/dependency/license inventory and protected signing credentials. Store signing material in publisher-controlled CI/environment only; use Node/Rust maintained cryptography. Keep internal source/debug maps/tests/logs out of the public distribution. Required third-party source/notice obligations are fulfilled separately.
- [ ] Create a separate public binary-distribution repository under the verified owner's account only after execution review; source repo stays private. Publish first to a draft release with exact immutable versioned asset names, then verify downloaded assets and manifest/signature/hash before stable promotion. Public publication needs real signing keys, production issuer/feed configuration and genuine release admission. Never overwrite an admitted version's assets to disguise a correction; use a new version.
- [ ] Test signing with throwaway keys/test release, key rotation, rate limit and publisher outage. Verify public assets have no source-access token or private files. Commit source/workflow/notices; test publication is explicitly labeled test.

## Task 9: Qualify the integrated portable package and hand it over

**Files:** Create `tests/native/{drive,portable,regression}.mjs`, qualification README/results; modify only identified failing implementations in new evidence/output names. Live install/promotion remains last.

**Interfaces:** Native driver emits per-scenario records and a final completion sentinel; evidence pins tested ZIP/extracted app/launcher/hash/OS/runtime/fixture. Actual independent review receipts precede `admitRelease`; self-review is labeled root-authored.

- [ ] Build one release candidate from committed source and verify baseline generation, locks, license inventory, signature and no private-data/source-map leakage.
- [ ] Run `npm --prefix desktop run verify` and `cargo test --manifest-path desktop/launcher/Cargo.toml`; `verify` runs all seven Node test suites with explicit nonzero test census. Preserve negative controls and failed runs.
- [ ] Run `npm --prefix desktop run native:portable` on actual packaged app: Disaster Recovery after crash/corruption and failed startup/update, Unicode path, move folder, read-only data choice, import/export/readback, two writers, crash recovery, login/30-day expiry/account switch, unauthenticated update check, signed update/rollback, malicious native calls and Dark/Warm Light Code/Docs/diagram/Office/PDF regressions. Run clean-machine no-setup and another-PC credential portability tests separately; if unavailable, report them unqualified and do not claim general portability.
- [ ] Establish observed size/startup/memory and current Code large-input baseline on identified hardware. Do not close T256 or raise source limits here. Prepare the separate editor/index scalability specification after these baselines.
- [ ] Obtain an actual fresh independent whole-change review plus scoped native/data/security checks as required by project conventions. Each reviewer receives exact candidate and frozen evidence, authors their own findings, and states limits. Repair findings in new artifacts; no coordinator-written substitute approvals.
- [ ] Admit only the exact qualified build. Publicly promote signed assets, verify downloaded installed bytes/runtime/data and preserve previous compatible fallback. Update private release note/resume/README from measured behavior. Do not claim all historical GitHub evidence synchronized merely because this plan/documentation PR exists.

## Plan self-review and handoff

Coverage: distribution/boundaries Task 1; data/migration Task 2; Disaster Recovery Task 3; activation/offline Task 4; signed checks/download Task 5; apply/rollback Task 6; UI/manual button/guide Task 7; license/private source/public binaries/patch delivery Task 8; regressions/independent provenance/actual portability Task 9. Scalability and web are explicitly later specifications, as in the approved foundation design.

Shared names, recovery contracts/checkpoint retention, schema 1, update phases, 30-day policy and baseline hashes are consistent across tasks. Each Review Focus item is assigned observable tests. Exact issuer/distribution repository/signing keys are deployment configuration to be established, not hardcoded guesses or claims of completed services. Proposed runtime/package versions were read from official release metadata on 2 October 2026 and are rechecked before retention.

Execution recommendation: implement here (Native) in substantial batches **1–3**, **4–7** and **8–9**, with genuine independent review before release. Storage, activation and update permissions share contracts; coordinating them in one implementation context reduces conflicting changes. Preserve all required per-task checks; batching does not remove them. Existing user authorization to use agents for review remains applicable; implementation method for this written plan is confirmed at the handoff.

The next action is the user's review of this saved plan, then execution via the selected required skill. No product scaffolding/dependency installation is performed before that review. Source/documentation synchronization is separately authorized by the explicit request to update GitHub; a documentation PR is reviewable work, not a desktop release.

Primary references: [Electron 44.5.1](https://github.com/electron/electron/releases/tag/v44.5.1), [Packager 20.3.0](https://github.com/electron/packager/releases/tag/v20.3.0), [Electron release support](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [release assets API](https://docs.github.com/en/rest/releases/assets). These describe dependencies/hosting, not successful SIREN qualification.


## Approved refinement: local PIN first, 2 October 2026

The user replaced the immediate account rollout with a local application PIN
that can be changed in Settings, then asked for an iPhone-like unlock screen.
This overrides account-required packaged editing for the current development
phase. The later online-account/30-day policy remains a separate future task.

- Startup: animated intro, then a fullscreen PIN screen, then the workspace.
  No project label/source/private draft is included in a locked bootstrap.
- First installation: enter and confirm a 4- or 6-digit PIN. Round numeric keys,
  masked dots, delete and ordinary keyboard input; no baked-in personal PIN.
- Settings: authenticate the current PIN, choose and confirm the replacement.
  Ordinary incorrect current-PIN entry keeps the existing session; five wrong
  attempts lock access for 30 seconds, including across restart.
- Lock command: stop editing and confirm workspace/private draft persistence
  before locking. Failed acknowledgement retains the open workspace.
- Native access authority validates every project/recovery invocation while
  locked. Unlocked local access never overrides native startup/readiness safety.
- Persist only an OS-protected salted scrypt verifier and bounded attempt
  metadata. Corruption/protection failure retains files and refuses reset.
  Project files remain ordinary local files; the PIN is an application lock.
- Qualification: real IO failures, real Electron PIN/pointer/keyboard, restart,
  current-PIN error/cancel, light/dark/reduced motion, first-paint sequencing,
  packaged editing/recovery and copied-folder locking. Keep failed evidence and
  reviewer authorship; successful units alone do not qualify the complete UI.

Before any later online-account rollout, specify the account data collected,
storage region, retention/deletion procedures, privacy information, EULA/license
terms and appropriate legal review. No account service, data collection or legal
compliance is claimed by the local-PIN implementation. Cross-Windows-account
PIN recovery/reset needs a separately approved data-preserving design.
