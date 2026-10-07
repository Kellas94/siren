# CI27 independent diagnosis

Reviewer: Codex subagent `/root/source_authority_review`. Date: 2026-10-03. Scope: read-only diagnosis of [CI27](https://github.com/Kellas94/siren/actions/runs/37097382873), an isolated Windows short-path fixture differential, and the workflow's outer unit-step budget. No implementation/workflow edits, CI retry, full suite or native Electron launch. This report does not reverse the failed CI result or qualify a package/release.

## Retained remote evidence

The reviewer independently fetched the latest-attempt jobs and decoded logs through the GitHub connector. Job `111129976324` concluded `failure`: the unit step failed, while guarded renderer, actual development native behavior and package identity steps were skipped. Logs are retained in ignored `desktop/evidence/ci27-independent-review/github-job.log` (SHA-256 `2a5f1e9f31a0760b1c775465fbfa25a2ec730501e7bf3f7ab63add08c90c3ba9`). Checkout used PR merge commit `dc1a3d4c6ce913cb4796c90c45afdfcf82cc5345`; the parent's source-head shorthand is not substituted for this actual checked-out commit.

The downloaded evidence ZIP's independently checked SHA-256 is `797582dc480bdb7cef82844b5b078f342f600045e0facc8cecb147ec2767ef16`, matching the job's upload receipt for artifact `11265300284`. Its two retained entries include interrupted `ci-units.log` (SHA-256 `dffb7d28304bd20694133343bbc5d54933e70ade7c6115846b207aec56d81863`) and the controlled process-identity deadline result. The latter is marked completed and retains its bounded startup/cancellation observations; this report does not reinterpret it as a CI failure cause.

The job preflight recorded TEMP as `C:\Users\RUNNER~1\AppData\Local\Temp`, resolving to `C:\Users\runneradmin\AppData\Local\Temp`. Its canonical-fixture `io.test.mjs` passed. At `04:47:05.4117179Z`, the unit output reported failure of `real repository byte receipts survive Unicode edit, no-op and commit without source copying` after 27.2666 ms. The interrupted reporter output contains no stack for that case, so its precise remote error remains unavailable.

The unit shell started at `04:42:21.7367696Z`. At `04:48:21.7395704Z` it was interrupted while running `tests/update-service.test.mjs`; the workflow explicitly reports timeout after six minutes. There is no complete unit summary. The required real 180-second callback test belongs to `tests/oidc.test.mjs`, and CI27 already reported it **passed**, 180111.3102 ms, at `04:45:38.9490135Z`. It was not the interrupted update-service test.

## Independently reproduced short-path fixture failure

The reviewer created only an ignored owned directory, `desktop/evidence/ci27-independent-review/LongTemporaryFixtureDirectory`, and used Windows' actual short path from `Scripting.FileSystemObject.ShortPath` as process TEMP and TMP. The path witness proves the short and long forms resolve to the same directory. TEMP/TMP were restored after each child invocation. No links, production-path exceptions or production guard modifications were used.

With this short TEMP, the unchanged tracked source-client test was invoked narrowly:

```text
node --test --test-reporter=tap --test-name-pattern='real repository byte receipts' tests/source-client.test.mjs
pass 0; fail 1; duration_ms 69.8069; Node exit 1
error: Project path refused
ownedDirectory src/projects/paths.mjs:9
ProjectStore.projectsRoot -> ProjectStore.createProject -> test line 192
```

Its raw `node:fs/promises` mkdtemp returns the short-root spelling. `ownedDirectory` compares the resolved input spelling with `realpath` and correctly refuses the mismatch. A separate ignored copy changes only that test's mkdtemp import to the existing canonical test-fixture helper, plus relative import relocation needed for the evidence directory. The exact same targeted case and TEMP then pass: 1/1, Node exit 0, 234.2072 ms. Actual Unicode edit/no-op/commit/export assertions remain intact.

Evidence hashes:

| File under `desktop/evidence/ci27-independent-review/` | SHA-256 |
| --- | --- |
| `temp-path-witness.log` | `1451df0c4e084da5f5acb51636f2921a2d986697dfd828d1e040d0716268bc67` |
| `raw-temp-red.log` | `67a7136d4ceb1b46663979be0bb06e3d6d7cde2af2895fb87cd8e41ab324133f` |
| `canonical-temp-green.log` | `6ddde76635ca060704295f8821b021e92f6bf67e32866cdda28beb4b553af77c` |
| `canonical-source-client.test.mjs` | `e91f725ec07256a6c78d5e6636a85dfce66e40d085f9c62ea2703a433d727348` |

This is strong controlled support for the CI27 short-path fixture explanation. Because the remote failure stack was not retained, it is not absolute retrospective proof of the remote exception. The minimal repair recommendation is to use the existing canonical fixture helper in the tracked test. Keep production `ownedDirectory` unchanged. Merely finding other raw mkdtemp imports does not establish a defect; some fixtures explicitly canonicalize after creation.

## Outer budget assessment

The current six-minute workflow unit-step bound is demonstrably insufficient for this CI27 attempt. The last two completed update-service results were emitted at `04:48:15.7235575Z` and `04:48:15.9802027Z`, leaving about six seconds until termination. The following tracked case exercises a truncated download; existing product download inactivity is bounded at 30 seconds. These timestamps describe log emission, not independently established start times: Node can emit file results in order and buffer output. They cannot distinguish CPU/filesystem scheduling cost from a pending body read, nor establish how much longer the whole suite would need.

Recommend a bounded **12-minute outer unit-step budget** to provide headroom for the expanded suite on the hosted Windows runner, retaining the current 25-minute job bound for now. This is an operational allowance, not a prediction or passing qualification. Do not shorten the required 180-second OIDC service deadline or its 200000 ms test limit, or alter update transport 15-second and download 30-second bounds. A subsequent completed CI run is required to evaluate total runtime and downstream native/package steps. The reviewer did not run or request a CI retry.

Recommend TAP reporting for the CI unit command so failed assertions retain their stack before a possible outer interruption. The reporter can change without changing tests, acceptance conditions or service deadlines. Increasing the outer budget does not resolve the already-observed source-client assertion failure; the canonical fixture repair addresses that separately.

## Input witness and limits

Local inputs inspected/reproduced at this diagnosis moment:

| File | SHA-256 |
| --- | --- |
| `desktop/tests/source-client.test.mjs` | `403502a5702f0c764f3dffbd0a33954905e0e7b0e6236ef3092e9e2a16c06dd7` |
| `desktop/tests/fixtures/temporary.mjs` | `0ceeb6b135b64b733494d6d7d1f29f953734db4eb5ad2d40eae45ddd62855d19` |
| `desktop/src/projects/paths.mjs` | `0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554` |
| `.github/workflows/desktop-verify.yml` | `25a921e4579ad29e1ad76bbf9ca9ecc41065aa2337cb918b25e8c4454e768d9f` |
| `desktop/tests/oidc.test.mjs` | `8f43d5572fa02acdc401d95d68f53dbe6dd44d06c76f5992d14682897d0b38fa` |
| `desktop/tests/update-service.test.mjs` | `460b9f4e0cd40be708019ee197453d59818b185f7ed7f1232db8f38109ff118f` |
| `desktop/src/updates/github.mjs` | `a5aaf7794b5e36459c2e8b726ce9835c5aa30d9133d951e467e8356bdd4b3930` |
| `desktop/src/updates/download.mjs` | `f3712e304b05cb472e59a2bc043e36a3d520a1640ee3dd523bc6ea3aa30099cf` |

An initial attempt to use `gh` did not execute because the executable was absent; its empty output is not remote evidence. A first connector call used an incorrect argument name and was rejected before execution; the correctly named read-only calls supplied the retained actual jobs/logs. No CI execution occurred in this review. The source-client finding, complete job timeout and skipped downstream qualification remain distinct outcomes; no broad PASS is claimed.

## Independently verified tracked correction

After the implementation owner froze the corrections, the reviewer reran the actual tracked source-client target under the same owned Windows short-path TEMP/TMP setup. It now imports mkdtemp from `./fixtures/temporary.mjs`; the production path guard is unchanged. No ignored replacement test was used in this final run.

```text
node --test --test-reporter=tap --test-name-pattern='real repository byte receipts' tests/source-client.test.mjs
tests 1; pass 1; fail 0; cancelled 0; skipped 0; todo 0
duration_ms 250.5969
Node exit 0
```

The retained final log is `desktop/evidence/ci27-independent-review/tracked-canonical-temp-green.log`, SHA-256 `a978999adec80872f72618a69e02f43ce20b868b57a2c99c84b565c14b4233cf`. The corrected tracked test SHA-256 is `9fb04525429bc785865a65eb8013b283815fdb50d27659d88131d091223796cd`.

The reviewed workflow correction sets only the unit step's outer timeout to 12 minutes and uses `node --test --test-reporter=tap tests/*.test.mjs`, retaining the 25-minute job bound, original test-file selection, evidence tee, and explicit Node exit propagation. Workflow SHA-256 is `6e62597c0cf1fd2f22a03680a9a03fb98a7539cd490c69fe41a7770b169d9cc1`. The inspected canonical helper, production path guard, OIDC and update-service tests, and update transport/download modules all match the earlier hashes in the input witness. No individual behavioral deadline was shortened by this correction.

Final scoped result: the actual tracked fixture correction passes the independently reproduced short-path case, and the workflow correction is appropriate bounded headroom with better failure evidence. The original CI27 failure and logs remain intact. Its missing remote assertion stack still limits retrospective attribution, and the next CI runtime/downstream results remain unknown. No CI rerun, push, full suite or product modification was performed by this reviewer.
