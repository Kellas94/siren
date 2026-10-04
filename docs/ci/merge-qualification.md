# Required merge qualification

`SIREN merge qualification` is the single required merge check. Its workflow runs on every pull request, including documentation-only changes. Routing reads the exact base/head Git diff with NUL-separated paths and no rename omission, without GitHub's changed-file API pagination limits.

Documentation-only changes run the CI policy tests and record application suites as skipped. Every other change in a checkout containing the desktop implementation runs both reusable workflows: the existing full desktop unit, native and packaged checks, plus the native launcher checks. The final job always runs and requires actual success for every selected suite; missing scope, failures, cancellations and unexpected skips are rejected. Existing test assertions, deadlines and artifact collection remain in place. Qualification is not production release admission or independent human review.

The initial main branch retains the historical HTML application and has no desktop implementation. Its CI bootstrap admits only documentation and CI policy updates. Legacy application edits fail closed until a dedicated legacy qualification is provided. The bootstrap PR does not merge the desktop feature into main.

Permissions are contents-read only. Checkout credentials are not persisted, actions are pinned to commit SHAs, and untrusted pull requests receive no secrets. GitHub's required-check setting must be enabled only after observing the real check on a pull request. Branch deletion, force pushes and direct main updates remain blocked by the existing ruleset.
