# Independent follow-up: CI15 maximise geometry

Scope: the actual `code-windows.mjs` failure after the successful bounded theme
readiness step in CI15, and assessment of the proposed window-state waits.
Earlier Code navigation and CI13 reports are unchanged. No product source,
frozen baseline or shared native driver was modified by the reviewer.

## Result and limits

The complete saved current Code-window probe passed independently at the exact
CI15 renderer viewport, **1008 × 655**. Its isolated owned native window was
resized to outer bounds 1024 × 720 before creating the Code window. Observed:

| State | x | y | Width | Height |
| --- | --- | --- | --- | --- |
| Initial normal | 32 | 60 | 847 | 485 |
| Maximised | 12 | 12 | 984 | 579 |

Maximise therefore increased both dimensions at this viewport. The complete
probe also passed exact original-geometry restoration, title-bar movement by
45/25 pixels, corner resizing by -100/-60 pixels, transparency input, keyboard
minimisation, two windows, tray restoration, exact Python draft retention and
the right-click menu assertion. The renderer digest remained
`a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e`.

The retained CI15 log reports the same renderer digest and a 1008 × 655
viewport. It fails the assertion that maximise grows both dimensions. The
failure diagnostic establishes that the library is hidden and the header and
workspace are not inert, but does not record Code's normal/maximised rectangles
or mode. Thus it does not identify whether the action had taken effect, whether
the initial geometry was already full size or some other state was involved.
The failure is preserved and its root cause remains unproven by this review.

## Input completion and expected-state waits

The unchanged native driver's `send()` resolves when it receives the CDP
response with the matching ID. Its `click()` first requires an actual center
hit on the target, dispatches mouse press and release, and then returns. It
contains no application-specific mode, geometry or animation completion
condition. This is a protocol acknowledgement, not an explicit assertion of
the SIREN window's final state. I did not independently reproduce a protocol
response preceding the maximise handler, so that timing interleaving is a
hypothesis rather than the diagnosed cause of CI15.

Bounded source inspection shows that the actual `maximise()` changes layout
mode, then calls `paint()` and persistence. `paint()` synchronously assigns the
rectangle's inline styles and `dataset.windowMode`. Drag/resize pointermove
handlers similarly update the layout and call `paint()`. At this viewport,
the existing clamping leaves enough room for all the test's exact movement
and resize expectations, as confirmed by the independent complete probe.

Expected-state waits are appropriate without weakening the behavior oracle:

- After one real maximise click, require `windowMode === 'maximised'` and both
  measured dimensions greater than the captured normal rectangle; retain the
  explicit growth assertion.
- After one real restore click, require `windowMode === 'normal'` and equality
  of all four rectangle fields with the captured normal geometry; retain the
  explicit exact-geometry assertion.
- After the original actual pointer drag or resize, require the exact expected
  positions/dimensions; retain the explicit numerical assertions.

A timeout must fail and report initial, last observed and target geometry,
mode, viewport, active pointer/click target if available and outstanding
animations. It must not retry the action, replace it with a DOM click, mutate
the layout, or relax the exact assertions. A real failure to transition remains
a failure. The shared `driver.click()` and intentional occlusion negative
control should remain unchanged.

The independently saved snapshot already contains the coordinator's mode waits,
exact drag/resize waits, glass-state wait and normal/maximised geometry logging.
It uses the original immediate geometry assertions after mode waits; combined
mode-plus-geometry waits described above are an assessment, not an independently
tested later source revision. This review does not qualify any subsequent CI
run or the whole release.

## Reproducible evidence and byte identities

Executed from `desktop/`:

```powershell
node evidence/reviewer-code-ci15-2026-10-02/build-probe.mjs
node evidence/reviewer-code-ci15-2026-10-02/full-small-window.mjs
```

Both exited 0. The build script saves the exact shared test source before
instrumentation, adjusts only the driver import location, inserts the
owned-PID native resize and prints actual viewport/normal/full measurements.
All original assertions and driver actions are retained. Saved source,
instrumented probe and `build-identity.json` are under
`desktop/evidence/reviewer-code-ci15-2026-10-02/`. Successful complete probe
evidence is under `desktop/evidence/code-windows-2026-10-02T14-40-34.898Z/`.

| Identity | SHA-256 |
| --- | --- |
| Saved current Code-window test source | `1b88f62ffdbb1ca4227a4f670b3b7acdb7a8e8e39c623efcb50bf02bc03cbee1` |
| Instrumented reduced-window complete probe | `5581424f53294839e181f78542fd827b25ee6bf0dac94bbeb0d24366838ff3ad` |
| Shared native driver | `0e67a2bcd752b67dff1e690dec0af31c09b07d430d054743e09a4d73a2d1c05d` |
| Loaded renderer | `a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e` |
| Retained CI15 log | `6e80b257ea519ab017b637d19f9dd81501dcd5505682752d53b71dcc9d0c7407` |

The log is
`.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/code-ci15-native-failure.log`.
Local HEAD at evidence collection was
`a92692f523e8664fab24e0862a1b7fcc5c7db006`; the hashes above identify the
specific uncommitted test snapshot inspected and executed.
