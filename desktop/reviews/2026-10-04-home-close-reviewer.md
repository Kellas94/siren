### Strengths

- Close preparation now synchronizes controls, writes the recovery draft and clean-exit marker, and awaits a final **selected workspace** save before storage is fenced. The existing storage adapter and native persistence distinguish recovery checkpoints from selected commits.
- The added real-storage tests cover selected-bag readback, preservation of larger recovery drafts, final workspace refusal, private Code retention and cancellation restoring the running marker. Concurrent-save tests refuse failures by actual payload rather than fragile request ordinals.
- Home summaries remain bounded to 16 selected-project registered views. Labels use bounded literal text and expose no source bodies, hashes, provenance or grants. Docs labels explicitly identify the selected project revision.
- Home minification preserves hashes computed from the emitted scripts. My read-only check of the existing generated artifact found **52,859 bytes**, three inline scripts and matching CSP hashes for all three. The package whitelist includes `src/navigation/window-labels.mjs`; esbuild was already declared.

### Critical findings

None found in the inspected scope.

### Important findings

1. **A dirty working Code window loses its filename and admitted version on Home.**

   File: [window-labels.mjs:32](/C:/Claude/SIREN_WORK/portable/desktop/src/navigation/window-labels.mjs:32)

   `referenceFor(view)` supplies the genuine native window’s current reference, but the helper accepts it only when its exact key appears in `snapshot.sourceRefs`. A working source can advance before its version is committed into the selected manifest.

   The existing native scenario demonstrates that state: [source-link.mjs:47](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/source-link.mjs:47) expects the working window to display `Agent Ș😀.py · v3 · Working copy · Unsaved`, while line 49 verifies the selected project remains unchanged with its earlier reference. Refreshing Home then produces `⌘ Code · <first eight source-ID characters>` without the filename or version. This undermines the named shelf precisely when users need to distinguish their working and immutable windows.

   The new shelf assertions run only **after** linking v3 into the manifest, at [source-link.mjs:71](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/source-link.mjs:71), so they miss this case.

   **Smallest safe fix:** carry an explicit main-owned working admission alongside the exact reference obtained from the current captured grant. Use that admitted reference for the version, and bounded selected metadata for the filename. Keep exact selected-reference/hash matching for immutable windows and reject unverified callback references. Do not consult repository “latest,” read source bodies, or acquire authority from a renderer-provided reference. Add the shelf assertion before linking v3, preserving the unchanged-manifest and wrong-hash assertions.

### Minor findings

1. **The native PIN probe records its recovery comparison without requiring it to have executed successfully.**

   File: [local-pin.mjs:100](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/local-pin.mjs:100)

   The probe records `window.__pinRecoveryProof` but asserts only that the confirmation dialog is closed. A future regression that skips the comparison could pass this portion with an undefined proof and a closed dialog.

   Assert that the comparison exists and `comparison.equal === true`. The inspected current receipt does contain that proof; this is an oracle weakness, not evidence that the current native result failed.

### Evidence and execution boundaries

I reviewed the tracked working-tree diff and both new files against base/HEAD `bc36af0314bf2e1f5d31439e67ebae8a40a854cc`. I inspected the specified renderer, Home build/UI/integration, packaging and test changes, plus the relevant storage adapter, `ProjectStore.saveProject`, `PrimaryPersistence`, registry capture/roster behavior, working-source admission, source-reference resolution, native preparation/rollback hooks and frozen baseline draft/save/recovery functions.

I also read the scoped plan requirements and retained evidence:

- CI74 forensic receipt remains **FAILURE**, with selected zoom 33, draft zoom 29 and clean marker `no`.
- `home-named-recovery-final-qualification-result.json` remains **ADVERSE**; its desktop native group exited 1 despite the full unit step exiting 0.
- `local-pin-2026-10-04T20-07-27.870Z/result.json` reports `completed: true`, recovery comparison equality, no prompt and selected clean marker `yes`.
- `close-draft-real-current-green.log` reports 27/27 passing.

Those test results are inspected implementer evidence. **I executed no tests, builds, application launches or package creation, and changed no files, index, HEAD or branch state.** My generated Home size/CSP check was read-only.

### Declined to judge

- Completion of broad Tasks 4/5/8: this review covers the explicitly scoped partial lot.
- Physical monitor, mixed-DPI, display removal and attach-back behavior: no relevant physical execution was performed.
- Installed application, signed release, updater and exact packaged-runtime qualification: no current package was inspected or launched.
- Broad diagram editing, Docs editing, source analysis and scalability: outside this lot.
- Final outcome of the new frozen qualification runner: it was still active during this review.
- Retrospective approval of earlier CI or adverse qualification runs: later corrective evidence cannot change their original outcomes.

### Assessment

**Ready to commit/update the draft: With fixes.**

The frozen lot is **not ready to commit as complete** because the named shelf omits genuinely admitted dirty working versions. Repair that case and qualify it before committing; the draft can already record this finding and the retained adverse/current evidence accurately. This assessment grants no approval of the whole branch, main, release or full plan.
