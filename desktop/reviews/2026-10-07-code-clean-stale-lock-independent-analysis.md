# Clean stale working Code and Lock — independent architecture analysis

Author: `/root/diagram_history_final_review`. Date: 2026-10-07. Read-only analysis of actual media-owned ADVERSE5 evidence and current preparation/persistence implementation. No product, harness or test edits and no GUI or original-scenario rerun.

## Finding: P2 — a clean stale working window can prevent ordinary Lock

The actual original-harness receipt at `evidence/code-context-commands-native/2026-10-07T01-03-26.139Z/result.json` records five completed cases, unchanged captured inputs, then an `ordinary-lock` timeout. Its log shows one working window prepared, followed by `commitSource / REVISION_CONFLICT`, renderer `REVISION_CONFLICT`, `VIEW_FLUSH_FAILED` and barrier refusal. This is evidence executed by `/root/media_batch_review`, inspected independently here; it is not a new reviewer execution.

The reported sequence saves working v5, opens another clean working view at v5, edits the first to v6 and immediately requests Home Lock. Source inspection supports the mechanism: `source-changes.js` schedules clean refresh after 250 ms; preparation cancels that timer, and `view-lifecycle.js` unconditionally calls `editor.flush()` for every writable view. The adapter allocates a fresh commit operation for its local bound version. Repository CAS correctly refuses that fresh v5 commit once the source is v6. Nothing in this observation justifies weakening CAS or excluding the second window.

## Recommended narrow correction: replay an existing verified exact commit

The implementer's proposed exact committed-operation replay is a smaller fit to existing architecture than introducing a separate historical clean-view proof protocol, **provided these invariants are preserved**:

1. Native selected working-reference context may expose an optional operation ID only after genuine `getCommitReceipt` verification for that exact source/version/SHA. Recheck frame, owner, selected membership and reference after asynchronous verification. A blob, draft receipt or renderer-supplied operation ID alone is insufficient.
2. After synchronously pausing admission, reuse that operation only while the adapter is clean, has no pending/saving work or fence, and editor/client reference still equals the verified committed identity. A newly opened v5 view needs hydration from the native proof; an editor that saved itself may use its actual exact successful commit receipt. Dirty or pending work keeps normal new-operation CAS. Never overwrite a v5 editor's bound reference with v6 merely to pass preparation.
3. Source-client duplicate-operation handling may permit only an exact previous successful **commit** identity. Reused edit IDs, mismatched version/source/hash, unknown or failed operations and an intervening edit remain refused. The repository must execute its existing verified idempotent commit branch; there is no synthetic renderer receipt.
4. Final coordinator reconciliation remains unchanged in meaning: a historical v5 commit proves only v5. If latest is v6, a genuine durable v6 receipt is still required and independently verified. Latest draft-only, missing or mismatched v6 proof must refuse Lock.

`SourceRepository.commitSource` already verifies and replays an existing operation before its new-operation CAS check, without selecting the old source head. This makes exact replay a legitimate historical receipt, rather than a stale content write. Imports with no real commit record cannot invent an operation; retain existing CAS behavior for that case or address it separately with a genuinely native proof.

## Concrete additional seam: historical replay must not regress working identities

`coordinator.mjs` currently publishes **every** successful `applyEdit` and `commitSource` receipt. `NativeWorkingSources` subscribes every working view and marks an entry invalid when a published version is lower than its current reference. Consequently, simply enabling a v5 historical commit replay after v6 will publish v5 and invalidate the working entries, even though the repository correctly kept v6 selected.

Handle this explicitly. Suppress a publication only when native verification establishes that the commit response is an idempotent historical/no-advance replay, or give the subscriber a precise independently verified replay distinction. Do not broadly suppress lower-version edit anomalies, regress the current owner reference, or treat arbitrary low-version receipts as harmless. Same-version/different-SHA remains invalid. Test continuation/resume as well as successful Lock: immediate destruction could conceal poisoned working entries.

## Alternatives and tests

A separate preparation-only clean historical seal is viable but would require a new distinction between per-view historical coverage and latest source durability, plus native issuer/verification and final reconciliation changes. It must never classify a working view as permanently read-only. Docs-style clean recapture is also viable only with genuine private-ticket reads and actual editor/client refresh; merely assigning the latest receipt is insufficient. Full source reload under the existing finite preparation deadline is a larger change and should not be the first workaround for already committed v5.

Suggested focused regressions:

- Real source repository, coordinator, working registry and two views: commit v5, reopen clean v5 with native proof, edit/commit v6 elsewhere, prepare immediately before refresh; historical replay leaves repository head and **both working entries** at v6, and final reconciliation uses genuine v6.
- Same case with latest v6 only a draft or no v6 commit receipt: preparation refuses. A v5 replay alone cannot cover it.
- Unsaved edits or pending transport in the stale view: retain local bytes and refuse genuine conflicting edits; do not replay v5 or recapture away local work. Include an edit arriving immediately before synchronous pause.
- Exact repeated commit succeeds; reused applyEdit ID, unknown/failed ID, wrong SHA/version/source, forged native-context fields, revoked membership, foreign frame and Lock/retirement during proof verification refuse.
- Native initial imported source without a commit proof; own Save followed by clean replay; Save then later local edit; recovery-degraded exact commit; repeated preparation cancellation/resume. Verify source versions, opaque metadata and selected Docs remain exact.
- Rerun the unchanged original native harness only after separate code/unit review and coherent build. Preserve ADVERSE5 and earlier ADVERSE4 records; no action/oracle/deadline relaxation.

## Evidence limits

Read inputs are captured in `evidence/code-source-context-independent-review/clean-stale-analysis-inputs.json`; a parsed bounded native-log excerpt is in `clean-stale-native-excerpt.json`. This report proposes an architecture and tests; it does not certify an implementation or claim a corrected native result. Earlier independent reports remain unchanged.
