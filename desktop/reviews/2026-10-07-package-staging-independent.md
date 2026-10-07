# Independent review: bounded package staging lifetime

Date: 2026-10-07. Reviewer: `/root/package_staging_review`.

Verdict: **ACCEPT_BOUNDED_FIX**. No Critical, Important or Minor defect found within the reviewed staging-lifetime change. This is not merge, release, installed replacement, portability, or GUI/native qualification. The coordinator's full-suite result remains separate evidence.

## Scope and immutability

Base and observed HEAD before/after: `d8584a5f9ad7fca694c29ccc37ee2192cb44a668`. Reviewed the actual working files and the tracked diff, rather than a base-to-HEAD diff that would omit this uncommitted work. No applicable AGENTS.md was found at the workspace/repository root or in the repository file search.

The four frozen source/test SHA-256 values matched the supplied manifest before and after review:

| File | SHA-256 |
| --- | --- |
| desktop/scripts/package.mjs | 1aa734545b9f3cc6638ec1e492129eab58b37d4a44ae35523286c936df1e8aa9 |
| desktop/scripts/package-staging.mjs | de376d3b1e2b5ccc38858b878ef7f19c524349252d2826bf94d147f7a390adf5 |
| desktop/tests/package-staging.test.mjs | a764a54a86c9a5a6c4763e3be963964bab65f2713c4407ce67d6071ff595c073 |
| desktop/tests/package-staging-integration.test.mjs | ac7f10cc5b63f2bd00b72d6024e5abb4cc50665889c93d54e05b1c569454973f |

The coordinator subsequently supplied `desktop/README.md`, SHA-256 `9d71f0db5849af603eb9c4f3f2480ba84631aecb8f3b40e547fe0a6f4b690f04`. Its actual diff and paragraphs 51-60 were reviewed and the supplied hash matched. This documentation addition did not change the frozen runtime/test files.

Reviewer writes were restricted to this report, its JSON companion, and the explicitly authorized independent evidence directory. No product/test edits, Git mutation, build/package execution, full suite, GUI, network request or process termination was performed.

## Strengths and requirement tracing

- `package.mjs:58-94` places staging ownership around the actual copy/runtime/ASAR/receipt work. Preview and partial preview paths are siblings, so cleanup targets only staged inputs; renderer/native generation before staging remains outside this temporary-directory policy.
- `package-staging.mjs:30-34` uses a fresh UUID and nonrecursive creation; existing sibling staging is neither enumerated nor selected for removal. The callback receives the exact owned path.
- `package-staging.mjs:7-27` checks admitted canonical parent/root directories and stable device/inode/birthtime identities, scans descendants for links/special files before recursive removal, and rechecks parent/root immediately before removal. `ownedDirectory` in `src/projects/paths.mjs:5-10` rejects observed symlink/junction paths and a differing realpath, including linked ancestors. These are observed-state checks, not atomic race elimination.
- `package-staging.mjs:35-43` preserves build result identity, exact thrown values including falsy values, and cooperative cancellation thrown by awaited work. A cleanup failure rejects even a successful callback, identifies the staging path and retains both errors when build and cleanup fail.
- The 11 helper tests cover successful deletion/preservation, failure identity, AbortError, falsy rejection, parent/root/descendant link refusal, parent/root replacement and concurrent invocations. The two integration tests call the actual builder with actual renderer/ASAR and explicitly fake, non-executed Electron bytes; the successful test inspects an archive sentinel and the failing test inspects retained partial preview plus historical sibling.
- README paragraphs 51-60 accurately limit the cleanup policy and disclose failure reporting, forced termination, and non-atomic path checks. It does not introduce global retention.

## Independent execution

Executed only `evidence/workspace-surface/package-staging-independent-2026-10-07/independent-probe.mjs` with installed Node v24.16.0 on Windows. It imports the actual `withPackageStaging` implementation and uses reviewer-created canonical temporary fixtures. All **4/4 probes passed**, exit 0, with no skips:

1. A junction in the parent ancestry rejects before the build callback runs.
2. Replacing the parent with a junction during the callback refuses cleanup and preserves the replacement target and moved original tree.
3. A real Windows exclusive file lock causes `rm` to fail with **EBUSY** after a successful callback; the caller receives `AggregateError`, exact staging path and the OS cleanup error.
4. The same real lock with a callback rejecting `undefined` retains the exact falsy original rejection as the first aggregate element/cause and the cleanup EBUSY as the second element.

The lock helpers were reviewer-created PowerShell child processes; they were released normally through stdin, not killed. The fixture root was verified under canonical TEMP and removed after all locks were released. Raw result: `evidence/workspace-surface/package-staging-independent-2026-10-07/independent-probe-output.json`.

The coordinator reported original builder RED 2/2 and focused GREEN 19/19. Those results are **coordinator-supplied context**, not executions independently repeated by this reviewer. The builder integration and its dependencies were inspected statically. The coordinator is running the full suite separately.

## Issues

Critical: none found. Important: none found. Minor: none found. No fix requested by this review.

## Declined to judge

- Atomic protection against malicious concurrent path replacement after a check: explicitly excluded; these path-based APIs cannot establish a filesystem sandbox.
- Cleanup after forced process termination or a never-settling build: cooperative lifetime cleanup cannot run once JavaScript is terminated or the callback never settles; the task explicitly excludes force-kill recovery.
- A new cancellation signal/API for `buildDevelopmentPackage`: not part of this fix. The change cleans staging when awaited work throws a cooperative cancellation; it does not claim to initiate cancellation.
- Historical/global staging retention or archive cleanup: explicitly excluded and no global scanner was added.
- Native Electron runtime, GUI, release admission, activation, signed updates, installed replacement, and portability: the integration runtime is explicitly synthetic and never launched; this review performed no native run.
- Full repository suite and unrelated product defects: coordinator-owned verification and outside this independent bounded review; no overall-suite PASS is asserted here.
- General package-input trust before staging is created: unchanged surrounding build behavior; this fix is a staging cleanup policy, not broad package-build sandboxing.

## Assessment

The implementation satisfies the bounded policy in `C:/Claude/SIREN_WORK/disk-cleanup/CLEANUP_NEXT_POLICY_2026-10-07.md`: it cleans only an invocation's ordinary owned staging on success/failure/cooperative rejection, preserves preview/sibling/user surfaces, refuses observed unsafe paths/replacements, and exposes cleanup failure without dropping the original build error. The independent real-OS error probes strengthen the supplied cleanup-refusal tests. Acceptance here remains conditional only on the separately required coordinator checks being reported accurately; it grants no merge/release/GUI admission.
