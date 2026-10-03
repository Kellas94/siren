# Standalone Home entry and native identity evidence

Author: root implementer, 3 October 2026. This is implementation evidence, not an independent review or release approval.

The approved Home plan now has a separate 43,744-byte `home.html` build, three local CSP-hashed scripts, no legacy diagram initialization or renderer project store, reused protected-PIN UI, a native-requested introduction and a distinct vault animation. Home presents Continue, local project summaries, module cards, readonly notices and a retained-input creation dialog. Labels use text nodes. Unconnected module/import actions remain disabled; unavailable Continue/Create receives an honest error rather than claiming navigation succeeded. Native entry and readiness checks accept only the explicit Home/App identities. A Home workspace grant has no entity IDs and cannot read sources merely because those IDs exist in native policy.

Production `main.mjs` still starts App. Production first-unlock project creation, entry-specific desktop-method permissions, native route hand-off, all-view transitions, genuine module destinations and Home/preload installation remain open. This commit does not claim that the Home screen is already the application's default or that Code/Docs/Present editors are admitted. Serving and packaging the data-free Home file does not authorize its data methods.

## Frozen unit result

`evidence/home-entry-suite-result.json`: 579/579, exit 0, no failures, skips, cancellation or TODO; captured source/build/test/script/workflow inputs unchanged. Native identity tests ran separately before the other tests, matching the actual workflow. Start `2026-10-03T14:03:34.893Z`, finish `2026-10-03T14:07:09.744Z`; full log SHA-256 `c441390fdb8e157d0227784f2b17b20200d0f92a207ff36c2fa31c8948e0a2b5`. The final native keyboard-sequence correction below was made after this unit run and changes only the native fixture; the product inputs qualified by the suite remain identical.

New coverage includes strict entry/route fields, genuine Home frame identity, readiness during navigation, empty Home authority, no metadata/UI construction while locked, explicit once-only introduction, reduced-motion no-timer behavior, entry byte budget, exact script hashes, closed protocol/package paths and absence of the old application initialization.

## Actual Electron qualification

`evidence/home-entry/2026-10-03T14-09-04.872Z`: COMPLETE, six groups, own PID 16612, captured inputs unchanged, no remaining fixture windows. Native result SHA-256 `a1d4c8b3e0b51f0293ff6c06102d5c3937512268307e8fb3682e170a4885f2d3`. Built Home SHA-256 `5c5d8e88a07aba48b56e7ab7f5d918c120ba71d55dc97e2ed729381e72049bfd`.

The fixture runs the actual Home build, HomeAuthority, invokeHome, HomeService, NavigationStore, ProjectCatalog, ProjectStore and LocalPinAccess with actual Electron protected storage, in its own data/profile directory. It observes Intro → PIN → Home, performs genuine PIN setup and wrong-PIN refusal, confirms zero projects after first unlock, and confirms every renderer resource request names only Home. Planted private project text never enters bootstrap/DOM; a hostile-looking label remains inert text. Unavailable native destinations retain the creation input and selected project bytes. Home-only Lock clears labels, skips intro replay and restores the unchanged project after genuine unlock. A pending native metadata response across Lock cannot republish old labels.

Native pointer, Tab/Return activation, 200% responsive layout and actual Chromium reduced-motion emulation are exercised. Captured light/dark backgrounds are independently checked as `rgb(246, 247, 251)` and `rgb(21, 22, 25)`; fresh screenshots were inspected. Readonly disables creation. This is a single-window owned Home fixture, not all-view production Lock, complete module routing, physical multiple monitors, startup latency or memory qualification.

`evidence/domain-workspaces/2026-10-03T14-09-05.953Z`: COMPLETE, six groups, own PID 38904, captured inputs unchanged. Native result SHA-256 `a080c4a9622376d480408a78f4d5ad273ef87676ab77b777e2311e8b5372e80c`. Existing primary/two-Docs/two-Diagram persistence proofs remain intact; the additional genuine Home frame cannot obtain source authority, and default App readiness refuses Home unless explicitly requested. These views are protocol fixtures, not production editors.

## Adverse results and corrections retained

- `home-entry/2026-10-03T13-58-17.862Z`: ADVERSE, `UnknownVizError` from attempting capture before the native compositor painted. The fixture now awaits painted animation frames before capture. No product timeout or success oracle was relaxed.
- `home-entry/2026-10-03T13-59-10.641Z`: four-group completion, but subsequent image inspection found both nominal theme screenshots followed the Windows dark preference. It is not evidence of two distinct themes. Explicit painted-color comparison and forced light/dark captures were added, qualifying the later results separately.
- `home-entry/2026-10-03T14-03-04.138Z`: ADVERSE at keyboard activation. The native test supplied only keyDown/keyUp. An ignored diagnostic copy exercised Return/character/keyUp and completed at `14-05-58.770Z`; that diagnostic copy is not final qualification. The actual tracked fixture now sends the complete native sequence and the final run above independently completed. Product click/key handling was unchanged. Electron documents that native input requires a focused containing window: [official webContents documentation](https://www.electronjs.org/docs/latest/api/web-contents/).
- A startup unit initially failed because the test helper replaced an explicitly undefined opening flag with its own default. Its fixture was corrected to preserve field presence; the product's requirement for an explicit native introduction flag stayed unchanged.

Original CI35 and other earlier failures retain their original provenance and unresolved-cause status. No independent verdict has been created by root. Production package admission and whole-branch independent review remain later approved-plan steps.
