# CI18 native driver follow-up

Author: launcher implementation subagent. This document records test-driver changes and actual scoped observations; it is not an independent release approval. CI18's original failure log and prior reports are preserved.

## Observed failures

The retained hosted log is `.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/ci18-native-failure.log`.

`account-transition.mjs` failed when reading `.desktop-state.textContent` after Sign in. The application now intentionally replaces that Desktop dialog with its access preview. The original probe did not follow the preview's Activate online action. I reproduced this exact null-element failure locally on the unchanged product before changing the probe.

Desktop UI's hosted strict pointer oracle rejected `#desktopCloseControls` because the parent dialog covered its coordinate. The hosted diagnostic had menu geometry but not the Done control's scroll geometry. An owned desktop viewport of 1024×640 reproduced the clipped control: in the final local run its top/bottom were 578.42/610.42px while the panel ended at 569.59px. The panel's scroll height was 563px versus 497px client height and target hit testing returned false. This requires normal scrolling before a pointer click, not a forced click.

## Scoped probe edits

Only `desktop/tests/native/account-transition.mjs` and `desktop/tests/native/desktop-ui.mjs` changed.

The account probe retains the actual final-commit guard, inert keyboard refusal, native private-draft/checkpoint readback, false-save-error assertion and explicit guard resume. It now follows the actual access preview, clicks Activate online, awaits the unconfigured production-service response, checks unchanged account authority and unlocked body/storage, then returns through Back to workspace. It verifies the original private draft survives, inserts a new comment by native keyboard and requires native private-draft save readback. The private marker must remain absent from Docs. Runtime safety UI checking remains separate and explicit. No user PIN or account credentials are supplied or recorded.

Desktop UI retains the strict click oracle, deliberate occlusion negative check, menu readiness, actual theme/opacity assertions, Code minimise and native Find route. Before clicking Done, it records the actual target, viewport and open panel. Only if the target is clipped does it dispatch one native mouse-wheel event inside that panel, await actual target hit visibility, and require a changed `scrollTop`. It then performs the unchanged strict pointer click. There are no forced clicks, repeated clicking or programmatic dialog dismissal. The optional `--small-viewport` scenario uses a desktop 1024×640 CDP viewport without changing product window settings.

## Actual local verification

- Account probe completed at `desktop/evidence/account-transition-2026-10-02T16-04-16.221Z`, with recorded renderer `6390ee4ddbda6278dfea1d94f59cebf855cf864563f457c0da5fa54a0471bcef`. Attempted unavailable online activation retained authority and private text; keyboard editing and native save resumed.
- Desktop UI completed at 1280×720 (`desktop/evidence/desktop-ui-2026-10-02T16-04-43.031Z`) without needing scrolling. A subsequent 1024×640 run reproduced clipping and successfully used the native wheel.
- Final frozen Desktop UI probe completed at `desktop/evidence/desktop-ui-2026-10-02T16-06-15.344Z` at 1024×640. The clipped control moved from 578.42px to 513.42px after `scrollTop` changed from 0 to 65, and hit testing became true. Both themes, panel/Code opacity, Code minimise and the keyboard update route passed. The original source retained renderer `6390ee4d…` during these runs; this Desktop UI probe's receipt does not embed a renderer identity, so the account receipt is the explicit generated-build binding.

Frozen source SHA256 identities:

- Account probe: `67fc57b8d61f3f1be876753cff78633f144f7e7639039c19f5eb25810ec54134`.
- Desktop UI probe: `bdd8fc9739ab1aa707dd85d77ca80ab12fd5924d14c040bc5da2e91595baf855`.

These local results do not assert a new hosted CI pass or production authentication. I did not edit product source, renderer builder, Rust launcher, workflows, original reports, user projects or recovery behavior, and did not dismiss a recovery dialog to make another test pass. The separate superseded-draft recovery failure remains the coordinator's product work.
