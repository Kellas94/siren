# Next desktop parity batch after Code context/commands

Author: `/root/disk_inventory`, 7 October 2026. Read-only source/backlog reconciliation; no runtime, GUI, network, product/test/build/workflow or Git mutation. This is a proposed implementation scope, not a fix, approval or fresh qualification. Root's separate Code qualification is in progress; its outcome is not assumed here.

## Reconciled baseline

The approved `portable/docs/superpowers/plans/2026-10-06-siren-workspace-ui.md` requires functional migration first, then decorative theme variants and real monitor/DPI checks. Its early “open” entries must be read alongside later delivery rather than reused as current defect counts.

- **Present already, do not redo:** shared Home/module/Find navigation, named themes, original palette shape/shadow metrics and attached/detached common shell. `desktop/build/appearance.mjs:8–11,31–39` extracts finite original colours and metrics; `desktop/src/ui/shared/chrome.css:2–17` applies them to native surfaces. `desktop/build/diagram-window.mjs:26–28` injects shared chrome/shell. The local Diagram System/Light/Dark selector alone does not prove 39 named themes are missing.
- **Present already, do not redo:** rich Docs editing/image/source context, saved document delivery, Presenter note metadata/export, native Diagram Text/Guided/Build/Style/SVG, history and typography. Current `src/ui/windows/docs.js:6–7` has real export/context integration; `src/ui/windows/diagram.js:10–19,90–101` mounts those Diagram tools and save/export authority. Read the separate authored delivery/hosted receipts for their exact qualification limits.
- **Current separate batch, exclude:** Code register/source relations, readable Compare B labels, compact commands/context menu and Python/text metadata, scoped by `portable/docs/superpowers/plans/2026-10-07-siren-code-source-context-commands.md`. Do not schedule that same work again or imply final qualification before root's actual result.
- **Reliability still OPEN:** original hosted Diagram Build Save mis-target, run37552477003. The current root checkpoint records a Save request hitting Attach; underlying geometry cause is open. Original hosted verdict remains FAILURE despite complete history/typography8 development +8 copied cases. This report neither diagnoses nor closes that issue. No release/main merge is suggested while that adverse is unresolved.

## Prioritized remaining scope

| Order | Concrete remaining gap | Source evidence and boundary |
| --- | --- | --- |
| 1 | Native Diagram walkthrough and readable preview navigation | Frozen R78 has a compact Walk through door, Previous/Overview/Next at `baseline/R78.html:21909–21912`, ready/empty/progressive control handling at `100908–100958`, focus/overview/step functions at `101016,101045,101060`. Current native `src/ui/diagram/window.html:4` offers zoom/Fit/export/Build/Style, but no walkthrough; `src/ui/windows/diagram.js:40–41,74` only transforms the canvas and binds rendered style/Build targets. This is absent native feature access, not a claim it is absent from Classic Studio. |
| 2 | Native metadata Inspector and derived Filters | Original R78 exposes Filters/Inspect at `21904,21918`; filtering functions are at `38084–38149`. Current `src/windows/domain.mjs:14` preserves nodeMetadata/view and related fields, while native draft/style/controller offer no corresponding metadata/filter controls. Preservation alone is not editing or filter rendering. Keep this separate from purely visual walkthrough; it needs finite metadata admission and explicit view/export semantics. |
| 3 | Docs readable review/comment/release trail | R78 has those routes at `22199–22202,25777–25800,25966,41311`. Current `src/ui/windows/docs.js:21–45` exposes extra imported fields through a generic preserved-field explorer; `src/documents/context.mjs:31–34` admits type/owner/agent/references only. A useful next tranche is an explicitly read-only structured timeline and jump-to-block for retained records. Appending review/release decisions requires a separate actual-actor/provenance contract; labels and hashes must not imply independent approval. |
| 4 | Decorative theme and attached-window ergonomics | Named palettes and shape metrics are implemented; full reference decoration/variant behavior and physical monitor/DPI/IME/accessibility checks remain open in the workspace plan. This needs representative actual screenshots and interaction evidence before identifying a concrete visual defect. Do not reopen the whole shell or declare decorative parity from token extraction. |

Public image/media cards remain a separate larger asset/recovery boundary: `src/ui/presentation/cards.js:18–19` admits table/title/text only. They should not be smuggled into a small UI-consistency batch as URL/path rendering. Docs image evidence and public presentation image storage are distinct features.

## Recommended next coherent batch: Diagram preview walkthrough

Implement one useful group across attached and detached Diagram views: a single **Walk through · N blocks** entry at rest; active Previous/current label/Next; Overview returning to the existing Fit behavior; visible focus/count feedback and keyboard access. Use the shared themed chrome and compact disclosure pattern; do not add a permanent navigation row when there are no supported targets. The original progressive controls provide a concrete design reference for the user's request to regain useful old controls without clutter.

Reuse the current successful render's targets from `src/ui/diagram/style.js:1–6` and `src/ui/windows/diagram.js:65,74`. They already match semantic IDs to actual SVG groups and expose `data-native-node-id`; their admitted target set is bounded to250. Use sanitized rendered text as a bounded label with the semantic ID as fallback. Do not advertise traversal of every Mermaid grammar or synthesize nonexistent nodes. The first batch can intentionally support the target sets actually exposed by the existing adapter, with an honest unavailable state for unsupported diagrams.

Reuse `transform/fit` at controller:40–41, render-generation fencing in `src/ui/diagram/session.js:4–25`, and existing prepare/resume/dispose hooks at controller:118–120. The same renderer survives attach/detach (`src/ui/windows/diagram-transfer.js:23–24`); a new independent floating UI is unnecessary.

Required boundaries:

- Walkthrough is view-local browsing, available in genuine readonly views; it never edits source/style/metadata, saves, rewinds history or opens Presenter. Focus decoration must preserve imported Mermaid colours/typography and must not enter saved or exported content.
- Start/step/overview use the actual current SVG. Clear or refuse stale targets immediately when source/render/generation changes, render fails, Refresh replaces content, presentation mode hides the preview, Lock prepares the view or it is disposed. Never navigate stale detached DOM nodes.
- Do not silently commit/discard pending Guided/Build/Style fields merely to browse. Preserve their exact text and all acknowledged save/version/hash authority. Toolbar state changes must not recreate the still-open Save/Attach hit-target problem.
- Scope keyboard arrows to the walkthrough/preview controls; never intercept editor typing, composition or application-wide presentation shortcuts. Announce current label/count and provide visible focus. Avoid motion or honor reduced-motion preference.

Proposed acceptance: real pointer/keyboard Start→Next→Previous→Overview on labelled/Unicode flowchart and a supported state diagram; empty/unsupported/invalid-source states; separate diagrams with independent traversal; unchanged full draft/history/saved project bytes and imported colours; pending fields preserved; source replacement and failed render invalidate targets; readonly browsing; attach/detach continuity; Lock/Close retirement. Run representative small/medium native bounds with shared light/dark/named themes and inspect actual screenshots. Those checks have **not** been executed by this analysis. The original packaged Save mis-target requires its own correction and original-oracle qualification, not relabelling through walkthrough success.

## Exact analyzed working-byte identities

These bounded hashes identify this static snapshot; Windows working bytes are not claimed equal to Git blobs. Parent's later Code changes are a distinct snapshot.

| Input relative to portable | Bytes | SHA256 |
| --- | ---: | --- |
| desktop/baseline/R78.html | 13,626,609 | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| docs/superpowers/plans/2026-10-06-siren-workspace-ui.md | 17,476 | `1a8ab87d3ad6bab18a1f18e75c3281c425f8fa66de7dc7a0663a8499b95f0abb` |
| docs/superpowers/plans/2026-10-07-siren-code-source-context-commands.md | 3,693 | `7b52e4955cfedeaa671d57ba601b40973288b056e1ff7743a2c30d1ee44e3e7c` |
| desktop/src/ui/windows/diagram.js | 22,300 | `df7ac8286ebb1ce38af4a2aca55350c2364498e19d437a6c154427d2298c02ca` |
| desktop/src/ui/diagram/style.js | 5,063 | `c8e6c2c2bb598e513e844ac526113efa1fa639a3ca84ba663895a09b243d04e4` |
| desktop/src/ui/diagram/session.js | 1,825 | `951506c1d8b0dfb55086c5b5e1f95cd8d6d78badb648faa9985e94d1f47bcd79` |
| desktop/src/ui/diagram/window.html | 9,036 | `fd9d9ba3e1a69515fbb22a9cffe3b1f393826d6a35c361d003719fe47c4d8424` |
| desktop/src/ui/shared/chrome.css | 8,493 | `5947b20b1d715a1e647b32e053f10a9f22d7cd79c81da095a592bdc7aff90077` |
| desktop/build/appearance.mjs | 7,136 | `efce6199f68e96dbd8e35a04f84793561b05386d51221af81b86f64f9873e9f0` |

Earlier reports/plans/checkpoints, current source and retained original hosted observations were reconciled. No fresh runtime parity, all-theme fidelity, physical multi-monitor usability, maximum capacity or fix claim is made.
