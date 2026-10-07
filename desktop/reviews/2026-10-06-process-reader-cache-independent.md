# Fixed process reader cache — independent build review

Author: Codex independent agent `/root/shared_workspace_review`. Date: 2026-10-06. Reviewed source: `98ee9550b21c2f5ff1e6d35d5d8ae28f3923b833`. Builder SHA-256: `6187b4696c98a2cad338ebbfeaab50030395df14d40cf5d52cfb715e21436985`.

Scope: read-only review of the new builder/cache change and independently executed isolated build/cache fixtures. No product source, repository tests, production generated files, helper bytes, Windows policy or earlier reports were edited. I did not launch Electron, the helper, a native GUI or a package. Compilation in the tests/fixture uses the actual fixed Framework compiler only against isolated temporary inputs; newly compiled helpers are treated as inert data and never executed.

## Findings

Critical: none established. Important: none established.

**Minor — the first-compile path does not establish ownership of the output directory.** `scripts/build-process-reader.mjs:18` creates `native/generated` recursively but does not verify that it is a regular owned directory with the expected canonical path. When its two leaf files are absent, the owned leaf reads both reject ENOENT. Line 29 then permits first compilation, while lines 30–33 compile/read/write through the unchecked output directory.

Status: OPEN as of source `98ee9550b21c2f5ff1e6d35d5d8ae28f3923b833`. No corrected-source GREEN is included in this report.

I independently reproduced this on Windows with `native/generated` as a junction to a different directory inside my own fixture root. Both leaves were genuinely absent. The actual builder returned `reused:false` and wrote a 6,144-byte helper plus receipt into the junction target. This is a first-compile ownership gap; it is not a demonstrated bypass of existing-cache admission, arbitrary helper execution, signing or native process authority. The original builder already used this unchecked output path, so it is not introduced by cache reuse. It limits the new broad claim that aliased/uncertain cache/output state is refused.

Minimum correction: after creating the output directory, verify it using the existing owned-directory primitive before cache reads or compiler invocation. Add an isolated first-compile junction case requiring refusal and an untouched empty target. This should not recompile or execute an admitted helper. Concurrent path replacement during a build was not independently tested here.

## Admission and provenance review

`admitCachedProcessReader` requires the currently installed fixed compiler digest to match the receipt and delegates to the existing source/binary admission. The build first checks the pinned source recipe using CRLF-to-LF normalization. Existing cache metadata is bounded to 4 KiB and executable bytes to 128 KiB via `readOwnedBytes`; regular-file/canonical-path checks, schema/kind/source identity, MZ header, finite size and exact binary digest are retained.

Both existing admitted files return without compiler invocation or writes. Partial pairs, uncertain IO failures, malformed JSON and identity mismatches are refused rather than silently regenerated. A new compile is permitted only when both leaf reads are ENOENT, subject to the output-directory finding above. Metadata is not repaired or updated to make a mismatched existing binary pass.

This establishes consistency of the existing owned artifact with a trusted build receipt and the current pinned source/compiler. It does not independently prove arbitrary cached executable/source correspondence, sign the executable or guarantee Windows Application Control approval. Runtime admission and unknown-to-read-only behavior are unchanged. Idempotent reuse reduces needless artifact changes during UI packaging; it is not an OS-policy repair or a query retry.

## My executions

I ran these repository tests myself:

```text
node --test tests/process-reader-cache.test.mjs tests/native-process-provider.test.mjs
6 tests; 6 passed; 0 failed; 0 skipped
```

They cover fixed provider paths/refusal, cache identity admission and an actual isolated Windows first compile followed by reuse. The test compile writes only into its OS temporary fixture, and the resulting executable is never invoked. These are my executions of repository tests, separate from the owner's previous test runs.

My independently authored `C:/Claude/SIREN_WORK/tmp-process-reader-cache-independent/probe.mjs` additionally calls the actual production builder on isolated owned copies of the existing source and helper:

| Case | Own result |
| --- | --- |
| Previously admitted actual helper/receipt | `reused:true`; binary and metadata bytes and mtimes unchanged |
| Same source with explicit CRLF checkout bytes | Recipe normalization admits exact cache reuse |
| Binary-only or metadata-only cache | CACHE_REFUSED; existing bytes retained |
| Malformed JSON | Parsing refusal; existing bytes retained |
| Wrong compiler digest | COMPILER_REFUSED; existing bytes retained |
| Changed binary with unchanged receipt | IDENTITY_REFUSED; supplied bytes retained |
| Oversized metadata or executable | CACHE_REFUSED; supplied bytes retained |
| Executable path is a directory | CACHE_REFUSED; existing state retained |
| Both missing under a junction output directory | Unexpected first-compile acceptance; helper and receipt written to the different target |

The first ten cases demonstrate the intended cache behavior. The eleventh is the ownership finding. Result SHA-256: `e9e98fcf53d1854cfc0ee1e4915beeeeb3449d1a541058143445a4c6a5092f62`. The default production helper digest was independently checked before and after: unchanged `485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3`. No fixture helper, including the newly compiled junction-target artifact, was executed or renamed for execution.

## Owner platform evidence and limits

The owner's separate build-stability record describes an Application Control refusal for a newly compiled helper and restoration of the previously qualified helper from the retained preview. Those are owner observations and artifact-recovery actions, not my executions or an independently diagnosed Windows rule. I did not retry the blocked binary, alter a policy, reproduce its OS refusal or independently qualify the restored helper's startup on this task.

The Diagram correction report remains exact SHA-256 `6b8d4aa1c2e94a578a78f0f17cd5019d4fc6bf0fc1c7a16b0604bab6b1c6af0e` and remains scoped to source `e228540` and its isolated UI/lifecycle verification. This new build report does not relabel that report, the earlier adverse CI, or any full/native/copied/hosted result. Combined-source qualification and signing/clean-machine execution remain outside my scope.
