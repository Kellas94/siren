# Window geometry implementation — 2026-10-03

Author: `/root/source_authority_review` (geometry implementer for this assignment).

Status: pure geometry implementation complete; focused tests pass. Independent review is assigned to `/root` and is not authored or approved by this report. NativeWorkspaces Task 6 as a whole remains incomplete. No physical multiple-monitor, native-window, package, or integration qualification is claimed.

## Authority and scope

Implemented the scoped `restoreBounds` contract from Task 6 of `docs/superpowers/plans/2026-10-02-siren-native-workspaces.md` and the geometry requirements in `docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md`.

Only these files were authored in this assignment:

- `desktop/src/windows/geometry.mjs`
- `desktop/tests/window-geometry.test.mjs`
- This implementation report.

No main/UI/registry/native dependencies, source/content persistence, commits, or full-suite runs were added. The parent explicitly authorized this pure core subset and reserved integration, independent review, full-suite and native qualification. That scope takes precedence over the executing-plans/TDD skills' general commit/full-suite instructions. This report is the scoped execution ledger. The executing-plans, test-driven-development and verification-before-completion skills were read and used.

## Concrete API

```js
restoreBounds(
  { normalBounds: { x, y, width, height }, displayId, maximized, fullscreen },
  [{ id, workArea: { x, y, width, height }, primary? }]
)
// => { normalBounds: { x, y, width, height }, displayId, maximized, fullscreen }
```

All rectangles use DIP. `scaleFactor` is deliberately irrelevant because the supplied current `workArea` is already DIP. The helper has no imports or mutable global state, creates a fresh normal-bounds rectangle, and returns only geometry and literal boolean state flags. It ignores unrelated fields such as source text, drafts, roles, and content. The future caller must keep persisted layout outside project/content snapshots.

Current display records require a safe-integer ID or a nonempty string ID of at most 128 characters; matching is exact and does not coerce types. Invalid display rectangles/IDs are excluded. Optional `primary: true` marks the fallback display; if the caller does not supply this annotation, the first usable display is the fallback. The helper does not discover displays or infer which display is primary.

The display with the largest positive intersection with valid saved normal bounds wins. The stored display ID breaks equal-overlap ties, followed by primary/first. If there is no overlap, or the saved rectangle is malformed, the existing ID hint selects a usable display, followed by primary/first. Thus a stale ID cannot pull an otherwise reachable rectangle onto a different monitor.

Saved rectangles require finite numeric coordinates and positive dimensions, with safe numeric edges. They round to integer DIP; positive sub-DIP dimensions round up to one DIP. Current fractional workAreas round inward to their integer interior. Malformed stored bounds use a centered 960×640 rectangle capped to the selected workArea. Coordinates may be negative. Accessor values and coercible objects are rejected rather than invoked as numeric fields.

The restored normal rectangle fits wholly inside the selected workArea, shrinking oversized dimensions and clamping coordinates. This is stronger than the requested titlebar intersection and deliberately repositions windows that span multiple monitors into one display. Tiny workAreas take precedence over any invented minimum size. A workArea with no positive integer interior is unusable. No usable current display throws `RangeError` with `code === 'NO_USABLE_DISPLAY'`; no virtual monitor is invented. Literal `true` maximized/fullscreen flags survive independently of the recovered normal rectangle. The caller applies the normal rectangle before any native maximize/fullscreen operation.

## Actual TDD and verification evidence

Commands ran in `C:/Claude/SIREN_WORK/portable/desktop`, using the available Node v24.16.0:

```text
node --test tests/window-geometry.test.mjs
```

| Run | Actual outcome | Interpretation |
| --- | --- | --- |
| Initial tests before geometry.mjs existed | Exit 1; 13 tests, 0 pass, 13 fail, 0 skipped | Each test reached an assertion: `restoreBounds must implement the geometry contract`; actual `undefined`, expected `function`. The missing-module loader error was converted into an explicit feature assertion. |
| Initial implementation | Exit 0; 13 tests, 13 pass, 0 fail | Literal geometry examples passed. |
| New hostile numeric regression before its fix | Exit 1; 14 tests, 13 pass, 1 fail | `malformed numeric fields cannot execute coercion or accessor code`: actual `TypeError: Cannot convert a Symbol value to a number` in `rectangle`, where arithmetic preceded the primitive-number check. |
| Pre-arithmetic type validation fix | Exit 0; 14 tests, 14 pass, 0 fail | Malformed numeric values now fall back safely, without numeric coercion/accessor execution. |
| Final focused verification after adding broad containment coverage | Exit 0; 15 tests, 15 pass, 0 fail, 0 skipped/cancelled/todo; duration 69.4616 ms | Includes 500 deterministic varied layouts and all literal/regression tests. |

The 500-layout test checks independent containment inequalities, a positive visible top strip, preservation of max/full flags, and unchanged input snapshots. It does not reproduce the implementation's clamp calculation as its expected-value oracle. The explicit examples assert literal restored rectangles and selected display IDs.

| Required pure behavior | Test coverage |
| --- | --- |
| Negative monitor coordinates | Reachable left-of-origin rectangle preserved; removed monitor rehomed; offscreen bounds restored to an existing negative-origin display. |
| 100/150/200% scaling | Same DIP rectangle with scaleFactor 1, 1.5 and 2; varied-layout invariant coverage. |
| Removed displays and stale IDs | Current overlap beats stale hint; overlap ties; removed-ID primary fallback; existing hint offscreen fallback. |
| WorkArea/taskbar/resolution changes | Positive top/left taskbar offsets; old oversized bounds shrunk; bottom/right positions clamped. |
| Tiny workAreas | Default and huge remembered bounds fit a 9×3 DIP area; varied areas down to one DIP. |
| Malformed bounds/displays | Missing/null/array/incomplete rectangle; NaN/infinity/zero/negative/string dimensions; unsafe edge; Symbol/coercible/accessor fields; excluded invalid displays; explicit no-display failure. |
| Max/fullscreen normal restoration | Offscreen normal rectangle recovered while both literal true flags survive; nonboolean flags become false. |
| Content/draft unaffected | Frozen layout/display inputs, unrelated throwing sourceText getter, retained draft content, exact return allowlist, fresh output rectangle. |

`git diff --check -- desktop/src/windows/geometry.mjs desktop/tests/window-geometry.test.mjs` returned exit 0, but both files were untracked at that point, so this command is not presented as verification of their added contents. The runtime source was read after the final tests. Runtime/test hashes were captured after that execution; neither file changed afterward.

## Final reviewed-source candidates

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/geometry.mjs` | `ec4d3f778df89df18db214178ba00690a713714cb3d8937361901d755dbe8333` |
| `desktop/tests/window-geometry.test.mjs` | `05c89f8e8778abb98c96a92e3f2ee4c29866109ce25dbb950ea1b4b7d8e99820` |

## Remaining qualification boundaries

No screen-event integration, settings persistence, rememberBounds/recoverVisibleWindows, Move to monitor/Bring all windows back UI, or native calls are implemented here. The helper only produces a recovery candidate from supplied current displays. A native caller must supply current workAreas/primary annotation and handle no-display failure, apply normal bounds before restored state, and revalidate actual bounds after any native constraints. This helper cannot guarantee full native controls fit an impossibly small workArea or override a BrowserWindow minimum size.

No hardware availability was inspected and no physical movement/unplug/mixed-DPI/fullscreen experiment ran. Physical multiple-monitor qualification remains explicitly unqualified. No full-suite/build/package/native integration approval follows from these 15 pure tests. Independent review and admission belong to the parent task.
