# Native Diagram Walk through — independent caption recheck

Author: `/root/diagram_history_final_review`, 2026-10-07. **R1 is corrected in the reviewed source and bounded probes.** No additional concrete defect was found in this narrow correction. This is a separately authored recheck, not replacement of the original adverse report or native qualification.

## Reviewed correction

The actual helper now reads SVG `text` elements and Mermaid outer row spans, adding separators between rows/text elements while retaining the complete text of each row. It avoids duplicating inner spans or inserting spaces inside a styled word. The original SVG remains read-only; caption data is local plain text. At 250 admitted entries, the entry now says `250 blocks shown` and its tooltip explicitly identifies the admission limit.

I read the retained actual DOM diagnostic receipt `evidence/diagram-walkthrough-caption-diagnostic/2026-10-07T01-35-25.614Z/result.json`, SHA256 `e6725ee2887504fb3539342d1cff27d97c3a918048d28b0b772a6c559ba205c0`, including exact group outerHTML. Its one text element contains two sibling outer rows with nested inner spans: `Început` and `Ș😀`. That is direct retained native structure, not a guessed fixture. The diagnostic was authored/executed by `/root/media_batch_review`; I did not run GUI.

My separate `recheck-probe.mjs` parses that retained exact outerHTML with the installed parse5, supplies DOM-model text/selector operations to the actual controller, and asserts the exact output `Început Ș😀`. Additional actual probe assertions cover adjacent inline spans forming `Inline`, separate text elements, bidi stripping and guarded row/text tails. All passed. With single-character rows the 512-character accumulator stops after 256 row reads; the visible caption is at most 160 characters. These limits bound selected content reads/output. Native `querySelectorAll` still enumerates matching descendants before the loops apply their caps, and DOM textContent reads its selected subtree; this is not a benchmark or proof of constant work for an arbitrarily large SVG.

## Actual checks

Executed the same seven-file scope as the original review: `node --test tests/diagram-walkthrough.test.mjs tests/diagram-walkthrough-window.test.mjs tests/diagram-session.test.mjs tests/diagram-draft.test.mjs tests/diagram-history.test.mjs tests/diagram-history-view.test.mjs tests/diagram-style-view.test.mjs`. Result: **39 PASS, zero failed/skipped**, exit0. Independent retained-structure probe also exited0 with all assertions passed. No product, tracked test, builder, generated renderer or native harness was modified by this reviewer.

All ten captured input/report identities remained unchanged across these checks. Helper SHA256: `c6623d7681ad2613f073dadc19734f5dbb16f779a6184cdff6ea6367015697c3`; focused helper test SHA256: `d0280755986813fcb32303bd1f19417afd66e27d78d66b9b636a66d7d998ec92`. Session, native controller, HTML and builders retain the hashes reviewed in the original. The original report remains byte-exact SHA256 `58c5384fbd127ea79a9f60e935343c56e81931f0a395ba34ad198f899b5db6e1`.

Evidence under `evidence/diagram-walkthrough-independent/`:

| File | SHA256 |
| --- | --- |
| recheck-inputs-before.json | `b59549112c1c8e9f534a4041b9cfc0a044c00ce944f27a1712de8ada2c4941b1` |
| recheck-inputs-after.json | `81224bbe8c8385f28712ea96a98f952c938ae8717690f1fa9d354b5468f895e6` |
| recheck-scoped-tests.log | `f830c0dcf3ab6d13e562b7ba36a8428978f93f705d5d129301581ed064dfe861` |
| recheck-probe.mjs | `45e0ba378ef8d7e2c964d0c71b25f4d05152015d488f594828517dfc5553d2b6` |
| recheck-probe.log | `270038e7d0af3e04e082a126c97f82ceb19bfbbdea220f31f60f4afd523a6490` |

## Limits

This clears the original label finding at source/model level against the retained actual SVG structure. It does not claim a corrected native run, real focus/blur behavior, cross-window/dock geometry, common Lock, export equality, build/full-suite, copied-package, hosted or release qualification. The original ADVERSE0 receipt and its zero completed cases remain historical evidence unchanged. Keep the original native Unicode oracle for subsequent actual execution. Original hosted Diagram Save/Attach mis-target remains OPEN.
