# Independent bounded source-bundle scalability measurement

Author: `/root/media_batch_review`, 2026-10-06. I authored and executed two isolated Node probes using the real `ProjectStore`, `SourceRepository`, manifest commit, saved recovery checkpoint and `RecoveryStore.exportSourceSnapshot` implementations. No product, root tests or generated application inputs were changed. No GUI, Python interpreter, packaged application or hosted CI was run by me. This report measures the tested path; it is not a maximum-size guarantee or release approval.

Both children completed their exact checks. The 100,000-line pipeline took 927 ms and the 300,000-line pipeline 2,238 ms internally. All four version exports preserved exact bytes, hashes, provenance and snapshot metadata. The existing file-import route still rejects these source bundles, separately described below.

## Bounded method

Each child ran Node v24.16.0 with `--max-old-space-size=192`. Its controller enforced a 55,000 ms process timeout, a 2 MiB stdout/stderr capture cap and a hidden console. Both returned exit 0 with no signal, timeout or process error. Each child handled one source, two source versions and two saved schema-2 manifests/checkpoints. There was no intentional OOM run or unlimited fixture generation.

Input is deterministic valid flat Python: repeated `x = 123 # Ș😀` assignment/comment lines, UTF-8 BOM, CRLF, and no final newline. One actual repository edit changes the first line's `123` to `124` without changing byte length. The repository's actual reference metrics report exactly 100,000 or 300,000 lines. Provenance contains an agent ID, release ID and unknown nested fields. This tests Unicode/newline/byte fidelity and line-count scaling, not complex Python AST/control-flow scalability.

Logical source bytes across both versions in both runs total **14,400,004 bytes**, below the authorized 16 MiB aggregate source budget (16,777,216 bytes). Actual retained `Data` files total 3,608,472 bytes and 10,808,472 bytes respectively. Bundles were checked in memory; no duplicate full exported backup files were stored. Two independent child executions are samples, not a benchmark distribution. No warm-up, forced GC, retry-to-pass or repeated timing selection was used.

## Actual export measurements

| Python lines | Saved source version | Exact source bytes | Bundle bytes | Export call elapsed |
| ---: | ---: | ---: | ---: | ---: |
| 100,000 | 1 | 1,800,001 | 2,401,897 | 15.1 ms |
| 100,000 | 2, edited | 1,800,001 | 2,402,021 | 50.8 ms |
| 300,000 | 1 | 5,400,001 | 7,201,897 | 46.9 ms |
| 300,000 | 2, edited | 5,400,001 | 7,202,021 | 142.9 ms |

The export timing includes the actual source verification/replay and full source-bundle serialization; it excludes the subsequent own JSON decoding assertions. Those decoding checks took 11.6/12.0 ms for the 100k versions and 41.1/38.1 ms for the 300k versions. Full pipeline measurements also include project creation, import, both manifest/checkpoint saves, actual edit and verification. Version-two manifest/checkpoint saves took 375.7 ms / 897.0 ms. Version-two export is slower than version one in these samples; actual edited versions replay through the text model, whereas version-one verification can export immutable bytes without materializing that model. These timings do not prove a universal scaling function.

| Whole-child measurement | 100,000 lines | 300,000 lines |
| --- | ---: | ---: |
| Measured pipeline elapsed | 926.9 ms | 2,237.5 ms |
| Process high-water RSS | 217.0 MiB | 359.4 MiB |
| Highest sampled `heapUsed` | 80.6 MiB | 117.2 MiB |
| Highest sampled `external` | 41.4 MiB | 78.5 MiB |
| Process user CPU time | 718 ms | 2,406 ms |
| Process system CPU time | 437 ms | 578 ms |

Memory snapshots were taken before/after each stage; synchronous allocations inside a stage can exceed those sampled heap/external values. `process.resourceUsage().maxRSS` provides the whole-process high-water mark. It includes import/edit/recovery work, my retained expected-byte buffers and my JSON/base64 assertion work, so it is **not isolated peak export memory**. CPU metrics are process totals, not a claim that CPU time must equal wall time.

The **192 MiB V8 old-space cap is not a total process-memory cap**: observed RSS exceeds it in both runs. No product memory ceiling is established by that flag. Current `src/sources/recovery.mjs:25` verifies source buffers, creates base64 strings, JSON-stringifies the whole bundle and then constructs its output Buffer; this bounded probe exercises that fully buffered design. It does not test the 32 MiB per-source or 256 MiB project-source limits, many independent sources, thousands of retained versions, concurrent exports or maximum aggregate bundle memory.

## Exactness assertions and separate importer gap

For each of four actual exports, my probe JSON-decodes the bundle, base64-decodes its source, compares every byte to the expected version, re-hashes it against the actual source reference, compares the complete reference/provenance and compares the entire snapshot. BOM, CRLF, Romanian letter, emoji and unknown nested provenance survive. Both manifest commits require a successful receipt without recovery-degraded durability. There is no lossy-text or provenance defect reproduced in these samples.

All four actual exported bundles were passed unchanged to current `parseLegacyImport`; all four rejected with **`Not a SIREN workspace export`**. This reproduces the already-known source-bundle import gap rather than discovering a new scalability failure. Static source confirms both the legacy main import route (`src/main.mjs:321`) and Home import route (`:759`) use that parser. It recognizes the older workspace formats, while the exported object has `format:'siren-source-bundle'`, schema 2, a snapshot and separate sources. These tested bundles are below the general workspace-size budget, so this rejection is format incompatibility rather than an oversized-input rejection.

Local owned-project opening and checkpoint recovery are distinct routes; rejection of a chosen bundle file does not imply the saved local project/checkpoint is lost. This measurement does not implement or approve a new importer and does not call its own bundle-decode assertion a user-visible import round trip.

## Exact evidence and input identities

Evidence is retained separately under `desktop/evidence/source-bundle-bounded-scalability-2026-10-06/`. Each size directory has an actual result, controller receipt, stdout/stderr and owned source/project/checkpoint files. Summary metrics are in `summary.json`. No earlier adverse evidence was edited or rerun.

```text
child.mjs 9f248a4eeda3740ce876a621c417f1d4159ea57b2a9137541cf01fa33ee3cabc
run.mjs 11997d67c75460e3f34134d675d5a19f1b0a7cbce4727739e2ba7572d09cdbf4
summary.json 9fcecf264e8855bf40e4c7945947b3d065f6795f4687fedc2c8c6a9fce7d38fb
100000/result.json d21f4b3d1baa0cb74ece8b86e21fa599ec88e09c29314d8fa21fe2873ac1cb28
100000/process.json 53b837514e4eb270da463bacd30d77dac7874a6d0e9b04e3e5c9e6169949da72
300000/result.json d6f77b9d178e1526a7c4ac45a6c20c52e3a2f665b8f425dff068b72accd32997
300000/process.json 6bdae3fc0dd1da949d4291f040ee7564bd3bf27ea05c10150983803f41f2ef1c

src/sources/repository.mjs ce4ba2ff620af9961b0b389b28c258491b5f13423ce32e1bd298ebf8d047b2e4
src/sources/text-model.mjs 359274f92067872fa11435e3e7aede8161ee2b7510b4930664173f85f10aa585
src/sources/manifest.mjs 1d31f69a6ac0f1281a908bddacf0325c2f773b65c6c03f90781b31674e0086a1
src/sources/recovery.mjs 4fddd4915be81e2290476fe5b113410c14af741f77206cf80b48a3ee23a6761a
src/recovery/checkpoints.mjs 3c840c707d2fc71d7ca8c2067994e0baa10d7e2f332d44f35c22dc084b6eb36c
src/projects/migration.mjs 5a13e71306f7fcb9a6945fc2b55ded31d2a37402bc880b7768e5c8eca08d3a01
src/projects/atomic.mjs 803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4
```

Both result files record the same implementation identities, rechecked against actual source after the probes. Local HEAD at the post-run read was `b15220d0c30be88f5a81cfb1ff146abcf012a7bf` (sync-record metadata); the individual hashes above identify the actual exercised implementation. This report does not attach itself as approval to a concurrently queued immutable hosted run.

Physical-monitor UX, scrolling, syntax highlighting, Python visualization, editor responsiveness and UI stalls are **unverified** here. The measured backend success at 300k short lines does not establish those properties or a maximum supported line/character count.
