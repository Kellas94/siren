# Independent review: UTF-8 Windows process identity

Scope: the uncommitted encoding repair in
`desktop/src/recovery/processes.mjs:9`–11 and its new real Windows regression
test. Local HEAD was `a92692f523e8664fab24e0862a1b7fcc5c7db006`.
This report is separate from the Code-window reviews.

## Result

No actionable defect found in this scoped repair. I independently reproduced
lossy Unicode process paths with the previous PowerShell script and verified
the repaired helper with an actual Windows Node process launched from a
Romanian/Japanese/Ukrainian/emoji directory. The exact path, PID and stable
creation time matched that process's own output. This is a process-identity
repair review, not complete packaged/release admission.

The sole product change sets the child PowerShell console output encoding to
UTF-8 without a BOM before `Get-Process` emits JSON. Node's existing UTF-8 stdout
decoding can then preserve the path. Avoiding a BOM also leaves the JSON parse
boundary intact. The encoding change applies only to the spawned PowerShell
process. The safe-integer PID guard, Windows-only boundary, read-only process
query, hidden child launch, five-second timeout, bounded output and fail-to-
`undefined` handling are unchanged. No path supplied by a project is composed
into the command; only an already validated numeric PID is interpolated.
Existing `null` for an absent process and `undefined` for unverifiable identity
retain their meaning.

I inspected the real consumers in `SessionJournal.inspectStartup` and
`exclusiveWriter`: they require both exact path and creation time to identify
a live owner. Correct encoding repairs that comparison rather than weakening
ownership checks or treating PID alone as proof.

## Independently executed evidence

From `desktop/`:

```powershell
node --test tests/process-identity.test.mjs
node evidence/reviewer-process-identity-2026-10-02/probe.mjs
```

The repository test passed **1/1, zero failures/skips**, using a copied real
Node executable under `Știință-日本`, repeated actual process inspection,
session-journal persistence and `null` after that child exited.

My separate actual-process probe passed and retained its result under
`desktop/evidence/reviewer-process-identity-2026-10-02/`. It copied Node to
`Știință-日本-Україна-😀/node.exe`, read the process's own `process.execPath`, and
compared old/new PowerShell readers for that same live PID. Observed directory
tail:

- Previous reader: `?tiin?a-??-???????-??/node.exe`.
- Repaired reader: `Știință-日本-Україна-😀/node.exe`, exactly equal to the child's
  own path. PID and `startedAt` were unchanged across readers; a repeated
  repaired read returned an identical complete identity.

The probe wrote three distinct recent opened-session entries for that actual
live identity into a real isolated journal. The old lossy reader caused
`inspectStartup()` to return `recovery` with “Three unclean starts within five
minutes”; the repaired real reader returned `normal`. Thus the negative case
reproduced the consumer consequence rather than merely checking a string.

The probe also wrote an owned isolated writer lock containing that live
identity, called real `exclusiveWriter` with the repaired inspector, and
required `WRITER_BUSY`. The guarded body did not run and the lock bytes remained
identical. Invalid PIDs 0, -1 and 1.5 returned `undefined`. Only the owned child
was terminated; subsequent real inspection returned `null`.

The old-reader fixture uses the previous actual PowerShell command body and
accepts only the known owned child PID. It does not mock the operating system,
PID, executable path, creation time, current helper, journal or writer lock.

## Exact identities and limits

| File | SHA-256 |
| --- | --- |
| `desktop/src/recovery/processes.mjs` | `981ff8b980a35295b62e5c9bd91b8b592385a15eaca8708812c455b8c7034ffa` |
| `desktop/tests/process-identity.test.mjs` | `ee08b635c61f72f2918d602331afc0f39d729ad6fc3d29b086d592685b767759` |
| Independent probe | `21d048ed5f8e1517ceeebec6b7be65e04e32c9f43d25f5d5c326bf2931eb3a50` |
| Independent `result.json` | `49e1d7f3d6216197d8275d775604961307938fe5c1f29b4b8b577ed8ea722e55` |

Commands used host execution outside the restricted Codex filesystem token to
launch/query owned Windows processes. Test data and copied executables were
isolated under the test temporary directory or the review evidence directory.
The reviewer did not edit product code, the frozen baseline or existing reports.

This evidence covers the local Windows PowerShell/Node path and consumers. It
does not independently rerun the packaged Electron Unicode recovery/copy flow,
clean-PC behavior, all Windows/PowerShell editions, access-denied process paths,
PID reuse interleavings, long-path output limits or the full unit suite. Existing
fail-closed semantics for unavailable process information remain in source;
they are not newly qualified by the successful owned-process cases here.
