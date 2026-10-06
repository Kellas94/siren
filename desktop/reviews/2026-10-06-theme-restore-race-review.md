# Independent theme restore race review — 2026-10-06

Author: Codex `/root/shared_workspace_review`. This report preserves the new CI37403029139 evidence and an independently authored controlled reproduction. Existing Docs and CI374005 reports are not edited. No hosted/native/release PASS is claimed.

## Actual retained CI evidence

I read the original `run-final.json`, `jobs-final.json`, and Desktop artifact results in `desktop/evidence/workspace-surface/ci37403029139`. Run head is6acf59385855bb0f2a32dd23461c64a03eba1b9b; final conclusion isfailure. Jobs show packaged workspaces, Windows unit job, Sources and Diagrams success; Desktop native and aggregate qualification failed. These are the original hosted job results, not my executions.

Independently hashed retained `desktop-original.zip`: SHA256017e1198aa0980badae9a89e6af8d73f15bfa970720edcaffd4b2c76018d32a9.

Actual original traces:

- `desktop-original/evidence/desktop-ui-2026-10-06T02-20-07.805Z/result.json`: pointerdown/click at499/503ms targets themeMenuLabel. Menu opens at534ms on Dark with shared bar still hidden. At959ms a classic-appearance event has `user=false`, body still Dark, menu open, shared bar visible. At1105ms body is Light and menu hidden/expandedfalse. No intervening recorded pointer appears.
- `desktop-original/evidence/access-screen-2026-10-06T02-21-20.495Z/result.json`: pointerdown/click756/758ms, menu open781ms; programmatic classic event922ms; Light/hidden948ms. Again no intervening pointer.

The event is dispatched before `applyTheme` updates body.dataset.theme, so the classic event recording Dark followed by a Light mutation is consistent with one application of Light; it is not evidence that an unrelated Dark choice happened in between. Final option rectangles arezero, so the reported cover at(0,0) is not evidence of physical occlusion of an open menu.

These actual traces establish an open menu being closed during a non-user theme lifecycle transition. They do not by themselves identify the exact IPC response/preference token or call stack. Initial native System resolving to OS Light is a strongly supported causal candidate, not a fully captured native call stack.

## Own controlled reproduction before correction

Independently authored fixture: `C:/Claude/SIREN_WORK/tmp-theme-first-native-review`. Builds the **whole frozen R78 renderer** through current `patchClassicAppearance` and `addDesktopShell`, with real Chromium layout/menu DOM, isolated fresh profile and hidden window. Appearance get is deliberately unresolved so the fixture controls the first native appearance application. Native project/preload admission, production appearance persistence, grants and main IPC are not exercised.

After original onboarding is dismissed through its real Skip control, a strict hit-tested real Chromium pointer opens themeMenuButton on Dark. The fixture then calls the production-exported `sirenClassicAppearance.apply('light')` once; it does not replace the menu or applyTheme implementation, stop animations, retry a failed option click, or extend any native test deadline.

Own original result retained in `result-before-correction.json`, original patched renderer in `studio-before-correction.html` (SHA25632d8b07cbc50c9ce906d08a8bbfcb75b9bd5eca0519eaa1a71a280d81954995a):

- Open Dark: hiddenfalse, expandedtrue, menu312×453 and Light option296×38.
- First native apply Light returns true, emits classic event `user=false`, updates actual body/preset to Light, and produces hiddentrue/expandedfalse withzero rectangles. There is no other pointer between opening and closing.
- Reducing the sequence to a same-Light reapply after reopening retains hiddenfalse/expandedtrue. This independently distinguishes first changed preference from the previously handled same-palette restore case.

The first two setup attempts were blocked by original onboarding/recovery UI and are not counted as menu-race evidence. The successful run used a new profile and real Skip, preserving the pointer visibility oracle.

## Important finding and minimum correction

Before correction `build/appearance.mjs:19` closes when `!window.sirenShell || desktopUser || arrivingAt`. On the first native Light restore from Dark, arrivingAt isLight even though desktopUser isfalse. The controlled full-renderer sequence directly demonstrates that this condition closes an already-open menu. This reproduces the trace shape of CI, while remaining a controlled lifecycle candidate rather than a complete production-native reproduction.

Recommended desktop policy: native programmatic restore/propagation preserves an open menu even when the effective theme changes; explicit desktopUser choice closes it; standalone retains original close behavior. Removing only arrivingAt from the close condition implements that policy without changing theme application, palette identity, source colours, native ownership or pointer oracles. A prior test expectation that a changed programmatic theme must close was a policy choice and should be corrected explicitly, not used as evidence that closing is required by the original reference.

The current strict pointer oracle correctly refuses a target that has vanished. Retries, fake clicks or longer deadlines would conceal this transition and are unnecessary to correct its close policy.

## Separate correction verification

The owner removed arrivingAt from the close guard. I repeated the same first-native-Light sequence against the actual corrected patch in the full isolated R78 fixture. The original RED renderer/result are preserved separately; GREEN is `result-after-correction.json` with patched renderer `studio.html` (SHA25625a0c235868e6f998c5d63482d460d0f20ac2032eaa58d2c4fd4d1253cc14bff).

After the first programmatic Light application, actual body/preset becomeLight, while menu remains hiddenfalse/expandedtrue,312×453. The Light option remains296×38 and `optionHit=true` under the real document.elementFromPoint sensor. The event sequence contains the original Dark menu-opening pointer plus a non-user classic event, with no intervening pointer or hidden-menu mutation. Same-Light reapply also leaves the menu open/hit-testable. For this second control, the fixture ensures the menu is open only if the first case closed it; on GREEN no second opening pointer is required. The decisive first-apply sequence was unchanged.

Own command `node --test tests/appearance-lifecycle.test.mjs tests/appearance-sync.test.mjs tests/appearance.test.mjs` completed13 tests,13 passed,0 failed, duration3781.0726ms. Its actual extracted lifecycle test verifies the explicit desktopUser and standalone close branches with mocked UI side effects; those branch checks are not physical native pointer observations. The other tests retain palette/store/admission/race boundaries. No repository test, pointer oracle, click retry or deadline was edited by this reviewer.

Reviewed correction `build/appearance.mjs` SHA2565f8d7ea7acdbb802b30b6a80a690d59ba9fd53311ba2eb164b69093b1c54ba5f. The fixture exited and was reported closed to the owner. Original hosted failures remain historical evidence. This narrow RED/GREEN establishes the corrected menu lifecycle under controlled programmatic restore; it does not declare CI37403029139 repaired, prove an exact production-native IPC timing sequence, or qualify release/persistence. Any owner-executed native checks or future hosted run remain a separate evidence class.
