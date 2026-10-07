# Docs Activity interrupted-refresh correction — independent recheck

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07. Narrow actual source/VM recheck; no GUI/native/build/full-suite/package execution or release verdict. Original integration report SHA-256 `08c204766035561733ed59e32605a2dd7addfe434252bd5161acd6111aa5ac82` remains unchanged.

The original R1 is corrected in this snapshot. `refreshActivitySaved(restore=false)` still admits the draft's verified saved document when the version changes. On Resume it now receives `true`, and on an unchanged version it re-admits the prior **saved** context with current dirty state. It does not substitute unsaved working content for the saved context.

I independently reran the original delayed Refresh → prepare → resolve retired read → Resume sequence with actual Activity controller, Docs window, draft and reader in the finite integration DOM/bridge stand-in. Activity is now enabled after Resume and can reopen immediately without another Refresh. I added an independent dirty/fenced rollback control: the bridge refuses Save, the old saved version remains, Resume restores Activity, saved comparison remains identical while explicit working comparison reports changed content, and saved block bytes stay unchanged. These assertions use the actual controller's controls and actual integration callbacks.

I also reran the corrected model budget fixture: exact 131,072-character first page, next source cursor8, all twelve deferred malformed rows present on the next page.

Actual scoped command:

`node --test tests/docs-activity.test.mjs tests/docs-activity-view.test.mjs tests/docs-activity-integration.test.mjs tests/docs-reader-reveal.test.mjs tests/docs-reader-guard.test.mjs`

Result: **40 passed, zero failures/skips**. Actual separate probe: `node evidence/docs-activity-integration-independent/recheck-probe.mjs`, completed with the assertions above. This is my execution evidence; root's broader/native results are not borrowed. The new integration regression also loads the actual controller rather than the former stub.

Evidence under `evidence/docs-activity-integration-independent/`:

| File | SHA-256 |
|---|---|
| recheck-probe.mjs | 6d2b165dc7a886e61493552ce63081cfc825e86d3949e7b108e4005e22609fa4 |
| recheck-probe.log | e93a4072605a9cf53af0b8c2d4aee5a234238e9331aa9ea95017acc1d3bcdd36 |
| recheck-tests.log | bc4d45271d1175922135c4ee64718c94808b7f9c072776a6ca12606a8a9ab7c2 |

`recheck-inputs-before.json` and `recheck-inputs-after.json` confirm identical hashes before/after:

| Input | SHA-256 |
|---|---|
| src/ui/windows/docs.js | 0f27116fbb2e843b7586bae47939599c1e75794f43ebbcf196f68d34f444c652 |
| src/ui/docs/activity.js | 9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4 |
| src/documents/document-activity.mjs | e7ea2b861b56bd06c6dd28c5cfaaa732f2afec9f71996770bf3a27f38cda24b1 |
| tests/docs-activity-integration.test.mjs | 9b3f138eabf890e9dedc7e4c93413a06de0ba88561f0e7416764b90defa3bb49 |
| original independent review | 08c204766035561733ed59e32605a2dd7addfe434252bd5161acd6111aa5ac82 |

The first after-hash wrapper mistakenly passed the whole record to Get-FileHash and produced path errors; it established no identity result. The corrected explicit `.path` capture succeeded and compared equal. Neither attempt changed product inputs.

No new Important defect emerged from this narrow correction recheck. Native focus/IME/rendering, generated-artifact coherence and the whole batch remain outside this result. Original model/integration adverse observations and unrelated hosted pan history stay preserved.
