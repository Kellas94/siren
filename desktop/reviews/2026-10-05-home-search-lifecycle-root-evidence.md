# Home search probe lifecycle — root execution evidence

Hosted run37246481829 on remote0dec7274 finished FAILURE. Unit1010 plus guarded I/O1, Launcher and all50 native children (20/15/15) passed. The package job failed after five Home search cases at verifyClosedSearch line13: `Occluded control: #homeLibraryQuery by home-create home-library`. This failure remains retained and is not reclassified as success.

Artifact11318179805 downloaded and verified against its hosted SHA25638bf3e037b3323fa888861c3cdc8ca331ebda50579d34f8cc60ab9721b366e79. Original log/screenshot/result are retained under evidence/monitor-memory-hosted-adverse. The screenshot shows the newly focused library; it does not itself prove which DOM node the global selector selected.

Root tested the lifecycle hypothesis on the exact development package at the hosted1008x656 viewport. The first diagnostic passed7 and found one genuine query. A controlled500ms delay of the old dialog's close handler then produced two query nodes and the exact same ADVERSE5 hit-test refusal (2026-10-05T00-21-18.504Z). The fixture mounted its isolated Home before the old close event had retired the old controls; its global selector selected the hidden previous query. This reproduces the failure mechanism, not a claim that hosted DOM diagnostics were captured.

Only tests/native/home-search-race-cases.mjs changed: await actual old-dialog removal before mounting the isolated Home, and scope query/search clicks to #searchRaceHome. No product, geometry, timeout, hit-test, permission or original assertions changed. The same controlled delayed-close case passed7 (00-22-11.463Z); the original actual packaged Home-search probe passed7 (00-22-54.828Z), with captured inputs unchanged. Owned children closed. The original failed run and negative trace remain unchanged.

The fresh package's runtime and application bytes are unchanged. Earlier independent package/source review remains scoped to45f6dc4 and does not retrospectively approve this fixture correction. A separate narrow review and hosted follow-up are tracked separately. No production release, installed replacement, physical unplug/DPI-setting or whole-task admission.
