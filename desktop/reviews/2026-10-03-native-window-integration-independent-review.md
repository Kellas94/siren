# Native window integration independent review — 2026-10-03

Reviewer: `/root/source_authority_review`. Main integration/fixes: `/root`. Entity roster author: `/root/terminal_contract`, as recorded in its implementation report. This reviewer authored only this report and ignored independent probes/logs; no product/runtime/test edits, commits, full-suite runs or native experiments occurred.

Final verdict: **APPROVED for the reviewed Windows 1 data-free shell/main seams and native entity roster, source/unit scope only**, at the identities below. Initial **CHANGES REQUIRED** findings and failed reproductions are preserved. Main's separate saveProject no-op change is assigned to another reviewer and is outside this verdict. No full Docs/Code editor, source transport, Task 3 dirty-editor coordinator, actual native window/process, physical monitor, or package qualification is claimed.

## Scope and inspected authority

Reviewed the main imports/authorizer/factory tracking, native workspace binding and bootstrap activation, window IPC admission/show path, shell retirement in selection/PIN/account/Quit, canceled/failed transition restoration and the frozen `workspaceEntities` roster. Used the actual registry/IPC/factory/roster modules and actual main source slices in VM probes; EventEmitter objects replace only native windows/WebContents, account/journal/renderer-boundary effects. These are source integration assertions, not native experiments.

The main window is the sole pinned owner. Binding grants nothing while locked; only a genuine main-window/frame bootstrap after native PIN access explicitly activates it. Failed identity/policy/retained destruction returns null snapshot rather than publishing data. Roster IDs come from the current native snapshot and role-specific arrays; Code versions, when supplied, must occur in the native selected sourceRefs. Renderer identity/payloads cannot supply project grants or roster entries.

Code/Docs factory windows begin hidden, use current workArea DIP and sandbox/contextIsolation/no Node, and are tracked from creation even before a registry grant exists. The factory loads an exact role/UUID URL; main shows only after registration plus renewed owner/candidate grant checks. Ready messages carry no snapshot/source/draft payload. The role entrypoint only gets its own metadata/close capability and explicitly says shared editor integration is in development; it does not instantiate the workspace store or release project content.

Retirement revokes the epoch, preserves the ordinary native owner without its grant, destroys registered satellites and separately covers hidden pending factories from the tracked map. Failed destruction remains a native admission/bootstrap fence until a genuine successful retry. Selection/account/PIN failure restoration explicitly reactivates the trusted owner only when policy permits; successful Lock cannot restore it because the native PIN is then locked. Quit records clean-close only after shell retirement; a failed Quit restores the still-authorized owner without forgiving a native failure fence.

## Initial findings — CHANGES REQUIRED (resolved)

All three were reported immediately with exact source identities and actual VM source-seam assertion outcomes. Runtime was not modified by this reviewer.

### 1. Failed unregistered factory destruction did not fence later opens

Initial actual-main source string SHA-256: `0d59d1518181effdd08ca297ee109ead950824b3810b670b18fe2c2a43eab4e1`.

A factory's load failed and its own cleanup destruction threw. The registry's awaited factory rejected before returning a handle, so its internal destruction fence could not retain that handle. Main tracked it but did not latch the IPC `WINDOW_DESTROY_FAILED` result. The next open therefore created and showed another shell while the first unregistered native handle remained live.

Expected: future opens/bootstrap fenced until retained handles are genuinely destroyed. Actual independent stdout summary:

```text
first: { ok: false, code: 'WINDOW_DESTROY_FAILED', message: 'Native window destruction incomplete' }
second: { ok: true, view: { role: 'docs', projectId: 'project_a', epoch: 1, entityId: 'doc_a', state: 'active', ... } }
flag: false; unregisteredOrphanLive: true; newWindowShown: true; nativeHandles: 2
AssertionError: failed unregistered factory destruction must fence future native opens
actual: undefined; expected: 'PROJECT_BUSY'
Exit code: 1
```

Root now latches every `WINDOW_DESTROY_FAILED` receipt and failed post-admission disposal in main. Independent final assertions confirm a second open refuses `PROJECT_BUSY`, bootstrap returns null snapshot, the retained handle remains tracked, and repaired retirement truly destroys it before clearing the fence.

### 2. Failed ready/show admission retained a live registered grant and forwarded an error

Same initial main SHA-256: `0d59d1518181effdd08ca297ee109ead950824b3810b670b18fe2c2a43eab4e1`.

After successful factory load/registration/revalidation, injected native `show()` failure escaped the main handler. The registered shell remained alive with a valid caller grant and the native failure flag was false. The thrown error contained the synthetic private path rather than a fixed refusal receipt. The ready/send call shared this unguarded path.

Expected: dispose the failed shell and return a sanitized refusal; if disposal fails, retain/fence it and report destruction failure. Actual stdout:

```text
result: { rawError: 'owned show failed C:/private' }
destroyed: false; grant: true; flag: false
AssertionError: failed native show must dispose the registered shell rather than leave its grant live
actual: false; expected: true
Exit code: 1
```

Root wraps ready/send/show in a guarded disposal path. Independently verified both send and show faults, with both successful and failed destruction: sanitized `OPERATION_FAILED` after confirmed disposal, or `WINDOW_DESTROY_FAILED` plus admission fence when retained. Neither case retains an IPC grant or reports a successful open.

### 3. Aborted Quit after retirement left the authorized owner grant absent

Initial main SHA-256 for this later finding: `dc47b2d52c6363306c61a1e13065c8b8811e17df743959477c359528cbab7b38`.

After retirement successfully removed shells/revoked the owner grant, the clean-close journal rejected. The close catch retained the native owner/unlocked project and showed its delayed-close dialog, but unlike the other canceled transitions did not restore the trusted owner grant. Every subsequent valid shell open refused until an unrelated reload/bootstrap.

Expected: a safe canceled Quit can restore the still-authorized owner, while retaining all native destruction fences. Actual stdout:

```text
errors: 1; ownerAlive: true; oldShellDestroyed: true; ownerGrant: false
newOpen: { ok: false, code: 'SENDER_REFUSED', message: 'Untrusted native window request' }
AssertionError: a safely aborted quit after successful retirement must restore the still-authorized workspace grant
actual: false; expected: true
Exit code: 1
```

Root now attempts trusted activation in the close catch after resetting its pending-close flag, with failed activation caught. Final independent journal-failure scenario leaves owner alive, records no clean-close, restores the eligible owner and permits another shell open; a native destruction failure still leaves admission fenced and the owner grant absent.

## Entity roster review

The separately authored roster was reviewed together with main consumption, transparently included in this verdict. `workspaceEntities` assumes ProjectStore has already verified the native snapshot; it is not source blob/manifest verification. Schema 1 never infers Code IDs from legacy codeFiles, drafts or row contents. Schema 2 Code IDs come only from own native sourceRefs with bounded valid IDs/versions/hash shape. Docs IDs come only from active top-level workpapers: exact primary storage wins over imported/direct content, a desktop bag missing/breaking that primary cannot fall back, and otherwise explicit import state/direct active workpapers are supported. Releases, old caches, drafts, unrelated nested arrays and source provenance are not authority sources.

Own data descriptors avoid ordinary snapshot/ref/accessor/inherited authority reads; JSON parsing is UTF-8 byte capped, malformed snapshots fail closed, IDs are deduplicated into fresh arrays, and input/source text is not mutated. Parsing metadata is not a source-text transport/capacity qualification. The implementation tests include genuinely ProjectStore-verifiable descriptor snapshots; the VM fixtures are synthetic native snapshots and do not claim actual disk source-blob verification.

Standalone roster command, cwd desktop:

```powershell
node --test tests/window-entities.test.mjs | Tee-Object -FilePath evidence/native-window-entities-independent-focused.log
exit $LASTEXITCODE
```

Actual result: **16/16 pass**, zero fail/skip, exit 0, **110.3119 ms**. No roster blocker was found. The final main probe additionally establishes that primary current Docs ID and native Code/version work, while provenance/release/import/direct-stale/backup IDs and an old Code version cannot open roles.

## Final independent verification

Command, cwd `C:/Claude/SIREN_WORK/portable/desktop`, Node v24.16.0:

```powershell
node --test tests/native-window-integration.test.mjs tests/window-entities.test.mjs tests/window-entrypoints.test.mjs tests/window-registry.test.mjs tests/window-ipc.test.mjs tests/pin-ipc.test.mjs tests/account-service.test.mjs tests/native-transitions.test.mjs 2>&1 | Tee-Object -FilePath evidence/native-window-independent-focused.log
exit $LASTEXITCODE
```

Actual result: **91 tests, 91 pass, 0 fail, 0 skipped/cancelled/todo, exit 0**, duration **398.0484 ms**. This selected run is not a full suite and does not inherit any package/native qualification. It includes five actual-main integration cases, sixteen roster cases, two entrypoint/factory cases, thirty-four registry and twenty IPC cases, plus selected PIN/account/native safety transition checks. The entrypoint test builds temporary synthetic renderer files and checks resource/CSP/package allowlist behavior; it does not build or launch a shipping package.

The retained independent script executes actual main policy/bootstrap/window handler/retirement/selection/Lock/account/close slices against real modules. Command:

```powershell
node evidence/native-window-independent-probe.mjs 2>&1 | Tee-Object -FilePath evidence/native-window-independent-final.log
exit $LASTEXITCODE
```

Actual final stdout, exit 0:

```text
Main source SHA256: 19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0
Independent actual-main native-window scenarios passed: 21
```

The 21 scenarios separately cover exact/foreign/subframe/locked native bootstrap and real roster role/version scope; successful hidden registration before ready/show with no content message payload; failed unregistered cleanup fencing/repaired retry; send/show plus destruction faults; actual Lock of minimized and pending-hidden shells; failed Lock destruction with no false PIN lock and repaired retry; failed renderer flush retaining unlocked work; canceled/failed selection and blocked selection callback on failure; canceled/successful/failed account commit/logout with retirement before account effects; failed Quit journaling/restoration, failed Quit destruction with no clean-close or reactivation, failed Quit flush retaining live work, and successful Quit recording clean-close only after shell retirement.

The independent script's first run had a **reviewer path-oracle error**: it compared Windows `node:path.resolve` output against a Unix literal in the fake preload path expectation. It exited 1 and was retained as `native-window-independent-probe-path-error.log`. Only that probe expectation was corrected to the native absolute path. This is not a product finding or product RED. The final independent script/log above binds the corrected assertions to the frozen main hash.

`git diff --check -- desktop/src/main.mjs desktop/tests/native-window-integration.test.mjs` exited 0, with a Git CRLF-to-LF notice for main.

## Final source and evidence identities

Hashes captured after final focused execution and independent probe. They identify the source/probe dependency boundary, not a package or full-file main approval outside the stated seams.

| Source | SHA-256 |
| --- | --- |
| `desktop/src/main.mjs` | `19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0` |
| `desktop/tests/native-window-integration.test.mjs` | `02fd8a21af60870b5cde3934cb971dbbd9330dfa697d4a29a7d32c88eaba5325` |
| `desktop/src/windows/entities.mjs` | `f85a1152def37065c69d66ca143278e82dd3da264c11a7efc8a0c4b0d28dd03a` |
| `desktop/tests/window-entities.test.mjs` | `28c0c898a2b1ad2e0315c47fab4d83e6b70577dd97b6c020bec2f6ac7439aa90` |
| `desktop/src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `desktop/src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `desktop/src/windows/factory.mjs` | `3cbdf1e52f0512a94af6148a6b531892fe6a439c3726ada46562c4e1d835437d` |
| `desktop/src/windows/geometry.mjs` | `ec4d3f778df89df18db214178ba00690a713714cb3d8937361901d755dbe8333` |
| `desktop/src/windows/preload.cjs` | `a9c8efbdd81c4a9c55964530211be2ca819beb439d3283f4634a9ab45f38871b` |
| `desktop/src/ui/windows/entry.js` | `db86d62cfa7319e5cc8242804d5bc80607485cf1726afd8ea97aa3386e144215` |
| `desktop/src/protocol.mjs` | `2e9494bc36a63557fd921ed79d2284d6e6452a6f998ed5350e3f342c686538b3` |
| `desktop/scripts/package.mjs` | `a9296b1ffa29dcd4366d8900833bd9a6a39665eaddb60da4d55ef76f2950adfd` |
| `desktop/build/renderer.mjs` | `a1e9579bf376c8d90f0dbed44fbfb325ca231c15ed910c26be40891c577a9fe2` |

| Ignored evidence | SHA-256 |
| --- | --- |
| `desktop/evidence/native-window-independent-probe.mjs` | `c7d192d63f24622cd7b9d583c18c233cca4ea08f460010dd4ef9c634ef7e3237` |
| `desktop/evidence/native-window-independent-final.log` | `d53564787c772a7c0a3c2e5a860bae96f4525a48e7ab26acbe1e85265060ee5c` |
| `desktop/evidence/native-window-independent-focused.log` | `66d9aee0c3e903fef6e7b94c5e67c3bf3135e6c10f442d8bab4bb91b641238ad` |
| `desktop/evidence/native-window-entities-independent-focused.log` | `4ca0222626512ec12668881aaf7252ab2dc86fa7e5a03a922db9628bfd01be65` |
| Retained reviewer path-oracle error log | `41fd178d956e8a25a0dfa4e0d12363e51cb718aed6e8cc1ede86338234c6d0c4` |

## Remaining qualification

Data-free shell grant decisions and simulated handle destruction are distinct from actual native/OS outcomes. These tests do not demonstrate process exit, no real content flash, actual minimized/Audience removal, mixed-DPI/physical multiple-monitor behavior, renderer memory, native packaged startup or binary/ASAR correspondence. The roster does not verify blobs, and metadata shell tests do not prove source save/restart or shared editor behavior. Full Docs/Code editor transport, dirty-editor pause/drain/recovery, coordinator intents, subscription ordering and presentation are future approved tasks, not delivered by this boundary. The parent must complete separate actual native and committed-source package qualification before product admission; the reviewed source fixes alone are not a package PASS.
