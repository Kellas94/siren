# Sources Task 2 implementation evidence

2026-10-03. Implementation/integration report authored by `/root`; metrics/model authored by `/root/source_model`. This is not an independent evaluator's report. The separately authored `2026-10-03-source-authority-review.md` preserves its initial required change and subsequent verification.

## Implemented boundary

SourceRepository owns immutable import blobs, hash-bound version journals, selected source pointers and explicit materialized commits beneath an existing owned project. Draft acknowledgements require journal/pointer readback; an in-memory edit alone is not an acknowledgement. Historical selected versions remain exportable. The same project writer primitive serializes source operations; caller/frame/epoch integration is still Sources4/Native1 work.

TextModel uses a piece table, incremental line treap and byte-bounded inverse/forward history (default 8 MiB). UTF-16 offsets include a retained BOM. CRLF, LF, lone CR and Unicode remain exact; split surrogate offsets/unpaired insertions are refused. Metrics distinguish UTF-8 bytes, UTF-16 units, logical lines and longest line width excluding its terminator. Unsupported UTF-8 remains a raw exportable source, with editing explicitly refused.

32 MiB/source and 256 MiB/project-source-store are byte limits. The latter includes retained blobs, journals, metadata, pending atomic files and transient new writes; seven distinct 32 MiB imports fit, the eighth is refused because their metadata is retained too. This conservatism never deletes a last good copy to fit a transaction. Limits injection can only lower production caps for tests.

Operation IDs bind accepted edit/commit requests across restart. A selected commit with failed checkpoint remains accurately `recovery-degraded`, including duplicate requests. Successful checkpoint tokens are separately durable; absence is conservative. Faults immediately after selection verify the actual new pointer before acknowledging it. Access is rechecked after asynchronous fault/flush work immediately before rename.

## Actual verification and failures retained

- Initial repository tests: exit 1, all ten failed because the new module did not yet exist (`source-repository-red.log`). First implementation attempt also failed ten tests because `childDirectory` refused the literal uppercase `Projects`; the fix uses the existing owned-directory primitive for that established directory (`source-repository-first-green-attempt.log`).
- Focused initial implementation: ten passed. Added tests found two real failures: degraded duplicate receipt incorrectly became committed, and edit reused a commit operation ID. RED 0/2 followed by GREEN after hash-bound commit descriptors/shared operation namespace and checkpoint tokens.
- A Lock-at-selection test failed (`true !== false`); access recheck before atomic rename fixed it. Checkpoint-success/restart duplicate receipt also passes.
- Independent review reproduced an orphan commit ID poisoned by its original parent descriptor. Root added the same regression: actual RED. Commit records now use unique immutable journal filenames, retaining operation identity separately and linking the latest selected parent. Actual GREEN and the reviewer's extended independent reproduction cover retry after another commit and changed checkpoint configuration.
- Final root repository command: `node --test tests/source-repository.test.mjs`, exit 0, **15/15**, no skip/cancel, 5103.4439 ms, `source-repository-reviewed-green.log` SHA256 `2334509dc5a0734470b1c6fb2ec2f15fc9e6ed79d778838860d139649bb317a8`.
- Metrics/model final focused command: **17/17**. Contains 400 Unicode/newline edit-oracle operations and undo, exhaustive short newline joins, large-line span edits, identity/history eviction and exhausted version checks. Independent review also exercised 4,500 mixed-width newline/Unicode edits against a separate string/metrics oracle.
- Independent combined focused suite after the orphan fix: **32/32**, exit 0, no skip/cancel, 5191.6562 ms. Root's earlier combined 31/31 was before the final orphan test.

Two agents started whole-suite checks while the repository was being developed, contrary to the coordinator's intended stable-source barrier. Their failures are retained: diagnostics run **134/144** (ten then-missing-module failures); model run **146/148** (the two already-fixed degraded/ID cases loaded before the fix). Neither is a final stable-source PASS, and neither replaces earlier adverse results. A coordinated product regression run follows the separate recovery/main fixes after their source stabilizes.

## Scope and next work

No editor UI, schema-2 migration, native satellites, Python execution, Terminal product dependency or portable package is admitted by these unit results. SourceRepository currently reconstructs the selected journal and hashes full source bytes per call; materialized commits are not yet replay checkpoints. Its disk scan, retained orphan files, TextModel piece traversal and growing identity map require measured cache/compaction work before sustained large-source input can be qualified. Native latency/memory claims remain open.

Latest source identities: metrics `4fad1128b218b0af1f40d6412112e9c7eebbe20f1785310ba66c8a5e9ca46ad6`; model `359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585`; repository `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457`; repository tests `c5b3a2b9c0cf5b7412ae6acb51f317f1d9d4407e293adb005561d31e69f34cbc`.

CI26's actual packaged failure remains historical and its specific cause remains unknown; the separate diagnostic/fix work must not call this source subsystem its causal repair. Frozen R78, original adverse artifacts, main branch and public release remain untouched.
