# Independent review — isolated Source IPC

No blocking finding in the captured pure authority module. The reviewer read the actual frozen module and original tests, ran the unchanged ten-case author suite, and added eight ignored independent cases using actual owned ProjectStore/SourceRepository and WindowRegistry. All 18 focused cases passed across two runs. This does not admit a live IPC channel, preload, editor, packaged runtime, physical native window, or large-source performance envelope.

## Reviewed authority and result boundary

The four-method allowlist and per-method strict schemas reject raw project/path/role/epoch assertions, unknown methods/keys, symbols, hidden fields, inherited/class payloads, and getters before repository dispatch. Normalized inputs are frozen copies. Requested versions are safe positive integers, edit expected-version exhaustion is refused, offsets are ordered nonnegative integers, reads are capped at 131,072 UTF-16 units, and well-formed inserted text is capped at 8 MiB UTF-8. SourceRepository/TextModel remains responsible for actual bounds and surrogate-pair endpoints.

Authority comes from `registry.caller` using pinned actual sender/frame references, rather than payload claims. Only workspace/Code roles containing the source ID are eligible. Project/window/role/epoch/WebContents ID/main-frame URL must remain identical, current entity membership must remain valid, and the trusted synchronous `access` callback must return literal true. Promise-valued access is refused. The callback's current readonly/Lock/source selection decision is rechecked with registry identity after each awaited repository call, including rejected calls. Changed original event-wrapper properties cannot replace the already captured sender/frame.

The fresh repository factory receives an immutable captured grant and a guard. Ordinary contexts must match the captured project/source/action. The approved internal `write` mapping without a source ID is available only to the captured edit/commit action, only for its project, and still uses current captured caller/policy. Reads cannot acquire that write authority. The real repository calls the guard again after fault/flush work at `before-rename`/`before-select`; tested revocation before pointer selection leaves the selected pointer exactly unchanged. Internal source-less writes rely on the trusted factory returning a fresh real repository and dispatching only the captured method/normalized payload; they are not a renderer-accessible general write primitive.

Metrics and mutation receipts are whitelist projections. Provenance, native paths, arbitrary repository extras, conflicting current versions, and exception messages are not exposed. Reads return only the exact requested, well-formed span with source/version/coordinates, without a fabricated full-source hash. Edits require exact source/op/resulting version and draft durability; no-op edits legitimately advance one version. Commits preserve their requested version and distinguish committed from recovery-degraded blob/journal durability. These are source receipts, not manifest/Docs save acknowledgements. Failed results use a fixed native-code allowlist and fixed generic messages.

The main integration still must derive source eligibility from verified schema-2 source references and supply current trusted access policy. Generic workspace entity IDs can also include Docs IDs; the integration must not treat a Docs ID or unreferenced source folder as source authority. The supplied callback/factory are trusted dependencies, not proof that a live handler already installs the correct policy.

## Actual focused evidence

Working directory: `C:/Claude/SIREN_WORK/portable/desktop`. Runtime: Node `v24.16.0`.

1. `node --test tests/source-ipc.test.mjs`: **10/10 passed**, exit 0, 1,455.8316 ms, zero skipped/cancelled/todo cases. This reviewer witnessed the current GREEN; author-reported earlier RED history remains in the implementation report and is not presented as reviewer-witnessed.
2. `node --test evidence/source-ipc-independent-review/independent.test.mjs`: **8/8 passed**, exit 0, 1,067.8107 ms, zero skipped/cancelled/todo cases. No failing review assertion occurred or was removed.

Independent cases exercised:

- Actual Unicode edit, no-op version advance, commit and fresh export with independently calculated SHA-256 for literal `a😀b\r\nc` and `a😀Ș\r\nc`. Original project snapshot remains unchanged by the source commits.
- Actual registry denial for Docs/presenter/audience plus ungranted same-project and cross-project sources, with zero repository dispatch for denied grants.
- Source eligibility removed during verified journal creation: refusal, exact old selected pointer, and old exported bytes preserved.
- Readonly policy transition at commit `before-select`: no selected pointer change and no successful receipt disclosure.
- Lock during checkpoint after a blob/journal commit is already selected: no acknowledgement disclosed; the actual selected commit remains, and trusted inspection reports recovery-degraded rather than inventing rollback or recovery success. The project snapshot remains unchanged.
- Mutation of the wrapper event after capture cannot replace its native owner; replacement of the actual native main frame during a rejected awaited read yields access refusal without the original exception/bytes.
- Actual readonly 131,072-unit read, +1 refusal, getter-not-evaluated input, and absence of a general export method.
- Exact captured mutation guard denial for wrong project/source/action, denial after Lock, and refusal of asynchronous truthy access decisions.

Fixtures use canonical test-owned temporary roots and real disk files; cleanup is registered through teardown. Only Electron's native-window boundary uses an EventEmitter double. No native shell process or GUI was launched. The independent tests do not duplicate the separate source-client review.

## Frozen identities and logs

Before/after manifests contain hashes for twelve reviewed/tested source/dependency files. Every captured identity matched. The registry identity below is the actual current root-owned registry used by this review, rather than the earlier registry hash from the author report.

| File/artifact | SHA-256 |
| --- | --- |
| `src/sources/ipc.mjs` | `4261e0315589c66140b22df681cfe1866608f44bd09a9f3052adc17aed858447` |
| `tests/source-ipc.test.mjs` | `b7ecc2956f33dee54519267b3efe0514ab489a0b45123a9fbf488f2d4c7891dd` |
| `src/sources/repository.mjs` | `ee86bb299af591cd0a056874e160e27607822a3d95d0c475085fe27f8a3b8457` |
| `src/windows/registry.mjs` | `bf5138cf8ba028ede0b02722eece85e9185d4f1cf34c243e80e2bc3d8f8b670d` |
| `evidence/source-ipc-independent-review/author-suite.log` | `94f4d30878da14db8aaf0b3c4e8bd6e9b9049d0dd9a80870a4db9b73e513f2e8` |
| `evidence/source-ipc-independent-review/independent.log` | `7fc491e5a776534d3e101d1a22e122295cb04eef01e947fc41ce72ff583a547e` |
| `evidence/source-ipc-independent-review/independent.test.mjs` | `ee238981b1ff99881b81f44c9de6a84ec58c67e5048f50adf095e23e9e347fb5` |
| `evidence/source-ipc-independent-review/start-identities.json` | `3eb3c45b496427fc075a727c8a367800004bd6d5b105c68e2d961dd197de0059` |
| `evidence/source-ipc-independent-review/end-identities.json` | `5f75c9e3a5ac2421a2f4ac2de85c4353daa616acfd238abe38146401aab1675e` |

All reviewer assertions/logs are ignored evidence. No product file or original test was edited, no full suite was run by this reviewer, and no commit was made. RPC result bounds do not establish whole-repository memory/latency bounds or interactive editor performance. Existing deferred live/native/package/editor/source-manifest and Docs qualification remains unchanged.
