# PIN first-launch crash: source trace and proposed discriminating evidence

Status: **OPEN — static follow-up; no crash reproduction or product correction performed.**

Author: `/root/disk_inventory`, owner-side delegated investigation, 2026-10-07. Scope: bounded existing source/API declarations and test source reads. No SIREN/native process was started, no runtime experiment was performed, and no source, test, protected profile, original adverse evidence, or PIN record was changed. This report supplements `reviews/2026-10-07-pin-first-launch-crash-observation.md`; it does not replace its retained observations or earlier successful qualifications.

## What the trace establishes

1. **Availability is not a successful decrypt.** Installed Electron 44.5.1 declarations (`node_modules/electron/electron.d.ts:12135-12143`) state that Windows `safeStorage.isEncryptionAvailable()` returns true once Electron is ready. The original failed restart's `available:true` therefore does not demonstrate recoverability of its existing ciphertext.
2. **Several failures collapse to one state.** `src/account/local-pin.mjs:56-79` validates the owned root/path, reads up to 16 KiB, decrypts, bounds the plaintext, parses JSON and validates exact record fields. Path/read/decrypt/parse/validation exceptions all become `#broken=true`; they retain the original file. The reported state cannot isolate these stages. `configured:true` is also set on non-ENOENT read failures, so it does not itself prove successful file read. A clock failure can also set broken state; with no loaded record it does not by itself explain the configured flag.
3. **PIN acknowledgement flushes ciphertext, not an explicitly coordinated profile key.** `#persist` encrypts then calls the application's atomic writer. `src/projects/atomic.mjs:8-28` syncs and closes the temporary file, renames it and verifies exact ciphertext readback. It does not decrypt that readback or establish a cross-process key-persistence barrier. No safeStorage/profile-key flush call is present in the inspected application source.
4. **Profile selection normally precedes ready.** `src/main.mjs:90-101` sets `userData` to the explicit owned Data path before ready when the preferred directory is writable; an explicit fallback choice is made after ready if that attempt fails. There is no silent alternate data-root fallback. The actual resolved profile paths at encryption and restart were not recorded in the adverse evidence, so path equality must still be measured, not presumed from source.
5. **The account service does not warm up protected storage in this configuration.** `src/publisher-config.mjs` has unconfigured account defaults. `AccountService.readAccess()` (`src/account/service.mjs:22`) returns before `credentials.read()` when unconfigured. Main calls `getAccess()` before PIN initialization, but that call is not proof that safeStorage encryption/decryption already occurred.
6. **Credentials share the dependency, with different refusal semantics.** `src/account/credentials.mjs:16-29` uses the same safeStorage plus atomic writer. A read/decrypt/parse failure returns null; unavailable encryption uses memory-only account storage. PIN deliberately refuses memory-only activation and refuses reset of existing unreadable data. Account behavior is not evidence that PIN data can be recovered after this crash.
7. **Graceful close is a different lifecycle.** Main close handling prepares views, joins application writes, flushes layout, records clean close and closes the window; `window-all-closed` requests `app.quit()`. The native driver's close routine instead kills an alive child. The observed graceful success cannot qualify abrupt termination.
8. **A DOMStorage flush is not a demonstrated remedy.** Installed `Session.flushStorageData()` declarations (`electron.d.ts:13274-13277`) promise unwritten DOMStorage data persistence. They do not promise persistence of safeStorage keys or Local State. Adding this call or a fixed sleep without a native implementation contract and fault proof would not establish a fix. The async safeStorage declarations likewise do not state a crash-durability guarantee.

The missing Local State in the failed fixture remains correlated with the failure. This investigation neither inspected that file's protected fields nor inspected Electron/Chromium native key-persistence implementation; it cannot identify key loss from the correlation alone.

## Evidence that would separate the boundaries

The following is a proposed experiment, **not an executed test or new telemetry**. Record only fixed stage enums, booleans, bounded lengths, timestamps, hashes, exact binary/build identity and owned-process identity. Never log the PIN, salt/verifier, plaintext, ciphertext, encrypted key, raw native exception message, or arbitrary user paths. Main should retain authority; no renderer method should accept arbitrary paths or expose storage secrets.

| Candidate failure | Discriminating evidence needed |
| --- | --- |
| Root/profile mismatch | Equality booleans for intended Data root, `app.getPath('userData')` and actual profile root at encrypt and restart, with their test-owned identities in an inert manifest. Report fallback timing explicitly. |
| Owned path/read failure | Stage outcome for root/path validation and bounded record read, including bytes/hash after successful read. An unchanged file on disk is insufficient if the process cannot open it. |
| Ciphertext damage | Same-profile record length/hash before termination and before restart writes. A changed hash requires inspection of the actual intervening operation; normal successful unlock rewrites the encrypted record. |
| Native decryption failure | Distinct `decrypt-started`, `decrypt-ok` or `decrypt-failed` markers, with no return value or exception text. A failure here excludes JSON/schema validation, but still does not by itself prove missing key material. |
| Payload/record failure | Distinct length/type, JSON-parse and record-schema stages. If decrypt succeeds and one of these fails, profile-key loss is not the explanation for that attempt. |
| Native profile-key persistence failure | Native upstream implementation contract for this exact runtime plus a controlled same-profile intervention or native diagnostic proving the key source selected/loaded. If a saved valid profile-state copy allows identical PIN ciphertext to decrypt in a separate owned diagnostic copy, that is stronger causal evidence than file absence; restoration must not touch original evidence or live Data. File presence/hash alone cannot identify the key or prove its correctness. |

A secondary synthetic canary can test cross-process safeStorage recovery, reporting equality only. Creating a canary invokes encryption and may change first-use timing, so it must be a separate diagnostic variant rather than silently modifying the baseline PIN experiment. A same-process canary or decrypt round trip cannot establish survival of process termination.

## Bounded real-crash proposal

After the coordinator's current native qualification is finished, use one captured SIREN/Electron build on the same Windows account. Six new, disjoint owned profiles suffice for an initial matrix: two each for (A) first PIN acknowledgement then abrupt termination, (B) first PIN acknowledgement, normal Lock acknowledgement then abrupt termination, and (C) first PIN acknowledgement, normal Lock and graceful application close. Capture profile-file metadata immediately before termination and on restart before unlock can rewrite the record. Retain the existing adverse profile untouched.

The controller must own and validate each child PID/creation identity and exact test profile. Force termination only of that owned child/process family; never use broad process-name termination. Give each run bounded waits and one restart, save the original result/logs, and stop after this matrix to inspect differences. Keep instrumented diagnostic runs separate from untouched product runs. This is process-crash coverage, not a power-loss or other-Windows-user qualification.

Oracles must check acknowledgement of setup, Lock and restart unlock separately from Home rendering. Failed decrypt must preserve the exact existing record and refuse setup/reset. Later import/UI assertions must not overwrite the storage result. Only successful post-crash decryption and known-PIN acknowledgement in a new process establishes recovery for that case.

## Conditional correction direction

No correction is justified by this static trace alone. First add or obtain sanitized failure-stage evidence in a scoped diagnostic harness. If profile-path selection is proven wrong, correct its lifecycle before first cryptographic use. If ciphertext damage is proven, correct the actual write/replace path. If native profile-key durability is proven, use a documented and fault-tested native persistence mechanism; do not substitute DOMStorage flushing, sleeping, or same-process decrypt readback for a cross-process durability proof.

If the installed runtime offers no reliable supported barrier, evaluate an explicitly designed OS-protected per-record storage backend rather than hand-editing Chromium Local State. That would require a separate narrow native API, versioned envelope, migration only while the existing record is successfully decrypted/authenticated, exact retained originals and abrupt-termination qualification. It is an option for a later design decision, not a recommendation to change encryption now.

All branches must retain the approved local-PIN threat model: OS-protected salted scrypt verifier and bounded attempts, no plaintext/memory-only PIN activation, no implicit reset, and no promise of protection against the same Windows user or portability of credentials to another account. The approved plan explicitly requires corruption/protection failures to retain files and refuse reset (`docs/superpowers/plans/2026-10-02-siren-portable-foundation-v2.md:240-270`).

## Limits of existing checks

Read-only inspection of `tests/local-pin.test.mjs` shows corrupt/empty/oversized, wrong encryption key, encryption failure, malformed authenticated records, cooldown and owned-path refusal cases. Its storage adapter is synthetic; these checks do not qualify first-use Electron profile-key durability. `tests/native/protected-storage-main.mjs` writes credentials and decrypts through a fresh store instance within the same Electron process, then clears them. That is useful native crypto/IO evidence but is not an abrupt process-restart proof. No existing test was rerun for this report.

Inspected source SHA-256 identities:

| File under desktop | SHA-256 |
| --- | --- |
| `src/account/local-pin.mjs` | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| `src/account/credentials.mjs` | `0ff92fb4c5530fd958d5a2d59161366342869a5a5ec5ee3204e8e35bd88d6d73` |
| `src/account/service.mjs` | `e43ebc22d1cbbd23f8147ec25c9033436bc3dded80d462808ed31bebaba9f63f` |
| `src/main.mjs` | `ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1` |
| `src/projects/io.mjs` | `a87fc4a0243eef18e3a14fb651b55cc8c1cfa49a137b21eb7239a262ce858687` |
| `src/projects/atomic.mjs` | `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4` |
| `src/publisher-config.mjs` | `f304d63398f9bdf58ac14daec0d1948a89855039f6908c601987abc4d478656b` |
| `node_modules/electron/electron.d.ts` | `6bfa87243d506741fdf4195f87538306c45496c6af07fa4552e8e8ffff54c820` |
| `tests/native/protected-storage-main.mjs` | `2da481944e9ee887c45ac91f02fdbdf2b23ee8df1b4d9c41c217bfc235a3d895` |
| `tests/local-pin.test.mjs` | `991af3ccdf0e71e8dd5cafd5b3b7e91308e17528b395dd31a1070c9dc46d90c9` |
