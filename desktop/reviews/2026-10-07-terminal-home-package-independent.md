# Terminal/Home development preview — independent package and receipt review

Author: /root/terminal_foundation_review. Result: COMPLETE for this bounded byte/receipt review; no discrepancy found. This is not a release approval or independently executed GUI qualification.

Frozen source: 7cb9d2c5ab121d3a4a31feaa2390f03720cd14dd. Preview: C:\Claude\SIREN_WORK\portable\desktop\dist\development-232d578c-6769-43fe-a817-c975949d8dc8. Reviewer capture window: 2026-10-07T16:31:45.136Z to 2026-10-07T16:31:49.454Z.

## Verified evidence

- Exact ASAR file set independently derived from frozen packaging policy and lockfile: **305 files = 123 source + 16 generated + 165 dependency files + package.json**. Every extracted member matches its current input and owner member SHA256/size. ASAR API list/stat/extract was used read-only; shared archive offsets are not treated as defects.
- ASAR: **54632505 bytes**, SHA256 **a84e0d7b340e73a8f18a6ada7e0eb259cfe6d76b0acd34da11fa29a51e9f9a7a**.
- Runtime: **245726208 bytes**, SHA256 **49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa**. Helper: **6144 bytes**, SHA256 **485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3**. Preview plus three copies match all 12 binary identities; 12 BUILD/helper/inventory metadata comparisons also match. Runtime matches installed Electron bytes; helper matches cached binary/receipt and frozen C# source; fixed compiler hash was read, never executed.
- **642 tracked inputs** match frozen Git: **605 raw bytes + 37 CRLF/LF-only**. Among 123 shipped source members, **120 are raw byte-exact** and only src/main.mjs, src/preload.cjs and src/ipc.mjs require CRLF/LF normalization. All **16 generated members are byte-exact**; no generated/dependency normalization was used. The 21 production package names/versions/integrities/licenses/notices match lockfile and local metadata.
- **668 aggregate captured inputs** match current hashes and owner before/after. The Home child additionally captures baseline/README.md (current hash checked separately against the child receipt) and the original Electron binary (hash bound above); child input snapshots are unchanged. Reviewer **944-file before/after capture is unchanged**, identical across original and corrected review runs. All 71 matched pre-existing Terminal review/probe artifacts remained unchanged.
- Retained actual owner copied receipts: **Home backup 4 + Help 12 + HomeLibrary search 7 = 23/23 COMPLETE**, process code 0 and null signal. Exact child receipts match embedded aggregate data; every case is true, source inputs unchanged. Three copied archives/runtime/helpers also match the **9 external post-exit binary checks**. Home explicitly records actual exit, verification before, and package unchanged after exit.
- All development-only flags remain false: releaseAdmitted, inventoryQualified, launcherQualified, accountConfigured and updatesConfigured. Pure Terminal source exists at this commit but **no src/terminal member is shipped**; cwd/profiles are explicitly rejected by frozen allowlist. No native Terminal admission follows.

## Copied Home oracle

The 99d8109c65f5d678fd41184f857c17de69be5e41a5c7f57c5b4ceb545365d8f0 base fixture and 71498c1311621b9917102b4b5e2482c89a3afda08f0ae7c7092ffbb7070267f8 one-off are verified. Replaying all 17 declared exact substitutions reproduces the full one-off bytes. The seeded 100k source and business scenario block, menu/keyboard/cancel/busy/common-Lock assertions and UI deadlines remain exact except the executable-launch substitution. The chooser inspector body remains exact. Added guards require explicit copied preview/Data, verify package before, observe actual exit and verify after. The OS Save chooser remains the same PID-checked simulation seam; no manual OS chooser is claimed.

## Original reviewer adverse retained

The first audit passed member/source/generated/binary checks, then failed because its own schema assumption required package.copy on all three child receipts. HomeLibrary legitimately omits that field. The original -audit.mjs and ADVERSE -audit.json remain untouched. The separate -audit-corrected files bind HomeLibrary to its actual evidence-root/Pachet-Știință-Home path and frozen fixture constant, while preserving explicit Home/Help bindings. The corrected read-only audit is COMPLETE. No test result or actual GUI run was changed or rerun.

## Scope and role limits

I previously implemented the separately authorized Home native fixture repair, including HomeLibrary Settings identities. This review is a distinct byte/receipt verification; ROOT executed the actual copied GUI probes. I did not run GUI, helper/compiler, build, suite, install, or change product/test/generated/Git state. Only new review evidence and these reports were written.

Original hosted causes remain open. Prior P2 reports are unchanged. This review grants no release/installed replacement, native Terminal/host/PTY, physical monitor, manual chooser, readonly native mode or legal/inventory/launcher/account/update qualification. The owner full-suite claim is outside this audit and was not independently rerun.

Exact members, 944 before/after hashes, receipt hashes, retained oracle error/correction and limits are in the sibling JSON. Raw evidence: reviews/2026-10-07-terminal-home-package-independent-audit.json and reviews/2026-10-07-terminal-home-package-independent-audit-corrected.json.

Actual identity receipt: evidence/workspace-surface/terminal-home-package-identity-2026-10-07T16-25-55.415Z/result.json. Aggregate copied receipt: evidence/workspace-surface/terminal-home-copied-2026-10-07T16-26-07.811Z/result.json.
