# Bounded adverse reproduction: valid 300k-line bundle overflows base64 regex

Author: `/root/media_batch_review`, 2026-10-07. I authored the parser; this is a factual adverse reproduction, **not independent approval of my implementation**. Root discovered the actual native failure. I independently reran the retained file and isolated the failing expression without modifying product/tests/generated inputs while the parent's common full suite held its source freeze. No GUI/global suite/CI was run by me.

## Demonstrated failure

`parseSourceBundle` at captured `src/sources/bundle-import.mjs:69:167` throws `RangeError: Maximum call stack size exceeded` from `RegExp.test` on root's actual retained native backup `evidence/source-bundle-import-native/2026-10-06T21-13-58.626Z/actual-export.siren-backup`.

The exact source syntax is:

```js
/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
```

The **9,454,085-byte** wire file contains one source with **7,088,891 bytes**, **300,000 lines** and **9,451,856 base64 characters**. Direct independent decode reproduces exact byte count, canonical roundtrip and the declared source SHA256. These sizes remain below the unchanged 64MiB wire / 32MiB source caps. This is not a demonstrated malformed-input or configured-budget refusal.

Isolating the identical regular expression on that exact valid base64 string reproduces the same `RegExp.test` stack overflow, both fresh and after ten small valid matches. A separate valid 2MiB base64 control succeeds. Thus the prior real-export 2MiB positive test was true but too small to establish the larger intended capability. Neither positive evidence nor this new adverse result should be deleted or recast as the other.

These observations localize the failure to the repeated-group base64 expression on a large input. They do not require guessing at the hidden application UI or asserting a precisely measured internal V8 stack-allocation algorithm. Root's native300k run independently recorded zero completed cases and Home unavailable, with unchanged inputs; that is parent-run native evidence, not my GUI execution.

## Bounded execution

Own command:

```text
node --max-old-space-size=192 evidence/source-bundle-300k-base64-adverse-2026-10-07/probe.mjs
```

Own probe caps the existing artifact at16MiB before reading and creates only ignored report/evidence output. It completes in under a second in this observed execution. The actual parser failure took42.93ms; isolated actual-string regex failures32.96ms/8.68ms; isolated2MiB control3.77ms. Sampled process RSS177,983,488 bytes and heapUsed24,373,328 bytes are end-of-probe metrics, not isolated parser peaks or a desktop capacity guarantee. The192MiB V8 heap setting is not a cap on total process RSS.

## Required correction and limits

After parent releases the common source freeze, replace the repeated-group preflight with a flat base64-character check plus explicit modulo/padding-shape validation, retaining predecode byte budgets and exact decode/re-encode canonical equality. Preserve rejection of junk, whitespace, misplaced/excess padding, omitted padding and nonzero unused bits. Do not widen limits or silently catch the range error as a successful parse. Add a genuine failing regression using this actual file or a controlled similarly sized real export before editing product, then preserve both RED and corrected evidence separately. Full native/route qualification belongs to root after the fix and source freeze.

## Captured identities

```text
src/sources/bundle-import.mjs 551dc265aae802b35e46e9bc5fab44f8adbbe35a8157166facc2ef60cda20345
tests/source-bundle-import.test.mjs 19e70c837f5c79b71cea61681154c4d68202d335233ba9a89bbb5c5eba70776d
actual native backup 8aa3e968d9944bc8fcadd89d3c0f7c54bfa9a8334d840fbe380d27c12a09eee3
```

Own exact stacks, source/canonical/metric checks and timing observations are retained in `evidence/source-bundle-300k-base64-adverse-2026-10-07/{probe.mjs,probe.log,result.json}`. Earlier parser/scalability and native100k positive evidence remains unchanged. This report records an open defect; it is not a correction, maximum-size claim or approval.
