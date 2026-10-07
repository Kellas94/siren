# Independent narrow review: Home-search probe lifecycle

Author: `/root/monitor_layout_review`, separate reviewer agent. Date: 2026-10-05. Read-only source/diff, retained artifact and result review. No product/tests were edited and no GUI probe was executed by this reviewer.

**Finding:** The narrow change is a justified test-fixture lifecycle correction. No original acceptance oracle or timeout was weakened. This is not a product-fix verdict or a claim that hosted CI has passed after the correction.

## Original failure remains adverse

Live read-only GitHub GETs independently confirmed run **37246481829**, head `0dec7274ed9811dbe38d44e9e16eb822d5221f5b`, completed **FAILURE**. The Windows package job failed its development-package step; desktop/windows, launcher and the three native jobs succeeded. The downstream Desktop and merge qualification gates correctly failed on the package result. The previous independent package-identity report is not converted into a hosted approval.

The reviewer independently hashed `evidence/monitor-memory-hosted-adverse/package.zip`: SHA256 **`38bf3e037b3323fa888861c3cdc8ca331ebda50579d34f8cc60ab9721b366e79`**, consistent with the retained artifact identified by root as 11318179805. Reading the ZIP entry directly, without extracting or modifying it, established the original hosted `home-library-search/2026-10-05T00-15-53.934Z/result.json`: **ADVERSE, five completed cases**, exact error `Occluded control: #homeLibraryQuery by home-create home-library`, at `verifyClosedSearch` line 13; its captured inputs remained unchanged.

The separately retained controlled local RED `2026-10-05T00-21-18.504Z` likewise has ADVERSE/five cases, the same occlusion error and **duplicate query count 2**. Its fixture delays the old dialog's queued close handling by 500 ms. The root-executed controlled GREEN `2026-10-05T00-22-11.463Z` has COMPLETE/seven cases under the same delay. Both recorded input sets were unchanged within their runs, and all seven product/generated hashes independently recomputed by the reviewer match both records. These results support the specific old-dialog/isolated-fixture collision; they do not prove all possible hosted timing outcomes.

## Exact diff and preserved checks

The reviewed product test change is limited to `tests/native/home-search-race-cases.mjs`:

- After clicking the original library's Done button, it waits for **genuine removal of the original `.home-library`** before hiding its Home and mounting a second isolated Home.
- The subsequent query and Search clicks explicitly target `#searchRaceHome`, eliminating document-global selection of the old hidden query.

Product source confirms Done calls `dialog.close()` while the close listener retires rows, clears the active state and removes the dialog. Since this close event is queued, hiding the original Home and creating a second same-ID library before that listener completes is an invalid fixture precondition. Waiting for its real removal observes the existing lifecycle; it neither forces removal nor fabricates a metadata reply.

An independent text comparison against HEAD established **all original assert-bearing lines are identical** and timeout/delay declarations are unchanged. The helper has one additional genuine-state wait (four `driver.waitFor` calls become five). The existing held real metadata gate, disabled Search/query assertions, real Close input, removal assertion, late-reply release, zero-old-rows assertion, cleanup and final Lock/project-equality checks remain present. `drive.mjs` retains the original geometry/hit-test occlusion refusal; the correction does not bypass it. The controlled RED/GREEN runners differ only in the imported case helper, and their retained helpers apply the same 500 ms delayed-close fixture.

The old/current production helper SHA256 values are `bb0f5aa45f83f404542cf4860e3b4c7f87750bf8e61cb0890472d581378b4a01` and `e41a04d28ebe534825258f931f1f0d9bfc36574e0f3e3f2c232785dc9d4fe01f`. Controlled RED/GREEN result hashes are respectively `5e8b918d03862a11bb88260e4438ab9e5834623d2d18ea00bb82601c81867672` and `bc8ed9bc32413ad33541d47b104ad4016eface8a89c27944e5a594462a3fd7a2`.

## Qualification boundary

No concrete blocker was established in this narrow correction. Original hosted/local adverse results remain retained. The previous reviewer reports still match their original SHA256 identities (`e8b39318…` and `5de46122…`); this is a new separately authored report. The original corrected packaged probe and a fresh hosted run are the root agent's remaining verification, not execution performed or approved by this reviewer. Run 37246481829 remains FAILURE regardless of the controlled GREEN result. Main merge, public release, physical input/monitor behavior and whole-feature admission are outside this review.
