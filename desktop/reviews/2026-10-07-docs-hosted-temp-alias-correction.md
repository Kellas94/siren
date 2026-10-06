# Docs hosted fixture path correction

Author: `/root`, owner debugging record, not independent approval.

Canonical Docs candidate `f608bd4f94250f823e592b0e340975d746fe1f79` / actual PR integration `fe86e46b77a9007602cdc6e93f4aebfb88b7a0fd` produced an adverse Windows unit job `112550900844` in run `37546239582`. Original decoded log is retained under `desktop/evidence/workspace-surface/ci37546239582/unit-job-decoded-original.json`; final run retention is separately owned by `/root/disk_inventory`.

Seven tests in `tests/native-docs-export.test.mjs` were marked `hookFailed`: their cleanup guard compared the canonical parent `C:\Users\runneradmin\AppData\Local\Temp` with the OS spelling `C:\Users\RUNNER~1\AppData\Local\Temp`. The existing fixture `mkdtemp` intentionally returns `realpath`, while the new teardown guard used only `resolve(tmpdir())`. This is evidence of a test cleanup guard defect; it does not turn the failed hosted verdict into a pass or prove all product behavior from that job.

Root independently read the original log and reproduced the same identity/spelling mismatch locally using a lowercase Windows TEMP spelling. The actual seven tests failed at their unchanged after hook (`docs-temp-alias-red.log`). The correction resolves both parent paths with `realpath` before equality; the exact intended temporary directory and required fixture basename are still checked before recursive deletion. Product ownership checks, assertions, timeouts and service implementation are unchanged.

The same actual reproduction then passed seven tests (`docs-temp-alias-green.log`). A tracked child-process regression runs the real Docs tests using the alternate spelling and asserts all seven pass, zero failures. Its first harness attempt inherited `NODE_TEST_CONTEXT`, which suppressed child test execution/output; this setup failure is preserved in `docs-temp-alias-regression-red.log` and `docs-temp-alias-regression-green.log`. The corrected harness removes only that inherited test-runner variable; `docs-temp-alias-regression-green-final.log` passes with genuine child output. Those initial harness failures are not claimed as product REDs.

New Presenter fixtures use the same canonical-parent comparison. A new hosted run remains necessary after the corrected candidate is qualified and synchronized. Do not cancel, relabel or overwrite the original run. No main merge, production release or installed replacement is implied.
