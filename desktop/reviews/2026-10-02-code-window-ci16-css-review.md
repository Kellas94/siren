# Independent follow-up: CI16 mode versus geometry

Scope: the CI16 maximise failure and the hypothesis of a theme/global CSS
geometry transition. Previous Code-window reports remain unchanged. The
reviewer did not modify product source, baseline, shared driver or shared tests.

The retained CI16 log records a 1008 × 655 viewport and identical captured
normal/maximised rectangles `{x:32,y:60,width:847,height:485}` despite the test's
successful maximised-mode wait. It still lacks the inline style, computed style
and active animation observations needed to identify why geometry had not
changed. This is stronger adverse evidence than CI15; it demonstrates why a
mode-only wait does not establish the geometry postcondition on that runner.

I inspected theme/global transition declarations and independently queried the
actual Warm Light Code root's matching CSS rules, effective computed styles,
inline styles, animations and DOM bounds at the CI viewport in owned Electron.
The complete saved CI15 probe passed again, with normal 847 × 485 and maximised
984 × 579. Before and after maximise:

- `transitionProperty: all`, but `transitionDuration: 0s` and
  `transitionDelay: 0s`; this is not an effective geometry animation.
- `animationName: none`, `animationDuration: 0s`, no active root animations.
- `transform: none`, `maxWidth: none`, `maxHeight: none`, `contain: none`;
  body transform was also `none`.
- No applicable matching rule declared a Code-root geometry transition.
- Inline style, computed dimensions and `getBoundingClientRect()` agreed in
  both states: normal `{32,60,847,485}`, maximised `{12,12,984,579}`.

The inherited/global transition hypothesis is therefore unsupported by these
local observations. They do not prove that the CI runner had the same effective
style/compositing state when it failed. The actual `paint()` assigns rectangle
styles before assigning `dataset.windowMode`; neither source ordering nor the
local observation establishes the CI cause. Do not label it diagnosed as a
CSS transition or early input acknowledgement on this evidence.

A strict bounded wait for maximised mode **and** actual width/height growth,
then the existing growth assertion, directly addresses the missing test
postcondition. Restore should wait for normal mode and equality of all four
original rectangle fields. Exact drag/resize expectations and explicit
assertions should remain. Persistent unchanged geometry must time out and fail;
no repeated clicks, forced DOM actions or relaxed geometry checks are justified.
Record inline/computed geometry, effective transition duration/delay,
transform, active animations, viewport, mode and before/last rectangles on that
timeout. A later CI result is still required to qualify the adjusted probe there.

Executed from `desktop/`:

```powershell
node evidence/reviewer-code-ci16-2026-10-02/build-css-probe.mjs
node evidence/reviewer-code-ci16-2026-10-02/css-probe.mjs
```

Both exited 0. Live CSS snapshots are
`desktop/evidence/reviewer-code-ci16-2026-10-02/normal.json` and
`maximised.json`; full successful window-probe evidence is
`desktop/evidence/code-windows-2026-10-02T14-52-38.985Z/`.
The probe derives from the earlier independently saved reduced-window probe
and adds CSS observations without changing its actions or assertions. It does
not claim to execute the subsequently revised combined-geometry wait.

| Identity | SHA-256 |
| --- | --- |
| Instrumented CSS probe | `d3f747a365eecf2c497a25a02a810c8474c64509567d60f034937624602b2eb5` |
| Loaded renderer | `a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e` |
| Retained CI16 log | `e1b0cbfe0631749542f7da606491077a2bf9798ad33c2507269d0eca6672cb2c` |

The CI16 log is
`.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/code-ci16-native-failure.log`.
This scoped diagnosis is not a release approval, a CI16 pass, or a qualification
of the whole Code feature.
