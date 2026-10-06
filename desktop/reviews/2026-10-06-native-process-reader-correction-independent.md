# Native process reader correction — independent review

Author: Codex independent review agent `/root/shared_workspace_review`. Date: 2026-10-06. Reviewed source: `066c886db7da8d441d2aa1a369b07e2fcba48f27`.

This is a separately authored read-only correction review. No product, generated, workflow, test or prior report was changed. I did not compile the helper, launch Electron, operate the desktop, run the owner's qualification suite, or launch a packaged application. The production helper was already built and frozen by the owner. My executions used that existing helper and isolated files under `C:/Claude/SIREN_WORK/tmp-native-process-correction-review`.

## Findings

Critical: none established. Important: none established. Minor: none established in the reviewed correction and the limited execution scope below. This is not a release decision or a claim that the failed hosted run has been repaired.

The implementation removes the per-query PowerShell process-provider startup, keeps uncertainty fail-closed, and preserves the identity format consumed by recovery and writer exclusion. Its actual Windows execution worked in my independently authored fixture. The remaining hosted startup and package qualification are separate evidence obligations.

## Scope and exact identities

I inspected the native helper, build recipe, main-process provider and decoder, package inclusion and resource copies, copied-package verification, launcher inventory treatment, CI sequencing, shell failure diagnostics, and journal/writer consumers. The central files are `native/process-identity.cs`, `scripts/build-process-reader.mjs`, `src/recovery/native-process.mjs`, `src/recovery/processes.mjs`, `scripts/package.mjs`, `tests/native/package-context.mjs` and `tests/native/shell.mjs`.

The frozen helper is 6,144 bytes with SHA-256 `485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3`. Its metadata pins source recipe `4d751525c646cdc652d5f2e263697ec1b033568167b99cfcabc993c625b726a8` and compiler hash `46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00`. I confirmed the existing helper hash before and after my queries, unchanged. Current source bytes for `native/process-identity.cs` have the pinned source digest. The builder normalizes CRLF to LF before recipe hashing; it does not normalize compiled binary bytes.

## My executions

I ran the following targeted pure tests against the reviewed checkout:

```text
node --test tests/native-process-provider.test.mjs tests/process-identity-result.test.mjs tests/startup-identity-diagnostics.test.mjs tests/native-verification.test.mjs tests/package.test.mjs
23 tests; 23 passed; 0 failed; 0 skipped
```

These exercised fixed development/package paths, metadata and binary refusal, missing-provider refusal without executing a fallback, decoder unknown/malformed/stderr cases, bounded startup diagnostics, package main-module inclusion and workflow sequencing. They did not compile or launch a package.

My own `probe.mjs` imports the actual production inspector and consumers. Its retained `results.json` records:

| Independent case | Observed result |
| --- | --- |
| Three actual queries of my running Node process | Exact executable path and identical identity on each query; UTC timestamp has seven fractional digits; no failure diagnostic |
| Invalid helper CLI: absent argument, zero, leading zero, signed values, DWORD overflow, shell-looking text, embedded space, empty argument, extra argument, non-ASCII digit | All eleven returned exit 2 with empty stdout/stderr |
| Protected System PID 4 | `undefined`/unknown, not proof of absence |
| High absent PID 4294967295 | `null` |
| Production SessionJournal using actual helper identity and isolated files | Normal startup admission |
| Production exclusiveWriter against an isolated lock owned by my actual live process | `WRITER_BUSY`; body not executed; original lock identity retained |
| Helper bytes before and after | Same SHA-256 |

The three short live-query measurements were approximately 31.55, 26.19 and 25.02 ms. These are local observations, not a hosted cold-start bound or proof against scheduling contention. My process path was not a multilingual copied executable; I did not independently compare its creation timestamp against a second native provider. The seven-digit format, exact repeated value and actual journal/writer compatibility were independently checked; Unicode and cross-provider 100 ns equality below belong to the owner's different execution.

## Primitive and refusal review

`native/process-identity.cs:27` opens one non-inheritable `PROCESS_QUERY_LIMITED_INFORMATION` handle. Path and creation time come from that same handle; the `finally` closes it on every return after successful opening. Missing is reported only for OpenProcess error 87 or an observed non-STILL_ACTIVE exit status. Access refusal, query failure, invalid time conversion and other uncertainty remain unknown. Exit code 259 is conservatively ambiguous and does not permit reclaiming a potentially live writer.

CLI admission at `native/process-identity.cs:49` accepts one positive invariant decimal UInt32, with no leading zero and at most ten characters. It accepts no command, executable path or mutation instruction. FILETIME high/low words are joined without truncation, converted directly to UTC, and serialized with invariant round-trip precision. JSON escaping covers quotes, backslashes and control characters. UTF-8 is written directly to the redirected standard-output stream rather than changing a console code page.

The Node provider admits owned metadata and executable bytes before one fixed-path `execFile` invocation. The PID is revalidated, `shell:false` and `windowsHide:true` are forced, and there is no PowerShell/PATH fallback or query retry. The original 10-second child-query deadline, 16 KiB output cap, decoder and stderr refusal remain. That deadline applies to the child query, not all preceding filesystem admission or total application startup.

Metadata admission establishes consistency with the pinned recipe and the binary digest recorded in the trusted bundle. It is not an independent signature or proof that arbitrary executable bytes were compiled from that source. Build receipts, copied-resource equality and launcher bundle verification supply the surrounding provenance boundary; this report does not certify a signed release.

## Packaging and UI boundary review

The builder uses the fixed Windows Framework64 compiler and records its digest. It neither downloads a toolchain nor compiles during application startup. The added dependency is the OS-provided .NET Framework 4.x runtime; the package inventory identifies it explicitly.

The package places `siren-process-identity.exe` and its metadata beside `app.asar` under resources. `processReaderPaths` resolves those fixed names from the packaged main-process module location; development uses `native/generated`. The package verifies the copied executable hash and includes the receipt in BUILD-IDENTITY. The copied-package context requires both exact binary bytes/hash and metadata equality with that receipt. The existing development launcher inventory covers regular resource files and its verification/holding logic therefore includes the helper. I reviewed these checks statically and through pure fixtures; I did not independently open the copied package or rehash the owner's entire archive.

I found no renderer IPC capability exposing this query or arbitrary PID/executable inputs. The helper is not a renderer protocol asset. Its use remains inside the recovery/main-process identity provider. The shell test now records actual startup mode and requires normal, writable, unlocked admission before checking the existing version condition. Failure handling retains bounded startup state and closes resources. Its version, interaction and isolation oracles have not been relaxed by these diagnostics.

## Historical adverse evidence and attribution

Hosted CI37409331278 remains an actual failed run. Its original shell log recorded `SIREN_PROCESS_IDENTITY_FAILURE` at query phase with `killed:true`, `signal:SIGTERM`, `reason:QUERY_FAILED` and zero stdout/stderr bytes. The earlier independent startup report preserves the causal chain from unknown process identity to read-only Recovery, where normal renderer/version initialization is intentionally absent. Replacing the PowerShell provider addresses that observed query mechanism; current local results do not establish that the hosted failure is repaired.

I separately read the owner's retained `evidence/process-reader-native-2026-10-06T03-53-37.991Z/result.json`: it is ADVERSE, with actual `undefined` against the expected Unicode child identity. The owner attributed the initial three-test adverse execution to setting console output encoding in a hidden GUI-subsystem helper. The final source explicitly uses direct UTF-8 StreamWriter output, and my actual fixed-helper queries demonstrate usable output on this machine. I did not execute the pre-fix helper or independently reproduce its console exception.

The owner's subsequent `evidence/process-reader-native-2026-10-06T03-55-18.454Z/result.json` records COMPLETE with six exact observations matching the original independent Windows cmdlet, including the multilingual executable path and seven-digit timestamp. This is retained owner evidence, not my cross-oracle execution. The owner's later full-suite/package/native results are likewise not counted among my passes.

## Declined judgments and evidence limits

I did not judge hosted load behavior, future CI outcome, complete desktop startup, native UI behavior, copied launcher execution, clean-machine Framework availability, signed release trust or all package inventory obligations. No click oracle, deadline or retry count was changed for this review. The earlier failed CI and all prior reports remain unchanged. All processes launched by my fixture have exited, and no helper or source bytes were overwritten.
