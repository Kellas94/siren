# Diagram Save / Attach passive diagnostic — prepared, not run

Author and preparation executor: `/root/disk_inventory`, 2026-10-07. This is preparation of an evidence-only diagnostic, not independent product approval. The original hosted failure **37552477003 remains OPEN**. No Electron/native scenario, GUI, package, build or product test was launched by this preparation.

The new ignored entry point is `desktop/evidence/workspace-surface/diagram-save-attach-passive-2026-10-07/driver.mjs`. Its default invocation performs source/hash preflight and generates evidence-only module copies; **only `--run-one` imports and executes the original scenario**. No original product, native-test, workflow or historical report was edited. There are no retries, handler invocations, synthetic success verdicts, added waits or relaxed assertions. CPU-throttling mode is explicitly refused.

## Actual preparation evidence

Default preparation completed once at `desktop/evidence/workspace-surface/diagram-save-attach-passive-2026-10-07/prepared-2026-10-07T01-55-25.158Z/`. Its `preparation.json` records exact originals and generated copies. Its `syntax-validation.json` records five separate `node --check` exit codes, all **0**: driver, observer, host recorder, generated adapter and generated full scenario. The renderer observer expression was also parsed using `vm.Script` during preparation; it was not executed in a browser. This is syntax validation, not runtime acceptance.

Original input identities, rechecked unchanged after preparation:

| File, relative to desktop | Bytes | SHA-256 |
|---|---:|---|
| `tests/native/diagram-build.mjs` | 26,351 | `c3d36cb3cd49a2b3a80fe2af170664b6f439caaf3786b4bdd4fb54d381719763` |
| `tests/native/attach-page.mjs` | 2,333 | `9adda5678dc537c070fe9dc3c8911f7efa8ba37f81637f434c61fe7b8b3fb7bb` |
| `tests/native/pointer.mjs` | 1,764 | `a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d` |

The original hosted result directly captured the first two hashes; it did not directly capture `pointer.mjs`. The pointer identity above is the exact current preparation input, not an invented original hosted receipt field.

Prepared diagnostic identities:

| File | Bytes | SHA-256 |
|---|---:|---|
| `driver.mjs` | 6,574 | `76210b9745c784bcd0d84402aeb5b1aabcfc918c067846660c5ce99cd03b2418` |
| `observer.mjs` | 4,544 | `2073597fdec822ff683a99a6d2a012a8e2cd53f763848b354c09bff681af2c7b` |
| `recorder.mjs` | 989 | `6c291fdfa5b27aa58a9ae38ba5b2e1429b2119b41932282557ec7786f0e6c7a5` |
| prepared `attach-page-passive.mjs` | 7,558 | `971739e2bff5687bd8fb0c455c9fb1730b9dc64980647eb8672f41555680c495` |
| prepared `diagram-build-original-scenario.mjs` | 26,787 | `9f9553b86f0f7c389cdd948dbaf819dc03ff278aaf5507f3ffd4df3c948feeb5` |

## Preserved actions and added observations

The scenario copy rebases only single-line static relative imports to the original module locations, substitutes the ignored adapter copy, and appends an export of existing `evidence` / `result` variables. The original fixture, 100k/optional 300k selection, full scenario, keyboard/pointer actions, assertions, deadlines, package-copy checks, original receipt capture and original owned-process cleanup remain in the copied scenario. Running it later creates a new normal `evidence/diagram-build/<timestamp>` result; no old result is replaced.

The adapter retains the original stable-pointer wait, clipping/center calculation, hit-test assertion and two mouse-dispatch parameter objects. Between the original point measurement and dispatch, it adds **only synchronous host-memory recording** of the requested point and the actual mouse parameters. It adds no browser round-trip, await, file write, second measurement or retry in that gap. Host timestamps and renderer timestamps use different clocks and must not be treated as a calibrated latency measurement.

The renderer observer is installed inside the original `Runtime.evaluate` that installs `__guidedSaveTrace`; no new round-trip is added. The original trace-read evaluation returns an envelope with its original value plus the passive observer state; the adapter forwards the original value back to the unchanged scenario and retains the extra state in memory. Thus original trace fields and oracles remain intact.

Additional observations are bounded: 128 event records with trust flags, 512 changed-layout samples, 128 mutation summaries and 24 font lifecycle events, with truncation flags. Sampling stops after 600 animation frames or 15 seconds, or page retirement. Records include actual event coordinates and `isTrusted`, requested Save coordinates, Save / Attach / header rectangles and visibility, fixed header labels limited to 80 characters and 24 children, viewport / visual viewport, limited class/theme/placement state, header mutations and font status. There are no input values, key events, PINs, raw CDP response logs or source-code contents in the added diagnostic stream. Observers do not focus, scroll, modify DOM/style, click controls or call application handlers.

## Root execution, only after exclusive native qualification becomes free

From `C:/Claude/SIREN_WORK/portable/desktop`, one optional future invocation is:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'evidence/workspace-surface/diagram-save-attach-passive-2026-10-07/driver.mjs' --run-one --package '<explicit qualified preview root>'
```

Omit `--package` only for an explicitly chosen development-runtime diagnostic. `--300k` is forwarded unchanged if that original scenario variant is intentionally selected. This report does not select a package, execute this command or authorize a repeated run. Root owns GUI execution.

A future run writes `passive-observations.json` and `execution.json` next to its fresh `preparation.json`, retaining the original scenario's status, case count, source-input capture and original evidence directory separately. New run paths change generated-copy hashes because imports include unique absolute preparation paths; original input hashes remain preflight-pinned. The original full scenario's own exact product/generated/package identities must be used when interpreting a later result, rather than treating current product bytes as the historical hosted package.

## Limits and open conclusion

Passive geometry reads can force layout and observer callbacks can perturb scheduling. Syntax success does not establish browser compatibility, successful execution, reproduction or causality. A later successful run cannot close the original hosted mis-target. A useful adverse would distinguish a requested point already inside Attach from a point that became Attach after measurement, correlate actual rectangles with header/visibility/viewport/font observations, and preserve the original result without changing any oracle.

The original adverse lacked requested point, event coordinates, Attach/header rectangles and mutation timing. Its raw historical ASAR was not retained in the uploaded result, so this diagnostic is not an exact historical package replay. The original reports `2026-10-07-diagram-build-hosted-adverse-analysis.md` and `2026-10-07-diagram-save-attach-observability-followup.md` remain unchanged. No root cause or fix is claimed.
