# Supplied Terminal business/report integration

The invoker launches one Python runner process for eleven supplied Windows
controls. The tested Terminal actor, UI and OS boundaries are supplied. The
RESULT childProcesses counter covers those cohort actors and excludes the outer
Python runner invocation. Installed Terminal qualification remains separate.
The production source labels beginning `C:\Claude\SIREN_WORK` are virtual checked-contract labels;
all shipped source/data bytes are loaded from the closed relative host map.

Use external Windows CPython 3.12.10 x64. The runner requires the previously
reviewed executable bytes (104952 bytes, SHA256
`4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a`).
The interpreter and its standard library are not bundled or automatically trusted.
A different interpreter is refused, even when its version label matches.

An independently delivered `peer-source-review.json` must accompany SOURCE.json
and name its exact canonical source/runner pins. This builder never creates that
review receipt. A supplied receipt establishes reviewed byte consistency, not
authenticated source custody. Canonical review identities remain separate from
actual checkout/output paths when the subtree is relocated.

From this directory in PowerShell, run this one guarded command:

```powershell
& (Get-Command python.exe -ErrorAction Stop | Select-Object -ExpandProperty Source) -B -I -S -X utf8 (Join-Path (Get-Location) 'invoke.py')
```

The root must be fresh: `INVOCATION-ATTEMPTED`, `CONSUMED` and `evidence/` are exclusive one-use outputs.
Preserve failed evidence. A second experiment uses a fresh checked copy, not a
deleted marker or overwritten result. The output records actual host input pins,
the external interpreter, observations, errors and teardown. A calibrated audit
refuses opens beneath the virtual legacy root outside this subtree and the
external Python runtime; exactly one deliberate refusal is required. This is a
bounded hidden-input check, not physical custody or a general IO guarantee.

The helper runs only the fixed runner command, retaining its exact stdout/stderr
bytes and exit status in `evidence/INVOCATION.json`, `runner-stdout.bin` and
`runner-stderr.bin`. It retains early source/argument/setup errors even when no
runner RESULT exists. Its180-second timeout or process-creation failure remains
explicitly adverse; the helper never manufactures a RESULT or reuses old evidence.

The fixed owner/outer lifecycle remains external-v1. Inner/Electron/UI business
production and the C0/report-reader/T0 successor profile remain explicitly
versioned. All original caps, clocks, body positions and adverse criteria remain.
GitHub CI, native operation and installation require their own completed evidence.
