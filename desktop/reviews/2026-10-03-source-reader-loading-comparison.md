# Independent Node comparison: version-pinned source reader

Date: 2026-10-03. Scope: one frozen comparison matrix of the root's isolated `SourceReaderPool` / `SourceRepository.openReader` implementation. No source, tracked test, old probe/report, main, client, editor, dependency, package, native Electron, CUA, or full-suite changes/runs occurred in this task.

**Measured result:** all six byte-identical source fixtures completed a version-pinned chunk stream with the exact independently expected UTF-8 SHA-256. For the 18.6 MB, 300k-record Python-shaped fixture, opening the verified snapshot took **130.717 ms**; 142 chunk calls summed to **1.641 ms**. Chunk-phase wall time, including expected-coordinate checks, UTF-8 hashing and measurement logging, was **28.797 ms**. Open plus that transfer phase was **159.514 ms**, compared with the original fixed-range profile's 17342.15 ms read-phase wall time on this machine. This establishes an isolated Node loading improvement for the measured inputs; it does not qualify a live IPC, Electron main/renderer, or CM editor.

The two earlier Unicode fixed-range refusals remain adverse evidence. The new API names an upper unit bound and returns the actual end; the profiler consumed that acknowledged end without retries. Its full streams preserved every BOM/newline/emoji byte. The old exact-end `readRange` contract and original probe were not changed or relabeled.

## One measurement and evidence

Exactly one execution: `node evidence/source-reader-profile/profile.mjs`, exit 0. Matrix evidence: `evidence/source-reader-profile/2026-10-03T04-38-45-413Z/result.json`, plus six case files. All case processes exited 0 with `COMPLETE`, no timeout, and owned fixture cleanup verified. Each case retained the original 60000 ms hard bound and 59000 ms stop-starting-work limit; no delay, retry, repeated run, changed limit, or adjustment in the measurement driver was added to produce a successful result.

The same deterministic fixtures as the original profile were used: compact `x`+LF; a 61-character ASCII Python-ish body+LF; and a 61-UTF-16-unit body with emoji/Ș+CRLF and one source BOM; 100k and 300k records each. The Unicode line is 63 units / 66 bytes including CRLF. Actual input SHA-256 equals the original matrix's independently expected input hash for all six cases. Sources still range from 200000 through 19800003 bytes, below the native 32 MiB cap; nominal line count excludes the final empty line metric.

Each isolated Node worker used a canonical temporary owned ProjectStore/SourceRepository. Import and metrics ran once each. It then opened one reader with an **explicit version 1**, called `readChunk({start,maxUnits:131072})` sequentially, validated exact source/version/start, a progressing acknowledged end within the maximum, text-length/end equality, and well-formed Unicode, and advanced only to that acknowledged end. It incrementally hashed the returned UTF-8 without assembling a retained full returned text string. The reader was disposed in `finally`; a read after disposal was independently verified to refuse `SOURCE_READER_CLOSED` in every case.

Expected full SHA-256 was generated independently by streaming the predetermined UTF-8 prefix and each line into Node crypto. The original imported input buffer was separately hashed, and original source blob bytes were streamed from disk before and after reading. Source pointer bytes and selected journal bytes were captured before and after; the original ProjectStore snapshot was compared before and after. All original blob, pointer, journal, and project snapshots were preserved. No edit or commit was performed in this read-only comparison.

The reader used the actual repository's captured read guard, with assertions for the exact project/source/read action. Guard counts were 6, 12, 98, 286, 100, and 292 respectively: two open checks plus two checks per successful chunk. This exercises the isolated owned repository guard; it does not substitute for native WebContents/window/epoch admission, Lock transition disposal, or the future typed renderer reader protocol.

## Actual timings

Milliseconds; read sum times only `readChunk` calls. Transfer wall includes the independent hash, coordinate assertions and periodic progress I/O. Whole case also includes fixture generation, import, metrics, disk-preservation checks and cleanup.

| Shape / records | Open | Chunks | Chunk-call sum | Longest chunk | Transfer wall | Open + transfer wall | Whole case | Peak RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact 100k | 28.210 | 2 | 0.271 | 0.230 | 0.616 | 28.826 | 186.288 | 167.133 |
| Compact 300k | 77.653 | 5 | 0.290 | 0.186 | 0.918 | 78.571 | 363.759 | 239.484 |
| Python 100k | 48.440 | 48 | 0.754 | 0.274 | 9.929 | 58.368 | 312.361 | 196.883 |
| Python 300k | 130.717 | 142 | 1.641 | 0.197 | 28.797 | 159.514 | 704.339 | 330.000 |
| Unicode 100k | 61.225 | 49 | 1.178 | 0.284 | 21.607 | 82.832 | 370.580 | 166.961 |
| Unicode 300k | 189.438 | 145 | 2.087 | 0.266 | 52.104 | 241.542 | 905.543 | 339.684 |

Import/metrics durations were 73.395/36.546, 146.238/80.780, 123.994/63.042, 302.135/138.081, 151.375/67.258, and 356.541/190.942 ms in the same case order. These full verification operations remain measurable; they are not hidden in the very small in-process chunk-call sums.

| Shape / records | Original range read-phase wall | New verified open + chunk-phase wall |
| --- | ---: | ---: |
| Compact 100k | 59.44 ms | 28.826 ms |
| Compact 300k | 374.36 ms | 78.571 ms |
| Python 100k | 2061.14 ms | 58.368 ms |
| Python 300k | 17342.15 ms | 159.514 ms |
| Unicode 100k | First fixed range refused; full stream unavailable | 82.832 ms, exact full hash |
| Unicode 300k | First fixed range refused; full stream unavailable | 241.542 ms, exact full hash |

For Unicode, the first actual end was **131071**. There were **24** / **72** acknowledged shortened boundaries at 100k / 300k. The product reader validates the start, then retreats only an endpoint that splits a surrogate and reports the actual coordinate. The profiler did not alter a request or catch/retry a refusal: each call used the same fixed `maxUnits`. Complete SHA-256 equality confirms that those coordinate changes dropped/replaced no source bytes. This is a different explicit API from the old request `{start,end}`; it is not interchangeable with the existing exact-coordinate client/IPC bridge without separately qualified integration.

## Process and qualification limits

Node v24.16.0, win32 x64, OS release 10.0.26200; Intel Core i9-13900HX, 32 logical processors, 34086969344 bytes RAM (about 31.74 GiB), matching the earlier machine. Each case runs in a separate Node process. RSS records sampled resident bytes and native `process.resourceUsage().maxRSS` in KiB; peak is the maximum converted native peak/sampled value. It includes runtime, fixture input buffer, import, metrics, retained full TextModel, hashing, disk checks and GC overhead. These are neither SourceReaderPool-exclusive memory nor Electron renderer/main memory measurements. The old whole-case peaks additionally included edit/commit and repeated full loads, so a direct memory-saving percentage would compare different workloads and is not claimed.

Files were imported immediately before measurement. No cold-cache control, forced GC, repeated statistical runs, CPU isolation, native IPC serialization/copying, frontend document construction, syntax work, highlighting or painting was measured. The small chunk-call times are in-process native-module calls, not end-to-end renderer latency. The root's reader retains a verified whole model after one full `load`, so the full-source verification/indexing cost appears in open instead of being repeated for every chunk. The profile does not separately attribute its open cost among I/O, decode, model construction, hash verification and GC.

Disposal was verified logically; no immediate RSS reclamation claim follows. The helper's reader-count/source-byte budget is not a fixed RSS budget. Native integration must share the pool across per-call repositories, dispose it on Lock/selection changes, and retain current grant checks before/after requests; this matrix does not qualify those unimplemented live seams. All six streams here stayed within the existing reader TTL and case bounds.

## Hashes and preservation

Each row's expected original hash, actual input hash, opened snapshot hash, full returned stream hash, and before/after disk blob hash matched:

| Fixture | SHA-256 |
| --- | --- |
| Compact 100k | `660aaa8fa7ab10f125196ef272b89b4ce3830f2b2c46978ac658d3b9ac48ee6e` |
| Compact 300k | `c141d2b3dc45071a03e28382aa0fc56142b7ba38a63401381f51cb81b12a0563` |
| Python 100k | `148c9186dc5670f01ab55c04bbf8507f262ac6f194eac79a3de52fb7b0fac325` |
| Python 300k | `2c700abdb4075f6256d3322e8f07d47fa56e5703a802cf0a72433598dbdfe888` |
| Unicode 100k | `386b3738a83cbb63c8711fb23697d7c0695f9f36444fdd84d1fc61f6c412d752` |
| Unicode 300k | `18602ea7d1fba9ac7783e7ea165f04c8cc2a756830c5de2556e65ed0e750eab8` |

Frozen measured inputs matched before/after the one matrix:

| File | SHA-256 |
| --- | --- |
| `src/sources/readers.mjs` | `05b6163fcdfadc06c338e70af42aa75a3d1a2549b615c0c86891a6e6cc79c30d` |
| Reader-enabled `src/sources/repository.mjs` | `af78ecd33712e94ec05385bd4d7a8ee466dbd2f52376edccb16ebd91dd5164bf` |
| `src/sources/text-model.mjs` | `359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585` |
| `src/sources/metrics.mjs` | `4fad1128b218b0af1f40d6412112e9c7eebbe20f1785310ba66c8a5e9ca46ad6` |
| `src/projects/store.mjs` | `e5b1d7faef5bab934577dcff40fc4a6aa31dd3d0c4c0d842aea614fe0147faf7` |
| New ignored profile driver | `3f96efa8722aa35bcc3cebb8b9088ee612585eea4ddcb15e5cd4394d6c6fe2fd` |
| New ignored worker | `f4492d5d3cf5fbb99e1ffa3e664aba7880062a0ce1c5c566ae122585d92a0499` |
| New matrix result JSON | `b07f391fddeb2891ff082813725b008e0c13bbbced3f422e25f2a75a64012153` |

The original range matrix remains SHA-256 `f5f87eda9d9f9add797090e63e8acde8cfae99d66cef477ce496799102b2312e`; its original report remains `84cee53df329d53751a3e7faffdcd6259249e95fb7f2b4807b269644ce32e27e`. They were rechecked unchanged. The comparison report adds new evidence without rewriting those earlier failures or claiming that a preserved original probe passed.

## Subsequent product hardening, outside this measurement

After this matrix completed, the root reported additional pool hardening: private capacity/TTL fields and expired pending-load slots retained until their loads settle. The root reported its own 9-test RED/GREEN evidence for that change. A later read-only observation found readers SHA-256 `b4eb8887ba932147ef46cf7aeeafb3ae4a897c44b65ac762ddbc3af9b1d386eb`, while repository SHA-256 still matched `af78ecd3…`. This reviewer did not rerun the comparison or independently validate that later change in this task. The table above remains the exact first measured source snapshot, including readers SHA-256 `05b6163f…`; later readers bytes differ. Even if readChunk/load code is reported unchanged, these timing results are not silently reassigned to a new product identity or promoted to final native/CM/full-suite admission. The original and comparison matrix JSON files remain immutable.
