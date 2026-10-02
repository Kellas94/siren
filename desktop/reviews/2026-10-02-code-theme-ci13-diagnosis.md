# Independent follow-up: CI13 theme-option failure

Scope: diagnosis of the native `code-windows.mjs:33` Warm Light pointer failure
in CI13. This addendum leaves the original Code navigation review unchanged.
No product source, frozen baseline or shared native driver was modified by the
reviewer. Local HEAD at final identity collection was
`a92692f523e8664fab24e0862a1b7fcc5c7db006`.

## Observations and conclusion

The CI log records 83 passing unit tests, a renderer build with SHA-256
`a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e`,
and successful actual shell, protected-storage and account-transition probes.
The subsequent Code-window probe fails because the Light option's center
hit test does not return an owned element (`by undefined`). That message does
not distinguish an option outside the viewport from a hidden/zero-size option.
It supplies no menu geometry; its root cause remains unproven.

I independently ran the unchanged driver against an isolated owned Electron
process, minimised a real Python draft and resized only that process's sole
`Chrome_WidgetWin_1` window with `SetWindowPos`. Resizing did not activate or
show the hidden window. Requested outer bounds and observed renderer viewports:

| Requested bounds | Actual `innerWidth × innerHeight` | Immediate Warm Light click |
| --- | --- | --- |
| 1000 × 700 | 984 × 635 | Passed |
| 1024 × 768 | 1008 × 703 | Passed |
| 1280 × 800 | 1264 × 735 | Passed |
| 800 × 600 | 944 × 575 | Passed; native minimum constrained width |

At each size, I additionally issued 40 immediate Dark/Light selections using
`driver.click('#themeMenuButton')` followed directly by the option click, with
no intervening geometry observation or readiness wait. All 160 attempts passed.
The Python draft still matched exactly after restoration. Reduced bounds alone
therefore did not reproduce the CI failure; there was no demonstrated need to
scroll the Warm Light option at these bounds.

The baseline does have an asynchronous opening sequence: `setThemeMenuOpen`
shows the menu and positions it synchronously, then schedules another placement
and selected-option focus with `requestAnimationFrame`. CSS applies
`t-surface-drop` for 160 ms, changing opacity from 0 to 1 and translating the
menu from -5 px vertically to its final position. Live observations confirmed
that initial menu geometry was 5 px above its inline `top` value. These facts
justify synchronising the probe with readiness, but neither frame placement nor
animation has been proven to cause this CI failure.

## Recommended bounded probe change

After opening the menu, wait for it to be open and its animation complete, then
for the target option to have nonzero dimensions, an in-viewport center and
`option.contains(document.elementFromPoint(centerX,centerY))`. Use the unchanged
driver's actual pointer click afterwards. A timeout should print both menu and
option rectangles, viewport dimensions, menu hidden state, scroll position,
computed visibility/display/opacity and hit-tested element, then fail.

This readiness wait must not force a DOM click, remove covering elements,
disable animation or weaken the intentional occlusion negative control in
`desktop-ui.mjs`. If an option is genuinely below the menu's scroll boundary,
diagnose that state and use actual wheel/keyboard input before rechecking it;
the local observations here do not establish that situation. A passing CI rerun
would qualify the adjusted probe on that runner; it would not retroactively
prove which transient caused the first failure. The CI screenshot and geometry
remain useful diagnostic evidence. No probe/product repair is claimed here.

## Evidence and identities

Executed command from `desktop/`:

```powershell
node evidence/reviewer-code-theme-2026-10-02/probe.mjs
```

It exited 0. Evidence includes the probe source, `result.json`, isolated data
roots and `electron.log` under
`desktop/evidence/reviewer-code-theme-2026-10-02/`. An earlier setup attempt
found `Browser.getWindowForTarget` unavailable in Electron, and a subsequent
attempt found no `MainWindowHandle` on the hidden owned process. The final
probe resolves exactly one top-level Chrome handle by the driver's PID.

| File | SHA-256 |
| --- | --- |
| Diagnostic probe | `d068eaf5916899a1208f163ce433f7607732d42ec20f91e010ff11f309d1e6b5` |
| Diagnostic result | `1af860f2a8c8dc2db12ba13adaf1b83200b36d6d899c64ec9afbef7ddb1c838f` |
| Loaded renderer | `a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e` |
| Unchanged native driver | `0e67a2bcd752b67dff1e690dec0af31c09b07d430d054743e09a4d73a2d1c05d` |
| Original Code-window probe | `cb18c451bf41ab92535fcfdbef822dda4dd91fda76f0d052db4024b7b2c987e1` |
| CI13 log | `2f859a4e4ab708f879f066aad3789bebb66bbe682592ed5fb5eac45a83d24e7d` |

The CI log is
`.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/code-ci13-native-failure.log`.

I also inspected the separately supplied actual diagram-interaction probe and
its successful `code-diagram-2026-10-02T14-16-21.152Z/result.json`. The probe's
SHA-256 was `86c4b8db0e1cdee4c01dd9eda50a3bceeefaa5563ae2442818fd3715ad078e15`.
It performs keyboard Mermaid editing while Code is minimised, checks a visible
diagram node outside Code windows, awaits the native close/save flush, reads
exact saved Mermaid and private Python text from the project store, and restores
the Code editor with unchanged Python. This expands the supplied interaction
evidence beyond the first review's header-action/inert assertions; I did not
rerun this additional probe. It does not resolve the theme-option CI failure
or qualify the complete release.
