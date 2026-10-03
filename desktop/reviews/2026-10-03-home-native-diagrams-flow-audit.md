# Home and native Diagrams: current-flow audit and proposal

Auditor: Codex subagent `/root/source_authority_review`, 2026-10-03. User goal: unlock SIREN, continue work or choose a project, and move clearly between Diagrams, Docs, Code and Present, including future native Diagrams on multiple monitors.

This is a fresh actual development-app flow audit, followed by proposed changes. **The current captured application has no Home screen. No Home or native Diagrams design was implemented during this audit.** The captured renderer is the existing generated application; the isolated new editor adapter/EditorView work is not mounted in these screens.

The requested [product-design audit skill](C:/Users/Taras/.codex/plugins/cache/openai-curated-remote/product-design/0.1.56/skills/audit/SKILL.md), router, critical overrides and audit framework were read. Its read-only user-context preflight reported no saved context. The user's explicitly selected native `tests/native/drive.mjs` was used instead of a browser prototype. No mock Home, browser clone, generated renderer changes or product edits were made.

## Fresh capture and actual steps

Fresh synthetic Data was created inside ignored `desktop/evidence/home-flow-independent-audit-2/synthetic-data`, using only fixture PIN 4826. The real native setup/unlock receipts were exercised through the unchanged owned driver. The project was the app-created `Untitled desktop project`, ID `c386db19-0630-4e6a-ba3e-219e74fce787`; no real user project or PIN was opened. The 1424 × 895 screenshots are renderer viewport captures, not OS desktop/titlebar photographs.

The auditor inspected every saved PNG using `view_image` before accepting it. Latest DOM was read before each pointer action, and the driver's hit test rejected covered targets. The raw snapshot's visibility filter does not fully account for hidden ancestors or modal occlusion: a listed underlying control is not proof that it is visible or usable. Findings use the inspected images, matched actual controls, and successful pointer actions, rather than raw button counts.

| Step | Actual interaction and evidence | Health |
| --- | --- | --- |
| 1 | Unlock; delayed tour appears over the starter diagram (`02-startup-tour`). | Works; asks users to learn desktop maintenance before choosing their task. |
| 2 | Click tour **Skip**; wait for no tour and saved-local state (`03-diagram-settled`). | Works; dense initial workspace has no project/task choice. |
| 3 | Click **Docs** (`04-docs`). | Clear empty state and creation action; shared navigation changes. |
| 4 | Click Docs' **Code** (`05-code-library`). | Clear source/draft entry choices; its library is not the new editor implementation. |
| 5 | Click **← Diagrams** (`06-return-diagrams`). | Works; focus returns to `codeLibraryButton`, preserving the diagram. |
| 6 | Click **Present** (`07-present`); click **Exit** (`08-present-return`). | Works; preview becomes a presentation and focus returns to `presentButton`. |
| 7 | Click footer **Desktop…** (`09-desktop-controls`). | Project import, backup, Settings and Lock are available, but grouped with maintenance actions. |
| 8 | Click **Done** (`10-desktop-return`), then **Find** (`11-find-commands`). | Works; input receives focus and keyboard instructions are visible; long command list competes with work-item search. |

The first screenshot, `01-first-entry`, was inspected and retained as an early transient only. Its DOM still said “Saving locally…” while the subsequent screenshot already showed “Saved locally”; the delayed tour had not appeared. It is excluded from accepted stable audit evidence. Intermediate return screenshots were also inspected and retained; the six principal captures below carry the experience findings.

### 1. Entry after unlock: tour

![Actual fresh startup tour](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/02-startup-tour.png)

The first tour page is “1/10 - Local desktop workspace,” explaining backups, recovery, code privacy and the development build. **Skip** and **Next** are clear. Its content is useful once someone needs those features, but it covers an already busy diagram before offering a choice of work. A task-oriented Home would provide that choice first; contextual help can explain each surface on its first use.

### 2. Settled Diagrams

![Actual settled diagram editor](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/03-diagram-settled.png)

Strengths: visible saved-local state, diagram name, Build/Mermaid distinction, recognisable module buttons, and direct diagram manipulation. Risk: first entry exposes builder controls, a diagram toolbar, global header actions, formatting, layout-engine selection, inspector, filters, history, minimap and footer controls together. At this viewport the lower diagram needs scrolling. The initial starter block is already highlighted and “Block colour · A” is shown before the auditor selects a block.

Keep zoom, fit and navigation on the canvas. Reveal block colour/shape/label when a block is selected, connector controls for connectors, and document-level formatting/layout in an inspector. Preserve advanced templates/tools as secondary expandable groups. This would give the actual diagram more space while retaining expert controls.

### 3. Docs

![Actual Docs empty state](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/04-docs.png)

Strengths: an explanatory empty state, a prominent **Create the first document**, search/filter and **New**. The diagram header disappears; the surface offers **Register**, **Code**, **New**, **Back**, plus the shared footer. Project identity, saved state, Find, Settings and Lock no longer occupy the same header positions. The DOM document title says “Untitled document — Docs” even though no document exists; a module/library title would be clearer until an entity is selected. This is a document-title observation, not independent OS titlebar qualification.

### 4. Code library

![Actual Code library empty state](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/05-code-library.png)

Strengths: **New code**, **Open file**, filters, source search and a separate Windows area explain the current model. Copy explicitly says SIREN does not run code. The empty Windows area tells users editors remain available and can be minimised to a return bar. No source/editor window was created in this read-only navigation audit, so its editing, source import, minimising and native window behaviour were not qualified.

The module header offers **Docs** and **← Diagrams**, rather than one consistent destination selector. “More +” is vague beside two meaningful primary actions. The DOM title remains the diagram title while Code library occupies the viewport. Use “Code — [project]” for the library and “[source] — Code — [project]” for a selected editor.

### 5. Present

![Actual presentation surface](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/07-present.png)

Strengths: the canvas gains room, slide count, Previous/Next, Studio, dimming and Exit are distinct. The footer still exposes local project identity and **Desktop…**, and the overview title card continues below the visible viewport. This capture represents the current presenter surface, not a privacy-qualified audience window. A future audience view must intentionally omit project/account/maintenance chrome and editor capabilities; the presenter can retain controls. Do not infer audience separation from this screenshot.

### 6. Project and Desktop controls

![Actual project and Desktop controls](C:/Claude/SIREN_WORK/portable/desktop/evidence/home-flow-independent-audit-2/09-desktop-controls.png)

**Open / import project**, **Export saved backup**, **Disaster Recovery**, **Settings**, **Lock**, updates, diagnostics and Quit are available. Disabled update controls communicate state. The useful recovery distinction (“opens a copy; preserves original”) appears in the tour. The modal gives all these actions similar visual weight, mixing frequent project/security actions with occasional maintenance. A persistent project menu should contain project choice/import and backups; Settings can group appearance and security; Help can contain guide, diagnostics, updates and recovery access. Keep Lock directly reachable rather than requiring the footer modal.

The native OS file chooser, opening/importing another project, changing PIN settings, Lock, backup export and Quit-as-a-save operation were not invoked. Their buttons were observed; their side effects were not qualified by this audit.

## Prioritised Home and decluttering proposal

**P1 — Add a lightweight Home after successful native unlock.** Show a selected/recent project label and last-worked metadata, a primary **Continue work**, secondary **Choose project** and **New project**, and explicit **Diagrams / Docs / Code / Present** entries. On a genuinely fresh installation there is no fabricated “last session”: offer project creation/import and a clearly named starter choice. The current application auto-creates a scratch project; changing that is a proposed behaviour, not an existing Home.

Home should read only authorised metadata initially. Do not mount the whole legacy editor/storage bag just to render project cards, and do not populate preview/source/document bodies before the user opens them. The native PIN/load barrier must complete before Home receives project authority; a renderer showing an unlocked visual state does not create grants. Show readonly/recovery context plainly when applicable.

**P1 — Use one shared command arrangement across work surfaces.** A compact header can contain Home/project selection, module selection, actual saved/pending/failed status, Find, Windows, Settings and Lock. Module-local toolbars then supply creation, search and context-specific editing. Present's presenter may collapse that bar; its audience should not receive it. This separates frequent navigation from advanced diagram editing without removing capability.

| Common command | Current observed placement | Proposed consistent treatment |
| --- | --- | --- |
| Project choice/import | Footer Desktop modal; project label in footer | Header project menu plus Home chooser |
| Save/state | Diagram chip; Find lists Save project to disk/Save as | Truthful per-owner status; explicit Save/backup semantics; no success on a stale receipt |
| Find | Diagram header; separate Docs/Code searches | Consistent global Find; clearly scoped local content search |
| Windows | Code library's Windows area, empty here | Common Windows menu listing actual live authorised views and clear focus/restore actions |
| Settings | Footer Desktop modal | Stable header action; advanced maintenance grouped separately |
| Lock | Inside Desktop modal | Always reachable security action with native revocation |

The captured Find palette supplies keyboard instructions, focus and curated commands, but its default list is long and visually translucent over diagram content. Distinguish work items from commands in results, group frequent project/module actions first, and use an opaque readable result surface. The screenshot suggests readability/contrast risks; no contrast ratio or WCAG conformance was measured.

**P2 — Reveal inspection progressively.** Selecting a block should reveal its edit/format controls; otherwise give the diagram most of the space. Keep Build/Mermaid explicit so “Code library” and “Mermaid source” are not confused. Rename vague “More +” by its actions or use a clear labelled menu. Preserve the observed return focus behaviour; Home/module changes should restore focus to the originating control when a child surface closes.

## Native Diagrams proposal and authority constraints

Offer **Open diagram in new window** from the diagram menu and the future common Windows menu. A native Diagrams window should own one authorised `{projectId, diagramId}` view, use the shared command layout, and have its own canvas and optional inspector. It should communicate edits through a typed main-owned diagram coordinator with revision/conflict receipts. Do not launch a second full legacy workspace with its own mutable copy of the entire project bag. That would introduce independent writers and obscure which view owns saves.

Continue work may persist a minimal project/entity/module pointer and display preferences, but **not** BrowserWindow IDs, webContents IDs, opaque reader IDs or a prior grant. On resume, validate current project selection, entity existence, access, version and native epoch; recreate/focus through the registry. A missing entity/project should give a clear chooser/recovery route, not silently create replacement content. A retired native ID must not reactivate a stale renderer. Focus the exact current native view, restore if minimised, and avoid opening duplicate owners unintentionally.

Home/module changes, project selection, account transitions, Lock and Quit need an explicit coordinator policy for pending edits and failed durable acknowledgement. Keep dirty local state/recovery truthful; never relabel an old receipt as the current saved document. Native grant retirement must cover pending, minimised and visible satellite windows. Window metadata needs project/role/entity scope so switching projects cannot expose a prior project's titles or drafts.

For multi-monitor restoration, use display work-area coordinates in DIP, preserve normal bounds separately from maximised/fullscreen state, and clamp a reachable titlebar when a display disappears. The existing pure geometry/registry code is not physically exercised by these client captures. Qualification must later cover two real monitors, mixed scaling/negative coordinates, removed displays, minimised windows during Lock, duplicate focus/restore and actual OS titlebars. Native Diagrams remains future work in this report.

## Evidence integrity and limits

The completed capture used owned Electron PID **27428**. Its exact executable path was verified at launch and before the unchanged driver's cleanup; later process queries showed it gone. The audit helper wrote `completed:true` for capture and stable-input verification, then its interactive PTY remained alive after cleanup and was stopped with Ctrl+C, resulting in helper exit **1**. That is retained as an audit-helper termination fact, not hidden as a passing test. There was no product exception in the completed flow, and no native test PASS/release admission is claimed.

The first attempt is separately preserved in `evidence/home-flow-independent-audit`: its ignored DOM observer used `innerText.trim()` on an SVG role=button, failed before screenshot capture, and its missing-process post-cleanup query also needed correction. Owned Electron PID **28164** was independently confirmed gone. Only the ignored helper was corrected; the product and native driver were untouched. The parent explicitly authorised the corrected fresh session. No initial failed observer attempt is presented as audit evidence.

Before/after witnesses in the completed directory are byte-identical, each SHA-256 `be109b7b939af3bf818fc308a33cfac7f126b675ab9e39ff334c1b76b4dc6571`, covering **52** actual entry/import inputs, preloads, generated inventory, baseline, package/lock, driver, helper and executable. Isolated not-imported editor/source-client/build work was intentionally excluded; it was not live in this audit. This was a development executable run, not a packaged ASAR test.

| Principal input | SHA-256 |
| --- | --- |
| `src/main.mjs` | `19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0` |
| `generated/app.html` | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| `generated/build.json` | `f2f1e84af26517281ade11a0e504da2326fe50b672840ad02e7c187813966ebf` |
| `tests/native/drive.mjs` | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |
| `package.json` | `b88a96a244c88c369ab9934635613896008feeb4ab0165eecb604a51aaba8043` |
| `package-lock.json` | `dc3cdd517b8dd18759260f2f7cc898c74bc57a0b7151f51e5f3c55be368f3cab` |
| Electron executable | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

Raw completed result SHA-256 `a47126f374e2c45503071f7137a7504fc03d70b7a4b957eb41711484e841eae9`. `screenshots-inspected.json` records each screenshot hash and acceptance. Fresh DOM receipts, action-before DOM records, logs and all return screenshots are retained beside it. No old screenshots were used.

Accessibility findings are risks and limited observations: labelled diagram controls, visible disabled states, focused Find input and successful return focus are observed; complete keyboard traversal, focus traps, screen-reader reading order, measured contrast, zoom/reflow and reduced-motion behaviour remain untested. Native titlebars, physical monitors, real project portfolios, large-source performance, complete Docs/Code editor functionality and audience privacy require separate qualification.

Recommended next design step: agree the metadata-only Home, shared command layout and typed native Diagrams ownership model before implementing the new entry flow.
