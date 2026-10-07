# Hosted Code language fixture — independent narrow recheck

Author: `/root/diagram_history_final_review`, 2026-10-07. **The correction is exactly the recommended fixture declaration.** No product or behavioral oracle change was found. This author performed byte comparisons and real metadata-function probes only; native executions belong to `/root` and are reported separately below.

## Exact correction

Current `tests/native/source-read.mjs` SHA256 `4af568f65f081571b7e59600bdc3745f19b3c805d7b03c9bdb86fac52f0aa221` is 22,212 bytes. Preserved original `evidence/workspace-surface/native-python-fixture-original/source-read-e260bf75.mjs` is 22,194 bytes, SHA256 `e260bf75b20a9ab4e6db6453be1af1ea571e5b897f2e8f622fdec26f226de551`.

An actual byte-level assertion removes the single 18-byte insertion `fileType:'python',` from the current fixture and compares the remaining bytes to the preserved original: exact equality. Thus every original assertion, source constructor, deadline, route, reference operation and wrapper behavior in this file is unchanged. The actual current document literal puts the declaration on the existing exact Knowledge row, as intended.

The probe independently evaluates only the three original source-construction constants from both files. Their generated buffers are exactly equal: **6,488,889 UTF-8 bytes**, SHA256 `5a799ac3cea60349908bf48a95fc35181192ebae39225cc91ce92bdc7102075e`. This hash matches all three new native receipts. No source text or native harness is edited or executed by this probe.

## Actual metadata recheck

Executed `node evidence/code-source-context-independent-review/hosted-language-recheck-probe.mjs`, exit0. Both real `createSourceContext` and `selectedCodeMetadata` return `python` for the actual corrected document literal and `unknown` for the preserved original. Explicit `text`/`txt` return `text`; conflicting exact Python/text declarations return `unknown`; title/filename alone and a foreign-source Python declaration remain `unknown`. All byte assertions and seven classification assertions matched. The minimal current-grant adapter is the same bounded model used in the original diagnosis, not an IPC/native access test.

Nine captured harness/product/report inputs were unchanged during this independent recheck. Original authored diagnosis remains SHA256 `668b0ee009c7a50543d3753d6b12e6f0782dea886beed46a05226f8988ce8dcd`. Evidence under `evidence/code-source-context-independent-review/`:

| File | SHA256 |
| --- | --- |
| hosted-language-recheck-before.json | `33b5c623d09883c7b5c874c52d6690b6e9778a489294ed2a093fa71365f5b080` |
| hosted-language-recheck-after.json | `1ac0e9b6f30002fcf52dee80580f3969f1fe8df241b65a19ab440a40195f4414` |
| hosted-language-recheck-probe.mjs | `9fa31567fc630581d9835788fc4cf1d32b1ea1128dd9f5954e006c9241b58e9f` |
| hosted-language-recheck-probe.log | `a0db53705f9829a84d9217719dcdfe1953f61d2e45dac0e9bd6c5faf1c3c8b98` |

## Separately executed native evidence inspected

I read and rehashed root's outer receipt `evidence/workspace-surface/native-python-fixture-recheck-2026-10-07T01-44-26.623Z/result.json`, SHA256 `e7e8dea5061e418b5648fc710c3a316760b23e5a2af6dbeb7f64d60418b9acbf`: COMPLETE, all three child exit codes0, changedInputs[]. I also read/rehashed the actual child receipts under `evidence/source-read/`; all report COMPLETE, every recorded case true, inputsUnchanged true, and the corrected fixture/source hashes above:

| Execution | Receipt timestamp | Cases | Receipt SHA256 |
| --- | --- | --- | --- |
| source-read | 2026-10-07T01-44-26.745Z | 6 | `ad4cbe8c36ea1e1e0cf52bec21f703535fa30a9797ed4c16359d546684dae843` |
| view-control-rollback | 2026-10-07T01-44-39.807Z | 7 | `94b50d866640e518d3a65a12cfedcae8ddea698228e78c35cdc54681962d6263` |
| home-navigation | 2026-10-07T01-44-53.115Z | 11 | `212f787105557261b6c106678b929ca3cf2bca214b5ae8c6bc969b912b509587` |

These are later local executions with corrected metadata, not a rewritten verdict for original hosted run37556787785. Its FINAL FAILURE, original syntax-spans failure and skipped focused development Code step remain unchanged. I did not run GUI, build, suite, workflow or downloaded application, inspect screenshots, or approve release/main merge/installed replacement. Ongoing full-suite results are outside this recheck.
