# Sources Task 4: isolated IPC authority contract

Date: 2026-10-03. Implementer: independent recovery/diagnostics agent. Result: the isolated contract's 10 focused cases pass. This is partial-module qualification, not live Source IPC, native-window, package, editor, or Docs qualification.

Only `src/sources/ipc.mjs`, `tests/source-ipc.test.mjs`, and this report were added. No main/preload/renderer/package/repository/registry/editor changes, new dependencies, full-suite run, native process launch, or commit occurred in this task. Prior failed package evidence and reports remain unchanged.

## API and limits

`invokeSource({event, method, payload, registry, repositoryFactory, access})` is an asynchronous main-authority function. It installs no IPC handler. `registry.caller(event)` is the sole grant source. The contract captures native sender/frame references and an immutable native grant before the first await. `access(grant, {sourceId, action})` is a trusted synchronous policy callback; only literal `true` admits access. Missing callbacks, promises returned as access decisions, throws, lost grants, or changed native identities refuse.

| Method | Exact renderer payload | Projected successful result |
| --- | --- | --- |
| `getMetrics` | `{sourceId, version?}` | `{ok:true, sourceId, version, sha256, utf8Bytes, utf16Units, lines, longestLineUnits, encoding, bom, newline}` |
| `readRange` | `{sourceId, version, start, end}` | `{ok:true, sourceId, version, start, end, text}` |
| `applyEdit` | `{sourceId, operationId, expectedVersion, start, end, insertedText}` | `{ok:true, sourceId, operationId, version, sha256, durability:'draft'}` |
| `commitSource` | `{sourceId, expectedVersion, operationId}` | `{ok:true, sourceId, operationId, version, sha256, durability:'committed'|'recovery-degraded'}` |

The exported immutable `SOURCE_IPC_LIMITS` contains `rangeUnits:131072` and `insertedBytes:8388608`. Read ranges are UTF-16 units; inserted text is capped at 8 MiB UTF-8 and must be well-formed Unicode. No independent lower text-unit cap was introduced. The preliminary insertion-unit check only rejects strings that necessarily exceed the byte cap. Source/version/range payloads use safe integers, nonnegative offsets, versions at least 1, and ordered ranges. Edit version cannot be `MAX_SAFE_INTEGER`, because the successful receipt must advance by one. Source, operation, and captured project IDs use `projects/paths.mjs` `validId`.

Payloads accept ordinary or null-prototype objects with only the exact enumerable own data-descriptor fields. Unknown/nonenumerable/symbol keys, getters, inherited/class/prototype-bearing payloads, renderer project/path/role/epoch/config authority, and other methods refuse before repository dispatch. Each normalized payload is a frozen null-prototype copy. TextModel remains the authority for actual source offsets and surrogate boundaries; an integer offset cannot bypass its split-surrogate rejection.

Results are frozen whitelist projections. Metrics contain no provenance, filesystem paths, arbitrary text, or repository configuration. Read text must be well formed and exactly the requested unit length. Mutation receipts must match the captured source/operation, expected resulting version, lowercase 64-character SHA-256, and method-specific durability. Failed native codes are retained only from a fixed allowlist with fixed messages. Unknown exceptions/codes become `SOURCE_REQUEST_FAILED`; raw exception messages, text, paths, or current conflicting versions are not disclosed.

## Native guard and repository adapter assumption

Only workspace and Code grants containing the requested source ID admit access. Docs/presenter/audience are refused. Readonly policy may admit read and deny edit/commit. The native grant pins project, window ID, role, epoch, WebContents ID, and main-frame URL; each current registry lookup must still identify the same captured native sender/frame and include the requested source. The current synchronous access policy is rechecked alongside that identity, including after each awaited repository operation and before any reply projection. Lock, epoch invalidation, changed frame identity, or changed URL after a completed read/mutation withholds bytes and successful acknowledgements.

`repositoryFactory({grant, canWrite})` must synchronously construct a fresh real owned SourceRepository per call using the supplied guard. Public repository contexts must match the captured project, source, and `read`/`edit`/`commit` action exactly. No renderer-provided project ID is passed through.

The actual repository's internal atomic writes call `canWrite({action:'write', projectId, sourceId:undefined})`, including `before-rename` and `before-select`. Parent explicitly approved a narrow adapter mapping: only a captured `applyEdit` or `commitSource` may admit that internal shape, and only for the captured project; it still rechecks the captured source and original action against current native caller/policy. Missing source ID for any other action, `write` carrying any source ID, wrong project/source, or another action refuses. Reads cannot obtain internal write authority. Tests exercise the actual repository/atomic publication hooks for both edit and commit, at both boundaries, and verify the exact source pointer bytes remain unchanged on revocation.

`commitSource` acknowledges the repository's blob/journal commit and checkpoint durability only. It does not save a selected project manifest or imply a Docs save. The actual owned ProjectStore snapshot is unchanged after tested source edits/commits. A failed checkpoint retains the selected blob commit and explicitly returns `recovery-degraded`; it is not relabeled as fully recovered durability.

## Actual TDD evidence

All runs below used `node --test tests/source-ipc.test.mjs` in `portable/desktop`; no broad suite or native harness was run.

1. Initial RED: 0 pass / 9 fail, 572.7991 ms, exit 1. Eight cases reported the missing contract. The publication fixture additionally failed because it used `selected.json`; actual SourceRepository uses `current.json` and the selection fault is `before-select`.
2. Corrected fixture RED, before production code: 0 pass / 9 fail, 546.1326 ms, exit 1. Every case now failed because `invokeSource` was absent.
3. First implementation GREEN: 9 pass / 0 fail, 1150.9333 ms, exit 0.
4. Added actual native version/budget/competing-writer cases and extended caps/publication checks. RED: 9 pass / 1 fail, 1438.5386 ms, exit 1. Actual repository `UNKNOWN_VERSION` was incorrectly mapped to `SOURCE_REQUEST_FAILED` by the first allowlist.
5. Fixed native code allowlist. GREEN: 10 pass / 0 fail, 1494.6544 ms, exit 0.
6. Extended direct guard matrix and spoofed receipt assertions. Final GREEN: 10 pass / 0 fail, 1490.5718 ms. The unchanged ten-case suite's Node summary reported no cancellations/skips/todos.

The ten suite cases exercise real temporary owned ProjectStore/SourceRepository operations and unchanged WindowRegistry logic with doubles only for Electron's native boundary. They cover strict malformed inputs and methods; forged senders/subframes/roles/wrong source/epoch/Lock/native URL; readonly Code; metadata projection; exact bounded reads; invalid numeric/version/Unicode ranges and TextModel surrogate protection; captured repository context; durable idempotent edits/blob commits, historical reads, stale CAS and operation reuse; four methods losing authority after await; four edit/commit publication-boundary revocations; actual owned competing writer refusal; actual unknown version and project budget refusal; checkpoint degradation; spoofed result metadata; and sanitized unknown failures.

Exact 8 MiB insertion admission is a validator/factory-double assertion using well-formed non-ASCII text, with 8 MiB + 1 byte rejected before dispatch. It does not claim an 8 MiB native disk-write or package test. Normal-size durability, duplication, writer contention, source-pointer publication faults, and checkpoint failures use the real owned repository.

## Frozen content identities

SHA-256 measured after the final focused GREEN:

| File | SHA-256 |
| --- | --- |
| `src/sources/ipc.mjs` | `4261e0315589c66140b22df681cfe1866608f44bd09a9f3052adc17aed858447` |
| `tests/source-ipc.test.mjs` | `b7ecc2956f33dee54519267b3efe0514ab489a0b45123a9fbf488f2d4c7891dd` |
| Actual unchanged repository exercised, `src/sources/repository.mjs` | `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457` |
| Actual unchanged registry exercised, `src/windows/registry.mjs` | `868ab882065b5a05b0f47fbbad397611adee2bad9eb97b8ff982111f3c3c3eb1` |

The integration owner must derive Code entity grants from verified schema-2 source references and supply current native policy plus an owned repository factory. The fixture's ProjectStore establishes owned project storage, not live schema-2 grant derivation. Qualified registry close/revocation, live Source IPC/preload exposure, editor mounting, Docs linking, actual manifest source-reference selection, and package qualification remain separate tasks.
