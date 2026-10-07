# Diagram pan harness — independent original review

Author: `/root/diagram_history_final_review`, 2026-10-07. Read-only harness review and extracted assertion-block probes; no GUI, product execution, build, native run, source/test edits or qualification approval.

## Finding R1: failed endpoint evidence is discarded

In original `tests/native/diagram-pan-release.mjs` SHA-256 `5ecee7c3ac63b8ba0e2a306702bce5d4584c17b26f7291d370dccd5d5fc63c43`, the endpoint receipt is read from the actual page, but appended to `result.panReleaseReceipts` only after all transform, event-order and coordinate assertions. Any failing new oracle skips the append. The final ADVERSE record then lacks the precise events/transform already collected, recreating the original pan diagnostic gap.

My actual extracted-block probe supplies two explicit adverse transport responses: wrong transform and wrong event order. Both throw the real assertion, and both leave retainedReceiptCount zero. These are controlled harness responses, not native pointer execution. Record the receipt before assertions while retaining every assertion unchanged.

The original document-wide recorder also has no event cap and removes listeners only after successful receipt readback. Bound its entries, count/assert overflow, and guarantee listener cleanup on transport/assertion failure. Cleanup failure must prevent a COMPLETE verdict; recording it and then continuing to success would not be sufficient. These changes concern evidence integrity, not product behavior or weaker acceptance.

## Original preview amendment is appropriately catch-only

The original preview `179025344c089b855a2314e85f0b89b808cfa9b7f13a538f2c970bde33b0ead9` is preserved at `evidence/workspace-surface/diagram-preview-original-before-pan-observability.mjs`. Amended preview SHA is `c0945ed15b6c9a07e7bd27cbcfb502b9cea4946f4a57d6e8f9b9a4d6c27355ee`.

The only diff adds per-target failureGeometry inside catch, after the original failure and screenshots. My probe verifies the entire prefix before catch and the final finally block are byte-identical. No successful-path action, oracle or deadline changes. New readback contains transform/computed transform, viewport rectangle, zoom, focus, devicePixelRatio and target ID; it adds no source, DOM text or private field values. Because readback follows screenshots/attachment, it is a later observation, not event-time proof or root-cause attribution. Earlier catch collection could fail before this new observation; original ADVERSE/error retention remains intact.

## New regression meaning and limits

The new harness copies original assertions/actions, then inserts genuine CDP no-move and partial-move endpoint scenarios after the original pan oracle. Each uses actual Fit, viewport coordinates and pressed/released input; partial movement is (20,10), release is (45,25). It requires exact final transform plus exact delivered event-type order and endpoint delta. No controller invocation, direct style write, retry or relaxed geometry threshold replaces the product behavior. It does not prove physical coalescing or historical hosted causality.

The new scenario changes later pan state but leaves it at the same expected (45,25), so subsequent original splitter/theme/source/Lock assertions remain meaningful. The original ordinary-pan oracle still runs first and can fail before either new case. The new recorder is installed only for each added scenario; it does not perturb that first original pan sequence.

## Snapshot and execution disclosure

Initial inspection read and hashed original `5ecee7…`. Root corrected it concurrently after receiving R1; my later filesystem capture therefore contains intermediate `f8a2dcc92bba852ae86606b284788e5653e82cc65dff559f1b810b700d43ea05`, not an unchanged original input set. The first probe setup failed because it expected the original code shape in that concurrent snapshot; this is retained as `probe-setup-mutation-error.log`, not counted as a product failure. I then used root's byte-verified preserved original `diagram-pan-release-native-first.mjs`, retained my own exact original copy and successfully executed the two adverse probes against it.

Evidence lives at `evidence/diagram-pan-harness-independent/`: original and intermediate snapshots, inputs-before.json, probe.mjs, probe.log and probe-result.json. The original and amended preview hashes remained as above. Corrections require a separate recheck; this report is immutable original evidence, not a verdict on the later harness. No native qualification or historical pan cause closure is claimed.
