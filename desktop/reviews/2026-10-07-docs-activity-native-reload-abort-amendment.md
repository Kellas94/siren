# Docs Activity second native abort and bounded harness amendment

Analysis and amendment author: `/root/media_batch_review`. Actual second native executor and abort recorder: `/root`. This report does not approve the product or claim a completed native run.

## Retained abort

Root's actual second run used harness `e5ea401d2f3caf24a5cd4309216bffa10b3692204675f47e3588c40e7fa0e3d4` and allocated `evidence/docs-activity-native/2026-10-07T03-38-51.863Z`. The owner record `evidence/workspace-surface/docs-activity-native-second-abort-owner.json`, SHA-256 `25e2d6154e6945ffe083d78727b7d707e595f621d17f43ff2a145e68c1ed4d49`, records exit 1 and hit-test failure for `#replaceLatestDocument` in `attach-page.mjs:17` through this harness's `click` helper. Root observed no Electron/SIREN processes afterward.

I inspected that owner record and the retained directory. It contains owned data and two earlier screenshots, but **no final result receipt or Electron log**. There is no verified completed-case count or verified unchanged-input capture for this aborted invocation; neither is inferred here. Original ADVERSE3/47a8, its receipt, analysis and snapshot remain unchanged. A byte-identical e5ea snapshot is now retained at `evidence/workspace-surface/docs-activity-native-prepared/original-e5ea401d.mjs`.

## Source analysis

The original sequence explicitly opens the peer Activity during Lock rollback, checks its retained unsaved-content notice, then attempts the underlying Reload button while the overlay remains open. The existing absolute, z-index 40 Activity overlay can cover editor/conflict controls. The actual hit-test refusal is consistent with that sequence; no failing-peer geometry or hit-element observation was saved, so the exact intercepting element remains unproven. This does not establish a product reload, save, or Lock defect.

There is a concrete harness error in rejection handling: `confirm=click(...)` starts an asynchronous operation, but the original source waits through dialog polling before attaching its eventual `await confirm`. An immediate click rejection can therefore become an unhandled rejection before the outer try/catch awaits it. That explains why this mechanism can bypass the harness's receipt-writing catch/finally; the owner-recorded aborted invocation remains separate from a normal ADVERSE receipt.

## Authorized correction, frozen for root execution

New harness SHA-256: `63f7fe40c7ad63fb5271c65e5cb9dc7c2a6c09e9b21b6b38054617be3e9a72f9`. Node v24.16.0 `--check` completed with exit 0. Only the reload scenario line changed relative to retained e5ea:

- Set the observation target to the peer; genuinely click Activity closed and wait for its actual hidden state before Reload.
- Retain the same trusted Reload click, true hit test, actual confirm-dialog event requirement, 20-second dialog deadline, acceptance action and exact saved-version/content oracles.
- Attach fulfillment and rejection handlers immediately to the click promise. A rejected click records the original error in a fulfilled outcome; the polling path throws that same error, or the awaited outcome throws it afterward. Failures still enter the existing outer catch/finally; they do not become success or get silently ignored.
- Restore the first working observation page after peer reload, retaining the existing later scenario behavior.

No product, builder, generated or other test inputs were edited. Current controller `9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4`, window `0f27116fbb2e843b7586bae47939599c1e75794f43ebbcf196f68d34f444c652`, and generated Docs `ec39d7c0a9b6ddd33f1607cca6e9c23e3a5a351b39572ff4bd3ab9949375e91d` were freshly rehashed unchanged.

## Limited non-GUI probe

`evidence/workspace-surface/docs-activity-native-prepared/reload-promise-handling-probe.json` records two dependency-stand-in cases executing the exact extracted final promise/dialog block: immediate rejected click rethrows the identical error without accepting a dialog, and a successful click with a supplied dialog event reaches acceptance. Both completed and zero unhandled rejections were observed. Extracted-code SHA-256: `9b0a24945476d0821100180ceed2028e5e47ad83305fbf1bc3feecbb06286139`.

This probe verifies JavaScript handling only. It does not demonstrate actual popup transport, native hit-test success, root receipt durability after every possible failure, Lock behavior, product correctness, packaged/hosted execution or full eight-case completion. No GUI or native rerun was executed by this author; root owns the next distinct runtime receipt.
