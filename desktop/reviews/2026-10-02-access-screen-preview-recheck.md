# Independent access-screen preview recheck — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. The original report `2026-10-02-access-screen-preview-review.md` is preserved unchanged, including its reproduced P3 finding. No product or implementation-test changes were made by this reviewer.

**Disposition: the reported footer collision is repaired in the tested viewports; the corrected native design-preview test passes. This is a scoped preview result, not authentication completion or production release admission.**

## Rechecked snapshot

| File | SHA-256 |
| --- | --- |
| `desktop/src/ui/desktop.js` | `7649320a8acc3819b209807ab443338f23370f7a5868d33075699434f4bba793` |
| `desktop/src/ui/desktop.css` | `cebf90f7e096cfdeacb45578d7caf9d19c064b3b737142d4edebe042373f9a4d` |
| `desktop/tests/native/access-screen.mjs` | `0ebd085fafe28be64d06ce7fd03530739f16b89c169525c49520f2b7de883f1b` |
| `desktop/reviews/native-access-layout.mjs` | `268032c11bae7b063f5469d25a339ace6e39798867372190655bf85abddf4abf` |
| Final stable `desktop/generated/app.html` | `a8cec03adfd82cbb14637f472cc7c28f7cfd397100bcfff794074bc8c93b196f` |

The product change moves the note into `.desktop-access-centre` and overrides its positioning to static with a top margin. It therefore participates in the scrollable form flow instead of crossing controls as an absolute viewport footer. Source inspection and native observation agree on this mechanism.

## Independent repair evidence

The first repair observation, `desktop/evidence/independent-access-layout-2026-10-02T15-38-01.971Z/`, ran against renderer `c810868f51480e9c7a7ff4a5f7abdfe23564321bd4d58bea3fd99567c44bb71d`. At the original 320×240 reproduction size the note was below the form (y≈342–370), the Unlock button was y≈167–212, and the visible button-centre hit test reached the button. I visually inspected the retained screenshot: the original footer/button collision was absent.

I repeated the same owned native probe against the final stable renderer, with matching artifact hash before and after: `desktop/evidence/independent-access-layout-2026-10-02T15-43-06.382Z/`. Settled centre opacity was 1. All eight native Tab steps stayed in the modal. None of the visible control centres was covered and no horizontal overflow was observed in the four sizes:

| CSS viewport | Dialog scroll height | Result |
| --- | --- | --- |
| 960×600 | 600 | No collision; no horizontal overflow |
| 640×360 | 423 | Scrollable; no collision or horizontal overflow |
| 480×300 | 393 | Scrollable; no collision or horizontal overflow |
| 320×240 | 370 | Original footer collision repaired |

The probe scrolls Back into view and clicks it in every size, then observes restored Desktop-options focus. Its covered-control metric only evaluates controls fully visible in the viewport; it does not treat offscreen controls as tested pointer targets. These emulated CSS sizes include values below the current 960×640 native window minimum and do not qualify every DPI/zoom configuration.

## Retained failure and corrected test

The first full native rerun after the footer repair failed at `tests/native/access-screen.mjs:44`, the immediate DOM-absence assertion after Back: `desktop/evidence/access-screen-2026-10-02T15-38-39.430Z/`. I reported that failure before any corrective rerun. The screenshot already shows the workspace without the visible modal. The production close listener removes the element during the asynchronously delivered dialog `close` event; the test could assert between `screen.close()` and that removal. The implementation owner added the same explicit DOM-removal wait already used for Escape, rather than altering the product behavior. The test also explicitly selects no-preference motion for its animated branch and tests reduced motion separately.

The corrected test passed at `desktop/evidence/access-screen-2026-10-02T15-41-45.973Z/`, but a concurrent generated-renderer rebuild occurred during that execution. Because the test reads build metadata before launching, that run alone cannot bind its loaded renderer to the recorded metadata hash. I requested a build hold and repeated verification.

The final independently executed `node tests/native/access-screen.mjs` completed with exit 0 at `desktop/evidence/access-screen-2026-10-02T15-42-34.684Z/`. It records renderer `a8cec03adfd82cbb14637f472cc7c28f7cfd397100bcfff794074bc8c93b196f`, matching before/after artifact hashes. Actual native pointer/keyboard checks passed for both themes, full viewport modal bounds, labelled text/password fields, synthetic PIN clearing after Enter, unchanged access state, precise unconfigured online status, Back dismissal, zero running animations under reduced motion, and Escape focus restoration.

## Additional observed visual finding: [P3] Workspace toast remains above the preview

In my independently retained final settled default screenshot (`desktop/evidence/independent-access-layout-2026-10-02T15-43-06.382Z/settled-default.png`), the workspace's “Full Mermaid renderer loaded.” toast is visible over the synthetic Code card at the top right of the access screen. The coordinator separately noticed the same condition. This is a small visual isolation defect for the requested calm full-page screen: a background workspace notification competes with the preview. The observed text is a renderer status message, not private project content or evidence of a locked-project read. It does not obstruct the form in the recorded default layout. Suppressing the workspace toast while this dialog is open would resolve the reported visual case; that correction is pending and is not approved by this snapshot.

## Remaining scope

The original P3 footer finding is closed only for the recorded correction and tested sizes. The additional workspace-toast visual finding remains open at this snapshot. The screen remains explicitly opened as a design preview: it does not implement a PIN verifier, backend account activation, automatic authenticated startup, or a locked-workspace access boundary. No actual PIN was read or used. Native launcher hostile-race qualification, signed updates and production admission remain outside this UI review and are not approved by it.
