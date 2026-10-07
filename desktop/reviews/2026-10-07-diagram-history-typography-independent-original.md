# Independent original review: native Diagram history and typography

Reviewer: `/root/diagram_history_final_review`. Date: 2026-10-07.

This is the reviewer's original authored report. Preserve it unchanged; record remediation and final frozen verification separately. Review began at HEAD `d3928e0ba846859d3e999db4e58b400aafcbfd00`, against base `d6bd704`, with the in-progress Diagram working tree included. Source was explicitly still stabilizing. The observations below identify their actual bounded evidence; this report does not confer native, hosted, merge, release, or installed-replacement approval.

## Confirmed findings

### R1 — P2: use own properties when validating block IDs

In `desktop/build/native-node-style-validation.mjs`, reading `old=prior[id]` and `next=value[id]` conflates absent styles with Object.prototype properties. A legitimate Mermaid block called `constructor` or `toString` cannot receive its first style: the renderer/domain intent accepts the ID, and the original frozen sanitizer retains `{fontSize:22}` exactly, but the new validator reads an inherited function as the prior style and rejects the Save. The user retains their local edit but cannot save that supported style change.

The same property-ownership mistake weakens admission in the other direction. An own JSON `__proto__` entry passes the new per-node validator even though the original frozen sanitizer produces no own entry. Its internal assignment changes the sanitizer result's prototype, and reading `sanitize(...)[id]` mistakes the inherited value for an admitted node. This is an original-validator admission mismatch; the probe does not establish code execution or a cross-process prototype attack.

Use own-property reads for prior/next data and require an own sanitizer output entry before accepting its managed leaves. Preserve unchanged imported opaque siblings and the aggregate cap.

Actual evidence:

- `desktop/evidence/diagram-history-independent-review/probe-output-third.log`: normalized first styles for `constructor` and `toString`; new validator `false`, original sanitizer exact `true`.
- `desktop/evidence/diagram-history-independent-review/probe-output-fourth.log`: also shows own `__proto__` new validator `true`, original sanitizer exact `false`, sanitizer own-entry count `0`.
- Separate immutable probe/input snapshots: `validator-prototype-finding-probe.mjs`, `validator-prototype-finding-input-hashes.json`, `validator-proto-own-finding-probe.mjs`, `validator-proto-own-finding-input-hashes.json` in the same evidence directory. The before/after hashes agree for each retained probe run.

The probe executes actual `normalizeDomainIntent`, the current embedded `domainHelper`, and the frozen extracted `sanitizeNodeStyles`. Unrelated validator bindings deliberately throw if invoked; none are invoked. It does not mock the node-style decision or persist a project.

### R2 — P2: absent typography must not be displayed as an explicit value

The initial `style-view.js` painted new global Weight `500` and inherited block Size `15` when those fields were absent. The actual frozen Mermaid engine, initialized by the actual native `prepareStyle` with the native default configuration and plain `flowchart TD\nA-->B`, reports font weight `normal` and size `16px`. The existing global Font/Size controls also displayed `Inter`/`15` while Mermaid reported the Trebuchet/Verdana/Arial stack and `16px`.

The new controls therefore suggest values which are not applied. Choosing another weight and returning to the initially displayed `500` changes appearance; leaving the displayed value untouched does not apply it. Likewise, enabling a block size at the displayed inherited `15` can shrink the current default `16px` text. Distinguish absence/inheritance from explicit values, or obtain truthful effective values without rewriting saved metadata.

Actual evidence: `desktop/evidence/diagram-history-independent-review/default-font-probe.mjs` and `default-font-output.log`. This executes the actual embedded frozen Mermaid engine and native preparation plus a mounted controller. It establishes configuration/control disagreement, not native rendered pixels. Initial reviewed StyleView SHA-256 was `bb7f1a01bc2ec29dc45f4fcce2f393c48d5f96465abf6b0a849b5d381473e5b2`; frozen baseline SHA-256 is `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`.

## Other review results and limits

- Read the approved history/typography plan and inline progress rulings. No applicable AGENTS.md was found under the inspected portable workspace. Reviewed draft/history/style controllers, render provenance, window integration, finite domain reset path, validator embedding, new tests, native harness and CI additions.
- The scoped initial test execution passed 48 tests, with zero failures, skips or cancellations. Exact TAP is retained as `desktop/evidence/diagram-history-independent-review/scoped-tests-initial.log`. These are controlled tests, not native observations, and preceded final freeze.
- The tests exercise current-CAS Undo after Save, presentation preservation, 60-state/8-MiB retention, oversized exact source retention, 750-ms coalescing, fences, refresh/reset behavior, field refusal, keyboard guards, style inheritance, opaque node siblings, reset normalization, domain validation and CI registration.
- The initial cardinality/invalid-empty-ID suspicion was corrected in root's stabilizing source before the reviewer's successful probe. Current observed results reject 251 newly authored styles and invalid empty IDs. No claim is made that the reviewer independently reproduced the earlier version's rejection failure.
- Global source-font protection carried only by nonempty node targets was raised as a specific controller concern. Root is changing that path. This report does not claim that a particular native rendered diagram type was independently observed failing it.
- The first validator probe failed during setup because unrelated sanitizer bindings were absent. Its exact adverse output remains `probe-output.log`; it was not counted as product evidence or hidden by later success. `probe-output-second.log` retains the corrected early probe.
- No GUI/native harness, full suite, renderer/package build, hosted workflow, push, cancel, rerun, merge, release or installed replacement was executed by this reviewer. Pure in-memory extraction of the existing style helper is used by the bounded tests/probes. No product source, tests or workflow files were edited. Review artifacts and ignored evidence are the only authored files.
- Source was not frozen at original issuance. The final candidate requires an input-hash recapture and scoped re-verification after root's remediation. A subsequent green native/hosted run cannot close the historical Diagram timeout by implication.
