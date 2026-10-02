# CI17 native probe diagnostics

Author: launcher implementation subagent. This is a scoped test-driver diagnosis, not an independent release approval. Original CI17 logs, authenticated artifact and earlier independent reports remain unchanged.

## Authenticated failure evidence

The retained job log is `.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/ci17-native-failure.log`. Its uploaded artifact digest is `1dad292cfaa0f771339023bb66435b340220c650ee2f5cd67fe04241f86c1761`; the coordinator independently downloaded and matched that artifact. I inspected its actual Guided result at `desktop/evidence/ci17-native/evidence/guided-intro-2026-10-02T15-20-26.651Z/result.json`.

The Guided result reports `replay.reducedMotion=true`, an opened overview, and no animation. All 180 startup frames ran from 310.3 to 4802.2 milliseconds; none showed the intro. The initial overlay existed but was not visible, then became hidden. That is the product's reduced-motion branch. The old assertion demanded an intro unconditionally despite saying “unless reduced motion is enabled”. My initial suggestion of observation exhaustion was a hypothesis before the artifact was available; the authenticated artifact does **not** support exhaustion as the cause of this failure.

The Desktop UI failure was an immediate theme-option pointer click with no hit at the reported coordinates. The menu schedules its placement with `requestAnimationFrame` and animates; this probe did not await placement, unlike the existing Code window probe. CI17 contains no captured failing menu geometry, so the exact transient geometry cannot be reconstructed. No shared application fix was made for this failure.

## Test-driver changes

Only `desktop/tests/native/desktop-ui.mjs` and `desktop/tests/native/guided-intro.mjs` were edited:

- Desktop UI performs one real theme-menu opening click, waits at most the existing driver's 30 seconds for the target option to be on screen, actually hittable and out of menu animation, then performs one real option click. The deliberate covering-element negative test, actual theme/RGB assertions, Code minimise and keyboard Find checks remain. New failure screenshots and bounded geometry diagnostics retain evidence if readiness never arrives. No repeated, forced or synthetic DOM clicks were added.
- Guided explicitly tests reduced-motion replay on its owned page: animation must be skipped while the feature overview opens. The fresh startup animation case requests `prefers-reduced-motion: no-preference` through CDP **before** the actual SIREN document navigation and asserts that this preference is active. This changes only the owned test page, not Windows settings or production behavior. The existing mandatory intro-presence and no-workspace-before-intro assertions remain.
- The passive startup observer has a 30-second/4096-frame bound and waits for actual SIREN initialization and animation completion instead of treating 170 frames as readiness. It also requires the exact fresh project's normal, editable native bootstrap. Bounded stdout diagnostics expose host preference, bootstrap and first/last frames to CI. The owned initial `about:blank` navigation registers observation; timings remain relative to the actual SIREN document.

CDP media emulation uses the documented `Emulation.setEmulatedMedia` feature API: https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedMedia .

## Local results and limits

Actual Windows Electron Desktop UI passed at `desktop/evidence/desktop-ui-2026-10-02T15-26-12.597Z` against renderer `f831ec5ce7197e17b660ea068f84c468459a3a2dce46615c6ba5f07b1e56a9e4`.

Actual Guided, native label edit/save, ordinary replay, explicit reduced-motion replay and motion-enabled startup passed at `desktop/evidence/guided-intro-2026-10-02T15-30-10.960Z` against renderer `f02418a0ea8d28edbf991ea76a5e2751bfe52d1695b7dcb30e54dd682c29a335`. First observed frame at 255.2ms contained a visible intro and no visible application control; the no-flash assertion passed. The result records the exact synthetic native project. No user projects were read or changed.

Frozen probe identities at this handoff:

- Guided SHA256: `07602ce648e48cb4bb83ed414e6eb71d58ec8afa28ead9b377e5f2a1a0df0a06`.
- Desktop UI SHA256: `5f4c193be5a4ec6ace43022700688f370e9b4323b6f73667bdd20a48741a11b1`.

These local observations do not establish a new hosted CI result, production activation, clean-machine qualification, signed update apply/rollback, or absence of other interface defects. No Rust launcher, renderer builder, shared product source, existing original reports or Windows policies were modified by this follow-up.
