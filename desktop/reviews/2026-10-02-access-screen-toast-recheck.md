# Independent access-preview toast recheck — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. Original reports `2026-10-02-access-screen-preview-review.md` and `2026-10-02-access-screen-preview-recheck.md` remain unchanged. The latter retains the independently observed workspace toast above the preview and the original footer repair evidence. This reviewer made no product or implementation-test changes.

**Disposition: the additional P3 workspace-toast visual finding is repaired for the observed existing `#toast` implementation. No authentication completion or production release approval is implied.**

## Inspected correction and source binding

The correction adds `body:has(#desktopAccessScreen[open]) #toast {visibility:hidden !important;}`. It applies while the access dialog is open, even when the toast is subsequently raised as a top-layer popover. It does not change account actions, remove notification content, close the popover or permanently hide notifications outside the preview.

| File | SHA-256 |
| --- | --- |
| `desktop/src/ui/desktop.js` (unchanged from footer recheck) | `7649320a8acc3819b209807ab443338f23370f7a5868d33075699434f4bba793` |
| `desktop/src/ui/desktop.css` | `d7d28f3b279e5f69d510fe270ca543c731c5f0ed526bace5ac261e05a1d7916f` |
| `desktop/tests/native/access-screen.mjs` | `64addd170ac67f7a9754773c59ba46adae2e93eeea6ebd5cc78753795201e7e4` |
| Actual `desktop/generated/app.html` | `6390ee4ddbda6278dfea1d94f59cebf855cf864563f457c0da5fa54a0471bcef` |
| Reviewer-owned `desktop/reviews/native-access-toast.mjs` | `9ffea0a571b1845043f5aa5080be1611d8c5a202cfb6b5ca7d157068eae4ec00` |

These product/test/renderer hashes matched before and after the two native runs below. Both evidence records identify the same renderer. Builds were held by the coordinator for this review window.

## Independently executed evidence

`node tests/native/access-screen.mjs` completed with exit 0 at `desktop/evidence/access-screen-2026-10-02T15-47-12.352Z/`. I inspected the new assertion: it raises the existing real `#toast` using `showPopover()` and its existing visible class, waits for full opacity, then checks actual `checkVisibility()` while the access dialog remains open. It calls `hidePopover()` only after the negative-visibility oracle. This prevents a false pass caused by test cleanup hiding the toast first. The native run also passed the two-theme modal bounds, synthetic masked PIN clearing, unchanged access state, precise unconfigured online response, Back dismissal, reduced motion and Escape focus checks.

I authored and independently executed `node reviews/native-access-toast.mjs`, exit 0, evidence `desktop/evidence/independent-access-toast-2026-10-02T15-47-35.479Z/`. This probe leaves the toast popover open throughout the dismissal to distinguish conditional suppression from destruction or permanent hiding:

| Actual native observation | Access preview open | After Back and DOM-removal wait |
| --- | --- | --- |
| Toast `:popover-open` | true | true |
| Computed opacity | 1 | 1 |
| Computed visibility | hidden | visible |
| `checkVisibility()` | false | true |
| Access dialog open | true | false |

Back restored focus to Desktop options. I visually inspected `open-toast-hidden.png` and `closed-toast-restored.png`: the preview's Code card has no overlaid toast while open; the synthetic notification is visible again over the workspace afterward. The probe used only a synthetic notification and owned fixture Data; it made no project-content reads for the preview art and used no actual PIN.

The coordinator reported a meaningful failing native assertion against the old CSS before applying this correction. I did not independently rerun the old version during this task; my own earlier retained screenshot already reproduces the original overlay and this report's independent claims are the current source inspection and two current executions above.

## Limits

This closes the observed existing-toast visual issue. It does not establish that every possible future notification or other top-layer surface is suppressed. The previously checked footer and keyboard behavior are not broadened to every viewport/DPI by this small CSS recheck. The preview remains explicitly opened design-only UI with no PIN verifier, production account backend, automatic authenticated startup or locked-workspace admission. Native launcher race qualification, signed update installation and production admission remain outside this report.
