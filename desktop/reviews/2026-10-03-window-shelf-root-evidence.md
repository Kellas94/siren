# Native Windows library — implementer evidence

Written by the implementing coordinator on 3 October 2026, not an independent approval or release verdict.

The actual App now has a nonmodal Windows panel. It opens selected saved Docs and source-backed Code through the native window owner, lists current native windows, and offers Show/Restore, Refresh, bounded pagination and Done/Escape. Code references retain their exact selected version and hash, excluding future drafts. Doc titles are metadata; neither document content nor source text is sent to the catalogue. Pages contain at most 64 items, with a 4,096-item discovery bound and an explicit truncation notice. Only the genuine native App caller can request the catalogue; Home, satellites, forged frames and locked callers are refused. Pending catalogue reads participate in the existing drain set.

The panel follows the active theme and retains other application interaction. Native operation errors produce an honest retained-work message; they do not create a success receipt. The guide distinguishes the native readonly 300,000-line tested Code case and 32 MiB source budget from legacy editable Code limits.

## Verification

- Frozen full suite `evidence/window-shelf-suite-result.json`: **624/624**, identity 2 plus remaining 622, exit 0; no failures, skips, cancellations, todo or changed captured inputs. Started `2026-10-03T17:27:59.309Z`, finished `2026-10-03T17:31:34.045Z`; log SHA-256 `cba58bc306a6b7a7bc0328b49ea7c95e34c7c83d83ff8bb5da8399270693f977`. Focused catalogue/main/package/diagnostic checks 26/26.
- Actual production Electron probe `evidence/source-read/2026-10-03T17-28-50.910Z`: COMPLETE, six groups, captured inputs unchanged. Native clicks open two Code windows and one Docs window from the real library, list the actual windows and invoke Show. The panel is nonmodal, has no planted private document text, matches the selected theme background and passes a 4.5:1 text contrast assertion. Existing 300,000-line EOF Find/Python colouring/themes/Wrap/readonly input, exact source and document bytes, cross-role refusal and Lock checks remain intact.
- `evidence/home-entry/2026-10-03T17-30-47.123Z`: COMPLETE, six standalone Home groups, exit 0. Home remains 44,697 bytes, three scripts. Actual Python draft/checkpoint/Quit/restart regression completed at `evidence/code-recovery-2026-10-03T17-29-20.406Z`.
- Renderer build App SHA-256 `cf29756725ed004a05f99295773c4c3ad0343fb7d7e07d95f77a3275c0915b90`; Code `8d91908d41fe18f7ea552bca05cc924801b1805999ee69118ad1eaa8cef70596`; Docs `b9136def4806b51bab9be84b2ba21d98a6ace480a56b52353c0e70939984dcb6`.

## Preserved findings and scope

Catalogue tests first failed for the missing implementation; the actual-main test first refused the absent method. A fixture lacking EventEmitter methods and another assuming source-reference insertion order were corrected while retaining strict native identity and complete reference equality. The first actual six-group shelf run at `17-23-36.788Z` passed behavioral assertions but its inspected screenshot showed an unreadable Dark panel: an undefined CSS variable fell back to a light background. This visual finding is retained. The product now uses the real theme background, and the distinct `17-26-21.027Z` and final run above verify computed theme/contrast and inspected readable screenshots. The first run is not retroactively called visual success.

This is a readonly native saved-item library. Legacy inline/private editable Code remains in its existing library. Native writable saving, automatic Home routing, attach-back, Diagram/Present windows, physical monitor tests and UI minimization qualification are still open. Show uses actual native focus/restore transport; this probe does not claim a physical OS minimize-button or multi-monitor test. The schema-2 fixture currently needs the legacy primary's unreadable-data warning cancelled through real native input; production source-aware Home routing must resolve that remaining limitation. No user project was edited.

Hosted CI40 at the preceding Code/Docs commit failed in process identity startup; its package step was skipped. See `2026-10-03-ci40-startup-root-evidence.md` for retained original evidence and bounded diagnostic instrumentation. Local successes do not relabel that hosted failure. No new package execution, main merge or public release is claimed; the one-time Git graph is unchanged.

After frozen verification, trailing blank lines only were removed from desktop.js/desktop.css and the status document for a clean whitespace check. Behavioral source is unchanged; the recorded renderer and captured-input hashes above refer to the explicitly named frozen run before that formatting cleanup.
