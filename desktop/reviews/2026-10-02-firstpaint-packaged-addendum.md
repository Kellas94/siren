# Independent packaged first-document gate addendum — 2026-10-02

Author: independent reviewer `/root/review_native_launcher`. Earlier package and first-paint reports remain unchanged. This addendum records actual mixed outcomes against the newly built package. It does not record a clean uninstrumented qualification or release admission.

## Exact candidate

Package: `desktop/dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`.

- Receipt sourceCommit: `b6249016cc9a001c646cc183f3c38884da678b1d`.
- app.asar: 14,277,106 bytes, SHA-256 `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5`, independently hashed and matching the development receipt.
- Runtime receipt: 245,726,208 bytes, SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`; successful relocation runs also independently checked the executed runtime hash.
- Archived generated renderer independently extracted and hashed: `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`.
- Archived main independently extracted: `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63`.
- Archived process inspector independently extracted: `5fce0c2e0a733d41daf1c4fa5fbbbfbdb1b9f7e2e170dd653f5c58c3295e9e1b`.
- Original `tests/native/packaged.mjs`: SHA-256 `856447dce1b8044a0380316ae6433a0c5c4eb4266a8b26a67ca7d2f7e5a851e6`.
- Original `tests/native/drive.mjs`: SHA-256 `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`.

The receipt remains kind=development-preview, releaseAdmitted=false. A failed diagnostic lookup initially guessed an incorrect archive path; the receipt's actual App/versions/0.1.0/resources/app.asar was then used. pin.js is embedded in the generated document, not separately present in this archive; a direct pin.js extraction attempt failed without modifying the candidate.

## Actual observations

| Execution | Retained evidence directory | Outcome |
| --- | --- | --- |
| Original unmodified test | evidence/packaged-2026-10-02T18-17-59.752Z | exit 1; CDP timeout Runtime.evaluate |
| Original unmodified test, fresh owned copy | evidence/packaged-2026-10-02T18-19-58.325Z | exit 1; same timeout |
| Evidence-only per-evaluation stage logging | evidence/packaged-2026-10-02T18-21-46.158Z | exit 0; all original assertions passed |
| Final original unmodified test, fresh owned copy | evidence/packaged-2026-10-02T18-22-34.610Z | exit 1; same timeout |
| Evidence-only in-memory/error-time stage metadata | evidence/packaged-2026-10-02T18-24-47.846Z | exit 0; all original assertions passed |

The three original failures are retained with completed=false result receipts. They stopped before the first desktop screenshot. Their owned local PIN file had been created, but their project folders still contained only the initial revision. Failure screenshot/evaluation also could not complete, and failure-state.json recorded state=null. Logs contained DevTools attachment but no explanatory product error. These facts do not identify the exact pending call, a product failure cause, or whether the renderer had physically painted anything.

The first diagnostic copied the test byte-for-byte into `evidence/packaged-trace-independent-2026-10-02/probe.mjs` and copied its helper with stage-name start/done logging around evaluations. `trace.log` retains the sequence without PIN payloads. It passed, so this additional logging may have affected timing and cannot erase the original failures.

After the final original failure, the second diagnostic copied the test byte-for-byte into `evidence/packaged-error-stage-independent-2026-10-02/probe.mjs`. Its helper only remembers the current expression in memory (PIN setup/unlock payloads masked) and appends it if the existing 20-second timeout fires. It adds no output or writes while evaluations succeed. I independently inspected its diff: no waiting, deadline, fixture, parser, assertion or authentication changes were introduced. It also passed; therefore it did not capture a failing phase. Both copied test hashes exactly equal the original hash above. Preparation scripts and diagnostic helpers are evidence only; no product or original test file was edited.

## What the successful diagnostic executions establish

Both actual diagnostic executions used isolated Unicode package copies and production native PIN receipts. They checked locked/null bootstrap, PIN_REQUIRED for a known-project save, rejection of development CLI overrides and require being unavailable. Real fixture PIN setup/unlock permitted editing. Native save/readback matched acknowledged JSON/hash/revision and a verified saved checkpoint. Pointer recovery created a new project with exact saved bytes while preserving the acknowledged original. A normal close completed and recorded clean-close before copying to the second Unicode folder; the relocated package relocked and then correctly unlocked, retaining the exact acknowledged original and recovered snapshot at the explicit post-close boundary. A third damaged-journal copy remained readonly and refused native writes with ACCESS_REFUSED despite a correct PIN. Updates were precisely unconfigured.

These two executions demonstrate the named packaged behaviors for this archive, with initial project SHA-256 `42a9805241863d9b0a6ac9061cf634cf21dbf7753ca530a76f4a0695d5e350de` and acknowledged saved SHA-256 `5cb37760438521f6d87bd4a60c66cceb46c5f5d8d4ac7f827e40e8e215f26342`. They do not qualify the original uninstrumented test's stability. Three original timeouts remain unresolved and should be visible beside any later hosted observation; no timeout fix is established here.

## Limits

This is a mixed-result local packaged observation, not aggregate clean PASS. No physical first-paint conclusion follows from the timeouts or DOM geometry. The previous first-document source review separately records current Guided/PIN/returning/recovery checks. No launcher execution, signed update/apply/rollback, clean-PC compatibility, real online account or hostile membership-race admission was performed here. The original CI20 process-identity failure cause is still unconfirmed. All PINs/project data were synthetic and original user Data was untouched.
