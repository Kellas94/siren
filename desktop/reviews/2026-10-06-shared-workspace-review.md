# Independent shared workspace review — 6 October 2026

Author: `/root/shared_workspace_review`. Scope: whole uncommitted desktop shared-workspace change against `e2f8b20ef58f41ee88f517a710c6f2df6b4b9d09`, before the parent agent's correction pass. This is a review of an in-progress implementation, not full reference parity, release approval, a hosted PASS, or copied-package qualification.

## Scope and provenance

I inspected the tracked diff and the new appearance contracts/store/IPC, build/appearance.mjs, shared shell/search JavaScript and CSS, Home guide, semantic Docs reader, and new appearance/admission/native probes. Related main/navigation/catalog/registry/surface/preload/build/package code was read for causal analysis. I read the approved implementation plan and reference comparison. The original R78 theme controls and applyTheme behavior were inspected directly.

I did not edit src, build, tests, scripts, generated or the frozen baseline. My only durable repository deliverable is this report. Verification builds were directed to `C:/Claude/SIREN_WORK/tmp-shared-review-20261006/`, outside the portable checkout. There were initial temporary-output and Windows Electron ACL launch failures; no application permissions or production source was changed to overcome them. The successful hidden fixture ran via approved elevated execution. Its final browser profile was explicitly inside temporary output.

Independent verification performed:

- `node --test tests/appearance.test.mjs tests/home-entrypoints.test.mjs tests/native-admission-receipt.test.mjs tests/workspace-surface.test.mjs`: **23/23 passed**, exit 0. This is my targeted unit execution, not the parent's full/native execution.
- A hidden Electron/Chromium fixture built native entrypoints into temporary output, and wrapped the frozen R78 with the actual new addDesktopShell. It used mocked get/set appearance IPC, never a production native grant. It measured Docs at 480/600/760/800/900px and exercised original Studio theme selection and long-prompt rendering. Result: `C:/Claude/SIREN_WORK/tmp-shared-review-20261006/result.json`.
- An independent Node catalog probe called the actual NativeWindowCatalog with an explicitly mocked workspace owner and a single named diagram/deck. Result: `C:/Claude/SIREN_WORK/tmp-shared-review-20261006/catalog-result.json`.

The mocked fixture establishes renderer/layout behavior and catalog semantics. It cannot prove native authentication, Lock/save coordination, source version durability, complete project retention, actual module transitions, or package/update integrity.

## Critical

None established in this review. This does not mean all races or security properties have been exhaustively proven.

## Important

### I1 — Studio's existing theme controls remain separate from the native preference

Location: `desktop/src/ui/shared/shell.js:37`, `:45`, `:52`; integration into Studio at `desktop/build/renderer.mjs:256`. Existing reference behavior: `desktop/baseline/R78.html:25460` and `:80531`.

The new shell only bridges codeTheme, documentTheme and diagramTheme. Studio still has themePreset, themePresetMobile and its theme menu, whose applyTheme changes state.theme, body.dataset.theme, the old selectors, and schedules a workspace save. The shared chooser also does not update those existing Studio controls/state. Its signature cache returns early for an unchanged native ID, even after Studio has changed body.dataset.theme.

Practical effect: the common chooser and the old Studio controls can show different themes; choosing a Studio theme does not update the native-owned preference or other windows. Existing local Studio initialization can also overwrite the applied body theme while the shared chooser still reports the native theme.

Own fixture, with fresh temporary browser profile and mocked native preference KPMG Blue: after startup, themePreset/body were dark while shared chooser/native preference were kpmg. Selecting sakura through the original themePreset left body/preset sakura and shared chooser/native preference kpmg after another 1.5 seconds. The fixture wrapped R78 directly, so the startup observation is not a production-main reproduction; the missing integration and user selection mismatch are established by both code and the fixture.

Required correction: bridge all retained Studio theme entry points to the native appearance owner and synchronize retained selectors/state without creating a recursive save or changing imported diagram colours. Add a production Studio probe that selects both the new chooser and a retained Studio theme control, then checks Home/native persistence and rendering.

### I2 — Global Find cannot return a Present result

Location: `desktop/src/ui/shared/search.js:19`, integration with `desktop/src/windows/catalog.mjs:40-42`.

Global Find calls getCatalog without a role filter. NativeWindowCatalog only emits presenter rows when the request role is exactly presenter; an unfiltered request emits each saved diagram as diagram. The new Find dialog advertises Diagrams, Docs, Code and Present and has a presenter label mapping, but presenter rows are unreachable in this flow.

Practical effect: finding a saved deck by name opens its Diagrams view, with no way to select its native Present entity through global Find.

Own catalog probe with one entity deck-one named “Find this presentation”: global query returned `{role:'diagram',entityId:'deck-one'}`; the same query with role presenter returned `{role:'presenter',entityId:'deck-one'}`. This uses the real catalog method with mocked admission and establishes the result-role gap without claiming an actual presenter grant.

Required correction: include an explicitly identified Present result in the bounded global catalog/search flow, while retaining exact native entity/version opening and metadata-only disclosure. Test the result selection into the real native Presenter role.

## Minor

### M1 — Long agent instructions are silently shortened in the semantic reader

Location: `desktop/src/ui/docs/reader.js:32`; accepted editing limit at `desktop/src/ui/docs/structured.js:17`.

Prompt text is clipped to 24,576 characters without an excerpt notice or a More control. The editor accepts valid prompts up to 200,000 characters. Other reader limits, such as rich HTML and checklist limits, do announce their bounded display.

Own Chromium probe: 24,594-character prompt ending REQUIRED_END_GUARD displayed exactly 24,576 characters; the final guard was absent; caption was only “Documented instructions · Not executed”; there were no visible expansion buttons. This is a display problem, not source modification or execution. Raw block fields remain available in the existing field browser, but the reading surface does not explain that the instructions are incomplete.

Correction: label the excerpt and provide bounded expansion or a direct route to complete preserved text. Preserve the no-execution boundary.

### M2 — The new Docs reading surface is excessively narrow at the minimum detached width

Location: `desktop/src/ui/shared/shell.css:15`, `desktop/src/ui/shared/chrome.css:24`, and the fixed 180px outline at `desktop/build/windows.mjs:39`.

The shell adds 18px body side padding on top of the existing 18px main padding. The 180px outline and content padding remain fixed at 480px. Own real Chromium measurements: content border-box 214px; actual reader width 156px. At 600px the reader was 276px, then 436/476/576px at 760/800/900px. The shared navigation itself fit all five tested widths without horizontal page overflow.

Practical effect: headings and ordinary prose wrap into a thin column in a supported detached size. This is a usability concern, not an inaccessible button or proven data loss. The fixed outline predates this change; new nested shell padding aggravates it.

Correction: reduce nested side insets and collapse or compact Contents at narrow widths; inspect the actual reading viewport rather than only total document scrollWidth.

## Boundary analysis and declined-to-judge items

- Main appearance admission rejects locked/transitioning callers before capture. invokeShell only permits workspace/docs/code/diagram/presenter, and rechecks current admission after awaited reads/writes. Native capture owns project context. Audience has no shared-shell asset insertion or sirenShell exposure. I found no new Audience private-data grant in this source review; I did not independently execute the production Audience/Lock flow.
- AppearanceStore serializes writers and performs a current/writable check at the atomic rename boundary. Corrupt preference reads fall back through invokeShell, while writes preserve/refuse the corrupt record. The targeted tests support these boundaries; exhaustive filesystem mutation races are outside this review.
- Every project-bearing new shell navigation calls services.goHome even when Home is already loaded. That route uses the existing all-workspace preparation/receipt coordinator and reloads Home before sending the module event. Empty first-use Home has no project-bearing save preparation to perform. This is a source assessment, not my native save PASS.
- Native host reservation is 54+48=102px; the same WebContentsView is attached/detached, and attached private bars are suppressed. Own surface units passed. I did not independently repeat the real production docking/native monitor cycle.
- Package and protocol additions permit exactly assets/shell.js and assets/shell.css. Builders add exact CSP URLs and SHA-384 SRI; package collection includes both names and the three native appearance modules. No broad asset folder was introduced. Targeted Home tests exercise exact URLs/SRI and rejection of query/encoded/other paths. I did not qualify a current copied package or updater installation.
- Reader HTML goes into an inert template, then only finite safe tag names/text are copied without source attributes. Executable/resource-bearing nodes are refused. This static assessment and the parent's prior hostile-HTML evidence do not amount to my own production hostile-HTML native execution.
- Global catalog lookup remains name metadata and literal normalized substring matching; selected entity/source version is passed to existing native openView. No code/document body scanning was introduced. Missing Present results are recorded above.
- I decline to judge full Docs authoring, images, comments, releases, presentation authoring, broad exports, free positioning, or full screenshot/reference parity as delivered. These remain open implementation scope.

## Other qualification evidence — explicitly not my executions

The parent reported fresh current-source Home library search COMPLETE 7; role privacy COMPLETE; workspace appearance COMPLETE 6; Docs reader COMPLETE 2. I did not rerun or certify these as my own. Earlier supplied native evidence at workspace-appearance/2026-10-05T22-49-03.171Z and docs-reader/2026-10-05T22-49-05.043Z predates later refinements.

The parent reported workspace-dock ADVERSE at native/workspace-dock.mjs:55, immediately asserting minimized=false after a renderer click. drive.click returns after input dispatch; the shelf action awaits IPC asynchronously; surface.focus issues restore/show/focus without proving a native restored-state acknowledgement. Therefore this failure alone does not establish a restore implementation defect or a harmless test race. An eventual native restore-state wait plus the action outcome is needed; retain the original failure. I did not rerun that native failure.

The parent also reported a full-suite ADVERSE result of 1055/1064 with unchanged inputs: eight actual-main VM harnesses omitted the new imports and one host-height oracle retained 48px. Those are reported provenance, not my verification or a ruling that all nine failures are harmless.

Hosted run 37378765868 on earlier canonical a2c5 remains FAILED. No fresh hosted PASS, release, or current copied-package approval is asserted here. This report does not certify the parent's subsequent correction pass.

## Reviewed source identities

Hashes recorded before the parent's correction pass:

```
src/ui/shared/shell.js  7e1696244a792f15b363dc88097f20fb78e5417d713a12d1b4581312349b2dfc
src/ui/shared/search.js 2cd5a4df3d36132f14a6f2c63ada1651619c8f75b60a4954945f3e6925c3cf12
src/ui/docs/reader.js   ba0a15c07f74af080cac3c957621985dd66d98139512ec579602333f3e25d30b
build/appearance.mjs   7cd3ea37c42f00bae1343c8757cbf501036622768efb91dfd17e23264e023d03
src/appearance/ipc.mjs a734cfb2aa0ced3f985a739b1bbcb7e57b1c2cbf3f9e63d02d2da38b80f811a8
src/appearance/store.mjs 77a00d4170921d6e4d7ae130c6d687f82466fafaaa370e1aba0a8774a99e4ca4
temporary assets/shell.js 5a2c12c6b418b74c4eea346f9270f53e0e92952029aebe8055f0e5f27152067c
temporary assets/shell.css c22816c5b5f4f4f5ba67086d7e87bf5d1d403a30add776b2488d53c45e07fa8e
```
