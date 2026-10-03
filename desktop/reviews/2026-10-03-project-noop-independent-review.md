# Independent review of exact native workspace no-op acknowledgement

No actionable defect was found in the frozen no-op correction within this review's scope. Independent authority, CAS, writer, checkpoint and renderer-receipt checks passed. An isolated reproduction using corrected save/store/adapter code and the retained production recovery-transition functions now preserves the complete original snapshot at revision 4. **The original immutable package remains FAILED; no new native package qualification was run.**

## Reviewed invariant and source boundaries

The prior native run, `desktop/evidence/packaged-2026-10-02T23-21-57.498Z/`, failed when recovery's transition flush resubmitted identical full JSON and advanced the preserved original revision 4 → 5. That unchanged probe result and full-snapshot oracle remain intact. The prior actual-archive synthetic trace establishing the duplicate flush is retained in `no-op-preservation-diagnostic-2026-10-02T23-28-26.734Z` and documented in `desktop/reviews/2026-10-03-stop-event-package-independent-review.md`.

The correction was written by the parent, not this reviewer. This independent review inspected the actual ProjectStore/renderer diff and the actual main `saveProject` service body, whose slice was frozen while unrelated Window1 main code continued to evolve.

ProjectStore now recognizes exact unchanged JSON only **after** initial native access, pending-attempt preservation, owned writer acquisition, second live access, schema-1 and exact live base-revision checks. It returns the verified current revision/hash, pending ID and typed `unchanged: true`; it does not create another selected revision. Private recovery is handled before this no-op branch and retains separate recovery semantics. Changed workspace JSON still commits a new revision.

Main independently reads the actual current snapshot and requires matching attempt JSON, returned hash, returned revision and `baseRevision + (unchanged === true ? 0 : 1)`. Generic unverified results cannot be treated as unchanged success. Recovery checkpoint creation is still attempted; contention or failure remains `ok: false`, `RECOVERY_DEGRADED`, with typed unchanged/current-revision metadata only after successful workspace verification. Pending-attempt cleanup is still performed only along the acknowledged path.

The successful public main receipt keeps its existing revision/hash shape; the unchanged marker is used internally for verification and exposed on degraded receipts. The adapter accepts the same successful returned revision without incrementing it locally. On degraded failure it retains only strict typed metadata, independently hashes the exact attempted UTF-8 envelope, and allows reconciliation to the same base only with `unchanged === true`. It continues to return `ok: false` and report the write error; unchanged commitment is not checkpoint success.

## Actual independent test evidence

Node `v24.16.0`, Windows, from `portable/desktop`:

```text
node --test evidence/project-noop-review/independent.test.mjs
node --test tests/project-noop.test.mjs tests/renderer-storage.test.mjs
```

- **Independent boundary suite:** 7 tests, 7 passes, 0 failures, exit 0, **472.3964 ms**.
- **Focused product/renderer suites:** 9 tests, 9 passes, 0 failures, exit 0, **3759.5064 ms**.

These are suite counts; table variants within each test are not inflated into native scenarios. All independent assertions exercise the actual helper/module/service APIs. No full suite or native process launch occurred. `node --check src/projects/store.mjs` and scoped `git diff --check` completed without errors.

| Independent boundary | Actual result |
| --- | --- |
| First or second live `canSave` denial, identical JSON | `ACCESS_REFUSED`, original unchanged, no unchanged acknowledgement |
| Actual owned project writer contention, identical JSON | `WRITER_BUSY`, no snapshot mutation |
| Pending-attempt disk failure, identical JSON | `SAVE_FAILED`, original unchanged |
| Stale base with identical JSON | `REVISION_CONFLICT` |
| Schema guard | `SCHEMA_UNSUPPORTED` before unchanged acknowledgement; the schema-2 returned read was a declared synthetic stub, not a source-repository native fixture |
| Main receipt says unchanged but attempt/current JSON differ, hash/revision mismatch, stale base, or string flag | `SAVE_UNVERIFIED`, no checkpoint or original mutation |
| Actual RecoveryStore writer contention after verified unchanged workspace | `RECOVERY_DEGRADED`, unchanged true, current committed revision/hash, checkpoint false, `WRITER_BUSY` retained |
| Retry after real checkpoint contention releases | Exact same CAS succeeds; complete original snapshot stays equal |
| Renderer misleading next-revision unchanged flag, string/missing same-base flag, wrong hash, generic refusal, or no verified workspace | Failure stays visible; unsupported metadata cannot advance CAS |
| Renderer verified changed degraded commit | Still returns failure, but next CAS advances only to its independently verified immediate next revision |
| Main project grant removed | `PROJECT_REFUSED`, original unchanged |

The actual focused product tests additionally verify unchanged current pointer/revision bytes and revision-file count, a private recovery attempt followed by a genuine workspace commit, and explicit failed-checkpoint metadata. The renderer focused suite exercises production private Code status, degraded committed retry, locks, queue draining and failure resumption. No native launch or process authority is supplied by those synthetic tests.

Independent renderer receipt cases also assert no arbitrary native JSON/PIN diagnostic fields leak, `window.sirenDesktopFlush()` still reports failed receipts, write-error callbacks run, and only exact boolean true retains the unchanged marker. The adapter consumes trusted native IPC receipts; the main verification tests independently reject spoofed native unchanged results instead of relying on renderer metadata alone.

## Actual transition-path causal resolution, without Electron

The separately retained probe `desktop/evidence/no-op-preservation-correction-2026-10-02T23-36-28.709Z/probe.mjs` uses the prior immutable package's actual saveState/RequestClose/BeginAccountTransition/selected/restore functions and retained synthetic full-bag fixture. It substitutes the corrected frozen actual ProjectStore, main save-service slice and renderer adapter. Baseline store code seeds the original revision 4; subsequent operations use the corrected store. The production control synchronization remains a declared synthetic no-op, as in the adverse trace. No native package was rebuilt or modified, and zero native processes were launched.

Command:

```text
node evidence/project-noop-causal-resolution.mjs
```

Exit **0**. Its desired assertion is full `deepEqual` of the original snapshot after restore to the preserved snapshot. The actual trace is:

| Relative timestamp | Observed execution |
| --- | --- |
| 1.654 ms | Explicit pre-restore drain submits exact JSON with base 4 |
| 43.645 ms | Actual main acknowledges unchanged revision 4 |
| 45.061 ms | Explicit drain returns preserved original revision 4 |
| 45.155 ms | Actual selection helper executes BeginAccountTransition |
| 45.347 ms | Second transition flush submits identical JSON with base 4 |
| 84.337 ms | Actual main acknowledges unchanged revision 4 |
| 123.873 ms | Recovery returns a distinct project at revision 1; original snapshot remains completely equal at revision 4 |

Its two submitted envelopes are byte-identical, and original JSON/hash remain equal. Identical JSON with stale base 3 still refuses against current 4; exact base 4 acknowledges unchanged revision 4. This is a code-level resolution of the deterministically reproduced path, not a claim of native package recovery qualification.

## Frozen identity and limitations

| Reviewed artifact | SHA256 |
| --- | --- |
| Corrected ProjectStore | `e5b1d7faef5bab934577dcff40fc4a6aa31dd3d0c4c0d842aea614fe0147faf7` |
| Corrected renderer storage | `fdc06fb5fab4193b4d3f36b1d8a9c1a7e8d4a028e038cc39e3796206f9ca6334` |
| Corrected main save-service slice | `c29082c4e5f7ad361201b9a014c6399a275b2488056c035e8d1ade9ad570b011` |
| Product no-op regression | `9c6bef115e1451e07e2e534ba2ed15778a563ca65abadafa2fa2daac44b6cf8e` |
| Independent boundary assertions | `a096fb1c0334da05e690e2ee51099f4d450a9d93a598a18f57c3f6f0b38ea9f1` |
| Corrected-path synthetic probe | `ad81e8f5326de0d3fe5ed47158942df75570ffcc9fd9886ecbd6fe23c6957291` |

The parent owns production changes and any subsequent immutable build/full suite/native qualification. This reviewer changed only ignored evidence and this review. No product file, original failed artifact, unchanged packaged probe, dependency, commit or push was modified. No-op equality does not bypass native CAS or promise checkpoint success. The old reload blocking stack, overall package qualification, Windows1/editor behavior, native terminal ownership, launcher/install/apply, online accounts and clean-PC qualification remain outside this review.
