# Independent factual addendum: successful hosted menu/register traces

Author: `/root/native_menu_trace_review`, 2026-10-06. Separate addendum to `2026-10-06-native-menu-causal-independent.md`; the initial report is unchanged (SHA-256 `11926dde17b0b4b14ea7e516e5e88b946606666285fea2ea5fcfac081f7d861d`, rechecked). No GUI, product/test edit or rerun. This addendum is the only new authored file.

**Observed result:** retained hosted run `37524176999` has nine completed/success jobs, and its original packaged Docs and development intro receipts show successful event sequences. **Causal verdict:** these traces explain how those successful interactions proceeded; they do not establish the causes of the earlier failures in run `37521535159`, overturn their adverse evidence, or qualify the separate export correction.

## Inspected original identities

Paths are relative to `desktop/`, under `evidence/workspace-surface/ci37524176999/`.

| File | Independently calculated SHA-256 |
| --- | --- |
| `jobs-final.json` | `529bb09126ab07633e1dd3e31a9b52033997e5a8503fe323e16e091a2431aa78` |
| `desktop-packaged-evidence-original/evidence/docs-context-native/2026-10-06T20-16-14.125Z/result.json` | `b3dad568a3e358856da6ef199f39cdff543c6e22600f0a255d2f406d8605b936` |
| `desktop-native-desktop-evidence-original/evidence/guided-intro-2026-10-06T20-17-08.613Z/result.json` | `b14e47ae4800c7a5eb4a6c5861f3a3d5d55611f7ba1da4e8b50cb2e4ce939691` |
| `desktop-packaged-evidence-original.zip` | `22f128a4fafd9e76419e8c0817da12199ddd5be86fec61f49bcc85fa1ba259dd` |
| `desktop-native-desktop-evidence-original.zip` | `be19dc8a0ebf2b16d4839a4516eb6cdc24b6edf6fef8c8a62223e3d058863f1d` |

The two ZIP hashes also match their retained ZIP identity receipts. I read the local retained job record; I did not independently query GitHub in this review. Its nine jobs include the packaged, all three native groups, Desktop qualification and merge qualification jobs, all successful. This limited inspection does not re-audit every individual probe in those jobs.

## Packaged Docs: selection preceded submission

The original receipt is `COMPLETE`, with six successful cases and `changedInputs:[]`. Its `registerTrace` contains 79 events, below the observer's 120-event cap. Event times below are renderer `performance.now()` milliseconds rounded to one decimal; capture and bubble records are distinct observations of the same event, not extra user actions.

| Time | Actual retained observation |
| --- | --- |
| 196.6 | Observer installed: Status `''` (All), both `doc-a,doc-b`, select and Search enabled, active BODY. |
| 276.8-290.7 | Trusted pointer press/click on `homeDocsFilter-status`; focus enters that select at 277.2. Status remains All during the initial click. |
| 294.3-294.7 | Trusted `input` then `change` on the select, in capture and bubble; Status is now `approved`, select enabled, both original rows still visible. |
| 298.4 | Document observes trusted Enter `keyup`, still on the focused select, with Status approved. |
| 341.1-342.7 | Trusted pointer sequence on Search; focus moves to Search, Status remains approved. |
| 343.0 | Submit capture: Status approved, both rows present, controls enabled. |
| 343.4 | Submit bubble: `defaultPrevented:true`, rows cleared, select and Search disabled, Status still approved. This matches the product submit handler starting its asynchronous catalog load. |
| 396.8 | Next pointer press on Status sees only `doc-b`, Status approved, controls enabled. The first result assertion had already succeeded. |
| 414.4-414.8 | Trusted input/change restores Status `''` (All), while `doc-b` is still the displayed row. |
| 438.0-438.2 | Second submit captures All; bubble observes prevented default, cleared rows and disabled controls. The trace stops after this submission; the receipt's successful first case establishes the subsequent assertion that `doc-a` reappeared. |

All recorded non-installation register events have `isTrusted:true`. No document End key event, or Enter keydown, appears in this **successful** trace. The intended original End/Enter action sequence remains in the harness. Therefore absence of those document key events cannot, by itself, diagnose failed delivery to a native select picker. The trace directly establishes the resulting approved value and trusted input/change sequence; it does not inspect native popup internals or record the catalog IPC payload/response.

The copied package records source commit `7e0b8515761ba2060fbb2f7a0349ceb78d96afb5` and app archive SHA-256 `28c1186e1db719dd47b7b77b88f7a1edad2acdccc3cd3068eedb24a61823ad04`, 53,808,361 bytes. That archive hash/size is identical to the original **failed** packaged Docs receipt. Of its 17 recorded input hashes, 16 match the failed receipt; the only differing entry is the diagnostic Docs harness, now `7175dade0404b4138f3f76da3d90909573e355354c99382104922ce8e401bd86`, previously `7a6045471316b1a6b60c63e3974e00388fede1ebe7d8088021112379e25dbd6a`. In particular, Home UI source and generated Home are unchanged by recorded hash.

This establishes a successful observed execution of the same package archive with the diagnostic harness. It supplies no product-change explanation for the older failure. Host scheduling, native popup state and diagnostic observation work differ or are unmeasured; byte-identical package content does not make the executions identical.

## Intro: each menu survives to its item click

The original intro receipt records `completed:true`, `guided.editSaved:true`, explicit tour available, replay overview reached, and reduced-motion replay skipping animation while retaining overview. The host initially reports reduced motion true, so this specific replay branch does not claim animated replay. The dedicated first-paint fixture is a separate observation, outside this menu analysis.

Its recorded harness SHA-256 is `35520ae9e2b23b35cfb82cbeff22146ca0b2f7772678830a4e68c389512d634c`. Its build baseline hash `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` and renderer hash `fbf59fd11031f7eb11d6a7c50d831dcb9c704308bc4c11b47b6f758d6688f299` match the earlier failed intro receipt. The trace contains 95 records, below its 160-record cap.

Guided row mutations occur around 1433.9, 1783.1-1783.2 and 1912.1-1912.2. The last of these precedes the first header press at 2570.4. The trace records no subsequent structure-row mutation through its end at 4144.2.

| Header menu | Actual successful sequence |
| --- | --- |
| `structure-menu-1` | Trusted header pointer press 2570.4 and click 2574.6; expanded true and first menu-item focus by 2583.3; insertion observed 2583.6. Trusted item pointer press 2619.4 and click 2620.9 occur while that menu exists and expanded is true. Header focus at 2622.7 observes expanded false and no menu. Removal mutation delivered at 2677.3. |
| `structure-menu-2` | Trusted header click 3076.9; menu-item focus 3079.2 and insertion observed 3080.7. Trusted item click 3120.7 while expanded true; header focus 3122.5 sees it closed; removal delivered 3146.1. |
| `structure-menu-3` | Trusted header click 3841.5; menu-item focus 3844.9 and insertion observed 3846.5. Trusted item click 3889.9 while expanded true; header focus 3891.7 sees it closed; removal delivered 3918.0. |

Header pointer events sometimes record an empty target string because the clicked descendant has neither id nor class; the observer selected it through `closest('#headerMoreButton,...')`. The menu event target is the generic `struct-menu-item` class. The trace itself does not record the clicked row's index/text, so identification as the Guide action also relies on the unchanged harness selector and its successful guide-dialog assertions.

This event order is consistent with the inspected product item-click handler closing its menu and restoring header focus before opening Guide. Every recorded non-mutation/non-installation menu event is trusted and none is recorded default-prevented. Capture-phase click records precede product click-handler effects. Mutation delivery occurs after removal and must not be misread as the exact time of removal; header focus already observed the closed state earlier.

No menu disappears before its intended item click in this new trace. It therefore does not reproduce the earlier transient disappearance, identify its removal caller, or support blaming renderer-upgrade toast timing. The absence of structure redraws during these successful menus is a useful comparison, but there is no corresponding original adverse event trace to establish that a redraw occurred there.

## Retained limits

The earlier adverse evidence and the initial independent report retain their original status and hashes. The new successful traces support the observed value/focus/submission and menu-lifetime sequences above. They do not prove a fix, a deterministic root cause, or that observation is scheduling-neutral. If the original intro behavior recurs, a separately identified bounded close-caller stack/reason probe remains discriminating. If Docs recurs, compare pre-submit value and native focus before attributing failure to catalog filtering.

The new export correction is unrelated and was not inspected or qualified by this addendum. No merge, release or installed replacement is approved here.
