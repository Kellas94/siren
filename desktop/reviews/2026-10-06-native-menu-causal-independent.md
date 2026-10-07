# Independent limited causal review: native menu and Docs register

Author: `/root/native_menu_trace_review`, 2026-10-06. Read-only source/evidence inspection; this report is the only authored file. No product/test edit, GUI launch, package build, native rerun, or release approval. Skill applied: `superpowers:systematic-debugging`, investigation and working/failing-example comparison only.

**Verdict: both hosted root causes remain UNRESOLVED.** The original intro failure does support a narrower concrete finding: its Guide menu control existed initially, then disappeared during the driver's geometry observation before the second pointer action. The original Docs failure supports an unchanged Status selection at the final screenshot, not a demonstrated catalog-filtering defect. Local observed passes, including throttled passes, do not establish either hosted cause or a fix.

## Original evidence actually inspected

All paths below are relative to `desktop/`. Prefix `E` means `evidence/workspace-surface/ci37521535159/`.

| Evidence | SHA-256 independently read from retained file |
| --- | --- |
| `E/desktop-native-desktop-evidence-original/evidence/guided-intro-2026-10-06T19-55-24.656Z/result.json` | `1d91657fef3eb5791a02ea543095e1ed2cc2677bd03d87c3c32da0458c91e508` |
| Same intro directory, `failure.png` | `d389b9ef76d7884f71eeb67666370d827a39590941c462d3b8164c2f061198e1` |
| `E/desktop-packaged-evidence-original/evidence/docs-context-native/2026-10-06T19-55-24.506Z/result.json` | `81b4fbefb0b081a84e4aa0400a90f810ef81155dea5cc914834d02322ddeddfa` |
| Same packaged Docs directory, `failure.png` | `af86b010f83f54e924f889ad32ee5d073f7d65ee7cab63fbbe3955d53470a726` |
| `E/desktop-native-diagrams-evidence-original/evidence/docs-context-native/2026-10-06T19-59-32.234Z/result.json` | `47a00539c589f1f076c6e61a199bc4ab05b86162fe1e52fcfff19cd6dd828d0e` |
| `E/native-desktop-original.log` | `a495d4cac602f1debbcaa9fd692b545b93d0f1d773d4a1a4b2ecafc42158fa78` |
| `E/native-diagrams-original.log` | `b734c05389042240f94399f0745683fc3eb0709eb064e9af3be23d440c516b28` |
| `E/desktop-native-desktop-evidence-original.zip` | `488b369abb341a8b48b4a256f7d5dd77041fa14d83bf51fccade44463b27971e` |
| `E/desktop-packaged-evidence-original.zip` | `0043b48b52fb66fcec4465ef39fcfb13bce5bbb15f2f5f8aa19beb30df0e83d2` |
| `E/desktop-native-diagrams-evidence-original.zip` | `ddd0cf68999dd2c187b8eb871e230f4f9b3947af340a66da223fbf240728965c` |

I visually inspected both original failure PNGs, read the original JSONs and relevant original log lines, and read the owner's adverse report/receipt. Original integration identity `d83bedc68e0025dd9050aa3bf7f093a2a74d0408`, canonical `67896f9bdd73cb8e08ef92e2a653263b7da649fa`, and tree `311e653a4734cbec6146d12449718d8283e924b6` are retained metadata; I did not fetch or independently reconstruct that integration commit. It is not available as a local Git object.

## Intro: transient removal is supported; its caller is not

The original JSON records the exact edited source and `guided.editSaved:true`, with normal/editable bootstrap. Failure occurs at original `guided-intro.mjs:67:44`, the second action in `click('#headerMoreButton'); click('.struct-menu-item:nth-child(2)')`. The screenshot has no header menu. It also shows the renderer-loaded toast, but contains no timestamped menu events.

The exception is **`Missing native control` through `waitForNativeCondition` at `drive.mjs:128`**, which comes from `stablePointerExpression` in `tests/native/pointer.mjs`. The preceding `click` step queries the selector and calls `scrollIntoView`; that step's absence error is instead **`Missing control`**. Thus, under the inspected driver, the second menu control was found by the initial query, then was absent by a later geometry observation. The failure is before dispatch of the second mouse press/release, rather than a Guide action that executed and failed to open its dialog. Geometry observation can run more than once, so the stack does not establish the exact removal frame.

This inference uses the inspected driver/pointer implementation, unchanged in `git diff fd20b76 -- tests/native/drive.mjs tests/native/pointer.mjs`, and the original matching error text/stack location. I cannot claim a complete immutable hosted harness reconstruction from its artifact: the intro artifact did not retain a harness hash.

The legacy product involved here is `baseline/R78.html`, not the separate modular `src/ui/diagram/guided-view.js` blur correction. Its independently calculated SHA-256 is `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`, exactly matching the original intro `build.baselineSha256`.

Relevant source facts in that baseline:

- Lines 26567 onward synchronously open a managed header menu; Guide is the second option in the editable list (also second in the read-only filtered list). The global `nth-child(2)` selector matches the current structure, but does not assert ownership by `headerMoreButton` or verify Guide text before clicking.
- Lines 32083 onward first close any previous global menu, construct and append the new menu, record its anchor and ARIA state, install an outside `mousedown` listener, and focus its first item.
- Lines 31999 onward remove the global menu and retire its outside/escape listeners. A historical stale-listener comment is not evidence that this already-corrected issue occurred in this run.
- `renderStructureEditor` at 33849 explicitly calls `closeStructureMenu` at 33867. This is a real product coupling: a Guided redraw can remove a header menu as well as a Guided menu.
- Other removal paths exist, including resize at 110244. The outside listener ignores the actual menu and its anchor; therefore one header click is not by itself a source-proven immediate self-dismissal.
- `startRendererUpgrade` at 35547 shows the toast and calls `renderDiagram`. Its visible direct sequence does not call `renderStructureEditor`. The toast does not prove that a Guided redraw, resize, or outside press caused the observed removal.

No original trace identifies the removal caller or rules out another menu replacement. The global selector also cannot retrospectively prove that its initial match belonged to the header menu, although that is the intended action sequence.

## Docs: the intended selection was not established

The packaged receipt is ADVERSE in phase `register`, with zero completed cases. Its wait for exactly `doc-b` times out after the original select/End/Enter/Search sequence. The final screenshot explicitly displays Status **All**; retained UI text includes both documents and `2 of 2 items`. This is stronger than the UI text alone, whose option list prints every status regardless of selection. The original artifact does not retain `select.value`, active focus, or input/change/submit events at each action.

Current `src/ui/workspace/home.js` SHA-256 is `226b9977a89edbe0383e401173b6f8ddf194adb88bebd1d76652d67d695df0c1`, exactly matching the original packaged and diagrams-job receipts. Lines 214-216 create an ordinary select with All (`value=''`), draft, in-review and approved. Lines 227-229 disable controls during loading and read nonempty field values when calling `getCatalog`. The submit handler at 252 resets rows and loads the next result. There is no filter-change auto-submit or intentional reset of the select value in this library sequence.

The native probe assumes clicking that select gives its native picker the subsequent End and Enter events. Its keyboard helper dispatches keyDown/keyUp to the selected page target, not to a DOM selector. The pointer driver checks geometry and hit containment, but does not assert `disabled===false`, active focus, option selection or popup ownership. Therefore successful dispatch is not proof that the picker adopted approved. A disabled/focus/popup routing explanation is a hypothesis only. In particular, ordinary initial load inserts its rows and enables fields in the same JavaScript continuation; the existing evidence does not establish a disabled-control race.

The same original run's diagrams job completed all six Docs cases using the identical original Docs harness hash `7a6045471316b1a6b60c63e3974e00388fede1ebe7d8088021112379e25dbd6a` and matching recorded UI/source input hashes. This supplies a hosted working comparison, not proof that the packaged path works: one case is copied-package execution and the other development execution. The packaged archive is explicitly `28c1186e1db719dd47b7b77b88f7a1edad2acdccc3cd3068eedb24a61823ad04`. I did not inspect its executable internals. No observed transition from approved back to All, no prevented key, and no wrong catalog request is retained in the original failure.

## Diagnostics and next discriminating evidence

At review, portable HEAD is `518a3306404c031f3b6c48a92e567efbd7a95712`. Reviewed diagnostic harness hashes: intro `a5670e07e8381dc915460421118674e8d8292e8cbfffe91c6bcd141969146d9d`, Docs `7175dade0404b4138f3f76da3d90909573e355354c99382104922ce8e401bd86`. Driver hash is `897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca`; pointer hash is `a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d`. These diagnostics preserve the single action sequences and success oracles; they do add observation work. They cannot be considered scheduling-neutral. Current listeners are bounded and capture product state without a retry-to-pass action.

First inspect the original retained event traces from hosted run `37524176999` when available. This review did not inspect that run's outputs and makes no prediction of its result. For intro, correlate header trusted press/click, insertion/ARIA expansion, focused first row, and removal/ARIA collapse. Capture-phase click state precedes the product's click callback; MutationObserver state is read at delivery, so one snapshot can reflect several queued mutations. Those distinctions matter when reconstructing order. A trace showing insertion and removal narrows the interval, but alone does not name the removal caller.

If removal recurs without an attributable outside press/resize, the useful next **separate diagnostic** is a bounded passive stack/reason record inside `closeStructureMenu` and `renderStructureEditor`, correlated with the existing timestamps and identities. Preserve the original one-click action, timeout and oracle; retain any diagnostic as a distinct instrumented build. This review does not authorize or implement that probe.

For Docs, compare capture/bubble focus, key, input/change and submit states, especially select value immediately before Search. If approved was never observed, investigate key delivery/picker focus before changing catalog logic. If approved was observed, inspect the submit value and request/response boundary before claiming filtering failure. Native popup handling may consume keys without document events; absence of a document key event alone does not establish that the browser failed to process it. Retain any additional observations without selecting options through script, extending deadlines or repeating user actions to obtain a pass.

The separately proven modular Guided blur-focus correction and unrelated main export edits are outside this review. Original hosted failures remain adverse. This report provides causal narrowing and next probes, not native, copied-package or CI qualification.
