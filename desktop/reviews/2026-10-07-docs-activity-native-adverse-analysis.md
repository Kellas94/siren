# Docs Activity original native adverse: bounded analysis

Author and artifact inspector: `/root/media_batch_review`. Native execution: `/root`. This is analysis of retained evidence and source, not a new execution, independent runtime approval, or product correction. No product, test, generated, or build inputs were edited and no GUI was launched for this analysis.

## Original outcome retained

`evidence/docs-activity-native/2026-10-07T03-33-14.131Z/result.json` is **ADVERSE**, with three completed cases and `changedInputs: []`. Its SHA-256 is `18372586c2baff424c879a5dc956d8ec358a69851f8efb1cac96686517931bbd`. It failed in `independent-windows-save-conflict` at `tests/native/docs-activity.mjs:87`, through `replace` → `click` → `attach-page.mjs:17`: `#documentTitleInput` was not hit-testable.

The original harness remains SHA-256 `47a8a1d739465aed7ae5ed638b29b59ef02bbc640dbbef33b82ffaa3caa25173`. I retained a byte-identical additional snapshot at `evidence/workspace-surface/docs-activity-native-prepared/original-47a8a1d7.mjs`; the earlier prepared b165 snapshot remains intact.

The three completed cases cover actual readonly record filters/cursors/deep and dangling jumps, bounded recorded provenance/comparison refusals, and working rich/image selection retention plus unapplied modal Context cancellation. They do not qualify the subsequent peer Save/conflict, Lock rollback/refresh, themes/docking, archive, or final Lock cases.

## What the evidence establishes

The phase explicitly opens the peer Activity, selects resolved comments, verifies the first working window still has Changes selected, and then immediately tries to replace the peer title without closing Activity. The peer diagnostic identifies window `b29996e8-b6a3-45a4-b82d-23cdecd113a5`, a ready writable `doc-a`, still clean, with resolved comments visible. All three readers show saved version `b920f0361c8983f6a8d2b443ecd024f8ea7e91fc538ae0dc077f6e6829537f7e` and entity digest `5d168f4c2f6221d8f194c05c7107d9a86c538e905713fac6264cfa08d6761305`.

The real pointer helper clips the target rectangle to visible viewport/ancestor bounds, computes its center, and requires `target.contains(document.elementFromPoint(x,y))`. The failed assertion happens before mouse press/release. `replace` awaits that click before Ctrl+A or text insertion, so this failure did not deliver peer title input, attempt peer Save, or exercise the later conflict/Lock oracle. Weakening the hit test would hide a genuine coverage condition.

The builder defines `.document-activity` as an absolute overlay with z-index 40, right 18px, top 112px, width `min(560px, calc(100% - 36px))`, and maximum height `calc(100% - 138px)`. At a 944px viewport its horizontal interval is approximately x366–926. The inspected screenshot visibly shows that overlay covering underlying editor content. Nonmodal means the editor stays mounted and uncovered controls remain usable; it does not imply pointer access through the overlay.

There is an observation limitation: `failure.png` and `result.observed` show the first dirty working window `b8d36c67-7e85-4a26-b702-459ff7779921`, because the catch path uses global `page`, while the failing call targets `peer.page`. The failure PNG SHA-256 is `f6c47196ba05eabc1f3edb327e82a6da42135cecf499d754bd16e84772da3ef0`. No exact peer title rectangle or its `elementFromPoint` result was retained. Overlay interception is strongly consistent with static bounds, the open-peer sequence, and the hit-test refusal, but the specific intercepting peer element is **not proven by saved geometry**. There is no evidence here of a product Save or CAS defect.

## Smallest recommended harness amendment

Preserve the original adverse receipt and harness. After the independent Activity state assertion, use a genuine trusted click on the peer `#documentActivity` button and wait for `#documentActivityPanel.hidden === true` before editing the title and heading. Reopen Activity before the saved/working comparisons. Keep all exact text, independent-window, source/project, save/conflict, Lock, focus, input, and deadline oracles unchanged. Do not replace pointer gestures with DOM clicks or direct value assignment, bypass coverage, or move product UI to make the fixture pass.

Use target-specific observation attribution for subsequent failures: set the observation target before a peer action, or retain an explicit operation page for the catch screenshot/diagnostic. This would improve evidence only; it must not alter gestures or failure criteria. If exact geometric causality is required before amendment, a separately authorized passive diagnostic can record the peer target rectangle and hit element without retrying input or changing the original outcome.

No amendment or rerun was made in this analysis. A future native run must be a distinct receipt; it cannot overwrite or reinterpret this original ADVERSE3.

## Inspected identities

These current hashes were freshly checked against the original receipt and match its captured inputs:

| File | SHA-256 |
| --- | --- |
| `tests/native/attach-page.mjs` | `9adda5678dc537c070fe9dc3c8911f7efa8ba37f81637f434c61fe7b8b3fb7bb` |
| `tests/native/pointer.mjs` | `a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d` |
| `build/windows.mjs` | `0936de4b266f348318ea44cad1d56d0224a73a3b2876079baa856188ff52d50b` |
| `src/ui/docs/activity.js` | `9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4` |
| `src/ui/windows/docs.js` | `0f27116fbb2e843b7586bae47939599c1e75794f43ebbcf196f68d34f444c652` |
| `generated/windows/docs.html` | `ec39d7c0a9b6ddd33f1607cca6e9c23e3a5a351b39572ff4bd3ab9949375e91d` |

Physical monitor UX, copied-package execution, hosted qualification, maximum capacity, and historical Save-to-Attach behavior are outside this analysis.
