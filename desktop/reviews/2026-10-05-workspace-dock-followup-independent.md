# Independent follow-up — corrected docking integration

Author: Codex independent review agent `/root/workspace_surface_review`, separate from root/implementation author.

Date: 2026-10-05. Target: uncommitted integration relative to HEAD `437bfd7b670b2e1c6a3af5c08d72c3d85cd0b560`.

Scoped source verdict: **No remaining actionable finding identified in the corrected integration reviewed below. Both initial P2 findings are closed.** A minimized-window regression identified during this follow-up was separately corrected and verified as documented below. Native qualification is limited to the attributed receipts; this is not a whole Task 4 or release PASS.

The initial CHANGES REQUIRED report remains unchanged at SHA-256 `389432fe1e35c82dda57f842b3bfa2ac466ea8a7f0f87705f3fdf04fbcca71d0`. Its findings and original hashes are preserved. Neither foundation report was modified. This reviewer edited only this new report and did not edit product/tests/build/scripts, start Electron, create agents, or commit.

## Exact reviewed SHA-256 snapshot

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`. The final surface hash below includes the minimized-client-area correction.

| File | SHA-256 |
| --- | --- |
| `build/renderer.mjs` | `18568c61299531d1ecda92be67373a46d2ef740428709cf7c36167fb9429899b` |
| `build/workspace.mjs` | `779c7280d80addf24bc31c6f2b33d222e8658af7876fc19f01dcd201ae3d7a4c` |
| `scripts/package.mjs` | `6bbc5506c1161005e2c3b46c68b59ed790ee3a3f87666f22a46faeb9c696a746` |
| `src/main.mjs` | `244cd8ecb1590ca1414a5a38bea68baa080a3d32ea3d60c01d8f2959a6581227` |
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
| `src/windows/layout.mjs` | `89117e479be516b674abd2b4aee3babb7aa58ac8c54ad79401c8cb288f20ca45` |
| `src/windows/preload.cjs` | `9beb8c60916657b12238f7704c4c020daa809838acd361072bf928f582893042` |
| `src/windows/presentation-ipc.mjs` | `9141a114c6974978cbd020c61951de18fefab1bd432b731827590cb36f27af77` |
| `src/windows/registry.mjs` | `fbb41c71f4ce26bdd456afc1ae59ec412622dec6ce29d2eda756a11e99a32c3f` |
| `src/windows/surface.mjs` | `c8c1ad80b087911a33a3ca38276f507079524d69f9690b28a444d1312a3d9cde` |
| `tests/window-views.test.mjs` | `2897fbb3f2659d581ba3af8e89d58dd9a8b4f915b7b8915bbc5277466cee11d7` |
| `tests/window-layout.test.mjs` | `58388e88e7865f3749a045ab43ea3d1426ca418ee5af6f8cab01ca672a75c0d0` |
| `tests/workspace-surface.test.mjs` | `1397f1d8a753817ac9b20ed3045979b45b593ff7c6e66ea4e1fe4fdf975197d6` |
| `tests/native/native-keyboard.mjs` | `251561e232148cafbf79a339bf9dcd54d2872450a818f1f304bbf470aff62d6f` |
| `tests/native/workspace-dock.mjs` | `5e964ce133db3a321998134fcf48dcf958a82d71259a473cdf1be09e88ce3ce6` |

## Initial P2 findings — CLOSED by independent rerun of original probes

I extracted and executed the exact JavaScript probe preserved in the initial report, unchanged except replacing relative imports with equivalent absolute file URLs to permit a temporary data-module execution. Actual registry/surface/dock IPC ran; native handles alone were doubled.

- Post-roster resize now matches `{x:0,y:48,width:1120,height:652}` after release and focus. The resize is still refused during the frozen roster. Current surface focus remeasures the authorized parent's client viewport. Main's next trusted successful shelf refresh, after transition guards open, also calls `resizeAttached`, so visible and hidden attached views catch up suppressed events.
- A stale attached peer now refuses incoming attachment before native ownership/visibility changes. Incoming Code remains detached, primary host retains one child, and only that previous child is drawn. Registry preflights the attached peers before movement and before selection mutation.

These are the original adverse triggers rerun, not merely newly authored regression tests passing.

## Attached monitor origin and exact native projection

The layout controller now captures the original attached shell's real grant before mapping movement to the visible primary host. It retains that association and rechecks original grant, handle, placement, main frame and display topology after native waits. It does not derive renderer authority from the host's BrowserWindow association.

An independent temporary probe using the real registry/surface/layout moved an attached Code origin's actual host to the negative-coordinate display, keeping the shell attached. Replacing the original attached renderer mainFrame at the same URL before consuming the ticket refused movement with zero host mutations:

```json
{"stale":false,"moved":true,"hostBounds":{"x":-1500,"y":80,"width":1000,"height":700},"hostMutations":2,"surfacePlacement":"attached"}
{"stale":true,"moved":false,"hostBounds":{"x":100,"y":80,"width":1000,"height":700},"hostMutations":0,"surfacePlacement":"attached"}
```

Windows projection keeps the requested DIP rectangle unchanged and computes an expected readback using Electron's public DIP-to-screen-to-DIP roundtrip. Completion requires exact equality against that projected rectangle across native turns. Unsafe/noninteger/out-of-workArea projections refuse before native sizing. There is no general pixel tolerance. The new focused test checks both exact projected completion and unsafe projection refusal while confirming the originally requested size remains unchanged.

I inspected retained `workspace-dock/2026-10-05T17-22-12.065Z` ADVERSE evidence: requested width 1120 corresponded to native readback 1121 on the configured 1.5 scale display; the public conversion roundtrip also yielded exactly 1121. The original adverse run remains adverse. Current projected completion is separately attributed below.

## Additional minimized-window regression found and CLOSED during this follow-up

During this review, the earlier focus remeasurement at surface hash `694da7...` measured before restoring a minimized BaseWindow. My independent native-boundary probe returned a minimized client viewport of 0x0 and reproduced `{focused:false,restored:false,stillMinimized:true}`. This was initially a local-code finding with the real Windows condition unproven; parallel OS focus interference was not accepted as its cause.

Root's unchanged isolated `evidence/dock-minimize/probe.mjs` and before/after records were inspected. Actual Windows minimized client bounds were `{-32000,-32000,0,0}`. The earlier source refused focus and remained minimized. With current `c8c1ad80...`, actual focus succeeds, minimized is false, and restored client dimensions are 884x585. The probe explicitly qualifies owned geometry only, not production caller/save authority.

Current surface focus checks authority first, restores, rechecks authority/ownership, then measures and focuses. I independently tested both normal restoration and trusted policy retirement during the restore callback:

```json
{"retireAtRestore":false,"focused":true,"restored":true,"shown":1,"stillMinimized":false}
{"retireAtRestore":true,"focused":false,"restored":true,"shown":0,"stillMinimized":false}
```

The actual production WindowFocus solo run `2026-10-05T17-27-23.541Z` remains ADVERSE at the same first minimized-Code case. The later root-owned `2026-10-05T17-31-13.295Z` is COMPLETE with nine cases; every captured input hash matches its after hash and current source. This closes the observed runtime restore regression without attributing the earlier failure to speculative focus interference.

## Tests and probes I executed

Initial follow-up command:

```text
node --test tests/window-views.test.mjs tests/window-layout.test.mjs tests/window-focus.test.mjs
```

43 passed before the minimized-window correction. Final current-source focused command:

```text
node --test tests/window-views.test.mjs tests/window-layout.test.mjs tests/window-focus.test.mjs tests/workspace-surface.test.mjs tests/workspace-surface-registry.test.mjs tests/workspace-surface-factory.test.mjs
```

**72 passed, 0 failed**, exit 0, including the new minimized 0x0 restore regression. Additional independent temporary probes are documented above. I did not start Electron. No full-suite execution is attributed to this reviewer.

## Runtime receipt qualification and explicit limits

All actual Electron/production native runs in this review are root-owned executions inspected through artifacts, not executions initiated by this reviewer.

The `2026-10-05T17-24-33.196Z` docking run had COMPLETE five cases with unchanged captured inputs, including exact native contents/frame/DOM/draft/selection, two Code/two Docs and 12 attachments, drawn exclusivity, real attached Undo/detached Redo with exact immutable source bytes, host resize/explicit Docs save, native A/D/Main/Cycle routes, configured cross-DPI monitor movement of the visible host, and common Lock. After the minimized-focus correction its old surface hash is historical; it cannot alone qualify the final `c8c1ad80...` surface. The prior 17-25 Docs/Code runs and 1046-test suite are likewise pre-correction evidence.

Final current-source receipts inspected by this reviewer:

| Root-owned receipt under `desktop/evidence` | Observed result | Captured inputs checked against after and current files | Result JSON SHA-256 |
| --- | --- | --- | --- |
| `workspace-surface/full-suite-2026-10-05T17-31-27.083Z` | COMPLETE; exit 0; 1047 passed; zero failed/cancelled/skipped/todo; 183735.5283 ms | 417; zero mismatches | `0557563ecc12cc594174793b268ca5137db11146673a09a4cba2406661b82736` |
| `window-focus/2026-10-05T17-31-13.295Z` | COMPLETE; all nine cases `ok:true` | 13; zero mismatches | `59c34ec401134db6ca06fe553e0271483371f99564c4e0d1f7c1421f1666fa94` |
| `workspace-dock/2026-10-05T17-32-18.973Z` | COMPLETE; all five cases `ok:true` | 21; zero mismatches | `68c832619291d8c9b9898eca19dd78cb31eb042cbc2b001f3453b9eaaa6b07f7` |
| `docs-edit/2026-10-05T17-33-15.554Z` | COMPLETE; all four cases `ok:true`; 300000 lines | 28; zero mismatches | `70a0d479753c9d737e445e5d37151866975cd3894988421e2cf0aa15de511ec6` |
| `source-edit/2026-10-05T17-34-10.297Z` | COMPLETE; all four cases `ok:true`; 300000 lines | 16; zero mismatches | `5d4fd57656a0cac880f9c7521ca2333e8df0a5bf7fbbd131968aa674f9f5d195` |

I inspected the full-suite log's final test counts and verified its SHA-256 against the receipt (`dc6d5d45ab715c554d0a1d5e4fd865ed395424899b494c65f96a7fb8de60ce7f`). Its `changedInputs` is empty. I compared every captured input in each receipt against its after value and the actual current file, not only the surface hash. All 26 reviewed-file hash rows above were recaptured and matched at finalization.

The final docking run repeats the five-case scope described above on the corrected surface, including 12 same-renderer attachments, exact Undo/Redo and retained source, native routes and configured visible-host monitor movement, plus common Lock. The final Docs run additionally covers actual working Docs Close/reopen, conflict/confirmation, and failed all-view Lock restoration; the final Code run covers large-source edit/save, Close/reopen and common Lock. These are the named observed cases, not exhaustive guarantees. Earlier ADVERSE artifacts and historical positive artifacts remain separate and unchanged.

This scoped review covers the implemented same-renderer attach/detach integration and examined authority, visibility, focus, geometry and awaited retirement paths. It does not certify whole Task 4, a production release, a packaged distribution, human physical-keyboard input, physical display-disconnection/hotplug, every possible OS/DPI arrangement, or exhaustive dirty-save/Lock failure handling. UI/source/security claims remain bounded to the reviewed files and observed cases. Evidence existence and a clean scoped review are not user approval.
