# Editor adapter independent review

Reviewer: Codex subagent `/root/source_authority_review`. Date: 2026-10-03. Scope: isolated `src/ui/code/editor-adapter.js`, focused tracked tests and independently authored controls. No adapter/tracked-test edits, live DOM EditorView, main/preload integration, native launch, full suite or package/release qualification. Real repository fixtures used only small synthetic source strings in ignored owned directories; native behavior was not simulated as a passing qualification.

## Initial result: changes required

Initial adapter SHA-256 `99cba4ff069031c480ecca46ade8817a759960af1c96b1e612520a8db5ce7d78`; tracked test SHA-256 `640aa59d73f0e0b39ec7486032ed9137dd7312427ca51e8f1db86bd773ba0dac`. Tracked focused test run passed 10/10, Node exit 0, 952.5322 ms, retained at `evidence/editor-adapter-independent-review/tracked-focused.log` (SHA-256 `ccd9c25230c60999a845f69c02eb6ba921c3fe81e74015cf505d9db374873850`).

Independent real-repository controls passed 5/7 and failed 2/7, Node exit 1, 4672.5253 ms, in `controls-initial.log` (SHA-256 `a66e551f3d113c34f37d226aa5c3ebd38c5d840f8fd9898c1e98331ea0925da7`). The original control file SHA-256 is `6fde4a7a025f868d563d923d2a8f99389d602e5d416f6630d17c475ad861171e`.

Both failures occur before `open()` resolves. Its final `finally` publishes ready/non-opening status after the success result has already been chosen. A subscribed observer can then reset the actual sourceClient to another version/hash; `open()` still resolves `ok:true` for the old identity. A second observer can dispose the editor, clearing its state; `open()` nevertheless resolves `ok:true`. Expected final refusals are `EDITOR_IDENTITY_CHANGED` and `EDITOR_DISPOSED`. These are synchronous observer mutations before promise settlement, not caller changes after settlement.

A separate typed-client control demonstrated the same lifecycle issue for `flush()` completion: publishing committed/non-saving status from the promise's finalizer lets an observer dispose the adapter or reset client identity before the returned promise resolves, while flush still returns success. It failed 2/2, Node exit 1, 70.8451 ms, retained at `flush-observer-red.log` (SHA-256 `e419014084dcbb92d7dea02a882632145b2664162aa4c9368f650b0d8b35f109`). Control file SHA-256 `cdffec961cbd836e2e787dc55f8ff834001d1dfb28b78e09e42c9d7a81209633`.

The flush controls use a typed fake client. They establish a stale final editor acknowledgement, not a failed native commit: the returned committed receipt can correctly describe already-persisted disk bytes. The recommendation is to recheck owner/disposal/identity after completion-status observers and before final outward success, retaining truthful internal durable receipt state. Findings were sent immediately to the owner; the reviewer did not fix product files.

Independent passing controls verify whole-transaction refusal when a later range splits a surrogate pair, 65-disjoint-change atomic queue refusal followed by 64 changes producing independently expected disk bytes/version 65, partial native multi-range refusal retaining the complete optimistic local document plus the exact already-accepted disk prefix, disposal during one in-flight edit fencing remaining edits/commit and preventing state resurrection, and throwing/rejecting observers not altering durable flush. These controls use actual SourceRepository/sourceClient and small source bytes. Existing tests additionally cover literal BOM/CR/UTF16 offsets, real CodeMirror history, readonly behavior and client resets at durable edit acknowledgement.

One separate static concern was reported without claiming a reproduced failure: source-byte admission checks the final multi-range document size, but native range persistence uses separate ascending writes. A grow-first/shrink-later transaction near 32 MiB can have a legal final size and an oversized intermediate version. This can cause avoidable partial-native refusal; it is not evidence of data loss. The initial review did not allocate a large fixture because this task requested small owned fixtures. This concern needs disposition before a broad byte-bound claim.

## First repair and remaining notification finding

The owner repaired open/flush final results after completion publication, captured client identity and adapter generation between observer callbacks, and preflighted each intermediate native-version byte size before admitting a multi-range transaction. The tracked 32 MiB boundary regression uses a real CodeMirror Text with a typed client; it is not a native disk/data-loss qualification. The reviewer independently reran the unchanged original seven controls and two flush controls, a narrowed notification identity control, and the final fifteen tracked tests: 25/25 pass, Node exit 0, 5340.3419 ms. Output remains at `final-focused-green.log`, SHA-256 `bd22d48f93c58ad2b115e04c95171a4486cd51148d38279b592ae97a482e0cf7`. Adapter at this moment: `5c7cf54b5c50c6bc456dae7a70867fc472fb832ea56330bf0eee4358a4c1d730`; tracked tests: `d2c29bce33fcbad20e1da1d9292d8226f7e4b067ffde35569de2244c4e40d0a5`.

The additional original notification identity oracle was too broad: it counted both an old successful ready snapshot and a later explicitly fenced diagnostic snapshot. The latter correctly describes retained old local state after identity refusal and is not a successful authority claim. A separate narrowed control excludes fenced snapshots. Its successful run does not erase the earlier failed log. The original notification run occurred against intermediate adapter `4f87f94f0fbc234cab58fb3a8174f1a5fe6962f8b097666474074d1e210c2037` during the owner's repair, not the initial freeze. Narrowed control SHA-256 `b2ffd4769aa9d3c521ae591b1e4fecbe2582ff4846470c9446ee81bdb867082f`; original failed log SHA-256 `84241386aec83f275dbb854e0d1570abb85db0b5e18bbdbe3d86c8a8a0a9878e`. A separately named `notification-identity-narrowed-red.log` is actually a 1/1 passing run, Node exit 0, 66.8555 ms; its filename is not an outcome claim.

A further narrowly scoped notification check still failed against the `5c7cf54...` freeze. A first successful ready-status observer changes the typed client's `disposed` or `fenced` flag without changing source identity. The second observer still receives the captured unfenced ready status: the observer loop compares source ID/version/hash and adapter generation, but ignores these client authority flags. Final `open` correctly refuses, so this finding concerns stale successful observer delivery rather than a stale outward promise result. Separate typed-client controls failed 2/2, Node exit 1, 66.2443 ms, in `notification-lifecycle-red.log` (SHA-256 `d219415fb8a8ab4931fb6d7b239f78ad9f01ba8f51f5c63127f4d7f258384e59`). Control SHA-256 `9dea12f303becc488740dfb45aa350853715ee7ef1b77e80cfbb335fb57f6391`. The recommendation was to capture and compare disposal/fence flags between callbacks as well as source identity, allowing stable explicitly diagnostic snapshots. This was reported immediately. All adverse evidence is preserved.

## Final repair and independent verification

The owner added captured client lifecycle flags to the observer checks, alongside identity and adapter generation, and a tracked actual-sourceClient disposal regression. The reviewer inspected the final observer checks and ran sixteen tracked tests together with the seven unchanged original controls, two unchanged flush controls, the narrowed identity notification control and two unchanged lifecycle notification controls:

```text
node --test tests/editor-adapter.test.mjs evidence/editor-adapter-independent-review/controls.test.mjs evidence/editor-adapter-independent-review/flush-observer.test.mjs evidence/editor-adapter-independent-review/notification-identity-narrowed.test.mjs evidence/editor-adapter-independent-review/notification-lifecycle.test.mjs
tests 28; pass 28; fail 0; cancelled 0; skipped 0; todo 0
duration_ms 5355.5279
Node exit 0
```

Final output is retained at `evidence/editor-adapter-independent-review/final-lifecycle-green.log`, SHA-256 `e1671985dc0f025172a97398155695f4119604f490fc26b32e3b341d3ab19328`. Final hashes, captured after that successful run:

| File | SHA-256 |
| --- | --- |
| `src/ui/code/editor-adapter.js` | `cfedf6fec2982f4c10e66417ea8e5ac79203746c22b5a49d25ced9cd41992f54` |
| `tests/editor-adapter.test.mjs` | `0915344d8e37958335ae1b6e0817e30044a857f849c2c2e73068130f3c1d79c4` |

Final verdict: approved for this isolated editor-state/persistence source-unit boundary. The reproduced observer races and notification lifecycle gap are resolved. The reported intermediate-size concern is covered by inspected primitive admission checks and the passing tracked typed-client boundary regression. No outstanding actionable finding was identified in this scope. Byte/queue bounds are finite contract checks, not a latency or full-capacity qualification. Optimistic text can remain dirty after a partial native refusal; the passing controls show exact already-accepted disk bytes and preserve the complete local document rather than falsely reporting it saved. Live EditorView behavior, native UI, Docs editing, packaging and release/CI admission remain outside this approval.
