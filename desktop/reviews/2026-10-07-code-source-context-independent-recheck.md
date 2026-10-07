# Code source context — independent corrected recheck

Author: `/root/diagram_history_final_review`, the independent reviewer who authored the original adverse report. Date: 2026-10-07. This separate report assesses the narrow implementer corrections to original R1/R2. The original report remains unchanged at SHA-256 `daa20581a39d109dcd99076f6be268d7ce32862f32ab0d5db33b1ae848f4c504`.

Disposition: **R1 and R2 verified corrected in the captured source; no new finding from this bounded recheck.** This is scoped source/unit qualification, not native, copied-package, hosted or release approval.

The helper now maps actual Knowledge `fileType:'txt'` to `text` at the Docs boundary and merges exact Code language claims before independently deciding whether a display name may be shown. Exact source identity, conflict-to-unknown behavior, name privacy, bounded scans and genuine working-source metadata fallback remain in place.

## Actual independent evidence

- Ran six focused test files: `source-context`, `native-working-sources`, `native-source-reads`, `native-source-read-main`, `native-source-analysis`, and `native-window-catalog`: **44 tests passed, zero failed**, without escalation. These include the actual production-adapter working Save → v2 analysis/read path, membership and Lock refusal, bounded association filtering and both new regression cases.
- Reran the original independently authored metadata probe unchanged. Docs `txt` now returns `text`; exact Python plus Docs `txt` returns `unknown`; exact Python plus unsafe-name text returns `unknown`; the safe-name conflict control remains `unknown`.
- Reran the original frozen-validator probe unchanged. Actual frozen `validateCodeFiles` still admits the path-shaped name; classification for its conflicting exact metadata is now `unknown`.
- Ran an additional independent assertion probe: sole exact Python claims with empty and path-shaped labels retain Python while exposing no display name; both conflict cases resolve to unknown; a different-source same-hash unsafe text claim cannot conflict with the selected Python source. All assertions passed.

Original adverse probe outputs and the original sandbox test failure were retained untouched. This recheck does not relabel those historical results.

## Input identity

Captured **35 inputs** before and after the recheck, including the corrected helper, regression tests and current workflow. **All hashes were unchanged** during the checks. Both `recheck-inputs-before.json` and `recheck-inputs-after.json` have SHA-256 `d79ccaaeae1719fc8b2a194772315a956eb861ac1d21606f50e26f0c056995e0`.

| Corrected input | SHA-256 |
| --- | --- |
| `src/windows/source-context.mjs` | `56c7341c5ecb282443c375dba316883953f925072493e5ad341f94158ece07ca` |
| `tests/source-context.test.mjs` | `55b32674ab0da7ccf655cb06c735b3c42ea6cd60eac313c77a57305936eb18b1` |

Retained evidence is in `evidence/code-source-context-independent-review/`:

| Evidence | SHA-256 |
| --- | --- |
| `scoped-recheck.log` | `a28a9953a1f603063672d236eece5b94b9146f8625958a673b5e10c6de06226a` |
| `metadata-probe-recheck.log` | `089da1995d3ecdceb211ae73f11498b0efda6e6ad72ff8a4f7cf8c529acdeba5` |
| `frozen-language-probe-recheck.log` | `51bf4d9a2952df8978c66d78f1910876188b1b1e4dc7560aae428f4dabffab72` |

Additional assertion source/output: `recheck-assertions.mjs` and `recheck-assertions.log` in the same evidence directory. Full input identities are in the two recheck manifests.

## Limits

The reviewer made no product/test/workflow/generated edits and ran no GUI, native harness, copied-package scenario, renderer rebuild, full suite or hosted operation. Concurrent implementer renderer/full-suite work and media-owned native work are separate evidence classes. The new native harness is not certified by this report; original broader review limits continue to apply. No historical Diagram adverse result or timeout is closed here.
