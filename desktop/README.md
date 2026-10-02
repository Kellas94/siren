# SIREN Desktop foundation prototype

Private implementation of the approved 2 October 2026 portable foundation plan.
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

Development data is isolated in `.dev-data/`. Import a complete `.siren` project
explicitly; no installed/browser profile is imported automatically. The unchanged
baseline is build input only and is SHA-256 checked before generation.

The development packager is `scripts/package.mjs <source-commit>`. Its output is
not a production portable release. The executable is under `App/versions/0.1.0/`;
its own local `Data/` stays outside that app version. Without a configured account
service, packaged projects are read-only, with recovery and export available.
No publisher private keys, credentials or source-access tokens are included.
An ASAR is a runtime container, not encryption or protection from reverse engineering.

There is no admitted update installer or public feed yet. Existing Code size
limits remain unchanged; large-source scalability is a separate planned phase.
