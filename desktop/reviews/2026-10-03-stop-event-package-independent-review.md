# Stop-event package independent qualification

The first unchanged packaged probe against the committed stop-event correction **FAILED overall** at recovery-original preservation. Native startup, PIN setup, reload, and the initial production pointer/keyboard edit plus acknowledged flush completed in this run. The original project's snapshot then advanced from revision 4 to 5 during the recovery transition while its JSON, hash, schema and project metadata remained identical. The exact full-snapshot preservation assertion must remain a failure; this is not a package PASS or Windows1 qualification.

## Retained artifact and committed provenance

Package: `desktop/dist/development-d4b9507b-2a17-47c3-a8f0-900770e1f7a6`, commit `d7d4bfbd9fdd8d995b4e5034f61409a427c7cd26`.

| Artifact | SHA256 |
| --- | --- |
| Actual ASAR, 14,356,539 bytes | `12574a1b460b2c4ee89ec7abc1ca6eaf2dc6084e8883c1db69e1a4c257824a46` |
| Runtime executable, 245,726,208 bytes | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Extracted renderer | `fce4cf13ec180acd7823e2dcc597ea6e0c699b40d80b2ea369556a3bf170cfa0` |
| Native stop-event helper | `f3b6c8e873f917db4195a340795ca781073c156042c301590b50d921f5f04d2e` |
| Unchanged packaged probe | `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541` |
| Unchanged driver | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |

All hashes were verified before launch; archive/probe/driver hashes were reverified afterward. The retained archive's source was compared with the named committed Git blobs and checkout-filtered bytes, not the moving working-tree main. Identity manifest: `desktop/evidence/stop-event-package-identity-2026-10-02T23-21-48.547Z/identity.json`.

All 35 archived source members have equal committed content after only CRLF-to-LF normalization; 32 are raw-byte equal to the Git blobs. Main, IPC and preload differ only in retained mixed Windows line endings and also do not match the checkout-filtered bytes byte-for-byte. Their actual versus Git blob SHA256 values remain explicit below. The corrected readiness helper matches its committed blob exactly.

| Component | Actual archived bytes SHA256 | Committed blob SHA256 |
| --- | --- | --- |
| Main | `0c3f56c0fa6d60c77453a9a03ec53976d131ad2b145dd1fe317ab63c30a87058` | `3a56e328b18d34a31ca07e28e83a5cfd1987a83fa56e48d6f0ffae891f415539` |
| IPC | `d695a1133654472479e5338525ce36c81630461ee62bd9fbfac01981b93ecaf5` | `a97c47f7d3800456729a621078c2e9d3c0d13257061877d988e34c457ca32b15` |
| Preload | `198353950873f884d48604e0238e3cf270412da2679666b2c7238b70d89f9206` | `7e88c308d6b276a5db563cb61071da15aac7d445075b6ac4a11b09377ec575e0` |

The actual unchanged probe, driver, ProjectStore fixture, RecoveryStore fixture and hash utility were also compared with committed bytes and are raw-byte equal. Root's ongoing Window1 work is absent from this immutable artifact and is not evaluated here.

## One actual run, no oracle modification

Approved `require_escalated` command from `portable/desktop`:

```text
node tests/native/packaged.mjs dist/development-d4b9507b-2a17-47c3-a8f0-900770e1f7a6
```

Exactly one probe invocation. Exit **1**, 6.9578533 seconds reported by the execution tool. No test/driver edit, delay, deadline adjustment, retry or native instrumentation was used. Evidence: `desktop/evidence/packaged-2026-10-02T23-21-57.498Z/`.

`result.json` is `completed: false` with `Recovery must preserve the complete acknowledged pre-restore original exactly`, thrown at `packaged.mjs:120`. Its saved `failedOperation` is wrapper operation 43, the last successful renderer source observation; it is not a native failed receipt and does not locate the assertion at operation 43. The assertion follows the recovery click, renderer reload/selection and displayed edited-source checks.

The retained save diagnostic establishes the initial production editor save:

| Field | Actual result |
| --- | --- |
| Kind | `production-editor-flush` |
| Baseline revision | 1 |
| Production flush | resolved |
| Native post-read revision | 2 |
| Native post-read SHA256 | `4c3fc28b74539c7eb1388ac5ba855fdde9340471ace3c5c69cdfb90f64663ef2` |

All preceding unchanged assertions passed, including locked null-snapshot/write refusal, native fixture PIN setup/unlock authority, post-unlock reload, UI pointer/keyboard edit, exact initial saved full-bag/native receipt readback, and the recovery renderer's new project selection/displayed source. These completed checks establish progress beyond the two previous startup failures for this run only. Later initial recovered-revision integrity, recovered production flush, normal closed-package move/copy, relock/unlock and damaged-journal safety checks were **not reached**.

## Exact recovery preservation adverse boundary

`restore-boundary.json` retains the complete acknowledged snapshot selected for recovery and the original snapshot drained immediately before the restore click. The failed assertion compares the current original native snapshot to that latter complete `preservedOriginal` object.

An independent read-only comparison after the failed run uses retained native ProjectStore data and confirms:

| Field | Before restore | After failed restore assertion |
| --- | --- | --- |
| Original revision | 4 | 5 |
| Original SHA256 | `c674f364380d3a625300c5dbb840ae508e26b376226af432c9037e0e4ba97a1d` | Same |
| JSON string bytes | Preserved envelope | Identical |
| Project metadata/schema | Preserved object | Identical |

The only differing snapshot key is `revision`. This derivation is retained separately as `independent-original-preservation-comparison.json`; it does not replace the original result, error, snapshot or failure state. There is no source-content loss in the captured original comparison, but the full preserved snapshot is not equal and the original assertion is not weakened.

A redundant identical-envelope native workspace save from selection quiescence is a plausible next causal lead. This run lacks write-origin instrumentation, so it does not prove which operation advanced the original revision. No product fix or test expectation change was made by this reviewer. The earlier stop-loading bug is separately resolved in code tests; neither that resolution nor this run's successful startup converts the overall package failure into PASS. The old `1e11a4` native blocking stack remains unknown.

## Cleanup and scope

The unchanged probe captured `failure-events.json`, `failure.png` and responsive failure-state diagnostics (visible/focused, body not inert, bootstrap normal and readonly false), then its `finally` awaited owned driver cleanup. An approved read-only Windows process-inventory query restricted executable paths to this exact evidence directory confirmed **0 remaining owned SIREN processes**. No unrelated process was terminated.

All previous failed package and observational evidence remains preserved. This report is the only new review file. No product code, package build, native probe/driver, dependency, commit, push or full suite was changed or run by this qualification. Window1, terminal shell ownership, launcher/install/apply, online account and clean-PC claims remain outside scope. A new causal investigation and any subsequent immutable build/probe require their own authorization; this first failed qualification will not be rerun until pass.

## Addendum: authorized read-only causal reproduction of the duplicate revision

The parent separately authorized read-only artifact/source investigation of the revision-only preservation failure, with no native rerun or product change. The complete preserved snapshot assertion remains unchanged.

An isolated synthetic diagnostic uses the immutable `12574a1b...` archive's actual main selected/changeSelection/save/restore bodies, actual embedded storage adapter, actual built `saveState`, `sirenDesktopRequestClose` and account-transition functions, plus real ProjectStore/RecoveryStore/RecoveryAccess/atomic code extracted from that same archive. It does not execute Electron. UI-only control synchronization is a harmless synthetic stub; the renderer state and full storage bag are taken from the retained synthetic preservation fixture, so both complete serialized requests can be compared exactly. No credential or PIN input is involved.

Evidence: `desktop/evidence/no-op-preservation-diagnostic-2026-10-02T23-28-26.734Z/result.json`; complete standalone probe and extracted archive code are retained beside it. Probe SHA256 is `485a16a6aff7e143d0ebac298304ea7c731a31db54d9cfaf163052043d0c2ef6`. The exact committed `src/ui/storage.js` bytes are asserted present in the immutable renderer before extraction. Source hashes remain main `0c3f56c0...` and renderer `fce4cf13...`. The first non-native preparation attempt included adjacent UI script in the VM and failed before save/restore execution; narrowing extraction to the asserted exact adapter fixed that diagnostic harness error. No native process was launched for either attempt.

Command from `portable/desktop`:

```text
node evidence/no-op-preservation-diagnostic.mjs
```

The successful diagnostic exits 0 because it asserts and records the **existing adverse behavior**, not the desired invariant. It reproduces original revision 4 → 5 with unchanged complete JSON and hash; it is not a preservation PASS.

| Synthetic relative timestamp | Actual executed boundary |
| --- | --- |
| 3.210 ms | Explicit pre-restore production close/drain enters |
| 3.619 ms | Full unchanged workspace envelope submitted with base revision 3 |
| 52.675 ms | Native main save acknowledges revision 4 |
| 54.058 ms | Explicit close/drain returns; preserved snapshot is revision 4 |
| 54.067 ms | Actual restore service enters |
| 54.157 ms | Actual changeSelection executes renderer BeginAccountTransition |
| 54.336 ms | Transition close/drain submits the same complete envelope with base revision 4 |
| 104.091 ms | Native save acknowledges revision 5 with the same hash |
| 180.180 ms | Actual recovery service returns a distinct new recovered project at revision 1 |

Both workspace requests are byte-identical JSON. The second request is issued by the transition flush **before** the recovered selection, establishing the redundant save path in this synthetic execution. The retained native artifact's only snapshot difference is the same revision increment; the unchanged native qualification itself did not record individual native write origins, so this does not claim a native stack trace or a separately instrumented native restore run.

The source path explains the result: production RequestClose always calls `saveState` for a normal selected snapshot; saveState always calls `setWithBackup`; the adapter always submits `persist('workspace')`; changeSelection always calls BeginAccountTransition, which calls RequestClose again; native ProjectStore validates exact CAS then unconditionally commits revision + 1 for workspace requests, even when the JSON is identical. There is no no-op condition in the retained store, adapter or main service.

Two actual native-store API controls establish the required CAS distinction without Electron:

- Current revision 5 and identical JSON submitted with stale base 4: explicit `REVISION_CONFLICT`, unchanged selected snapshot.
- Current revision 5 and identical JSON submitted with exact base 5: acknowledges revision 6 under the existing implementation.

Any minimal correction must keep native authority, schema and exact live revision checks under the writer lock before acknowledging a no-op. Renderer-only local equality would bypass those checks. Byte equality must be verified, rather than inferred only from a receipt/hash. Recovery drafts retain their existing separate semantics. Native writer contention and degraded checkpoint acknowledgements must remain explicit refusals.

The current main save verification also requires `current.revision === request.baseRevision + 1`. A store returning an unchanged current revision therefore needs a deliberately typed and independently verified no-op path in main; merely returning current revision from the store would turn it into `SAVE_UNVERIFIED`. Pending-attempt cleanup, checkpoint verification/refusal and receipt semantics still need review in a proposed fix. This investigation proposes those invariants; it does not implement or approve any such code change.

The causal diagnostic launches zero native processes, writes only isolated synthetic evidence, and leaves the failed original probe/evidence/product source untouched. Fresh corrected package qualification remains future work.
