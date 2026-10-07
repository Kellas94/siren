# Implementation correction: bounded flat Base64 preflight

Author/implementer: `/root/media_batch_review`, 2026-10-07. This records my parser correction, **not independent approval of my own code**. Product edits are confined to `src/sources/bundle-import.mjs` and focused `tests/source-bundle-import.test.mjs`. No helper, main, catalog, build/generated assets, package/workflow, baseline, GUI, global suite or CI changes/runs were made by me. Parent released the common source freeze only after its1215-unit plus identity run had completed unchanged; that earlier pass did not qualify this later correction.

Original adverse reproduction remains immutable at `reviews/2026-10-07-source-bundle-300k-base64-adverse-reproduction.md`, SHA256 `6946278bb45a19709a49d0d186f5e8167dd03270df2df9219c6e4f0c27e055f1`. Root's actual native300k failure and earlier100k/2MiB positives remain retained separately.

## Change

Removed the repeated-group Base64 regex that overflowed the V8 stack on a valid large string. The predecode pass now rejects characters using a flat negated character class, requires length divisible by4, determines zero/one/two trailing padding characters, and requires the first `=` to begin exactly that trailing padding. This rejects embedded, leading or excess padding without repeated groups or copying the encoded string. Existing predecode wire/per-source/aggregate limits, reference validation, decode/re-encode canonical equality, source hash/metrics/provenance and original manifest checks remain unchanged. Canonical equality still refuses unused padding bits such as `Zh==` and `Zm9=`.

No caps were widened, no input is truncated, and a thrown error is not reclassified as success. Empty source Base64 remains valid for an actually empty referenced source. Non-source legacy JSON behavior remains unchanged.

## TDD and actual retained-file verification

Before product edits I added:

1. A deterministic actual backend-export test with300,000 Unicode Python lines, BOM and CRLF. It generates the same source shape as the retained native failure: **7,088,891 exact bytes**. The test verifies source bytes, provenance/metrics, snapshot/metadata, original wire and unchanged original project.
2. Canonical empty/unpadded/one-padding/two-padding controls and malformed leading/embedded/excess padding, whitespace/junk and unused-bit controls.
3. An ignored evidence-only probe that reads the **exact retained native** `actual-export.siren-backup` and verifies its fixed length/hash before calling the parser. The committed unit test does not depend on ignored native evidence existing in another checkout.

Genuine old-product REDs are retained: exact actual-file probe exited1 with `RangeError` at `RegExp.test`/parser line69; focused parser tests **11 pass, 1 fail** on the generated300k export with the same stack. The earlier2MiB case and padding controls passed, demonstrating their prior insufficiency rather than negating the larger defect.

After the correction, the exact retained **9,454,085-byte** file parses successfully under `--max-old-space-size=192`. Its wire SHA256 stays `8aa3e968d9944bc8fcadd89d3c0f7c54bfa9a8334d840fbe380d27c12a09eee3`; decoded source is **7,088,891 bytes /300,000 lines**. Snapshot, metadata, complete source ref/provenance and canonical bytes match the original; rereading the source file proves it unchanged. Observed parser time62.43ms, end-of-probe RSS115,351,552 bytes / heapUsed15,074,160 bytes are bounded sample measurements, not GUI fluidity, isolated peak memory, a total-process192MiB guarantee or maximum supported size.

Focused related copy/parser/admission/selection/recovery/manifest/migration tests: **64/64**, exit0. Both original2MiB and new300k actual-export regressions pass, with unchanged corruption, provenance, raw encoding, pointer graph, checkpoint, unconfirmed completion and selection/Lock controls. Root owns later full-suite/native/package/CI qualification and another author's independent recheck.

## Retained evidence

`evidence/source-bundle-base64-correction-2026-10-07/` contains `retained-actual-probe.mjs`, original `retained-actual-red.log`, `unit-red.log`, corrected `retained-actual-green.log`/JSON and `related-green.log`. It writes no replacement of the original native file. Earlier adverse reports and root native receipts were not edited.

```text
src/sources/bundle-import.mjs df8c9ff13a91cbb6769dba8faa90b7512d4fd62715d26da8c88345a1e960839f
tests/source-bundle-import.test.mjs e63946a634e2444b40e9e0afb17ecf6a121cd74305c55315560bc59b92a3d8d2
retained-actual-probe.mjs 6ef3c253242024171b9220238dff237cb69c8c9808d808fb7018b955ee2e2ec4
retained-actual-red.log 27e2979fd372d814449398cfa641f73c4e28daf38f55af7dbe9fdd0abc396dbd
unit-red.log 833f6ac09a9df0d2130c7c82a7183b953a295c340c40fbd163e51c8a60ecd11e
retained-actual-green.json 95806248cc8c92123df93aa45bcd60978128be5caf991f440dc16fba75e5afe3
related-green.log f6b0048d264259ca490f51addde8fea1c65ae885b9b5239aef2e8611d111fda8
```

No additional product edits are planned; ready for source freeze and separate review.
