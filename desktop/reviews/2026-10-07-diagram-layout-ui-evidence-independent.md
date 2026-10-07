# Independent review: Diagram layout UI, controller and retained evidence

Author: `/root/catalogue_view`, 2026-10-07. No product source was changed. Result: **no blocker observed in the reviewed scope; one nonblocking CI test coverage gap**. This report does not constitute independent GUI, package, hosted CI or release approval.

The reviewer executed **30/30 focused Node/VM checks**, including five independently authored cases. Real StyleView and Draft code ran in a fake DOM. The exact `onPrepare` callback was extracted from the frozen controller and executed with those real components and controlled neighboring components. This is stronger than checking the callback text, but it does not execute the complete renderer or real native Lock coordinator.

## Finding

**P3 · LAYOUT-CI-COVERAGE-01 — utility CI execution is present but its regression guard is incomplete.** `tests/diagram-layout-ci.test.mjs:5` verifies native layout controls, copied-preview execution, failure propagation and layout-native evidence. It does not require the new `diagram-layout-render.mjs` utility step or its two scoped result uploads. A read-only in-memory witness removed that step and both uploads, then executed the actual `verify` function; the mutant was accepted. The workflow itself was never edited and presently contains the correct utility step. Extend the contract and negative fixtures to protect these additions.

## UI/controller findings

`src/ui/diagram/style-view.js` uses finite choices and literal labels. Readonly, unsupported source family, source-owned layout and opaque imported preference cases disable the control with an honest explanation. Paint does not invent a saved default. The local draft still rejects attempts to overwrite opaque preference values.

In the independent invalid-input case, a pending invalid font size plus engine choice remained pending. The exact prepare callback hid/inerted the view and paused its session, then returned `GUIDED_EDIT_PENDING` without calling apply or flush. Composition similarly refused admission without discarding pending input. A changed actual draft identity refused committing old pending fields into its replacement.

A finite valid engine choice changed only the local draft. The exact prepare callback then called one save and one flush before returning ready; paused controls did not make another mutation. These are VM callback/API-spy assertions, not independent native Lock execution. Existing session/focus tests separately checked delayed render invalidation, privacy fencing, rollback and focus leases.

The controller propagates the shared prepare result's layout provenance through `onPreview` into `styleView.setTargets`. Existing Save/export guards refuse pending fields; rejected edits are not reported as saved. Main/source-opaque preservation is additionally supported by the separate finite-model review, rather than inferred solely from disabled DOM controls.

## Review of root's runtime records

These records were **authored and executed by `/root`**; the reviewer only inspected them and their scripts.

- Native run `2026-10-07T11-01-58.616Z`: `COMPLETE`, four cases, 628 captured inputs, exact before/after maps, no changed inputs. It compares five real node transforms/bounding boxes between Dagre and ELK, exact undo/redo geometry, computed imported fill, explicit save/readback, reopened preference and retirement of native windows after a clean Lock. These are actual assertions rather than label-only checks. The Lock case has a clean saved project; invalid pending/native IME Lock behavior is not measured there.
- Original native run `2026-10-07T11-01-15.468Z`: `ADVERSE`, zero completed cases, caused by recorder use of nonexistent `SVGRect.toJSON`. The original result and harness hash remain retained. Explicit x/y/width/height serialization replaced that recorder operation. No production fix is claimed from that failure.
- Utility run `2026-10-07T11-04-03.959Z`: `COMPLETE`, three cases, inputs unchanged, driver exit zero. Real SVG and public-slide utilities execute before the observation hook captures DOM geometry. Assertions require equal node geometry and imported fill for each selected engine, different Dagre/ELK geometry, native window/webContents destruction and frontmatter Dagre winning over an ELK preference. The image pipeline executes, but comparison is DOM geometry, **not PNG pixel parity**.
- Those two successful records are **development executions**: neither contains a package record or `packageUnchanged`. They do not establish copied-package success.
- Fresh renderer receipt `layout-renderer-0b79dd4f-5a87-4ca1-a52b-425957f28962/result.json` records 26 generated files and four changed outputs. Utility HTML hashes match retained runtime inputs. Its own limited fresh-build scope is honest; the reviewer did not rerun the build or independently compare all 26 outputs.
- The original CI local log called `diagram-layout-ci-green.txt` actually contains three passing checks and one failure. The retained original fixture still expected catalogue in two layout regexes. The corrected log records four passing checks. Both are local contract checks, not hosted CI execution.

At review capture, **18 shared native identities and nine shared utility identities matched the current inspected files**, without drift. Exact hashes and original outputs are retained in the companion JSON. New utility-family tests or later byte changes require their own qualification.

## Package and coverage boundaries

`tests/native/package-context.mjs` verifies copied app.asar, runtime binary and fixed process-reader bytes against the development-preview receipt; mismatches refuse admission. `diagram-layout.mjs` rechecks that package after execution and marks mismatches ADVERSE. `scripts/package.mjs` includes the new layout contract. This is static package-branch review; no package was run by the reviewer and archive immutability alone is not an independent source-to-package binding.

Actual geometry in the reviewed runtime records is **flowchart only**. Contract/VM support for class/state/ER/requirement does not prove registered-engine behavior or geometric change for those families. Root has identified that remaining qualification separately. Physical monitor behavior, real IME, Audience UI, PNG pixels, hosted workflow outcome and release approval remain outside this report.

Artifacts: `reviews/2026-10-07-diagram-layout-ui-independent.test.mjs` contains the five independent cases; the companion JSON contains executions, identities, root-record provenance, limitations and the real in-memory CI coverage witness. The first focused run passed 30 checks; its final fixture was subsequently strengthened from a disposal guard to an actual replacement-draft identity guard and the same total passed again. No invented adverse result or product fix is attributed to that fixture improvement.
