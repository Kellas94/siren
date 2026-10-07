# Terminal Task 3 — cwd and profile preflight

Author: /root/catalogue_view. Captured 2026-10-07T12:57:48.8368334Z. **Read-only dependency analysis; native execution is not admitted.** No product source, test or manifest was changed. No shell, PTY, application module, native fixture, build or installation was run. Only this report pair was written. File identities and inspection limits are in the JSON.

## Existing seams and actual gaps

The approved 3 October spec and Task 3 plan require a native directory picker, project-bound opaque cwdId, revalidation before spawn, protected Data/runtime roots and absolute PowerShell with ['-NoLogo','-NoProfile']. No imported text, path, argv, environment or startup command may acquire execution authority.

src/terminal/cwd.mjs and profiles.mjs and their cwd/IPC tests are absent at inspection. TerminalPolicy already defaults to refusing native authority and requires normal mode/canExecute for cwd selection/create; passive list/listProfiles remains narrower. It accepts a future terminal role, while WindowRegistry's current role set still omits terminal. The session ledger explicitly declares nativeExecutionAdmitted:false. These are prerequisites, not proof of a working shell.

WindowRegistry.capture(event) retains actual sender/main-frame objects; isCurrent rejects an ordinary copied grant. captureAdmissionGuard permanently revokes queued admission across freeze/rollback. Reuse these checks rather than constructing a grant from renderer IDs or URL. Check live PIN, normal mode, write access, selected project and admission before and after every picker/filesystem/profile await and immediately before any host-create dispatch.

projects/paths.mjs ownedDirectory is useful precedent: resolve, lstat directory, no leaf symbolic link and realpath equality. Project tests already contain junction refusal fixtures. It is intentionally an owned-storage helper, not a complete general cwd grant: it does not remember a directory's identity across calls, inspect every reparse type, or atomically bind a later spawn to that directory. Do not add create:true or invoke writableDataRoot on a user-selected cwd; both would introduce writes.

## Recommended interfaces and trust model

Retain approved CwdAuthority({pickDirectory,protectedRoots}).pick(grant):Promise<CwdGrant> and .resolve(grant,cwdId):Promise<string>. Add main-only injected isCurrent/captureAdmission/inspectDirectory/id providers and finite grant capacity, with explicit revoke(reason)/dispose lifecycle. These constructor/lifecycle details are recommendations, not new renderer IPC. Defaults refuse. Return only {cwdId,projectId,displayPath}; private records hold the canonical path, directory identity, project, app-run/epoch and admission generation.

A picker operation retains the originating native scope until it mints the grant. The grant itself is project-bound, not a permanent lease on that window: another eligible current same-project view can resolve it under policy. Foreign project, stale application epoch, Lock/project transition and disposed authority invalidate it. Avoid resurrection on A→B→A or failed-Lock rollback. Keep a bounded grant map with explicit capacity behavior; do not persist cwd tokens as startup execution authority.

Resolve native protected roots from active dataRoot and installation/runtime/resource location. main.mjs allows explicit relocation of Data, so hardcoding portable/Data is insufficient. The packaged App/versions directory, current/inactive runtime trees and app resources belong to the protected installation envelope; in development explicitly protect the runtime/application/generated roots supplied by main. Never accept protected roots from a renderer or derive them from the user's project content.

Canonicalize the selected path without converting it into a command. Check both lexical and canonical paths against each canonical protected root, using equality/component-descendant boundaries rather than startsWith (Data-other must not equal Data). Preserve Unicode literally, including distinct normalization forms. Treat directory aliases/reparse components conservatively, consistent with the existing ownedDirectory refusal policy, and do not normalize unsafe device namespaces into accepted paths. Initial implementation can explicitly support local absolute drive paths and drive roots; UNC/device/extended forms need a declared qualified policy, not accidental acceptance. A legal apostrophe/backtick/$() is inert path text; double quote is not a normal Windows filename character and should be a refusal fixture, not a command-escaping exercise.

At selection, remember the canonical directory and meaningful native/file identity of its leaf and necessary ancestors. Before spawn, re-inspect directory existence/type, reparse/alias state, canonical path, identity and protected roots; replacement at the same path must refuse, not silently retarget. Fail closed on missing/inaccessible or unknown required identity. Recheck the native admission scope after every await, after cwd and profile resolution and immediately before host transport.

**Limit:** repeated lstat/realpath and file-identity checks still leave a path-based filesystem TOCTOU interval before PTY creation. They cannot establish an atomic directory-handle guarantee. Native proof or an explicit supported race policy is required before claiming otherwise. This protects initial cwd selection; a real local shell can later cd or read anything its OS user can access. It is not a filesystem sandbox.

Cancellation, empty or multiple picker answers, virtual-only projects and disappeared directories never fall back to process.cwd, home, temp, blob storage or installation paths. They never create/materialize a source or start a command.

## Profiles and environment

Retain listShellProfiles():Promise<ShellProfile[]> and resolveShellProfile(profileId):Promise<{executable,args,env}>, backed by a private main-owned immutable catalog. Inject trusted OS/system-directory discovery and filesystem inspection for tests. Renderer receives profileId, label and available only. It supplies no executable, argv or env.

Discover the absolute Windows PowerShell executable from a trusted native OS/system-directory input and verify canonical regular-file ownership/identity. No PATH search, where command, cwd lookup, guessed C:/Windows fallback or silent PowerShell 7/cmd substitution. Refuse unavailable or replaced executable. Revalidate immediately before create; keep exact ['-NoLogo','-NoProfile'], with no -Command, -File, -NonInteractive, execution-policy modification or generated startup content. Optional shells require separately fixed discovery/argv entries.

Build env from a copied native-owned OS snapshot, preserving required OS variables and PATH. Remove Node/Electron injection keys case-insensitively, including the spec's NODE_OPTIONS/NODE_PATH/ELECTRON_RUN_AS_NODE/ELECTRON_NO_ASAR/ELECTRON_EXTRA_LAUNCH_ARGS; use the broader existing PIN-worker stripping precedent where appropriate. Windows duplicate case-folded env names must have a deterministic refusal/canonicalization policy. Exclude app-injected credentials, PIN/account/AI keys and application worker/module injection. Do not mutate process.env or merge renderer env. Do not log environment values.

The candidate fixture is not production policy: it filters a short list with case-sensitive key comparison, chooses SystemRoot || C:/Windows, and resets PSModulePath to OS modules to avoid inherited Codex module paths. Preserve that fixture's provenance. Production should explicitly remove application-injected module locations or qualify an OS-only module policy; copying it silently can hide user modules. An OS-inherited user environment is still not a guarantee of no secrets anywhere: state precisely that SIREN does not inject its private credentials, and test the actual intended policy.

## Focused RED and later native witnesses

1. Native dialog cancellation/empty/multiple selection never substitutes cwd; no host side effect.
2. Windows drive roots C:/ and D:/, Unicode/combining characters/emoji, spaces/apostrophe/backtick/$() remain literal path arguments; no command construction.
3. Relative, drive-relative, rooted-without-drive, device/extended namespace, NUL/control/unpaired-surrogate paths refuse; UNC policy explicit rather than silently rewritten.
4. Canonical Data/runtime equality and descendants refuse; prefix siblings Data-other/App-old allowed; case and separator variants cannot bypass boundaries.
5. Leaf symlink, junction ancestor, replaced protected-root alias, and same-path different identity refuse; inaccessible/deleted/file/unknown identity refuse.
6. Known path changes during lstat/realpath/profile/picker awaits return ACCESS_REFUSED or CWD_CHANGED; no usable late grant.
7. Lock then rollback, project A→B→A, retired frame and copied native-grant object never resurrect a pending picker or cwd token.
8. Project-bound cwd is usable by another eligible current project view under native policy, not by foreign projects or Docs/Code/Presenter/Audience.
9. Bound cwd grant map with deterministic capacity refusal, no eviction of active session authority; revoke on Lock/project transition/dispose.
10. PowerShell executable absolute and owned regular file; SystemRoot absent/malformed, executable absent/replaced/link/protected-root candidate => unavailable with no PATH/cwd search.
11. Optional pwsh/cmd unavailable until separate exact discovery/argv inventory; never silently substitute another shell.
12. Exact immutable PowerShell args [-NoLogo,-NoProfile]; no Command, File, NonInteractive, execution-policy override, user startup commands or imported content.
13. Mixed-case NODE_/ELECTRON_/VSCODE_ injection entries stripped; duplicate case-folded environment keys refuse or deterministically canonicalize; required OS vars retained.
14. App credentials/PIN/tokens/project snapshots absent from shell envelope and logs; sanitize never mutates process.env and rejects non-data/getter-bearing malformed snapshot.
15. Executable revalidation finishes before final current/admission checks; profile list results rechecked after awaits; no Promise/object truthiness authority.

Pure tests use fake picker/fs/OS providers and a spy that stays at spawnCount=0 on refusal; that proves dispatch behavior, not actual shell ownership. Preserve an original adverse before repair. Real Windows junction/reparse/Unicode/discovery/environment witnesses belong to a later isolated actual-runtime scope, followed by exact portable package hashes. Task 1 ownership/ABI/helper qualification remains an independent admission requirement even when all pure cwd/profile tests pass.

Next implementation can safely complete pure authorities and tests first. Registry terminal-role/dock/preload/IPC and host-create wiring then use the same authoritative scope checks and owner guard. No new permission question is needed for this approved Task 3 scope; no guard success or native qualification should be simulated.

