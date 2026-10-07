# Clean committed-source replay — independent correction review

Author: `/root/diagram_history_final_review`. Date: 2026-10-07. Separate source/unit review of the implementation following the ADVERSE5 clean-stale Lock analysis. Earlier authored reports and original native observations remain unchanged.

Disposition: **no actionable defect reproduced in the reviewed correction**. Exact historical commit replay and latest-source reconciliation passed the bounded checks below. Native resolution of ADVERSE5 is not claimed here.

## Review assessment

Writable `getReference` optionally returns an operation ID only after the repository verifies a real commit for the exact current source/version/SHA. Missing or nonmatching head proof leaves that field absent; asynchronous completion rechecks current source authority before disclosure. The renderer forwards this optional proof identity into its editor adapter.

The adapter waits for its edit queue, then reuses an initial or last receipt operation only when clean and still bound to its exact identity. Dirty work retains fresh-operation CAS. The source client still calls native persistence on replay and permits a known duplicate only for its exact last successful commit; reset clears the exception. Repository and coordinator commit/reconciliation contracts are unchanged. Existing source-adapter tests cover genuine stale dirty CAS refusal and exact retained source bytes.

The publication issue identified in the preceding analysis is handled in `NativeWorkingSources`: strictly older committed/recovery-degraded receipts from the genuine owner subscription do not replace or invalidate the current reference. Older draft receipts and equal-version hash changes remain invalidating. This relies on the existing trusted owner route, which publishes projected results of real repository operations; it is not a renderer receipt admission path.

Final source reconciliation still requires the highest current version to have a genuine durable commit. A valid historical replay alone cannot establish durability for a later source draft or commit. No version is overwritten to make a stale editor appear current.

## Checks actually run

```text
node --test tests/native-source-reads.test.mjs tests/native-working-sources.test.mjs tests/editor-adapter.test.mjs tests/source-client.test.mjs tests/code-view-lifecycle.test.mjs tests/window-source-barrier.test.mjs tests/view-control.test.mjs
```

Result: **97 passed, zero failed**. No GUI, renderer build, native harness or full suite was run by this reviewer.

Additional independent probe `replay-ticket-probe.mjs` used the actual repository, coordinator, working-source owner and genuine registered captures from the existing native-context fixture:

- Committed version 1, admitted an edit to version 2, paused the owner and issued two distinct real private flush tickets.
- Under those tickets, committed version 2 and replayed the actual version-1 commit, then called `finishViewFlush` for each ticket. Both native seals succeeded.
- Historical-only final reconciliation refused with `SOURCE_VERSION_CHANGED`; the two genuine sealed receipt sets reconciled successfully to version 2.
- Both working references remained at exact version 2/SHA. Resuming and editing through the second grant advanced both to version 3, showing historical publication did not poison continuation.
- Separate deliberate fault injection at the captured owner-subscription callback proved lower-version draft invalidation and equal-version/different-SHA committed invalidation remain active. These injected anomalies are unit controls, not actual native receipts.
- Selected project/Docs snapshot remained exactly equal to the initial snapshot.

This probe exercises real private-ticket issuance, execution, finishing and reconciliation. It does not exercise Electron IPC, a real renderer's clean-state claim or Home Lock UI.

## Frozen identities and evidence

Eighteen inputs were captured before and after checks: **all unchanged**. Both manifests have SHA-256 `fc9c3426275b569e5918d3a76320b99653c79784d23ba2a453b05f258358001b`.

| Reviewed input | SHA-256 |
| --- | --- |
| `src/windows/source-reads.mjs` | `ddc42c4fe795b77ffb38716d688fe094415979a2d8400971993f0a23cbae1fb5` |
| `src/windows/working-sources.mjs` | `5dbb8562fee8b7cb509c468b6ad458a3af99173c74e866d9a7cd6530e283a299` |
| `src/ui/code/editor-adapter.js` | `dec802405c61bde578c84bc0eaf32de53ce1fcc9126fc88cc5469a62471dc0df` |
| `src/ui/code/source-client.js` | `55556668aeb0fb49728345df537e928e0678e8d259fa25c8a20984715db54926` |

Evidence retained under `evidence/code-source-context-independent-review/`:

- `replay-inputs-before.json` and `replay-inputs-after.json`: full input manifest, including unchanged repository/coordinator and relevant tests.
- `replay-scoped.log`: SHA-256 `487ab4c65883493864f18f38d35db2b93ad1c71ca8f82996bd7680a1b31cf6e9`.
- `replay-ticket-probe.mjs` and `replay-ticket-probe.log`: authored probe source and actual output; log SHA-256 `7350ecd9571043d0416f21a7b584d9d7ccea9849eed426d1538c689d6a1b1ab9`.

## Limits

No product, tests, harness, workflow, build or generated files were edited. This review does not prove capacity/performance for the new optional commit verification, which reads and verifies repository history; no new maximum-size claim is made. The actual original ADVERSE5 and ADVERSE4 records remain historical adverse evidence. A coherent corrected native execution with unchanged actions/oracles remains separate, as do copied-package, full-suite, hosted and release qualification.
