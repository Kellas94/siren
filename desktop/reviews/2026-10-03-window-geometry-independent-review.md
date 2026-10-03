# Independent review: data-only window geometry

Reviewer: `/root/terminal_contract`, 3 October 2026. This reviewer did not author or edit `desktop/src/windows/geometry.mjs` or `desktop/tests/window-geometry.test.mjs`. Scope is their actual bytes, the native-workspaces geometry requirement, this report and ignored review evidence. No product edit, commit, full-suite rerun, native Electron experiment or physical monitor test occurred.

**Result: no blocking finding in the reviewed data-only logic.** The focused suite passed 15/15. Independent checks passed 12/12 groups, including 5,000 generated fractional/disconnected layouts, with source/test hashes unchanged across that run. This qualifies the function's tested arithmetic and malformed-data behavior; it does not admit native multi-window or monitor behavior.

## Reviewed identities and evidence

| File | SHA256 of reviewed bytes |
| --- | --- |
| `desktop/src/windows/geometry.mjs` | `ec4d3f778df89df18db214178ba00690a713714cb3d8937361901d755dbe8333` |
| `desktop/tests/window-geometry.test.mjs` | `05c89f8e8778abb98c96a92e3f2ee4c29866109ce25dbb950ea1b4b7d8e99820` |

Focused command: `node --test tests/window-geometry.test.mjs`, cwd `desktop`; actual result **15 tests, 15 pass, 0 fail/cancel/skip/todo**, exit 0, **70.9607 ms**. Output is tool chunk `5b6a82`; no separate focused redirected log was captured. The first read captured the same hashes as the later independent run.

Independent script: ignored `desktop/evidence/window-geometry-independent-review/review.mjs`; result: `review-result.json`. Command: `node evidence/window-geometry-independent-review/review.mjs`, cwd `desktop`, local **Node v24.16.0**. Recorded interval `2026-10-02T23:03:33.522Z` to `2026-10-02T23:03:33.553Z`; output tool chunk `a7b078`; exit 0. Its actual start/end file hashes match the table. No whole-repository immutable snapshot or author RED evidence is asserted by this review.

## Behavior reviewed

The implementation keeps workArea inputs in DIP, preserves valid negative coordinates, rounds fractional workAreas inward, selects largest current overlap and uses the saved display hint only to break a tie or rehome a wholly offscreen rectangle. It caps saved/default dimensions to the selected current workArea and clamps the entire normal rectangle inside it. A missing/invalid saved rectangle uses centered defaults; no usable current display throws `RangeError` with `NO_USABLE_DISPLAY`. Maximized/fullscreen use literal booleans and retain separately usable normal bounds.

The output is a fresh object containing only normal bounds, display ID and literal state flags. The code reads own data descriptors rather than executing getters or numeric coercion; unrelated draft/source content is not copied. Native caller/display authority remains outside this pure function.

Author tests cover overlap/ties, left-side monitors, scale-factor metadata, removed displays, taskbar/resolution changes, tiny areas, malformed values, fractional coordinates, flags, input immutability and 500 generated states. Independent assertions added separately expected negative-display defaults; missing/non-array display lists; malformed types in each of four saved fields (including symbol, bigint and coercion traps); inherited properties; throwing accessors; negative x/y with scale metadata; stale versus usable hints; invalid IDs/sub-DIP workAreas; flags and absence of private data; frozen inputs; and 5,000 generated layouts verified against the original selected workArea coordinates. All checks passed.

## Limits and integration obligations

The tested contract is ordinary data snapshots and current display arrays, not a general sandbox for hostile JavaScript proxies/iterators or an unbounded attacker-supplied monitor list. Current displays must come from native screen authority; geometry must not grant renderer-supplied display objects any authority.

The [native-workspaces design](../../docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md) also requires startup/display-removed/metrics-changed wiring, real BrowserWindow normal/maximized/fullscreen restoration, titlebar reachability, independent layout persistence and actual mixed-DPI disconnect/reconnect/restart tests. The mathematical suite's `scaleFactor` metadata cases establish that this helper does not multiply DIP coordinates; they do not exercise Electron's coordinate conversion or an actual display scale. Physical multi-monitor behavior, event ordering, state restoration and native persistence remain unqualified by this report. There are no requested code changes from this review.
