# Local PIN module implementation evidence

Author: launcher implementation subagent. This is my implementation receipt, not an independent evaluator's approval. Scope is only `desktop/src/account/local-pin.mjs` and `desktop/tests/local-pin.test.mjs`; the coordinator owns main, IPC, interface, renderer and actual Electron verification.

## Implemented contract

`LocalPinAccess(root, safeStorage, { now = Date.now })` exposes `initialize()`, synchronous `state()` and `lock()`, and asynchronous `setup`, `unlock`, and `change` returning structured results. Only four or six ASCII digits are accepted. Setup requires matching confirmation. Change requires an unlocked session and proof of the actual current PIN; successful setup or change activates the session only after durable readback. Restart always starts locked.

The encrypted record lives only at the owned `Access/local-pin.bin`. It contains schema, a fixed scrypt KDF marker, a random 16-byte salt, a 32-byte verifier, PIN length and retry metadata. It contains no plaintext PIN, confirmation, current PIN or new PIN. The product uses Node's actual asynchronous scrypt with N32768/r8/p1 and 64MiB maxmem, compares equal-sized verifiers with `timingSafeEqual`, and passes the JSON record to Electron's supplied `safeStorage.encryptString`. Standard owned-path checks, `atomicWrite` flush/readback and bounded `readOwnedBytes` are reused; there is no fallback memory-only activation or plaintext storage.

Five wrong unlock/current-PIN attempts persist a 30-second cooldown. Wrong or syntactically invalid unlock values produce the same generic incorrect-PIN response; oversized values are rejected before KDF input. A successful acknowledged unlock resets the attempt counter. Calls to one Data root are serialized across instances in the same process and reload the protected record before mutation. The main process must retain its Data-root single-instance ownership; cross-process hostile concurrent file modification is not claimed as solved by this module.

Unavailable encryption, malformed/empty/oversized/undecryptable records and hostile owned targets fail closed. Existing record bytes are preserved and setup cannot silently reset an existing record. A synchronous explicit lock cancels a queued setup/unlock before a new record rewrite or access grant. No recovery/delete/reset command was added. A failure after an atomic publication but before confirmed readback must still return failure; no power-loss qualification is claimed.

## RED and GREEN evidence

`desktop/evidence/local-pin-red.log` records the initial failclosed scaffold: 12 actual behavioral tests, 11 assertion failures and one negative unavailable-storage pass. These were expected missing-feature assertions, not missing imports or compile errors.

`desktop/evidence/local-pin-green-1.log` retains an implementation failure: the project-ID helper rejects the required capitalized literal `Access` directory. The implementation was corrected to create that fixed directory and verify it with `ownedDirectory`, without relaxing project-ID checks. `local-pin-green-2.log` records all initial 12 tests passing.

`desktop/evidence/local-pin-lock-root-red.log` records two additional real assertion failures: a queued setup could still publish after explicit lock, and an absent owned root was mistaken for fresh access storage. Those were repaired with epoch cancellation checks before persistence and an independent root ownership check.

`desktop/evidence/local-pin-green-final.log` records **14/14 passing** on real Windows filesystem IO (about 2.4 seconds). The tests use an explicitly labeled external safeStorage double with real authenticated AES-GCM encryption; they do not mock product scrypt, hashing, filesystem validation, atomic writes or readback. One assertion independently recomputes the persisted scrypt verifier. Other tests cover 4/6-digit validation, distinct salts, old/new PIN succession, session proof, generic malformed input, cooldown boundary/restart, encryption failure, malformed authenticated payloads, hostile target preservation and concurrent retry serialization.

The tests use only synthetic fixture PINs and generated temporary owned roots. The user's real PIN is not in source, test data or reports. These tests do **not** establish actual Electron OS-protected-storage operation; the coordinator runs that separately. No source publication, commit, launcher qualification or production account activation is claimed.

## Frozen source identities

- Product module SHA256: `de283659a908526a3a0e5d78281c9a1c1f759cec47a3648f7b382b7cee4ff9b9`.
- Test suite SHA256: `482e1020a75ce755acb10960efcac8e10def23b92b6d5d2c1b335e258f48437b`.

Primary API reference for the KDF and comparison: https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback . This module adds no package dependency.

## Addendum: existing-session current PIN verification

Coordinator's integration review identified that reusing `unlock()` for the current-PIN stage revoked the existing editing session after one ordinary wrong PIN. Added `verifyCurrent({pin})`, which requires an existing unlocked session and never grants or restores access. Wrong attempts persist through the same counter; the fifth locks the session. Correct verification preserves the salt/verifier and resets attempts only after durable persistence. An explicit queued lock or failed encryption acknowledgement refuses success.

The original 14-test delivery remains an historical record. `local-pin-verify-current-red.log` preserves the missing-method test failure; `local-pin-verify-current-assert-red.log` records a failclosed method scaffold yielding **14 PASS / 2 behavioral assertion FAIL**. `local-pin-verify-current-green.log` records **16/16 passing**. The added tests use actual IO/scrypt and the same explicitly labeled external OS-storage double. This implementation addendum is authored by the implementer, not an independent service review or actual OS encryption qualification.

Frozen product SHA256: `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7`.
Frozen tests SHA256: `991af3ccdf0e71e8dd5cafd5b3b7e91308e17528b395dd31a1070c9dc46d90c9`.
