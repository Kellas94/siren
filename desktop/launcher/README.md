# SIREN native launcher development

This is Task 6's first development delivery. It supplies a Windows root launcher,
typed `App/current.json` selection and complete preview payload hash checks.
Production builds have no configured publisher trust and refuse to launch.
Only an explicitly compiled `development-preview` feature accepts an unsigned
development selector. Such a build is not a release or a publisher approval.

The launcher belongs at the portable folder root as `SIREN.exe`. It determines
that root from its own executable, reads the fixed `App/current.json`, and
launches only `App/versions/<stable-version>/SIREN.exe`. It accepts no arbitrary
executable, root path, command text or forwarded application flags. `--verify`
checks the selection without starting the application. Keep the whole portable
folder together; `Data/` is outside the application version and is never read,
rewritten or moved by this launcher.

Selection refuses unknown or duplicate JSON fields, invalid UTF-8, excessive
metadata or extracted bytes, escaping paths, Windows reserved names, streams,
case collisions, junctions, reparse points and hard-linked files. Windows handles
hold existing files against writes/deletion and directory paths against rename
or reparse replacement until the child exits. They do not prevent adding a new
directory member. Every listed asset is hashed through its held file handle;
extra or missing files at verification prevent startup. A final membership
recheck is being added for ordinary late changes. It cannot close the hostile
insertion race between a census and Windows image/DLL loading. These preview
checks detect accidental damage; they do not establish a trusted publisher's
identity or qualify hostile concurrent modification for a production release.

## Build and attach

Rust 1.99.0 and dependencies are exact pins. A generated `Cargo.lock` is retained
and all final builds/tests use `--locked`. The installed local Rust installer was
blocked by Windows Application Control. Do not disable that policy or attempt an
alternate local installer to evade it. The private GitHub Windows runner is the
approved compilation path for this development delivery.

```powershell
cargo +1.99.0 test --locked --manifest-path desktop/launcher/Cargo.toml
cargo +1.99.0 test --locked --manifest-path desktop/launcher/Cargo.toml --features development-preview
cargo +1.99.0 build --locked --release --manifest-path desktop/launcher/Cargo.toml --features development-preview --target x86_64-pc-windows-msvc
node --test desktop/launcher/attach-development.test.mjs
node desktop/launcher/attach-development.mjs <new-preview-root> <native-launcher.exe> <artifact-receipt.json> <exact-launcher-source-commit>
```

The attachment validates exact binary/source identity and the original preview
runtime/ASAR hashes, checks the serialized selection against the launcher's 1 MiB
limit, and writes a fresh writable staged binary. It publishes the root launcher
only after selection and receipt readback, without replacing a prior launcher.
Ordinary failures clean up owned partial selection and restore the original
identity so a retry can proceed; failed cleanup is reported for inspection.
This does not qualify power-loss atomicity. It keeps both
`releaseAdmitted` and `launcherQualified` false. The CI artifact receipt identifies
the tested source, target, Rust version, feature and binary hash/size. It is a
development build receipt, not an independent review or production signature.

## Remaining Task 6 contracts

Signed ZIP extraction, shared Node/Rust signature corpus, publisher key rotation,
atomic durable apply/rollback journals, minimum allowed version, exact owned
process identity, helper replacement and boot confirmation remain unimplemented
and unqualified. A 30-second readiness timeout must never silently delete data or
trigger a rollback. No production updater integration or release admission is
implied by a usable development launcher.

Local execution of the CI-produced launcher may also be blocked by the machine's
application policy. Report that refusal explicitly; do not mark it as a passing
native launch or modify the policy.
