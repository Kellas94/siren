# Independent process-deadline package addendum — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. This is a separate recheck of the new development artifact. The CI20 diagnosis, earlier packaged reports and all failed receipts remain unchanged. No product or test edits were made during this run.

**Disposition: the source-tied development package with the bounded ten-second process inspector passed the actual packaged regression. The original CI20 failure cause remains unconfirmed; this result does not establish current CI green or production release admission.**

## Executed source and archive

Package root: `desktop/dist/development-88b278e9-a3b1-4676-bd8c-b819bf30f8c9`. Its build receipt identifies committed source `6b1e46f8d4d1c7637f9d50bd478aad6822aac3e8`, kind development-preview and release admission false. The probe verifies the copied archive before launch and the copied runtime afterward against that receipt.

| Artifact or inspected source | SHA-256 |
| --- | --- |
| `app.asar`, 14,276,909 bytes | `50d3fabd91ae871bdeb5e72c23709f209520b57b51d9a85335f7f0128aa8fe6e` |
| Renderer, independently extracted from archive | `240a2b60f014d2be861c608b265e024b91373c12dfdda6fd580b4ff2abc2aca6` |
| `src/recovery/processes.mjs`, independently extracted from archive | `5fce0c2e0a733d41daf1c4fa5fbbbfbdb1b9f7e2e170dd653f5c58c3295e9e1b` |
| Main source, independently extracted from archive | `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63` |
| Runtime binary, unchanged | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Committed native packaged test, unchanged | `856447dce1b8044a0380316ae6433a0c5c4eb4266a8b26a67ca7d2f7e5a851e6` |

The extracted process helper exactly matches the source tested in the separate independent CI20/deadline review. Its finite 10,000 ms deadline and trusted optional failure metadata do not change the query/identity fields or unknown-to-readonly behavior. The main source retains the previously source-inspected damaged-selection `localAccess:true` metadata correction; the renderer remains unchanged.

## Independently executed packaged result

`node tests/native/packaged.mjs <this package root>` completed with exit 0 and completed:true at `desktop/evidence/packaged-2026-10-02T17-54-00.855Z/`. The run used approved ordinary Windows execution and isolated owned Unicode-folder copies with synthetic fixture PIN `4826`.

All existing committed assertions passed: startup locked/null snapshot with authoritative `PIN_REQUIRED` save refusal; explicit production native fixture setup/unlock; editable packaged source; actual acknowledged save and exact revision/hash/JSON disk readback; a verified matching checkpoint; native pointer recovery into a new project with exact immediate recovered bytes and unchanged acknowledged original; clean-close acknowledgement before copying; copied-folder relock and native unlock; retained exact recovered source/full copied snapshot; ignored development-only CLI arguments; receipt-matching runtime; unconfigured update status; and an owned damaged-journal variant that remains readonly and refuses saves with `ACCESS_REFUSED` despite a correct PIN. The acknowledged original remains exact at recovery, exit, copy and safety boundaries. The previously documented normal-exit renderer-envelope boundary is retained.

This run adds actual packaged regression evidence for this new process-helper artifact. It does not repeat the artificial six-/12-second native-delay experiments inside the packaged runtime; those focused real-PowerShell experiments are separately recorded against the byte-identical helper source. The coordinator reported a complete 112-test local run and another native PIN run; I did not independently execute those full runs in this task and do not include them in my own test totals.

## Scope limits

The original CI20 log lacked native error/query-liveness diagnostics, so its exact cause remains unclassified. A hosted CI observation is still needed; local/package passes are not substituted for CI results. The OS folder-picker damaged-project branch remains source-inspected rather than independently driven by this packaged probe. This report does not qualify another Windows account/clean PC, encrypted project storage, all private Code/PIN/concurrency scenarios, hostile local races, signed update apply/rollback, or a production release.
