# Independent final local-PIN package addendum — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. The prior packaged review and all failed/successful receipts remain unchanged. This addendum qualifies the new recorded artifact and bounds the additional source review; no product or further test edits were made during this rerun.

**Disposition: the committed packaged native regression passed again against the final development artifact. The one-line damaged-selection UI metadata correction is consistent with the native gate and existing readonly/recovery authority by source inspection. This is not production release admission.**

## Final executed artifact and outcome

Package: `desktop/dist/development-50253700-10b7-4723-8f9f-89586819863d`. Actual receipt source: `02bca40488bcf55153d033254062bb8662716834`. Kind remains development-preview and release admission remains false. The final corrected packaged test is committed in this source identity; its SHA-256 remains `856447dce1b8044a0380316ae6433a0c5c4eb4266a8b26a67ca7d2f7e5a851e6`.

| Artifact | SHA-256 |
| --- | --- |
| `app.asar`, 14,276,453 bytes | `d9ee614f054d4a7f9ad49abad28192b06b126b263cdd4ca4c2239290e46ed249` |
| Renderer (unchanged) | `240a2b60f014d2be861c608b265e024b91373c12dfdda6fd580b4ff2abc2aca6` |
| Main source, independently extracted from this archive | `79e8645b92112c80c8c9aa3a0bfad81ff336b8ede182e39ad57e79a41bc2ff63` |
| Runtime binary (unchanged) | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

I independently executed `node tests/native/packaged.mjs <this package>` with approved ordinary native execution and owned isolated Unicode-folder copies. Exit was 0, `completed:true`, evidence `desktop/evidence/packaged-2026-10-02T17-29-22.278Z/`. The probe verified the copied archive and runtime hashes against this receipt.

All previously documented current assertions passed: raw locked/null snapshot and `PIN_REQUIRED` save refusal, explicit native fixture PIN setup/unlock, packaged editing, actual acknowledged native save/exact disk readback and verified checkpoint, pointer restore into a different project with exact immediate recovered bytes and preserved original, acknowledged normal exit, Unicode folder-copy relock and unlock, exact retained source/snapshots, ignored development CLI arguments, unconfigured updates, and native damaged-journal readonly/`ACCESS_REFUSED` despite a correct PIN. The original save remains snapshot-equal at recovery, exit, copy and safety boundaries. The test retains the earlier documented normal-exit recovered-envelope boundary rather than comparing it to pre-exit legacy JSON.

## Independently inspected source delta and limits

The product delta from source `332551613e8e5cfa3015a5a15b7d20a22cc58450` is one field in the native explicitly chosen damaged-project branch:

`bootstrap = { mode, reason, snapshot: null, recoveryProjectId: projectId, readonly: true, localAccess: true };`

The chosen-folder path still validates the owned Data project location and ID. `openOwnedSelection()` retains the native grant for a damaged original, selects recovery mode and returns `recoveryRequired:true`, so the caller reloads the renderer. `pin.js` requires `boot.localAccess`; the Desktop controls use that same predicate to choose PIN Settings/Lock versus the deferred account-preview controls. Retaining this metadata therefore prevents a separately chosen damaged local project from accidentally showing the old account-preview controls. The field is orthogonal to native PIN authority: the bootstrap still returns a null locked snapshot until native PIN state is unlocked, and the existing native IPC/save guards, null damaged snapshot, recovery mode and readonly flag remain intact. No native gate bypass is introduced by this field.

This rerun exercises packaged recovery and a damaged-journal safety variant. It does not independently drive the operating-system folder picker into the separately chosen damaged-project branch. That specific metadata correction is source-inspected here; it must not be described as an independently executed picker scenario. The successful packaged regression does not broaden the earlier reports' limits to clean PCs, other Windows accounts, encrypted projects, all private Code flows, hostile local races, production online activation, signed update installation or release admission.
