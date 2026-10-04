# SIREN Desktop foundation prototype

Development implementation of the approved 2 October 2026 portable foundation plan.
Read [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for implemented behavior,
remaining qualifications and the original independent review findings.

From this directory with Node 24.16.0:

```powershell
npm ci
npm run runtime:install
npm run verify
node build/renderer.mjs baseline/R78.html generated
npm start
```

After this setup, double-click `../SIREN-Development.cmd` to open the editable
local development build. It uses the installed runtime and the generated renderer
in this checkout; it is not the portable distribution or production activation.
Startup runs **intro → local PIN → Home**. Home resumes verified work, selects
projects and opens Diagrams, Docs, Code and Present in separate native windows.
Its window shelf uses saved names and versions, including minimized windows.
First launch asks you to
create and confirm a 4- or 6-digit PIN. The iPhone-style dots/keypad also accept
keyboard input. **Desktop… → Settings… → Change PIN…** requires the current
PIN. **Lock SIREN** (Ctrl+Alt+L) confirms local saves before locking; Ctrl+,
opens Settings. Restart always locks again. No online account is required.

Development data is isolated in `.dev-data/`. Import a complete `.siren` project
explicitly; no installed/browser profile is imported automatically. The unchanged
baseline is build input only and is SHA-256 checked before generation.

The development packager is `scripts/package.mjs <source-commit>`. Its output is
not a production portable release. The executable is under `App/versions/0.1.0/`;
its own local `Data/` stays outside that app version. The local PIN permits
editing after unlock; startup/readiness safety can still require read-only mode.
PIN verification uses a random salted scrypt verifier in current-Windows-user
protected storage. It does not encrypt project contents or provide an online
license. Keep project backups: no implicit PIN reset is implemented, and moving
the folder to a different Windows account requires a separate recovery design.
No publisher private keys, credentials or source-access tokens are included.
An ASAR is a runtime container, not encryption or protection from reverse engineering.

There is no admitted update installer or public feed yet. Source-aware desktop
projects keep immutable code versions separate from documentation and use an
incremental Python editor. Current import budgets are 32 MiB per source and
256 MiB per project. Qualified fixtures include 100k and 300k lines; these are
tested cases, not a promise that every script size or analysis fits in memory.

The first native development launcher is documented in
[launcher/README.md](launcher/README.md). An attached preview starts through
`SIREN.exe` at the portable folder root; keep its whole folder together.
Windows CI verifies the typed selection, held-file checks, actual native fixture
launch and production publisher refusal. It does not admit signed updates.
Use `../SIREN-Development.cmd` to run the current editable checkout. Online
accounts, 30-day activation and their legal/data-handling review are deferred.
