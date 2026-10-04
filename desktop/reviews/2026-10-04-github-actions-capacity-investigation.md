# GitHub Actions capacity — root investigation, 4 October 2026

The user supplied a GitHub notification confirming 2,000/2,000 included Actions minutes consumed, resetting1November2026. This is a compute-minute allowance, not a source repository size/storage limit. No billing settings, paid budget, repository visibility, runner registration or hosted rerun was changed. Subsequent automatic-CI-triggering synchronization is held while development and qualification continue locally. The connector cannot inspect account billing settings; $0 budget, payment method and actual accrued charges remain unverified.

Current private source97c7ecab remains on draftPR2. Actual run37222096999 is **Desktop prototype verification**, and37222097026 is **Native launcher development verification**; the immediately preceding resume note reversed these names, now corrected. Launcher111494333358SUCCESS. Desktop unit111494333276SUCCESS, packaged111494333430SUCCESS, native diagrams111496406588SUCCESS, desktop111496406621SUCCESS and sources111496406766SUCCESS. Final Desktop qualification111497474872FAILED at18:07:49–18:07:51Z, with empty runner name and no executed steps. Its decoded-log endpoint returned BlobNotFound404. The email is consistent with quota-related inability to dispatch the final job, but the exact refusal reason is not established by these fields. Do not claim the complete workflow passed or rerun to replace this failure.

## Options and recommendation

| Option | Source privacy | Actions minutes | Assessment for SIREN |
| --- | --- | --- | --- |
| Current local test runners and packages | Private | No GitHub runner minutes | Immediate recommendation; already available with exact captured-input evidence. Preserve scoped local vs hosted verification distinction. |
| Dedicated Windows self-hosted runner | Private | GitHub documents self-hosted Actions use as free; hardware/electricity/maintenance remain ours | Useful later for regular heavy Electron/Windows suites; isolate account/machine or VM, restrict jobs to reviewed trusted code, and maintain OS/runtime/runner patches. Do not install a background runner on the personal desktop implicitly. |
| GitHub-hosted Windows with explicit bounded paid budget | Private | Billed beyond included allowance | Optional external clean-host verification at milestones; only after user chooses cost/budget. Published standard Windows rate currently$0.010/minute, excluding artifact storage. |
| GitHub Pro | Private | 3,000 included instead of2,000 | A modest increase, not a complete solution for repeated full suites. |
| Public source repository | Public | Standard hosted runners free | Conflicts with the approved private-source requirement. Not recommended. The planned separate public signed-binary repository does not remove the private source repository’s CI usage (inference from repository-owner billing rules). |

Retain the private source repository and the existing local validation. Reduce cloud frequency instead of weakening tests, removing assertions or raising deadlines. Git pushes themselves do not consume hosted Actions minutes; the workflow events they trigger do. Supported skip instructions can prevent push/pull_request jobs during intermediate backup synchronization, but leave required checks pending and are not release qualification. They do not suppress other workflow event types. A cleaner long-term choice is an explicitly triggered milestone CI workflow with the full qualification gate retained. No trigger modification has been implemented in this investigation.

Before any paid hosted run, the account owner should verify Actions budgets and stopping behavior in GitHub billing settings. Deleting artifacts does not restore used compute minutes, and cannot undo already accrued storage charges. Preserve original adverse logs/artifacts; no cleanup has been performed.

## Official sources consulted

- [Actions billing, allowance, Windows pricing and storage](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Self-hosted runners and maintenance](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners)
- [Secure use of self-hosted runners](https://docs.github.com/en/actions/reference/security/secure-use)
- [Adding a self-hosted runner: ownership and permissions](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [Skipping push/pull_request workflows and pending-check caveat](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)

This report is implementer investigation, not independent approval, an account invoice or authorization for paid usage.
