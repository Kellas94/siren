# Desktop evolution: bugs and bounded scale review

Reviewed 2026-10-02. This is a non-security code review and synthetic scale experiment, not a formal security scan or release approval. No product, baseline, driver, real user Data, or real credentials were changed. Native probes used isolated owned fixtures and explicitly authorized fixture PIN setup. Python was parsed as text, never executed. No OpenAI API work was performed.

## Source identity and evidence

| Source | SHA-256 |
| --- | --- |
| Frozen web baseline | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| Actual generated renderer | `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8` |
| `src/main.mjs` | `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63` |
| `src/projects/store.mjs` | `a6316abb4b20467293b59db21654e4d2d8893fb345f7a7a719cb1b1239837767` |
| `src/ui/storage.js` | `9691d51e1c90bd850848f0ec3144949ab7a2a9ba792da72e98c545b7387d05a2` |
| `build/renderer.mjs` | `321aa70263827454e9efe23a51ea74205f1312042d94f1d1062dd9e7cb14cde2` |

Node was 24.16.0, Electron 44.5.1, on this Windows host. Probe scripts and raw results are retained under `desktop/evidence/`:

- `evolution-scale.mjs`; results `evolution-scale-2026-10-02T19-37-50.854Z/result.json`.
- `evolution-revision-boundary.mjs`; actual adverse fixture and result `evolution-revision-boundary-2026-10-02T19-38-44.411Z/`.
- `evolution-native-scale.mjs`; results `evolution-native-scale-2026-10-02T19-41-05.753Z/` and `evolution-native-scale-2026-10-02T19-41-55.096Z/`.
- `evolution-native-open.mjs`; result `evolution-native-open-2026-10-02T19-44-52.567Z/result.json`.

Native raw launch retained the actual PIN gate. The helper only authenticated owned test fixtures through production native receipts. All launched owned processes were closed after each probe; a final Windows process check found no Electron main process with an evolution fixture test-root argument remaining. The busy renderer from the input timeout was terminated through its owned driver; there was no repeated bulk-paste attempt until PASS.

## Confirmed defect: accepted workspace becomes an unreadable selected revision

**P2, data-integrity boundary.** `src/projects/store.mjs:10–14` accepts a workspace JSON string up to 64 MiB. `commit` serializes that string again inside its revision record, writes/verifies the file, replaces `current.json`, then calls `readProject` (`:59–68`). `readProject` permits reading 128 MiB plus 65,536 bytes but rejects any selected file over exactly 128 MiB (`:49–53`). The serialized envelope and escaped JSON string can exceed this smaller condition even when the inner workspace passed validation.

Actual isolated reproduction used exactly **67,108,864 workspace bytes**, containing a JSON property with backslashes. Validation accepted it. Creating the project selected a **134,217,961-byte** revision, then rejected its own readback with `Corrupt selected revision`. A subsequent native store read failed identically; `listProjects()` marked the newly created project damaged / `Recovery required`. The selected pointer and original revision file are retained, project `bfb8a491-78ca-45f1-a323-0ccb9fadead9`. No bytes were truncated. Create took 926 ms; process RSS immediately after the failure was 536,608,768 bytes, including large native buffers.

This is an actual store failure, not merely a calculated upper bound. The same `commit` path is used by workspace save, so an existing selected project is exposed to this condition; the existing-project variant was not separately executed here. Ordinary 1/8 MiB saves passed below this boundary.

Minimal repair seam: share one explicit serialized-record byte budget between validation, write, read, and recovery; reject an oversized serialized record **before changing the selected pointer**. The current read allowance already reserves envelope overhead, but the subsequent hard comparison discards that allowance. Preserve the adverse fixture and add a boundary regression for both creation and save while keeping the previously selected valid revision readable. Do not silently shorten the workspace.

## Code size: opening, input, analysis, and recovery are different qualifications

The source has deliberate limits, not general hundred-thousand-line structure support:

| Operation | Current source limit / behavior |
| --- | --- |
| Python structure map (`generated/app.html:110431`) | 100,000 UTF-16 characters, 3,000 lines, 120 mapped blocks; larger input returns `limit` |
| Syntax colors (`:110445–110446`) | Python only; disabled above 100,000 characters |
| Line gutter | Hidden above 10,000 lines |
| Standalone Code library | 80 files, 500,000 characters per file, 4 MiB aggregate UTF-8 JSON including metadata |
| Docs knowledge source (`:66898`) | 500,000 characters per source, 80 rows per block; 300 blocks per document |
| Private Code recovery (`:110317`) | 2 MiB aggregate serialized UTF-8 payload, including base and current text; at most eight open drafts |
| Draft undo history | Up to 64 full text versions per draft |
| Comparison | LCS only when changed-region product is at most 1,000,000; otherwise alignment is explicitly approximate; full rows are still allocated; UI preview limited to 2,000 rows |

Exact generated parser/analyzer functions were extracted into a bounded VM without changing them. Boundary oracles returned: 3,000 comment lines `ok`, 3,001 `limit`; 120 assignment blocks `ok`, 121 `limit`; a 100,000-character comment `ok`, 100,001 `limit`. These are guard tests, not successful huge-code analysis.

| Synthetic source | Characters | Analyzer | Standalone file validation | Private recovery when opening with an equal base |
| --- | ---: | --- | --- | --- |
| 80k compact `x=1` lines | 319,999 | limit | accepted | write scheduled; 800,116-byte payload |
| 100k compact lines | 399,999 | limit | accepted | write scheduled; 1,000,116-byte payload |
| 300k compact lines | 1,199,999 | limit | refused | memory-only |
| 80k representative lines | 2,959,999 | limit | refused | memory-only |
| 100k representative lines | 3,699,999 | limit | refused | memory-only |
| 300k representative lines | 11,099,999 | limit | refused | memory-only |

“Representative” here is the exact repeated 36-character line `value = value + 1 # synthetic source`, joined with LF, not a claim about typical repositories. VM storage receipts were synthetic promises; the timing snapshot could remain pending before their microtasks settled, and is not a durable native-save proof. Recovery capacity also depends on the base: a new edited draft with an empty base can fit when an opened source with both base and text would not. The limits are aggregate across drafts.

Native source-opening observations used real Code library pointer actions and actual editor/map state:

| Fixture | Editor value length | Open through map-limit message |
| --- | ---: | ---: |
| 80k compact lines, stored standalone source | 319,999 | 749 ms |
| 100k compact lines, stored standalone source | 399,999 | 853 ms |
| 300k compact lines, recovered private draft with empty base | 1,199,999 | 1,798 ms |

All three displayed the explicit map-limit message and hid the gutter. The combined fixture exceeded the aggregate private recovery budget after sources were opened; the UI honestly reported `In memory — download for a durable copy`. This confirms bounded opening and value length, **not** editing latency, huge-file native save, exact large-file restart/readback, Python execution, or whole-application safety.

**Adverse input result:** a single actual CDP `Input.insertText` paste of 80k compact lines into a new Code editor in the 200-Docs fixture exceeded the unchanged **20-second command timeout**. Subsequent screenshot and renderer state requests also failed to acknowledge within their command bounds; the probe then closed its owned Electron process. This is a confirmed harness-visible responsiveness failure under that scenario. The bottleneck is not localized to Chromium textarea layout, Code repaint, recovery serialization, or their combination; no profiler sample was captured, so a specific product root cause is unproven. The original failure is preserved. A first probe's attempted covered header click also failed the occlusion oracle; that was a fixture-navigation error, corrected to the real Docs Back button before the single bulk-paste attempt.

Observed renderer DOM counters after seeded opening reached 217,725 / 234,572 / 834,540 nodes for successive 80k/100k/300k cases. These counters include internal and detached nodes and earlier renders; they are not live visible element counts or total native memory. Renderer JS heap snapshots were approximately 36.6 / 28.3 / 24.3 MB and therefore do not measure the complete textarea/DOM/native footprint.

Extracted line comparison of a single changed line at 80k/100k/300k produced 80,001/100,001/300,001 result rows in 15.9/12.0/47.1 ms. This excludes native UI rendering and broad changed regions. A 100k-line draft with 64 whole-text edits retained 64 history entries totaling 25,600,694 characters; that history is separate from persisted base/text. These measurements support profiling and a bounded editor model, not a blanket performance verdict.

## Docs, diagram rendering, and full-snapshot costs

Native Docs fixtures each had one 20,000-character knowledge source per document. The fresh launch included native fixture setup and renderer reload; it is not a cold startup timing for an already configured user.

| Docs fixture | Initial workspace bytes | Open Docs register | Rendered register entries | JS heap at sample |
| --- | ---: | ---: | ---: | ---: |
| 200 documents | 4,115,884 | 74–97 ms | 200 | 26.1–55.3 MB |
| 1,000 documents | 20,564,684 | 205–243 ms | 1,000 | 177.3–189.2 MB |

The register currently creates every matching document button (`generated/app.html:70214`) and reconstructs it on render. This experiment qualified initial opening, counts, and sampled resources; it did not test typing/searching every document, large individual sources, images, archived revisions, export, or multi-hour sessions. `MAX_WORKPAPERS=Infinity` is a count policy, not evidence of unbounded practical storage.

The embedded Mermaid API was measured directly in the real renderer using simple chain diagrams, not through complete SIREN editing/auto-fit/export flows. Current config was `maxEdges=500`, `maxTextSize=50000`, layout `dagre`:

| Requested nodes / edges | Source characters | Actual render result |
| --- | ---: | --- |
| 100 / 99 | 2,944 | 100 node groups, 351 ms, 144,789 SVG characters |
| 300 / 299 | 9,742 | 300 node groups, 1,136 ms, 420,386 SVG characters |
| 600 / 599 | 19,942 | refused at 500-edge guard in 186 ms |

Larger/dense/cyclic diagrams, other layout engines, and sustained concurrent rendering are unqualified. The 600-node refusal is an observed configured limit, not a parser crash.

The native persistence probe performed three actual workspace saves, full verified checkpoints, pending acknowledgment, and revision pruning in isolated stores:

| Inner JSON payload | Save + checkpoint elapsed range | Retained bytes after three saves | Files |
| --- | ---: | ---: | ---: |
| approximately 1 MiB | 127–156 ms | 7,343,070 | 9 |
| approximately 8 MiB | 586–825 ms | 58,723,294 | 9 |

Source explanation: `src/ui/storage.js:19–32` captures the whole mirrored bag for each persistence operation and serializes native operations. Code persists on every edit. `RecoveryStore.checkpointProject` scans/parses/verifies saved snapshots before pruning and scans all projects again for its catalog. Retained saved checkpoints and revisions are whole snapshots, not deltas. The measured growth is expected from that design, not proof of lost writes. Large multi-project catalogs, long typing bursts, pending-copy accumulation, low disk space, and shutdown-drain latency require dedicated testing. The worker's sampled RSS rose to 350.5 MB during the 8 MiB sequence; allocation history and GC from earlier cases affect this shared-worker figure, so it is not a standalone minimum memory requirement.

## Suggested evolution batches and minimal module seams

1. **Data correctness first.** Repair the accepted-workspace/serialized-revision budget mismatch, test valid-pointer retention on a refused save, and preserve originals/recovery. Centralize envelope limits in the native project/recovery contract. This is the confirmed defect and the most concrete first batch.
2. **Editor responsiveness with profiling.** Capture a CPU/layout profile of the preserved 80k paste scenario before changing behavior. Separate text/draft/history state from DOM views; keep full source intact while painting only necessary line/syntax ranges. Give large-file capability limits explicit statuses. Debounce/coalesce ordinary edit persistence only after proving crash retention and acknowledged-close semantics; do not weaken those contracts.
3. **Persistence scale.** Extract a workspace repository/checkpoint scheduler from the full mirrored-bag adapter. Measure actual keystroke bursts and multi-project catalog scans before considering revisions/deltas, content-addressed sources, or retention changes. The existing acknowledgment queue is a seam to preserve, not bypass.
4. **Docs and diagram UI scale.** Separate the Docs register index/filter from its DOM renderer, then consider visible-row rendering if measured search/repaint costs justify it. Separate diagram parse/layout/render scheduling and report edge/text limits before rendering. Keep export and complete-source oracles distinct from screen previews.
5. **Module extraction with existing behavior tests.** First isolate Code source resolution, drafts, analysis/compare, and views at their existing pure-function boundaries. Reduce guarded string-replacement coupling in `build/renderer.mjs` incrementally while retaining baseline identity and actual native regression coverage. Avoid a wholesale rewrite of embedded libraries as the first step.

AI integration remains the later research batch requested by the user. No implementation choices here depend on it.

## Qualification limits

Only reviewer-owned probes/report were authored. Syntax checks and scoped diff checks passed; this review did not rerun or claim the complete unit/native suite or the pending PIN CI. The original security plugin preflight failure is not replaced by this report. All timings are single-host synthetic observations, not statistical performance guarantees. Successful analysis refusal, source opening, one-line diff, or store saves cannot establish that the entire app safely supports hundreds of thousands of lines.
