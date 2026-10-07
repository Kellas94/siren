# Copied-profile PIN diagnostic — native decrypt boundary isolated

Status: **OBSERVATIONS COMPLETE; product crash defect remains OPEN.** This is not a fix, baseline rerun, or product approval.

Author/executor: `/root/disk_inventory`, delegated owner-side diagnostic, 2026-10-07 local date. Exactly two headless Electron processes were run, one per verified copied profile. Both exited normally with code 0. No original profile, PIN record, product source, test, build or renderer was edited; there was no unlock, PIN reset, canary, native-key manipulation, sandbox-disabling flag or additional crash.

## Evidence and provenance

Diagnostic evidence: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-first-launch-crash-diagnostic/2026-10-06T21-30-40.810Z/`.

- Original diagnostic aggregate `result.json`: SHA-256 `546cab06b6d098c4204e6bd25284d09c636bcabf040e281de77ada3bd6b1d033`.
- Controller: `desktop/evidence/pin-first-launch-crash-diagnostic-controller-2026-10-07.mjs`, SHA-256 `fd7a4910838f047993c5c63bf46004527983c35554f50c5f64c667dd47e7c2f7`.
- Diagnostic app `app/main.mjs`: SHA-256 `1eef0c06e3ab9efbbe968099b8e76a98f15b284acae21a6dc9e2865af21ba267`.
- Actual `src/account/local-pin.mjs`: SHA-256 `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7`.
- Exact Electron **44.5.1** executable: SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

The abrupt source was `evidence/source-bundle-import-native/2026-10-06T21-04-25.723Z/owned-data`, whose original adverse profile still lacked Local State. The graceful source was `evidence/pin-first-launch-crash-matrix/2026-10-06T21-28-34.766Z/setup-lock-graceful-1/owned-data`, after its acknowledged restart unlock and graceful cleanup. These are different provenance groups. The abrupt profiles from the new matrix were not used because their later graceful cleanup can create Local State, obscuring the originally observed missing-file boundary.

Every regular file in each selected profile was copied without overwriting. Reparse/symlink and resolved-path checks were applied. Complete relative-path/length/SHA-256 manifests were retained in each `copy-manifest.json` and the aggregate. The abrupt original had **81 files / 12,956,938 B**; the graceful original had **61 files / 7,174,994 B**. Both copies exactly matched their respective original file manifests before launch. Complete original manifests were rechecked after the diagnostics and remained identical (`originalUnchanged:true` for both). Five actual-class/helper/runtime input hashes were also unchanged.

## Diagnostic behavior

The separate app sets copied `userData` before ready and instantiates the actual `LocalPinAccess` class. Its injected storage object forwards to real `safeStorage`; decrypt input/output remain in memory. It records only fixed stage names and type/bound booleans. After successful decrypt, a diagnostic JSON parse records success/failure without retaining values; the original string is forwarded unchanged to the actual class, whose private record validator remains authoritative. No encryption was requested.

The class's original owned-file reader was not replaced. Reaching the injected `decryptString` therefore shows the actual owned path/read sequence reached the native decrypt call. Actual class state supplies the final accepted/refused outcome. Both processes reported their expected copied `userData` and `sessionData` roots as equal. Their native output streams were suppressed rather than copied into retained logs; no raw exception message, plaintext, ciphertext or protected key was recorded.

| Copy | Actual stages | Actual class state after initialize |
| --- | --- | --- |
| Abrupt original | `decrypt-started` → **`decrypt-failed`** | configured=true, pinLength=null, unlocked=false, available=true, blocked=true, retryAfterMs=0 |
| Graceful control | `decrypt-started` → **`decrypt-ok`** → `diagnostic-json-parse-ok`; string/type and 4096-byte payload bound accepted | configured=true, pinLength=4, unlocked=false, available=true, blocked=false, retryAfterMs=0; actual class accepted record |

Both ciphertext files were 222 B. Abrupt PIN SHA-256 was `8113eb7e5ad7a7fb28169aa6d151b2549ab90b6b82f3d4539172cbfc5cdcfb99`, matching the retained original observation. Graceful PIN SHA-256 was `1d73ef5400f653977e8082d9ff7c3e55ef579f20b2018c248048d7277744d7df`, its normal post-unlock rewrite from the matrix.

The copied abrupt profile had no Local State before launch. Graceful shutdown of the diagnostic subsequently created a 490 B Local State **in that copy only**, SHA-256 `0838dd90d0427a0483ba4135ad3b4cc798dc4ddbe989cce2cdaa77c7161da49e`. The copied graceful Local State remained 490 B with its original SHA-256 `3da3c834c29548fa2d5b86877fee1f56b65eea6b9f65cbb3f25071cae353d0d5`. This is profile-file behavior, not inspection or identification of an encryption key.

## What is established, and what remains open

For the copied original adverse profile, failure occurs **inside real native `safeStorage.decryptString`**, before payload JSON parsing and actual record-schema validation. The actual reader reached that call; a valid alternate copied control decrypts and is accepted using the same runtime/class and Windows account. JSON/schema corruption is not the failing stage in this diagnostic attempt.

The result does not prove why native decrypt failed. A missing, different or otherwise unusable key source remains consistent with absent durable profile state, but was not directly inspected. The existing encrypted record could also be cryptographically invalid; without a same-profile previously captured key identity or stronger controlled native evidence, this diagnostic does not establish its earlier decryptability. No raw native error was retained, and Electron/Chromium key implementation was not inspected.

These copied-profile observations strengthen and narrow the separate six-case SIREN baseline in `reviews/2026-10-07-pin-first-launch-crash-matrix.md`; they do not replace it or claim baseline equivalence. Next work must establish the exact native key-persistence contract before selecting a correction. Preserve original files and the approved fail-closed/no-reset policy.
