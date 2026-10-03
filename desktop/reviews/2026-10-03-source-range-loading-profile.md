# Sources readiness: current bounded range loader profile

Date: 2026-10-03. Reviewer: recovery/diagnostics agent. Scope: unchanged owned SourceRepository in Node, six cases measured exactly once. No product, main, client, editor, package, tracked test, or dependency changes; no native Electron/CUA/full-suite run.

**Result:** eagerly reading the 18.6 MB, 300k-record Python-shaped source through fresh per-call repositories took 142 calls and **17.296 seconds of read-call time**, with a longest call of 133.30 ms. The corresponding 100k-record source took 48 calls and 2.035 seconds. The current fixed 131072-unit chunk strategy also refused the first Unicode range in both sizes with `INVALID_UNICODE`. These are concrete loader costs and an adverse range-boundary result before CM integration; they are not live-editor responsiveness or Electron readiness measurements.

## Fixed matrix and measurement

One driver execution: `node evidence/source-range-profile/profile.mjs`, exit 0. Evidence: `evidence/source-range-profile/2026-10-03T00-34-07-767Z/result.json`, plus six individual case JSON files. A completed measurement process does not mean every case passed: four are `COMPLETE`, two remain `ADVERSE`. No retry, changed chunk, silent normalization, timeout increase, or rerun-to-PASS occurred.

Each case used its own fresh Node process and canonical temporary owned ProjectStore + SourceRepository fixture. The source was imported once, metrics fetched once, then sequential ranges of at most 131072 UTF-16 units read using a **new SourceRepository per call**. A single safe-EOF append edit and a single blob commit followed. The hard child bound was 60000 ms; the worker also stopped starting operations after 59000 ms. No bound was reached; the longest whole case was 18.523 seconds. Every owned fixture was cleaned. Progress was recorded per phase and every eight reads.

The predetermined source shapes were compact `x` plus LF; a 61-character ASCII Python-ish body plus LF; and a 61-UTF-16-unit Unicode body containing emoji and Ș, plus CRLF and one source BOM. Unicode fixtures have 63 units/66 UTF-8 bytes per record. All sources end with a line terminator, so the model's metric line count is the nominal record count plus one. Sources range from 200000 to 19800003 bytes; all are below the native 32 MiB source cap. No cap refusal was encountered or inferred.

Expected SHA-256 was computed independently with Node crypto by updating a stream with the BOM prefix, each predetermined line's UTF-8 bytes, and, for edited content, the exact appended suffix. Actual successful read text was UTF-8 encoded into a separate incremental hash without retaining a full returned text string. Complete streams matched the independently expected full original hashes. Import, metrics, and the one edit/commit receipt matched their corresponding expected hashes in all six cases. Unicode full-read verification remains incomplete because its first range refused; the empty read-stream hash is not substituted for a source hash.

## Timings and memory

All durations below are milliseconds. Read time sums only repository calls, including a refused attempt where noted. Total includes fixture/expected-hash construction, owned project setup, progress/result I/O, edit/commit, and cleanup.

| Shape / nominal records | Source bytes | Successful / attempted reads | Import | Metrics | Read sum | Longest read | Edit | Commit | Whole case | Peak RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact 100k | 200000 | 2 / 2 | 71.67 | 32.12 | 59.19 | 32.64 | 84.27 | 78.31 | 361.57 | 241.89 |
| Compact 300k | 600000 | 5 / 5 | 150.62 | 80.15 | 373.76 | 76.86 | 196.32 | 191.35 | 1038.16 | 356.41 |
| Python 100k | 6200000 | 48 / 48 | 125.33 | 48.56 | 2034.74 | 45.72 | 135.48 | 124.23 | 2539.20 | 277.05 |
| Python 300k | 18600000 | 142 / 142 | 299.19 | 134.00 | 17296.28 | 133.30 | 355.41 | 323.73 | 18523.39 | 444.32 |
| Unicode 100k | 6600003 | 0 / 1, refused | 145.09 | 65.46 | 63.08 | 63.08 | 185.83 | 181.99 | 693.36 | 277.63 |
| Unicode 300k | 19800003 | 0 / 1, refused | 354.06 | 192.08 | 188.85 | 188.85 | 501.37 | 457.96 | 1762.80 | 519.26 |

Python median read-call time was 42.67 ms at 100k and 121.46 ms at 300k. Read-phase wall time was 2061.14 / 17342.15 ms respectively. At 3× lines and bytes, total measured read-call time was approximately 8.50×. This is a two-size one-pass observation, not a statistically established complexity law or percentile/latency guarantee.

Environment: Node **v24.16.0**, win32 x64, OS release 10.0.26200, Intel Core i9-13900HX, 32 logical processors, 34086969344 bytes physical RAM (about 31.74 GiB). RSS is whole worker process resident memory, not SourceRepository-exclusive heap or editor memory. The case JSON records sampled RSS and the runtime's cumulative native `process.resourceUsage().maxRSS` in KiB; the reported peak uses that native peak converted to bytes and the sampled RSS maximum. Each worker has a separate peak, so earlier cases do not contaminate later peaks. Memory includes the input fixture buffer, source loading/model allocations, edit/commit, and runtime/GC overhead.

These are Node measurements, not Electron main/renderer measurements. The files were imported immediately before reads; no cold-cache control, forced GC, CPU isolation, repeated statistical runs, editor painting, highlighting, native IPC overhead, or CM mounting was measured. The hardware is stated so these numbers are not generalized to another machine.

## Preserved Unicode refusal

Both Unicode cases refused **`readRange({version:1,start:0,end:131072})`** with `INVALID_UNICODE`; successful count remains zero. The BOM occupies one unit; each line occupies 63. `(131072 - 1) % 63` is 31. The emoji's high/low surrogate units occupy line offsets 30 and 31, so this endpoint splits the pair. This fixture geometry was fixed before the matrix run and disclosed to the parent before execution. The existing TextModel refusal is correct and was preserved.

The later safe-EOF append edit and blob commit succeeded once in each case and matched independently expected edited hashes; that does not convert either failed loading case to `COMPLETE`. There was no adjusted boundary request or second full-read attempt.

**Untested adapter strategy, separate from these measurements:** preserve the refusal, maintain the exact pinned version and a previously acknowledged safe start, and explicitly request a smaller end (such as one unit earlier) through the same typed API when the cap endpoint splits a surrogate. Advance only by the newly acknowledged endpoint, and validate the entire resulting UTF-8 hash. This changes range coordinates rather than source bytes. The current error does not distinguish invalid start from invalid end, so a strategy must establish safe starts and cannot blindly normalize or retry arbitrary ranges. It needs its own adverse/complete-chain qualification; it was neither implemented nor benchmarked here.

## What the source actually does

`SourceRepository.readRange` calls `load` for every range. The unchanged `load` reads the version journal and base blob, constructs a TextModel for the full source, replays relevant edits, materializes full bytes, and verifies the full hash before returning the requested range. No reusable model cache exists in that path. These are direct source observations, not sampled stack attribution.

This profile times the whole operation. It does not separate filesystem/cache costs, parsing, decode, TextModel line indexing, reconstruction, hashing, GC, or object construction. In particular, it does not attribute the measured time specifically to constructing a new repository object: reusing the same current object would still call the same uncached `load`, but that variant was not run. The current per-call path shows a material bulk-loading cost and requires an explicit loading policy before it can be treated as an eager large-source CM loader. Any future caching/worker strategy must preserve per-call native grant/version/hash checks and protected publication guards; no such product change is part of this profile.

## Expected hashes and frozen identities

| Case | Independently expected original SHA-256 | Independently expected edited SHA-256 |
| --- | --- | --- |
| Compact 100k | `660aaa8fa7ab10f125196ef272b89b4ce3830f2b2c46978ac658d3b9ac48ee6e` | `5b20590262a00ee302cec6fc9419436156b84be6512d93e83800243b120dbf6a` |
| Compact 300k | `c141d2b3dc45071a03e28382aa0fc56142b7ba38a63401381f51cb81b12a0563` | `d20bc6817b0341c42d3368ea5280b77a08b29192b83f8763ca8e0ed543f1385e` |
| Python 100k | `148c9186dc5670f01ab55c04bbf8507f262ac6f194eac79a3de52fb7b0fac325` | `54525add805ee1f51c2356817753111ae4a4b7f0ac4c5980f58f006d41a3b043` |
| Python 300k | `2c700abdb4075f6256d3322e8f07d47fa56e5703a802cf0a72433598dbdfe888` | `067c6c584485c349e255c8655aa25bb33df466fc910aa3453cfeb75bd8437fe6` |
| Unicode 100k, incomplete read | `386b3738a83cbb63c8711fb23697d7c0695f9f36444fdd84d1fc61f6c412d752` | `0b244a81c20f77943d3d150b9ab535f1af7c0c579b8cf9e1757cc7b7277b3f94` |
| Unicode 300k, incomplete read | `18602ea7d1fba9ac7783e7ea165f04c8cc2a756830c5de2556e65ed0e750eab8` | `4337ef22fca1ebf5bf6a6dda2f8ab205421b4b75491b2a67c5bada33f168b8f1` |

The four measured source hashes matched before and after this single matrix:

| File | SHA-256 |
| --- | --- |
| `src/sources/repository.mjs` | `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457` |
| `src/sources/text-model.mjs` | `359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585` |
| `src/sources/metrics.mjs` | `4fad1128b218b0af1f40d6412112e9c7eebbe20f1785310ba66c8a5e9ca46ad6` |
| `src/projects/store.mjs` | `e5b1d7faef5bab934577dcff40fc4a6aa31dd3d0c4c0d842aea614fe0147faf7` |
| Ignored profile driver | `4e49d4b4a60213bddca7026e60627dfb70a4598960e3163382203ea544da985e` |
| Ignored worker | `1b85f248c6ce61ca04ea623667684221366e503dec02a0af7a81b15d0fb050a3` |
| Matrix result JSON | `f5f87eda9d9f9add797090e63e8acde8cfae99d66cef477ce496799102b2312e` |
