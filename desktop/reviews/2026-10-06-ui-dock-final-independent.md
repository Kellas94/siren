# Independent final UI/dock source and copied-package addendum

Author: `/root/workspace_surface_review`. Review date: 2026-10-06. Scope: immutable source commit `c97ce8f87ad769df8cb74203777173696195ee6a`, its frozen raw inputs, final root-owned source/native evidence, and the separately built development package below. This is a reviewer-authored addendum, not an implementer receipt or independent Electron execution.

**Verdict: no new blocking finding in this scoped lot.** The original legacy palette P2 correction is supported by source inspection and final retained captures. Completed source and package evidence supports the bounded shared chrome and Diagram attachment behavior exercised here. General UI consistency remains partial. This verdict does not admit a release, complete Task4/6, or qualify subsequent working-tree changes.

The coordinator began the next context/shelf lot after my source-byte checks completed. References to matching current raw bytes below describe that completed frozen-candidate check; they must not be carried forward to later working-tree edits. I did not edit source, tests, builds, helpers or earlier reports, and did not run Electron, build this package, execute the full suite, or execute remote CI.

## Independently performed checks

I read the source/package receipts and root evidence report, recalculated result/log/image hashes, checked recorded case outcomes and before/after input equality, read actual ASAR headers and extracted bytes, compared the expected package inventory, compared tracked Git blobs, and hashed the five actual copied archives, executables and build identities. I visually inspected all 13 final retained PNGs using the image viewer. Earlier scoped source/CSP/privacy review and independent focused unit execution remain separately attributed in the preceding reports; they are not represented as a new runtime run here.

| Reviewed document | Actual SHA-256 |
| --- | --- |
| `reviews/2026-10-05-ui-dock-root-source-receipt.json` | `d72af0ff6e9fe118922a70c116ee277f108c33a465f4d54fbabe5006a52fe9f0` |
| `reviews/2026-10-05-ui-dock-package-receipt.json` | `6dfa18b44c20b51959446a729d515f636c16114cfb41c6cd53d455e332b71d51` |
| `reviews/2026-10-05-ui-consistency-root-evidence.md` | `b7409189317aafefb66004a1f7a881bb6d9520f0298f5e0d53a4b29200c0adca` |

The original CHANGES REQUIRED foundation report remains byte-exact SHA `eee36d626c98fe9dcf2ee29de0a58a5db4a4f21aef03f9c00b6c83768584f6f3`. The separate pending-full follow-up remains byte-exact SHA `c860554cc3c53714d07514e750589b6e70145782d75f0590d6a73a714d015ee7`. Neither historical verdict was rewritten.

## Frozen source and original native evidence

The actual full-suite result at `evidence/workspace-surface/full-suite-2026-10-05T20-55-01.786Z/result.json` hashes to `e8809e5236a3eaa84cc254d56ccddee2c0089c6b29190a2213fda3e202446df0`. Its actual log hashes to `96836f9f3761ec2ac80947be2e013bf2ff497dafc9e7ed60ba60f2e421e0942b` and ends with 1055 tests/pass, zero fail/cancel/skip/todo, 184219.1295 ms. Root recorded exit 0/no signal. I checked all 423 captured raw input hashes against the before file, after map and actual frozen files; no changes were found. This is artifact qualification of root's full execution.

The native aggregate at `evidence/diagram-dock-qualification/2026-10-05T20-54-47.832Z/result.json` hashes to `933796d49aedde32585235f8e9ea593bfb83368a94aab88e7118859c31431ef0`. All seven retained child results and aggregate child logs match their declared hashes. All 36 cases record `ok: true`, each child records exit 0/no signal, and all 160 child input pairs are unchanged; captured source entries also agree with the frozen full-suite map. The aggregate has 18 unchanged input pairs.

| Root-owned original probe | Cases | Actual source fixture |
| --- | ---: | --- |
| Diagram dock | 5 | 300,000 lines |
| Diagram edit | 4 | 300,000 lines |
| Diagram Guided | 4 | 300,000 lines |
| Diagram Build | 7 | 300,000 lines |
| Diagram export | 5 | 300,000 lines |
| Workspace Code/Docs dock | 5 | Separate multi-view fixture |
| Presentation windows | 6 | 100,000 lines |

Presentation's wrapper supplied `--300k`, but its existing parser uses `--lines`; the result's `sourceFixture.lineCount` is 100000. I do not classify it as a 300k run. Standalone Guided/Build success does not prove pending Guided fields or undo history across Diagram attachment. The dock probe covers actual same renderer/frame/DOM, draft and textarea selection, zoom/theme, visible ownership, native transfer routes, explicit Fit, coordinated selected Close and all-view Lock. Presenter/Audience attachment remains outside this lot.

The earlier off-field selection, zoom, reader-refresh and shelf timing adverses remain historical adverse evidence. Final reader refresh waits for actual shelf selection, drawn ownership and focused/non-inert document before the real click; its exact version/source assertions remain. The separate event-counter diagnostic observed one click and UI version 2. This supports the final exercised route without establishing a universal cause for every earlier failure.

Selected frozen raw source hashes relevant to this addendum:

| File | SHA-256 |
| --- | --- |
| `src/ui/shared/chrome.css` | `ee31a9bab146f96cf14f575af1ecde18d1d4ddcf345448d8a1ddb45ff0038a37` |
| `src/main.mjs` | `795ad830735c0caa74807c8016d2ae870b4e6208ce327eda78697b39dfbb52c5` |
| `src/windows/factory.mjs` | `6e9ae972df36ed40c5ea0cdfd628db2dece21f7171d47684e53b9d493f82e3e3` |
| `src/windows/registry.mjs` | `23a1f81537758bbd2c08acebac118cc928e14ad187411ddac5e4e46920bdf1af` |
| `src/windows/dock-ipc.mjs` | `a84f31193088494efd4492bd1fc074c44b71e812f11ec856ebd0d8294ac74226` |
| `src/ui/windows/diagram.js` | `bacfb9915777617b14bb0f950203ec3193f3f93dde7f3f4338297f16d5612bd8` |
| `src/ui/windows/diagram-transfer.js` | `a2740f4b41d4103a2b3f4473df8eb372521a9f4458a890a1f258ba3e860f8422` |
| `tests/native/diagram-dock.mjs` | `acf44a027cdcbf535f4c95dcc1697de9ca9cc057a3c4fff9fc8609d41e2f1086` |
| `tests/native/diagram-export.mjs` | `eeec83bb9c88c316adbea5fd9a1f9868b8bdc4c660f1d96f3ba7bbc5b07691f5` |
| `tests/native/packaged.mjs` | `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24` |

## Actual package and copies

Package: `dist/development-872150ad-5313-4b5c-bef1-81c9b9ef2d96`. Its development build identity names source commit c97 and does not admit release.

- Actual `app.asar`: 53,603,420 bytes, SHA-256 `8144c19e373e915ba52b93951db8b4426ed04accec3f9e4ca64fc6edaae587a9`.
- Actual `SIREN.exe`: 245,726,208 bytes, SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`; byte-exact to the installed Electron runtime used for this package.
- Independently enumerated raw ASAR header: 243 unique files, exactly the live package collector's 243 expected paths; no extra/missing files, links or unpacked entries. All 243 extracted buffers matched actual frozen application input bytes.
- Of 95 packaged paths tracked in source commit c97, 92 matched Git blob bytes exactly. The remaining three (`src/ipc.mjs`, `src/main.mjs`, `src/preload.cjs`) differed only by CRLF versus LF. No other tracked-byte difference was found. Remaining generated/dependency files matched their actual frozen raw inputs.
- All five retained copies have exact matching archive/runtime bytes and byte-identical build identity: the three portable Unicode copies, `Pachet-Știință-SVG`, and `Pachet-Știință-Docking` under the child evidence directories below.

I checked the actual three child results/logs against the receipt, root aggregate exit observations and frozen probe inputs. Original probe hashes are unchanged; no derived assertion substitute was used.

| Root-owned copied-package output | Result SHA-256 | Outcome |
| --- | --- | --- |
| `evidence/packaged-2026-10-05T21-04-39.673Z/result.json` | `f45d56863067d5e8c748b6ff2620300580ed290e70ff87499f7ea24df7db752a` | Original portable flow completed; original probe hash exact |
| `evidence/diagram-export/2026-10-05T21-05-04.225Z/result.json` | `9550fa70272e230496c5e22afaff5ded317e3163f44a3f22e507bf4e4ae540c3` | 5 cases, 300k, 16 unchanged input pairs |
| `evidence/diagram-dock/2026-10-05T21-05-22.405Z/result.json` | `0044b70cb1351993d1e91ae9e5a71ed505c91f7e4b0a06feaac6da1f484518b1` | 5 cases, 300k, 20 unchanged input pairs |

Portable evidence includes original PIN/acknowledged save, exact saved project/hash readback, Unicode moves/relock, recovery and damaged-journal read-only behavior. This package lot has 10 native cases plus the original portable flow, not seven packaged source groups. It does not qualify launcher/apply updates, clean machines or hosted package retention.

## Final visual correction and remaining UI work

I viewed all 13 final content PNGs in `evidence/ui-consistency/final-2026-10-05T21-02-35.941Z` and independently matched every image SHA to the source receipt. Actual capture result SHA is `3f4570533063aed372bafd1a0c432da1dc4aa7cef6356f8ea25036ab0b6f4e8f`. Navy and Warm Light legacy screenshots agree with the reported actual body palette and shelf panel values. The corrected CSS maps both `:root[data-theme]` and `body[data-theme]`; the previous root-only selector finding is resolved for these shown palettes. Home and native Code/Docs/Diagram/Presenter now share a recognisable frame, font, controls and surface family. Code syntax colors remain distinct as intended.

This is a partial chrome foundation. The screenshots still show materially different context/navigation structures: Home's fresh-start hero, legacy workspace controls/footer, satellite title/status bars, and Presenter controls. The legacy dark capture is read-only at 9% diagram zoom; subsequent Navy/Warm Light captures show 47%, still not a full editor or functional parity audit. No final Audience visual was captured. Presenter content remains a saved public frame and does not dynamically inherit shell palette. These limits do not create a new blocker for the bounded lot, but prevent a claim of whole-app consistency or global theme synchronization.

The next coherent task should make current context and common controls truthful before adding further styling: show selected project context in Home, provide useful native-owned shelf identity, and distinguish actual minimized and unsaved state without inventing continuation state. Bounded literal native titles and minimized observations are a reasonable next step within the existing registry authority. Workspace may receive its authorized roster; satellite rows must remain own-ID only, and Audience must retain its public projection boundary. Titles are untrusted display text, never HTML, identifiers or write grants. Truncate long labels accessibly while preserving the existing 48px shelf geometry and native actions.

Follow that with shared command grouping and responsive overflow using existing controls/routes. Preserve Code/Docs save semantics, selected-view Close, captured caller/epoch authority, dirty/Lock barriers, same-webContents attachment, IDs, strict CSP and role privacy. Validate long names, missing/retired owners, minimized restoration, narrow viewports and zoom before removing any existing route. App-wide appearance synchronization is a separate behavior contract.

No new security/CSP/privacy or lifecycle blocker was identified by this scoped final evidence review. Physical displays/mixed DPI, screen-reader operation, comprehensive narrow/200% UI, online accounts, clean-PC deployment, permanent hosted process-identity cancellation repair, fresh hosted CI success, production admission and complete Task4/6 remain unqualified. Earlier adverse artifacts and verdicts remain unchanged.
