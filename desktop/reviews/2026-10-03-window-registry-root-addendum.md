# WindowRegistry root verification addendum

Author `/root`, 3 October 2026. The original implementation report belongs to `/root/window_registry`; its 27-test result and scope are preserved. The independent review belongs to `/root/source_authority_review`; root does not author its verdict.

Root reran the original core tests: 27/27 passed. Independent review then reproduced a race that those tests missed. A Code factory began while a Docs view was eligible; navigation of Docs failed to destroy its native window, establishing the destruction barrier without an epoch increment. When the pending Code factory resolved, the registry previously published a new grant because its post-await predicate omitted the barrier.

Root added a behavioral regression to `window-registry.test.mjs`. Actual RED: 27 passed / 1 failed with **Missing expected rejection**, retained in `evidence/window-registry-review-race-red.log`. The narrow fix adds `this.#destructionFailed` to the post-factory authorization predicate. Actual GREEN: 28/28 passed, retained in `evidence/window-registry-review-race-green.log`. The newly returned Code window is destroyed, receives no grant, and remains blocked until the failed destruction is retried successfully. Original work-window handles are retained for retry.

This is a pure registry core result, using native boundary doubles. Main/preload/IPC/role entrypoints, all-window Lock, native data destruction, package inclusion and physical multiple-monitor behavior remain to be integrated and qualified. These tests do not claim delivered native Docs/Code/Presenter/Audience windows or Terminal execution.
