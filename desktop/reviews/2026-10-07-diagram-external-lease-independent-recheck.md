# Independent narrow recheck — corrected Guided/Style context leases

Author and focused-probe executor: /root/disk_inventory, 2026-10-07. Scope: current finite Guided/Style APIs under simulated DOM, using my **unchanged original10adversarial cases**. No GUI/native, build, global suite, source/test edit or commit was performed.

**The four previously failing stale-context cases now pass on the corrected frozen sources.** My unchanged10-case suite is10/10GREEN; the current bounded lease/Guided-view/Style-view regression command is32/32GREEN, both exit0 with zero failures/skips/cancellations. This independently verifies this finite correction; it does not qualify the future catalogue integration or native Save/Lock behavior.

## Corrected identities and actual execution

The implementation author separately confirmed these frozen full hashes, and my own before/after readback matched them:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| src/ui/diagram/guided-view.js | 6,703 | 8e5970ecedaeccf302f79d1e25ffc727b741ecd2932ebf5a8ba12921b58db21d |
| src/ui/diagram/style-view.js | 10,738 | 301c067b09597b7c7e3487a3962ce65f8fb6b6c5c532aed197f7ca875dbf236e |
| tests/diagram-external-interaction-lease.test.mjs | 12,290 | 912761d04ddd00d65a9512f201acaf8267ac106316bdc73b392cd00982b69617 |

Commands I actually executed:

```
node --test evidence/workspace-surface/diagram-lease-independent-2026-10-07/adversarial.test.mjs
node --test tests/diagram-external-interaction-lease.test.mjs tests/diagram-guided-view.test.mjs tests/diagram-style-view.test.mjs
```

The first is my original10cases without edits; the second has32current cases, including the author's four new regressions. I did not merely reuse the author's54-test GREEN or their execution of my probes.

Nine explicitly listed relevant source/helper/baseline/owned-fixture inputs were captured before and after: identical bytes and hashes, changedInputs:[]. This is a scoped9-input capture, not a claim that every transitive dependency or whole tree was frozen by my snapshot.

## Source-supported correction and observed contract

Guided now captures contextFor() on creation of the pending editing closure. Its mutation-capable finish refuses a different context before calling onSource; acquisition also refuses to rebind that retained stale field. Style captures pendingContext at the first pending field; pendingCurrent guards lease acquisition, apply, commit, change/input and relevant repaint/target paths. The old source text alone is no longer the mutation authority.

For both controllers, the unchanged adversarial sequence creates pending input, acquires a lease, moves focus outside, replaces the context token while source remains equal, then observes restore:false. The next implicit event and explicit commit now refuse, preserving the real draft/source/history instead of applying private old data. The unchanged controls still pass: valid live-context explicit commit changes history once; composition key events do not imply completion; retirement itself does not apply; inert-private restoration refuses without stealing focus.

This addresses the exact finite context-retirement gap from my prior review. It does not silently discard or auto-save stale pending DOM; caller-owned lifecycle integration must still dispose/retire the old context deliberately.

## Original adverse preserved

I rehashed and verified all four:
- Original review `reviews/2026-10-07-diagram-external-lease-independent-review.md`: `37a87a911bed2003722e60da6f9af4eabf3284ef68571a1efcd06540e6dee2c9`, unchanged.
- Original10-case6PASS/4FAIL log: `d1013ab127163ec9ad03805c84f7dea83aec4a9c25657ea02070c8ab6d17a953`, unchanged.
- Own adversarial.test.mjs:3,170bytes SHA256 `6e1e28d05227b82658f4fa9477968fa05a80e4dff97cbdc46f977d80ed65a1c2`, unchanged.
- Own corrected fixture.mjs:4,351bytes SHA256 `cd4e76f2bde45d325d1cc9e279537dad4f631e93100c7bba5a89b1d20aacdc66`, unchanged.

The original37a87report describes the actual pre-correction source and remains valid as historical adverse evidence. This separate report records changed source behavior; it does not rewrite that history.

## Retained new evidence

`desktop/evidence/workspace-surface/diagram-lease-recheck-2026-10-07/`:
- before.json and after.json:1,534bytes each, both SHA256 `fe09a49ea6568b38e2955ff205041eed7df4490ee6ebb62634dc2375f49427d0`.
- independent-adversarial.log:1,114bytes SHA256 `66a0f11f54f96416836f3ed1834520dfac6b16d228893aaa102b0d6fe6faed34`,10/10.
- independent-focused.log:3,619bytes SHA256 `da2658b248f1d6bf8dc511d6fb6e732af0d47da5845dba7c748820e461292cda`,32/32.
- recheck-receipt.json retains exact current/source/original identities, counts and scope.

Catalogue/main/UI integration still requires a stable real admission/retirement context token and actual ordering before focus movement, explicit Save/prepare, common Lock and native teardown. Optional default undefined cannot provide equal-source identity isolation for callers that never supply a real token. This review does not approve those unimplemented paths, durable Save, native IME, a copied package, release or root's pre-correction build. Historical Diagram pan and Save→Attach remain OPEN and separate.

