# Implementation correction: uncertain final copy completion

Author/implementer: `/root/media_batch_review`, 2026-10-07. This is my implementation record, **not independent approval**. Scope is only `src/navigation/source-bundle-copy.mjs` and `tests/source-bundle-copy.test.mjs`, plus retained evidence/report. I changed no parser, helper, main, catalog, build/generated inputs, existing other-author reports or native runners. No GUI, global suite, CI, release or installed replacement was run.

Other-author original finding remains unchanged in `reviews/2026-10-07-source-bundle-parser-copy-routes-independent.md`, SHA256 `21098aab10ad5b3d8192b163bf2e643d2e669446e030c4039a09978e0ef5779a`. It demonstrated an accepted complete marker/checkpoint that my copy catch reported as definitely incomplete after an atomic post-rename hook failure.

## Final contract

The copy latches `completionAttempted` immediately before its final owned completion-marker `atomicWrite`, after sources, manifest/reopen and exact saved checkpoint verification. A later publication/hook/readback/authority failure now returns:

```js
{
  ok: false,
  code: 'BUNDLE_COMPLETION_UNCONFIRMED',
  completion: 'unconfirmed',
  retainedProjectId: /* actually allocated fresh copy */,
  reason: /* underlying error code, otherwise BUNDLE_COPY_FAILED */
}
```

Such a result does not include `incompleteProjectId` or a successful snapshot, does not select a project, and makes no rollback/cleanup claim. The conservative result also covers failure before final rename once publication has been attempted; the durable strict reader may then still show `incomplete`. On accepted final rename followed by error or revocation, that same reader can independently establish `complete` against the actual manifest/checkpoint. The caller must continue to refuse selection on `ok:false`. Success remains `{ok:true,snapshot}` after all exact checks. Failures before the final completion attempt retain the old allocated incomplete identity and original refusal code; no allocation still returns no copy identity. No extra read/write is attempted after authority revocation to guess a completed state.

## Genuine RED and verification

Before changing product code, modified/added three actual-filesystem cases and ran the copy file. Retained `evidence/source-bundle-completion-unconfirmed-unit-red.log`: **13 pass, 3 fail, exit1**. Expected code `BUNDLE_COMPLETION_UNCONFIRMED` differed from old actual `BUNDLE_COPY_FAILED`, `OWN_HOOK_FAILED`, and `ACCESS_REFUSED` respectively. The failures were missing result semantics, not syntax, fixtures or environment.

After the minimal product correction:

- Focused actual copy/parser/admission execution: **30/30**, exit0. The first command also named an absent `tests/import-status.test.mjs`; Node did not execute that path. No claim is made that it tested a status test file. The explicit existing-file related run below supersedes that command.
- Explicit existing files: copy, parser, admission, selection, source recovery, manifest and migration: **62/62**, exit0, retained `evidence/source-bundle-completion-unconfirmed-related-green.log`.
- Before-final-rename refusal now returns retained/unconfirmed, while the actual owned marker remains strictly `incomplete`, schema2 manifest and exact checkpoint already verified.
- Post-final-rename hook failure returns retained/unconfirmed with original reason. Actual owned marker is `complete`, exact revision/hash agrees and saved checkpoint verifies. Original project snapshot is unchanged and no session selection file is created.
- Authority revoked in final `after-rename` hook returns retained/unconfirmed with `reason:'ACCESS_REFUSED'`; actual copy is complete and checkpoint-bound but remains unselected, original unchanged.
- Existing tests continue to verify earlier source/checkpoint/incomplete-marker failures, source bytes/provenance/version fidelity, corruption/status refusal, selected ancestry after later saves, global recovery isolation and independent selection atomic fault handling.

This does not independently re-run the other author's actual catalog/main-route probe, qualify the readonly correction in root-owned main, or prove native/package/CI behavior. No full suite was run because parent explicitly reserved it for the common source freeze.

## Frozen implementation identities

```text
src/navigation/source-bundle-copy.mjs 0104184330691d6e04d54c31c06237a8bbab32fdb95a5613c25defdd3e8b488c
tests/source-bundle-copy.test.mjs 2d960b1cb18d91ac1a543a96f6d425894f514991db7f1cf376c72c076e447777
evidence/source-bundle-completion-unconfirmed-unit-red.log 10de09a4ffc346a710f039bdef2533ff8aafd067a6dd9afd00e1d12ef6461c3a
evidence/source-bundle-completion-unconfirmed-focused-green.log 19e05b8f2c4f1cd4ba711796453848294d42e50aec4ffcd98863aa7a24f66a92
evidence/source-bundle-completion-unconfirmed-related-green.log e5d1dc4680a14276ae7b895876fd41f0530c1f5a24d36ca2ef365a7078e383b7
```

Another author's independent recheck of this corrected result contract and root integration remains required; the original adverse report is retained intact.
