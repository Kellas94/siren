# Independent finite Guided/Style lease review — stale-context finding

Author and focused API-probe executor: /root/disk_inventory, 2026-10-07. Scope: the three frozen Task2 lease files and actual Guided/Style/draft helpers under a simulated DOM. No GUI/native/full-suite/build/commit was executed by me; no source or original test was edited. Root's separately active pre-correction build is not reviewed or qualified here.

**Finding: the new lease rejects restoration for an equal-source context replacement, but old pending fields can still mutate draft/history through a later event or explicit commit.** The finite helper contract needs correction before catalogue integration can rely on context retirement. This is not a claim of an observed native exploit or deployed catalogue behavior.

## Immutable reviewed identities

| File | Bytes | SHA256 |
| --- | ---: | --- |
| src/ui/diagram/guided-view.js | 6,607 | 49aed83caabe2c72c99d943b419e85ec8ee846d9cf98a6f4aefa568c119c47c1 |
| src/ui/diagram/style-view.js | 10,282 | 7e55f095bbf7d46f01eed8058558af3a23a7f9bb1e310956d7c573901159b48d |
| tests/diagram-external-interaction-lease.test.mjs | 10,722 | 6e892d851a7057f6ccf85f22a70591a6899ee72533c88a3b490c22ef6b8e53f3 |
| Author implementation report | 6,255 | dd5b662413d932a05194514f640e08cb06e5c825898414591f8247be0838fbd0 |

I read the implementation report as the author's record, not independent approval. My before/after snapshot for the subsequent adversarial probes covers9actual source/test/helper/baseline files; changedInputs:[]. The initial28-test command preceded that full9-file snapshot, so it is not represented as a retroactive whole-input before capture. The four reviewed identities had been explicitly hashed before that first command.

## Actual executions

Existing bounded focused command:
`node --test tests/diagram-external-interaction-lease.test.mjs tests/diagram-guided-view.test.mjs tests/diagram-style-view.test.mjs`

Result:28tests,28passed,0failed/skipped/cancelled. This verifies existing regressions in their finite fixture; it does not cover the additional stale-event branch.

Own ignored10-case adversarial suite:
`node --test evidence/workspace-surface/diagram-lease-independent-2026-10-07/adversarial.test.mjs`

With the corrected owned fixture import path:10tests,6passed,4failed,0skipped/cancelled, exit1. Four failures are two manifestations of one context-binding gap, in both controllers:
1. Failed stale lease restore followed by late field event mutates.
2. Failed stale lease restore followed by explicit commit returns true instead of refusing stale pending data.

Six controls pass: for each controller, live-context explicit commit changes real draft history exactly once; composition key events do not imply commit or completion; explicit retirement itself does not apply, and inert-private restoration refuses without moving focus. These controls are finite event simulations, not physical IME or browser focus qualification.

My first owned probe attempt failed during import because only one of two rebased baseline URL occurrences was replaced. Its original fixture copy and log are preserved. I corrected only that ignored fixture path, then executed the10cases. That initial setup failure is not counted as a product finding.

## Reproduction and causal source anchors — P2

For Guided and Style:
1. Start an actual pending field in the finite fixture using real controllers and real draft/history.
2. Acquire beginExternalInteraction; move simulated focus outside. Source remains identical.
3. Replace the stable context token with a new object.
4. lease.restore correctly returns false and focus remains outside.
5. Deliver a late Guided blur / Style change, or call the explicit commit API.

Observed late-event changes: Guided source now contains OLD_PRIVATE_CONTEXT; Style fontSize changes18→20. Real draft/history is changed by those events after the context was retired.

Separate direct observations additionally record explicit commit: both controllers have restore:false,commit:true,mutated:true. Guided rewrites its source with STALE_EXPLICIT_OBSERVED; Style changes18→20. Full before/after diagrams/history are retained in stale-explicit-observations.json. This separates actual mutation evidence from the tests that fail first at the unexpected Boolean return.

Source explanation is bounded and concrete:
- Guided guided-view.js:15 validates contextFor identity inside restore, then its finally retires the lease even when validation fails. The pending editing closure survives.
- Guided guided-view.js:26–34 finish checks disposed/current input/composition/line editability, but not the edit's captured context identity. The blur path at41 resumes finish once external is inactive. Explicit commit at65 also retires then calls finish.
- Style style-view.js:11 validates contextFor only in restore. Pending Set fields remain when that restore retires.
- Style style-view.js:35–40 apply/commit/change check disposal/editability/composition and current source metadata, but not the pending edit's captured context. Thus equal-source context replacement bypasses the lease's only identity check at the later mutation boundary.

Existing tests for changed context/source/dispose verify false restoration/no immediate mutation, then stop before the late event/explicit commit. They therefore do not exercise this branch. Different-source Guided validation can refuse by expected line; equal-source replacement requires the stable context identity independently of source text.

## Correction boundary and remaining integration work

Bind the pending edit/batch to a stable current context at its creation/first input, and validate that binding at every mutation-capable finish/apply/commit path. Stale context should refuse without applying old private values; caller-owned context disposal can then retire the old DOM. Preserve live-context explicit commits, invalid-value DOM/errors, source/history exactness, composition refusal and original Save/prepare semantics. Do not infer that a stale restore refusal alone invalidates all retained field handlers.

Root must still supply a stable admission/retirement context token, acquire leases before catalogue focus movement and retire/dispose them at actual private-context transitions. Optional default undefined retains old callers' behavior and cannot distinguish equal-source replacement by itself. Catalogue/main/UI integration is not implemented or approved by these tests.

No persistent Save/flush/IPC or native common-Lock authority was exercised here. Valid explicit controller commit is a local draft operation, not proof of durable Save. Existing private-visibility tests protect focus restoration; they cannot prove native teardown/focus sequencing. Historical pan and Save→Attach issues are separate and remain OPEN.

## Retained own evidence

Root: `desktop/evidence/workspace-surface/diagram-lease-independent-2026-10-07/`.
- before.json SHA1cb5e9eca3a43d5b2f4b570569af7fe3768708f6760dae6bef8322fc585ea9da.
- after.json SHA544eacc5aeb792049a4349103682e21a6796a864ed74f93206db3fc23b98b29c; changedInputs:[].
- Corrected fixture.mjs SHAcd4e76f2bde45d325d1cc9e279537dad4f631e93100c7bba5a89b1d20aacdc66.
- Own adversarial.test.mjs SHA6e1e28d05227b82658f4fa9477968fa05a80e4dff97cbdc46f977d80ed65a1c2.
- Initial import-error log SHA00cc08bd0dccdd72b2cc5876eb5570fc47171503366d17bbb4dc6fc9ab5000bd.
- Corrected10-case adverse log SHAd1013ab127163ec9ad03805c84f7dea83aec4a9c25657ea02070c8ab6d17a953.
- Separate original focused28-pass log `evidence/workspace-surface/diagram-lease-independent-focused-2026-10-07.log` SHAacb9fc361347c0262536fcadf3ee7cc6b5baacc54bdbf7249cfdf17037118bb9.
- review-receipt.json records original paths/lengths/hashes and true setup/finite-execution scope; stale-explicit-observations.json retains the two observed explicit mutations.

Verdict: **finite context-retirement gap OPEN; correction needed before integration qualification**. No source patch, build, GUI/native qualification, copied-package approval or independent approval of the author's own record is claimed. All original adverse records remain unchanged.

