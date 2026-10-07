# Independent frozen recheck: native Diagram history and typography

Reviewer: `/root/diagram_history_final_review`. Date: 2026-10-07.

Verdict: no unresolved confirmed findings remain within this bounded source/controller/domain review. Original R1 and R2 are corrected in the frozen candidate. This is scoped review closure, not native, full-suite, hosted, merge, release or installed-replacement approval.

The original authored report remains byte-for-byte unchanged at SHA-256 `5b0d75fa1337a2fac09b618d902d7da8d5beba2c98b602e4297474af9d0c281b`. This separate report records remediation without replacing the adverse observations.

## Frozen evidence

After root's corrected-freeze signal, independently recaptured 21 reviewed source/build-helper/test/workflow input hashes and verified exact equality after the bounded probes and tests. Actual manifest: `desktop/evidence/diagram-history-independent-review/frozen-recheck-result.json`, with before/after manifests and extra readbacks. `frozen-input-hashes.json` also retains the probe's own before/after capture.

Read-back generated Diagram SHA-256: `31df3b1e64b673064221bb183be169885e11361bfbb27e88c2c0348b4b80a410`.

Read-back generated import-validator SHA-256: `a424a8247de09788a791fa055e804c315c9a4201a7a0a79a536532a4354d6af3`.

These are identity readbacks; this reviewer did not rebuild, package, copy or run either generated renderer.

## Remediation recheck

- **R1 closed:** actual embedded domain-helper probe now accepts first styles for `constructor` and `toString`, rejects own JSON `__proto__`, and continues rejecting 251 new styles and invalid empty node IDs. `frozen-validator-output.log` retains the actual output. Inspected own-property reads for both prior and next entries and the own sanitizer-output requirement. Executed regression additionally checks first style and deletion for `constructor`, `toString` and `hasOwnProperty` against the actual frozen sanitizer. Opaque sibling preservation and aggregate admission regressions pass.
- **R2 closed:** actual frozen Mermaid preparation still reports its own default family, `16px`, and `normal`. Re-running the original probe now shows all absent global typography and inherited block-size values blank instead of fabricated explicit values. `frozen-default-font-output.log` retains that comparison. Source inspection and controller regressions confirm disabled `Theme default` select options, `Theme default` global-size placeholder, `Inherit` block-size placeholder, and preservation of absent metadata until an explicit user edit. Explicitly enabling an empty block-size field authors a visible 16px value; it does not claim to have read an effective source/class font.
- **Zero-target provenance concern resolved in source/controller scope:** the window render result passes global `fontDeclared` independently from targets, and StyleView consumes it even when no stable blocks exist. The executed regression verifies that global font controls remain disabled with source ownership and an empty target list. No native pixel observation is claimed.

Exact scoped command:

```text
node --test --test-reporter=tap tests/diagram-history.test.mjs tests/diagram-history-view.test.mjs tests/diagram-style-view.test.mjs tests/diagram-style.test.mjs tests/diagram-node-style-validation.test.mjs tests/domain-owner.test.mjs tests/domain-validation.test.mjs tests/diagram-history-ci.test.mjs
```

Actual result: **52 passed, 0 failed, 0 cancelled, 0 skipped**, retained in `desktop/evidence/diagram-history-independent-review/frozen-scoped-tests.log`. The initial 48-test log and all original probe outputs remain separately retained.

The covered history behavior includes current CAS after Save/Undo, retained presentation and unrelated data, exact optional-key removal, bounded history/oversized current work, coalescing, lifecycle refusal, pending fields, controlled keyboard handling, style inheritance and original-validator preservation. Further bounded inspection identified no additional confirmed defect.

## Remaining evidence boundaries

No GUI, actual browser/native focus or IME experiment, native harness, copied-package execution, full suite, hosted workflow action, merge, release or installed replacement was performed by this reviewer. Native execution belongs to the separately assigned executor. Browser/native behavior, visual output and runtime/package identity require their own retained evidence. A later successful run does not close the historical Diagram timeout or alter its original outcome.

No product source, tests, generated output or workflow files were edited by this reviewer. Only these authored review reports and ignored review evidence were written.
