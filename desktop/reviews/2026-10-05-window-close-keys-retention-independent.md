# Independent follow-up — Diagram Export artifact retention

Author: Codex independent reviewer `/root/workspace_surface_review`. Fix author: `/root`.

Date: 2026-10-05. This prospective local follow-up closes the historical report's P2 **in the inspected workflow/test implementation only**. The historical hosted report remains SHA-256 `8e9670f7131c3a2d48d71d381310f6fe1cd679da021432bd1e1b6c8e24a8d705`; original run `37360932464` remains success with 22/102 logged versus 21/97 retained execution/case evidence. Missing old Diagram Export JSON/log/images have not been manufactured, retrieved through a rerun, or reclassified as retained.

I read the exact Git diff, executed the focused commands below and performed in-memory adversarial checks. I did not launch Electron, modify source/tests/workflow/generated/helpers/evidence, alter old reports/logs/ZIPs, or commit. Only this new report was written. **No remaining actionable finding in the final inspected local retention correction.** Future hosted retention is not yet established by these local checks.

## Exact change and reviewed hashes

The workflow adds exactly nine path lines: one result JSON, log glob and PNG glob in each of the three existing named always-upload blocks: `desktop-development-evidence`, `desktop-native-${{ matrix.group }}-evidence`, and `desktop-packaged-evidence`. No probe command, original oracle, timeout, qualification gate or application-source route changes in this diff. These patterns cover `desktop/evidence/diagram-export/*/result.json`, `*.log`, and `*.png` from the actual missing original execution.

The initial regression counted three appearances globally. I identified that misplaced duplicate patterns could satisfy that check while leaving an upload block uncovered. Root replaced it with checks for each uniquely named upload block, actual upload-artifact use, `if: always()`, and exactly one result/log/png pattern in that block. A planted misplaced result pattern keeps the former global count three but must be rejected. The current nine workflow additions are correctly distributed. That coverage caveat is closed by the final inspected test.

Paths relative to `C:/Claude/SIREN_WORK/portable`; SHA-256.

| File | SHA-256 |
| --- | --- |
| Old committed `.github/workflows/desktop-verify.yml` | `c608c1b66dc8057f94e0b0b315f31bd02f7e23a6d451711bdbdb6761938dc120` |
| Current `.github/workflows/desktop-verify.yml` | `66c372292128617f1f3f21110f8dd45d56677ef025ab508c54ff515655e1da04` |
| Final `desktop/tests/native-verification.test.mjs` | `cce18ca06d49c33d4f5e78ab71f0fdb777253368c4834af9f0563b7b98292633` |
| Unchanged `desktop/scripts/native-verification.mjs` | `84734fa99cf07f6799d9a41bf17eba62ed4fa7543d4ea9e6bce0225563f63db7` |
| `.github/ci/qualification-cli.test.mjs` | `f75b3726f86ab77777dfa69faba54049fd2441ab583bccdc34dcf625d110ed91` |
| `.github/ci/qualification.test.mjs` | `20dd3e6fff32426f5ea47346d71567f6762a82dc8f28c1c4637baf18aec8f087` |
| `.github/ci/qualification.mjs` | `387abad64dc97a29e60c7da252340fc47557bb7a4cb2ae652200664bcaae7f28` |
| Unchanged `desktop/src/main.mjs` | `311d40fc553fcd82f88c0114fa7274a99d89804cbe264698ce84023a19a016e2` |
| Unchanged `desktop/src/windows/focus.mjs` | `6774de6f4d36725ba4f55015ce07f53d5eb223b8e691f0441feb7d94c817262d` |

## Independently executed verification

From `C:/Claude/SIREN_WORK/portable`:

```text
node --test .github/ci/qualification-cli.test.mjs .github/ci/qualification.test.mjs desktop/tests/native-verification.test.mjs
```

Final hash scope above: exit 0, **11 passed**, zero failed/cancelled/skipped/todo, **1033.7271 ms**. This includes real qualification CLI/gate behavior, malformed/unknown/result refusal, finite original native-group registration, planted misplaced retention and native child/spawn failure propagation. It does not execute Electron. My earlier command on the initial aggregate-count test also passed 11, but it is historical for the strengthened test and is not substituted for this final execution. The overlapping commands are not added as unique test counts.

I also extracted the exact final retention verifier from the inspected test into an in-memory function. It rejects the old committed workflow, accepts the current workflow, and rejects a misplaced result pattern even though the global count remains three. The original Git blob and current workflow were read only; no fixture/workflow bytes on disk were edited. This independent adversarial check exited 0 and establishes the failure mode the final regression guards.

Root's `desktop/evidence/workspace-dock/export-retention-final-focused-green.json` separately records their own 11-pass execution, 1030.8498 ms. It is not attributed to this reviewer. Root's initial wrong-working-directory CLI test failure and earlier missing-pattern RED remain separate preparation/test observations; neither implies an application failure or a successful hosted follow-up.

## Limits and unchanged historical evidence

The correction is prospective. A fresh actual hosted run/artifact is required to establish that GitHub uploaded the new Export files; no existing old ZIP can demonstrate that. Source/package byte and native Close/Quit qualifications remain the previous separate evidence classes. This review does not approve a release, whole Task 4, physical keyboard/IME/monitor or clean-machine operation.

During the historical review I additionally compared the prior failed source-read result and actual Electron log directly against their entries in the unchanged `37355828768` sources ZIP; both match exactly. That prior ADVERSE identity-query observation remains unchanged and the new green hosted observation does not prove a permanent provider reliability fix. No original hosted execution/status/evidence is relabeled by this local retention fix.
