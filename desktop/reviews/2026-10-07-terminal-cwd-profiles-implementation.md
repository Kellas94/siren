# Terminal cwd/profile pure implementation

Author: /root/hosted_resume_retention, **implementer and own verifier**, not an independent evaluator. 2026-10-07T16:02:28.330Z. Status: frozen for independent review. **Native execution/ownership remains NOT_ADMITTED.** These four new files are a subsequent local tranche, not part of Python preview source041e616/manifest9031343.

## Delivered boundary

- `src/terminal/cwd.mjs`: approved CwdAuthority.pick/resolve, project/run/epoch-bound opaque tokens, native-only injected selection/inspection/policy/admission providers, complete directory ancestry/identity checks and protected-root revalidation. No fallback, filesystem writes or implicit virtual-source cwd. Eligible same-project peers can resolve a token; it is not permanently tied to its originating window.
- `src/terminal/profiles.mjs`: createShellProfileCatalogue plus approved listShellProfiles/resolveShellProfile interfaces. Unconfigured exports refuse. Private fixed powershell catalogue, absolute trusted system-directory discovery, pinned executable/ancestry identity, immutable interactive args [-NoLogo,-NoProfile] and copied/filtered native OS environment. Inspect executable again after environment await.
- `tests/terminal-cwd.test.mjs` and `terminal-profiles.test.mjs`: **50** actual pure cases; reuse the existing TerminalPolicy and strict request dispatcher. The focused run includes **13** existing policy/contract cases, total **63/63**, exit0, no skipped/cancelled tests.

Only those four owned source/test files were added. No policy/contracts/registry/main/preload/IPC/UI/workflow/build/package/dependency changes; no host/PTY/application spawn, native GUI, build, full suite or Git operations. Full integration verification is reserved to ROOT after independent review.

## Actual TDD and adverse preservation

| Retained run | PASS / total | FAIL | Exit |
| --- | --- | --- | --- |
| red | 13/48 | 35 | 1 |
| green | 48/48 | 0 | 0 |
| adversarial-final-scope-red | 52/58 | 6 | 1 |
| adversarial-corrected-fixture-red | 52/58 | 6 | 1 |
| adversarial-device-red | 52/59 | 7 | 1 |
| adversarial-final-scope-green | 59/59 | 0 | 0 |
| adversarial-provider-redaction-red | 61/63 | 2 | 1 |
| adversarial-provider-redaction-green | 63/63 | 0 | 0 |

Initial RED proves missing features, with original source absence and test snapshots retained. The first adversarial run contains one fixture timing defect: final-resolve revocation fired before the intended filesystem completion and already refused CWD_REFUSED. That original is preserved; correcting only the fixture timing produced the intended missing-rejection RED. Separate original source snapshots precede both actual correction rounds.

Real implementation defects found and repaired: (1) a reentrant authorization/guard callback could revoke/dispose at the final check and return true; local generation/disposal/context is now checked again after callbacks, (2) previously accepted device aliases now refuse, and (3) malformed provider reflection now maps to generic refusal rather than leaking raw exception text. The final unchanged assertions pass. Final receipt captures **14 inputs unchanged during execution**; ten existing inputs also match original pre-implementation RED. Logs, receipts, original tests and source snapshots all have SHA-256 inventory in JSON.

## Main-only contracts and limits

Cwd constructor accepts pickDirectory, protectedRoots, inspectDirectory, authorize(grant,method), captureAdmission(grant), maxGrants64/maxPending8. Picker result is data {canceled,filePaths}. Inspection is data {canonicalPath,identity,directory:true,reparse:false,ancestors}; ancestors contains every drive-root-through-leaf directory with path/identity/directory/reparse. Missing, redirected, replaced, link/reparse, malformed or unknown identity refuses. Main must source meaningful native identities; this class never invents them from a path.

Profile factory accepts getSystemDirectory, inspectExecutable, readEnvironment, request-bound authorize/captureAdmission, privateEnvironmentKeys and maxPending8. File evidence adds file:true and includes all parent directories. Callbacks must be bound to a stable real native request/captured caller, not a mutable global renderer identity. Public profile entries remain only profileId/label/available; extra argv/env/command input is refused. Receipt wrapping and real IPC wiring are later manager responsibilities.

Both authorities provide revoke/dispose; disposed authority cannot revive. Call revoke on Lock/project/run transition including failed transition rollback. Every awaited provider and final delivery is fenced; no async truthiness grants access. No pending timers/retries/fake cancellation are introduced: unresolved providers retain a finite slot until completion. Limits are64 cwd tokens,8 pending operations,16 protected roots,128 ancestor records,32768 path characters,256 identity characters; env512 variables/32768 characters per value/256KiB total UTF-8. No active token is silently evicted.

Local absolute drive paths/roots only; UNC/device/extended/relative paths and malformed/ambiguous components refuse. Literal Unicode, spaces, apostrophe/backtick/$() remain native path text. Protected paths use equality/component-descendant boundaries rather than prefix guesses. Main must pass actual relocated Data plus install/runtime/resources roots.

Environment preserves nonempty SystemRoot/PATH and copied OS values, strips Node/Electron/VSCode/SIREN injection prefixes, CHROME_LOG_FILE, PSModulePath and explicit privateEnvironmentKeys case-insensitively; duplicate case-folded keys refuse. PSModulePath omission is explicit and may affect inherited custom module paths; no actual PowerShell behavior is claimed. The class adds no application credentials. User OS environment may itself contain secrets; there is no universal secret-removal claim.

Actual native-dispatch spy remained **0** for five rejected renderer terminalCreate envelopes carrying executable/argv/env/command/project fields, through the real existing dispatchTerminalRequest validator. This is strict-boundary evidence; it is not a mocked valid native execution gate or process ownership proof.

## Remaining qualifications

Real Windows filesystem/reparse/identity and trusted OS/profile discovery adapters remain unimplemented. Revalidation leaves a filesystem TOCTOU interval before a future spawn and does not establish atomic directory-handle binding or a shell/filesystem sandbox. Main must still establish native caller/writable/admission checks and the independent Task1 atomic Job/host/PTY ownership before any execution side effect. No product wiring, portable package qualification, GUI/fullsuite or release/hosted PASS is inferred. Original hosted failures and all earlier independent reports are untouched.
