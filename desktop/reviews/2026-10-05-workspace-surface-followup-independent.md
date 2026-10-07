# Independent follow-up review — corrected workspace-surface foundation

Author: Codex independent review agent `/root/workspace_surface_review` (separate from implementation/root agent).

Date: 2026-10-05. Review target: current uncommitted foundation lot, BASE and HEAD `bb73f818363ae7f89322122548fc19a525f557fe`.

Verdict: **No remaining actionable finding identified within the reviewed inactive foundation scope. Initial P1 and P2 are closed for the hashes below.** This is an independent scoped review result, not user approval, production enablement, whole Task 4 acceptance, or release qualification.

## Provenance and exact reviewed SHA-256 hashes

The original author report `reviews/2026-10-05-workspace-surface-independent.md` remains unchanged with SHA-256 `1ca01223e5d05452965d9735d0b856cad82c55c137f43480755a2bc41c2e88ed`. Its initial findings, reviewed hashes, adverse probe, and initial verdict remain historical evidence. This new report qualifies only the corrected source below.

Paths are relative to `C:/Claude/SIREN_WORK/portable/desktop`.

| File | SHA-256 |
| --- | --- |
| `src/windows/surface.mjs` | `0bd68029728807bbc6552ba494eed3ebf32899412d64b16373cdb4d869260266` |
| `src/windows/registry.mjs` | `f321f4d3afb81adbbf46501ea6d58673c25c0d5be3b545dd78db5b4a098a3ef2` |
| `scripts/package.mjs` | `8ed8e25d41a2765401d444fa763f0b1ad44bb0976c471330b8b26aa6319fcfda` |
| `tests/workspace-surface.test.mjs` | `fcb823bc1ec06badd22c148e8bc9663099bb6efc14e1e133685bfe4f5d6182b1` |
| `tests/workspace-surface-registry.test.mjs` | `9c769cb22b8995dc4218140148f7d201ba590d0bbcc976aa686e9b33c3d4524b` |
| `tests/native/workspace-surface.mjs` | `8de2e32a6fefbcb417cb8e9af698a914a758925cb4ddd75f3131b0a5256fcef8` |
| `tests/native/workspace-surface-app.mjs` | `b729af529c8a354ddc98de084982e99cdc9dc7c834ccd438f0a05d4f3ee7ee7e` |

## Initial P1 — CLOSED: externally closed surface lifetime retention

Registry lifetime handling now distinguishes a surface's native shell from its renderer. On either native lifetime event, an incomplete surface is synchronously revoked, retained in `#unclosedWindows`, and placed behind `#destructionFailed` before asynchronous disposal is awaited. Success removes the retained handle and recalculates the fence from the remaining actual handle set; failure leaves both retention and the fence intact. Completion callbacks can run after an epoch change without renewing old authority.

I independently reran the original shell-first scenario against current source with actual registry/surface logic and only the native boundary doubled. While contents close remained pending, activation refused with `ACCESS_REFUSED`; awaited epoch retirement refused with `WINDOW_DESTROY_FAILED`. After actual contents completion and retry, both handles were destroyed and activation succeeded. Confidential pixels were removed synchronously throughout the pending period.

Additional independent probes confirmed:

- Contents-first external destruction with native shell destruction refusal retains the surviving shell and blocks activation/retirement. A later real shell-destruction retry recovers.
- Pending self-close followed by a newer async epoch retirement retains the admission fence, completes native cleanup, and refuses the old close result/one-use receipt after the epoch changes.

These are adverse timeout/refusal results, not inference from successful fast native cleanup.

## Initial P2 — CLOSED: failed initialization retains concrete native ownership

Surface creation now tags its actual created shell in a module-private WeakSet, registers the surface controller before fallible initial native bounds/attachment work, and carries the actual `nativeWindow` on owned construction failure. Registry factory rejection examines the own data descriptor, accepts only the exact module-owned native handle, excludes pinned/previously admitted handles, retains it synchronously, and awaits proven cleanup. A timeout produces `WINDOW_DESTROY_FAILED` and preserves the native admission fence.

I independently reran the original initial `setBounds` failure with contents close pending. `openView` refused with `WINDOW_DESTROY_FAILED`, both shell and renderer remained alive and retained, epoch retirement also refused, and activation was blocked. Only real contents completion plus retry proved both destroyed and permitted activation.

The newly added test for an error carrying a previously admitted native handle passed during my independent focused run; static review confirms the rejection catch does not dispose that existing or pinned owner. A renderer-projected numeric ID or untagged arbitrary native object cannot satisfy the private ownership check.

## Independent verification performed

Command from desktop:

```text
node --test tests/window-registry.test.mjs tests/workspace-surface.test.mjs tests/workspace-surface-registry.test.mjs
```

Result: **63 passed, 0 failed**. This includes 38 original registry tests and 25 surface/foundation tests. I read the corrective tests and the full current surface module plus the modified registry contract; I did not edit product or test source.

Independent temporary `node --input-type=module` probes reused the original report's native-boundary mocks and original adverse triggers, adding assertions for the required refusal/timeout/retry outcomes. They also exercised the two additional lifetime order/race cases above. Exit 0; observed stdout:

```text
P1 original shell-first sequence: timeout refuses retirement and activation; actual completion/retry recovers
P2 original initial-bounds sequence: known failed native handles retained, timeout fences; actual completion/retry recovers
Pending self-close plus newer async retirement: fence retained and old close receipt refused
Contents-first destruction with shell refusal: native shell retained/fenced until real retry
```

## Current native evidence inspected

I inspected the fresh root-owned isolated native probe at `evidence/workspace-surface/2026-10-05T16-39-31.662Z`, its `result.json`, `native-result.json`, and revised probe source. It records `COMPLETE`, exit 0, no timeout, unchanged inputs, six complete cases, no cleanup/surface failure, and zero remaining native windows. Current surface, registry, and native-program hashes match both captured input and after-input hashes. This is inspected real Electron evidence, **not a fresh native run initiated by this reviewer**.

The original five scenarios remain present: two independent real Code editors and two Docs draft models; 12 attach/detach cycles preserving exact frame/contents identity, working text, selection and draft state without navigation; Code undo/redo across movement; actual self-close receipt after both handles disappear; and awaited epoch cleanup preserving the host and original Docs data.

The sixth case now genuinely destroys an attached BaseWindow shell with `rendererAliveAtShellClose:true`, requires immediate activation refusal and view removal from the host, and awaits actual surface disposal. It therefore exercises the real split lifetime that triggered initial P1.

Initial native fixture failure and the initial positive native run remain retained historical evidence. They are not used to qualify the corrected source.

## Scope limits and outstanding qualification

Source lookup confirms production main/factory/preloads/UI do not activate this primitive. The production-safe preferences and trusted main-process predicate remain enforced. No copy, reload, or replacement renderer is introduced in the movement primitive. The package change remains the single source whitelist addition.

The native Docs evidence covers a textarea and the real draft model, not complete production Docs UI or document-save authority. This review does not qualify production docking controls, common dirty-save/Lock persistence, production close/save behavior, tab UI, restart, all Task 4 acceptance, or release. Physical multi-monitor behavior is outside the fixture.

The root-reported original full suite with 1031 passes is historical pre-fix evidence. No final full-suite result is claimed by this review; final qualification must use the corrected source hashes.

The separately reported old native `window-shells` fixture remains ADVERSE at a role privacy sentinel assertion. I did not independently diagnose or rerun that fixture here, and this report does not classify it as a product pass or erase that adverse result. Any separate current native focus evidence requires its own attribution and scope.

No enablement or approval is inferred from evidence existence or this scoped finding closure.
