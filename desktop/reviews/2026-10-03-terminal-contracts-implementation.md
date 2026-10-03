# Terminal request contracts implementation

Date: 3 October 2026. Author: `/root/recovery_diagnostics`. Scoped implementation of the pure request boundary in [the approved Terminal design](../../docs/superpowers/specs/2026-10-03-siren-terminal-design.md). Used test-driven-development and the scoped executing-plans workflow. Changed only `src/terminal/contracts.mjs`, `tests/terminal-contracts.test.mjs`, and this review. No runtime/main/preload/UI/registry/output/dependency/package edits, commits, shell launches, native qualification, or ownership admission.

## API and normalization

Exports:

- `TERMINAL_LIMITS`: immutable exact design budgets.
- `TERMINAL_METHODS`: immutable schema map for exactly the ten approved names; each field schema is also frozen.
- `validateTerminalRequest(method, payload)`: `{ok:true,payload}` for a validated immutable null-prototype copy; otherwise immutable `{ok:false,code:'REQUEST_REFUSED'}` with no attempted text or input object.
- `dispatchTerminalRequest({method,payload,dispatch})`: validates before calling the trusted native callback as `dispatch(method, normalizedPayload)`. Invalid payload never invokes it. A missing callback returns `{ok:false,code:'UNAVAILABLE'}`. Dispatch's receipt/authorization/error handling remain the integration owner's responsibility.

The exact accepted methods and extra fields beyond mandatory `operationId,epoch`:

| Method | Mandatory additional fields |
| --- | --- |
| `terminalPickCwd` | none |
| `terminalListProfiles` | none |
| `terminalCreate` | `cwdId,profileId,cols,rows` |
| `terminalList` | none |
| `terminalAttach` | `sessionId` |
| `terminalInput` | `sessionId,leaseId,generation,inputSequence,data` |
| `terminalResize` | `sessionId,leaseId,generation,cols,rows` |
| `terminalAck` | `sessionId,leaseId,generation,throughSequence` |
| `terminalDetach` | `sessionId,leaseId,generation` |
| `terminalStop` | `sessionId` |

IDs match existing project syntax, `/^[a-z0-9][a-z0-9_-]{0,127}$/`. This is shape only: a syntactically valid ID is not proof it was issued, belongs to a project, or has an active lease. Epoch, generation, input/ack sequences are safe nonnegative integers; policy owns current epoch/generation and sequence ordering. Columns are 2–500 and rows 1–200, both inclusive. Every specified field is mandatory; renderer payloads do not receive implicit dimensions, paths, profiles, argv, environment, commands, or execution defaults.

Payloads accept ordinary object literals and null-prototype data objects. Arrays, functions, class instances, dates, changed/custom prototypes, inherited data, symbol keys, unknown keys, hidden/nonenumerable fields and accessors are refused. Validation reads own property descriptors instead of invoking getters. It copies only the validated primitive fields into a frozen null-prototype object. It does not echo or retain the refused payload or coerce types.

Input preserves exact valid strings, including Unicode, CR/LF and control characters, with a maximum of **32,768 UTF-8 bytes**. Empty input is shape-valid; session policy decides whether it is useful. Counting scans bounded UTF-16 without allocating a second encoded full string. Unpaired high/low surrogates are refused rather than replacement-encoded. A 32,768-character ASCII string and 8,192 emoji are accepted; either plus one ASCII byte is refused as a whole.

## Exact native defaults

The exported immutable budgets are: `sessions=8`, `ringBytes=4194304`, `totalRingBytes=33554432`, `inputBytes=32768`, `outputBytes=32768`, `attachmentOutputBytes=262144`, `hostOutputBytes=2097152`, `inputQueueBytes=262144`, `scrollbackLines=10000`, `minCols=2`, `maxCols=500`, `minRows=1`, `maxRows=200`, `vtSequenceBytes=4096`, `inputReceipts=256`, `stopDeadlineMs=10000`. Exporting them does not implement rings, credit accounting, cleanup deadlines, input fences, or receipt deduplication.

Ruling: all listed request fields remain required, including dimensions, because the design specifies exact payloads. The defaults here are native budgets; no undocumented renderer fallback or display/path byte cap was invented. Cost if integration wants optional dimensions later: an explicit contract/design change and tests.

## Actual test evidence

Node `v24.16.0`, Windows. Command: `node --test desktop/tests/terminal-contracts.test.mjs` from the portable repository.

- **RED:** 6 suite cases, 0 passes, 6 assertion failures, exit 1, 64.8519 ms. The contract module did not yet exist; each test's loader converted only `ERR_MODULE_NOT_FOUND` into the explicit assertion `Terminal contract implementation is missing`. No runtime implementation was written before this run.
- **GREEN:** the same command after implementation: **6 suite cases, 6 passes, 0 failures**, exit 0, 64.4496 ms. These six cases contain tables of multiple payloads; this is not a claim of six native scenarios or an inflated per-payload test count.

| Suite case | Exercised behavior |
| --- | --- |
| Exact ten methods | Every complete method payload accepted; separate immutable normalized copy; unknown `command` and omitted operation ID refused |
| IDs/numbers/dimensions | ID length/case/path/Unicode/type refusal; numeric coercion, negative/fractional/unsafe/nonfinite values refused; dimension endpoints accepted and overflow refused; required dimensions/input sequence; unknown/prototype-named methods refused |
| Object data boundary | Custom/class/array/date/function/accessor/hidden/symbol/prototype-pollution inputs refused; getter read count remains zero; null-prototype data accepted |
| UTF-8 input | ASCII/emoji/two-byte boundary accepts, overflow refuses, malformed UTF-16 refuses without partial normalization |
| Before-dispatch guard | Invalid create payload causes zero calls; valid stop invokes callback with a distinct frozen normalized object |
| Budgets | Exact approved finite exported caps and immutable budget object |

`node --check desktop/src/terminal/contracts.mjs` exited 0. `git diff --check` reported no whitespace error. The parent owns combined output/contracts and later full regression verification; no full suite was started by this task.

## Boundaries left to the owner

Request validity is not execution authorization. Registry caller identity, exact live frame/URL/role, native project binding, local PIN, mode, epoch revalidation after awaits, current attachment lease, input sequence deduplication, native cwd/profile grants and every actual shell/input side effect remain required integration work. The helper callback must not be exposed as renderer-supplied authority.

Event validators for `terminalData`, `terminalGap`, `terminalState` and their exact scoped delivery are deferred to the output/preload owner as directed by the parent. Session/profile/path display limits were not invented for this request-only module. No PTY import/spawn, shell/Job owner, output handling, or terminal UI is added; the shell/Job ownership candidate remains **NOT admitted** by this work.

## Delivered identity

SHA256 of the finalized pure module and its test is recorded below; it does not bind any native terminal artifact:

| File | SHA256 |
| --- | --- |
| `src/terminal/contracts.mjs` | `1637bc7b9b7687b988ea45b7bee5418727e0c4e00a284e966953d0a56efae79e` |
| `tests/terminal-contracts.test.mjs` | `0b3e95567aebbf4abc31472d064951c8915887b366e30f5887fb3130101fb247` |
