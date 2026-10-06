# Same-main PIN acceptance probe — incomplete diagnostic

Status: **ADVERSE / diagnostic stopped before its discriminating observation.** No crash/restart or successful pre-crash decrypt proof is claimed from this attempt.

Author/executor: `/root/disk_inventory`, delegated owner-side diagnostic, 2026-10-07 local date. The coordinator authorized one fresh actual SIREN profile and one restart after a same-main initialize-only check. Exactly one SIREN process was launched. The check failed before the intended abrupt termination; the process was instead closed gracefully. No retry or second launch was performed.

Evidence: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-first-launch-accepted-before-crash/2026-10-06T21-32-31.045Z/result.json`, SHA-256 `f441d520629f3b32d6f5ecaf66db16df912b407bd749568a2944a509a88106eb`.

Controller: `desktop/evidence/pin-first-launch-accepted-before-crash-controller-2026-10-07.mjs`, SHA-256 `ae1b3cf4e103cc2f27bb47c43fa522529b0b978f5d5b686d2ae295aeaf515036`.

The actual SIREN setup acknowledged. Public product state was configured=true, pinLength=4, unlocked=true, available=true, blocked=false, retryAfterMs=0. Main inspector PID matched the owned child; native executable/creation identity was captured and checked before cleanup. Both userData and sessionData matched the intended owned Data root. Runtime was Electron 44.5.1 with the same captured source/build identities as the six-case matrix.

Before the attempted diagnostic, Access/local-pin.bin existed at 222 B with SHA-256 `983786d0af27f359360d21106fbc2411b542fa884e179e19f19ba0c0a9e4ca87`; Local State and Preferences were absent. The next inspector expression used dynamic import to obtain the actual LocalPinAccess class and initialize a new instance against the fixed owned root with real safeStorage. That expression did not return a public state. The controller retained only the fixed failure category `OWNED_INSTRUMENTED_CASE_FAILED`, stage `same-main-initialize-only`, and did not log its raw inspector exception.

Consequently this attempt cannot distinguish an inspector/module-loading failure from another diagnostic execution error. It does **not** show that native decrypt failed, and it does **not** establish that the ciphertext was decryptable before crash. There was no after-diagnostic hash capture, abrupt kill or restart. The setup acknowledgement alone remains insufficient for that stronger claim.

Cleanup was graceful. All nine captured product/helper/build/runtime input hashes were unchanged; no source, test, generated file, PIN record or Local State was manually edited, and no protected value was logged. Original adverse and six-case baseline evidence remain preserved.

If another separately authorized diagnostic is pursued, first resolve the inspector module-loading mechanism. A fixed createRequire path for a require-compatible ESM module may be an option, but it has not been tested here. The original six-case failure and copied-profile native-decrypt result remain valid independent observations; no root cause or correction is inferred from this incomplete attempt.
