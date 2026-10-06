# Bounded DPAPI per-record prototype: runtime blocked by Code Integrity

Author/prototype implementer: `/root/native_menu_trace_review`, 2026-10-07. **Compile completed; native execution blocked before any of four intended cases. No crash-survival, PIN-restart or production-fix claim is supported.** This is research only. No product/test/build/workflow/generated inputs or qualified process-reader bytes were changed, no dependencies installed and no GUI was used.

The actual safeStorage first-session crash matrix and copied-profile decrypt diagnostic belong to root. This prototype does not identify their cause. It specifically explores a separate OS per-record protection boundary without introducing an application-profile key file. Microsoft's documentation describes `ProtectedData` as a Windows DPAPI wrapper and `CurrentUser` protection as decryptable under that user; it also documents dependence on the Windows user profile. That does not promise survival of arbitrary OS/power/storage failures or access after Windows-profile loss. [ProtectedData](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=netframework-4.8.1), [DataProtectionScope](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope?view=netframework-4.8.1).

## Prototype and actual result

All prototype source is under ignored `evidence/dpapi-record-prototype-2026-10-07/`. The C# helper admits only one fixed `protect` or `unprotect` argument and uses `ProtectedData.{Protect,Unprotect}(...,null,CurrentUser)`. It accepts no path, command, process identity, environment setting or network target, and calls no file/process/network APIs. It is not an OS-sandboxed process: its Windows token would still have normal user rights; the restriction described here is the fixed reviewed API surface.

Binary input/output frames have a four-byte length prefix. Protection plaintext is capped at16KiB, ciphertext input/output at32KiB, decrypted output at16KiB. Empty and declared oversized input refuse before payload allocation. Stdout carries only the framed operation result, never diagnostic text; stderr remains empty and caught failures return2. Input/result arrays are cleared in `finally` on normal/caught completion, not on forced termination. Parent subprocesses use fixed paths, no shell, hidden windows, bounded outputs and10s/15s deadlines. Plaintext and raw ciphertext are never logged. Synthetic ciphertext would be retained only in its explicitly owned evidence file.

After flushing its result, the helper waits for one zero acknowledgement byte and EOF. This diagnostic framing permits the parent to receive and durably store the entire protected record, withhold acknowledgement, then terminate the **actual C# protection process** while it is still alive. It avoids confusing an already-exited protector with a separately killed wrapper. A normal caller supplies ACK and closes stdin. A production protocol could simplify the acknowledgement after its crash proof is qualified, but must preserve bounded framing/deadlines and fail-closed semantics.

I compiled once using the same fixed-OS-compiler approach as the existing process reader, to a distinct owned evidence binary:

```text
C:\WINDOWS\Microsoft.NET\Framework64\v4.0.30319\csc.exe
/nologo /optimize+ /target:winexe /reference:System.Security.dll /out:<owned evidence>/dpapi-record.exe <owned evidence>/dpapi-record.cs
```

The4608-byte PE was produced successfully. The first child spawn failed `UNKNOWN` before a test completed. A narrow actual Windows `Microsoft-Windows-CodeIntegrity/Operational` query records matching events3077 and3033 for that exact new binary path: the process did not meet Enterprise signing requirements / violated the configured Code Integrity policy. This is an observed Windows policy block, not a DPAPI decrypt failure, synthetic-fixture failure or Codex automatic approval rejection. I did not rename it, rebuild variants, change policy or use another host to bypass the block. A trusted signing/admission route would be required before this exact native-helper experiment could continue.

Retained run: `evidence/dpapi-record-prototype-2026-10-07/2026-10-06T21-32-40.476Z/`, **ADVERSE, zero completed cases, no owned children remaining**. The qualified process reader and inspected LocalPinAccess/atomic writer input hashes agree before/after. No synthetic PIN file was created because execution stopped in the first case.

## Four intended cases, unexecuted

1. Synthetic payload: actual helper Protect → full parent receipt → existing actual `atomicWrite` flush/rename/readback → abrupt termination of the still-waiting owned protector → fresh helper Unprotect and exact equality. Only lengths, hashes, PID/exit metadata and equality booleans would be retained.
2. Corrupted synthetic ciphertext must return a fixed refusal without plaintext output.
3. Empty protect/unprotect frames and over-cap declarations must refuse without output; all controls remain in this single bounded-input case.
4. Actual unmodified `LocalPinAccess` with a diagnostic **synchronous** bounded helper adapter: setup a known synthetic fixture PIN in an owned root, acknowledge its durable protected record, abruptly terminate the owning Node child, start a fresh child locked and unlock using the known fixture PIN. This would exercise actual scrypt, schema/record validation and atomic writes; it would not integrate the application or prove Electron key-state behavior. The adapter's fixed availability=true is diagnostic only, not a production availability implementation.

The source/harness is prepared for these cases but has no runtime qualification from this blocked execution.

## Feasible production boundary and migration requirements

If an admitted native helper is selected, compile only during the controlled build; ship independently reviewed and signed bytes with exact source/compiler/binary receipt checks and fixed resource paths. Do not compile during application startup, invoke through PATH or accept executable/argument paths from a renderer. Keep the existing qualified process reader separate. Windows policy admission, supported OS/.NET coverage, package/copied-package paths and actual crash matrix must be qualified before adoption.

The application-facing adapter should be asynchronous: bounded `execFile`/spawn on the fixed admitted helper, deadlines, input/output frame/schema validation and tracked cancellation/Lock/close drains. `LocalPinAccess` currently calls storage encryption/decryption synchronously even inside asynchronous methods. A real integration must explicitly await both in `#load` and `#persist`, retain per-root serialization/epochs, prevent post-Lock authority publication and retain atomic ciphertext durability before activation. Synchronous subprocess calls in this research adapter must not be copied into the Electron main thread. Availability needs an admitted, bounded startup capability check; native failure stays unavailable/locked rather than memory/plaintext fallback.

Use a strictly versioned, bounded new record envelope that explicitly identifies the backend/purpose and cannot confuse new data with legacy ciphertext. Bind the record's intended purpose as appropriate in the reviewed protocol. New writes must use the new backend only after its durable-write/readback and fresh-process recovery contract is qualified. Legacy Electron safeStorage should remain a **decrypt-only migration reader** for explicitly recognized legacy records. A successful legacy decrypt is still subject to existing strict payload/schema/KDF validation and legitimate PIN authentication before replacement; retain original bytes until the new candidate is durably verified. Already-unreadable legacy data must remain fail-closed and unchanged. A failed new-envelope decrypt must not be reinterpreted as legacy, reset to setup or silently overwritten. Credentials, PIN, cooldown/change writes and rollback/readback uncertainty need separately explicit migration tests; this small PIN-sized prototype does not cover the existing larger credential cap.

This architecture is a candidate, not an approved fix. CurrentUser DPAPI does not establish portability to other Windows users/computers, does not remove dependence on OS key material/profile health, and does not protect against a process already running with the same user's decryption authority. A helper crash test alone would not prove OS-crash durability. Preserve the original adverse safeStorage data throughout any future investigation.

## Exact identities

```text
dpapi-record.cs ed0c7828b4b92541d0c8416ed34fe765fd75a991e44c32070361ba7d2fd74789
probe.mjs 706e11bc3bdc84b7f5a70db0387e1e603addf496dc950fbd666e8cd4d63a47f2
pin-child.mjs f6f7e76df5c949cc1f4466efdb1a0187e1ce2445b7572ec108097e5edc0604ff
fixed OS compiler 46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00
new prototype binary c72fa964077f08acf34355ad50230f5922fa4353253e66cd1775bef61d95543a (4608 bytes)
planned/attempted first synthetic input 1f85c959f045dd2fc74ae6593f6935fdac3de09c6faeebdd7a2bbc67570d921d (protector did not start)
result.json 437968e2c0a9fad645808bcc1018f9736aa6638866f7e7eda7df79f1fd37e3d5
code-integrity-events.json 1a618afee302dedbfd353727f143d0224c8f0e24e5b363f32565fbd46e035417
unchanged qualified process-identity.exe 485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3
unchanged qualified process-identity.json 01df97b167ee1ad57cd3cdceb87ec36725dcfa696223d3b4c14adda3e492b7f2
unchanged src/account/local-pin.mjs 61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7
unchanged src/projects/atomic.mjs 803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4
```

The intended input hash was independently computed without displaying its bytes. It identifies only the prepared synthetic payload; the first protector never started, so it cannot turn the blocked run into protection evidence.
