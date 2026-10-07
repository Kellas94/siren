# Docs Activity native harness amendment — independent narrow review

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07. Read-only source/diff review plus isolated promise-control-flow probe. No GUI, product/native execution, build or source/test modifications by this reviewer. This is not product qualification or an approval/release verdict.

Reviewed frozen `tests/native/docs-activity.mjs` SHA-256 `63f7fe40c7ad63fb5271c65e5cb9dc7c2a6c09e9b21b6b38054617be3e9a72f9`, independently hashed before and after my probe. Compared against the preserved immediate predecessor `evidence/workspace-surface/docs-activity-native-prepared/original-e5ea401d.mjs`, SHA-256 `e5ea401d2f3caf24a5cd4309216bffa10b3692204675f47e3588c40e7fa0e3d4`.

## Original outcome remains ABORTED

I read root's owner transcription `evidence/workspace-surface/docs-activity-native-second-abort-owner.json`, SHA-256 `25e2d6154e6945ffe083d78727b7d707e595f621d17f43ff2a145e68c1ed4d49`. It records the second actual invocation at `evidence/docs-activity-native/2026-10-07T03-38-51.863Z` aborting on `#replaceLatestDocument` hit-testing with exit1. It explicitly has no final receipt, verified case count or verified unchanged capture. The screenshots/owned data are retained; they do not supply the missing final receipt. I did not execute or independently observe that GUI run.

## Amendment assessment

The diff changes only the reload/confirmation line. The harness now sets the diagnostic `page` to the peer, closes the already-open Activity disclosure through its genuine trusted button, and waits for the panel to be hidden before clicking Reload. This is a meaningful ordinary UI route to reveal an occluded control. It neither deletes the peer nor calls a controller/DOM.click/direct reload implementation. The stale peer, failed Save, Lock rollback and exact unsaved title/heading checks still precede the reload. The explicit discard confirmation remains required.

The original reload click is still subject to `attachNativePage.click` stable pointer/hit testing and genuine CDP input. The harness still requires an actual Page.javascriptDialogOpening confirm event, uses the existing explicit Page.handleJavaScriptDialog acceptance, waits for the clean expected title, refreshes the reader to the real saved version, verifies changed saved comparison, and rechecks exact project/source state. The 20-second dialog bound is unchanged. There is no retry, force-click, DOM visibility mutation or relaxed assertion.

The formerly unobserved click promise now immediately installs both fulfillment/rejection handlers. Rejection becomes a typed outcome while retaining the exact error object; the polling loop throws an observed rejection promptly, and the later awaited outcome also rethrows any rejection arriving after the dialog event. Therefore that rejection reaches the existing outer catch/finally instead of remaining unhandled during the dialog poll. Setting `page=peer.page` improves failure diagnostics; restoring `page=working.page` afterward preserves subsequent scenario ownership.

I inspected the unchanged outer catch/finally: it records phase/error, best-effort diagnostics, closes the owned process, captures inputs and writes result.json. The amendment restores the ordinary error route to that code; this review does **not** claim result.json is guaranteed after process termination, filesystem failure, capture failure or a failure inside the unchanged cleanup itself. Those would remain distinct infrastructure failures, not invented completed receipts.

## Actual bounded probe

I extracted the amended promise/poll/confirmation fragment verbatim and executed it with finite fake transport objects, **not** the native harness or product. Three cases: rejection before a dialog, rejection after a dialog event, and successful confirmation. Both rejection cases reached catch with the exact original error; all three reached the surrounding finally; no unhandledRejection event occurred. This establishes the JavaScript rejection-routing property only, not whether the real Reload target is now hit-testable or the product passes.

Evidence under `evidence/docs-activity-harness-independent/`:

- `probe.mjs`: `88e151bb54459624617a00ba903dae77ea0da356b692ab1dc682e82815088ca5`.
- `probe.log`: `a18611bf30defdc26bf5263cacb1ff5397fb5bb418eafe0345623780f2055b71`.

No oracle weakening was found in this bounded diff. The amendment is a harness correction with its original failure preserved. Actual amended native execution and its final receipt remain root's next evidence, not a result supplied by this report.
