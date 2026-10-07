# Hosted UI personality readback — 7 October 2026

Author: `/root/catalogue_view`. Independent **read-only artifact and canonical-source review**, not independent GUI execution, a rerun, or release approval. Run `37629602152` remains **FINAL FAILURE**. Both original UI personality receipts remain **ADVERSE**.

## Finding: conflicting public-image oracle (P2)

The two failures are at `tests/native/ui-personality.mjs:83:10`. The canonical fixture captures an Audience PNG while the application is Dark, then switches to KPMG Blue. After checking the four private window palettes and the Diagram Style input, it demands that the Audience PNG data URL still equal the initial Dark PNG. Both originals contain six completed cases and five KPMG personality observations, with identical before/after maps of 29 captured input hashes. The copied receipt also records `packageUnchanged:true`.

This invariant conflicts with the implemented appearance contract and another permanent fixture in the **same canonical source**. `tests/native/workspace-appearance.mjs:69–75` requires a theme switch to rerender the current public Presenter image with a higher sequence and different PNG, while preserving the exact deck version and saved project. Its separate original development and copied receipts are both COMPLETE, nine cases each. They do not replace the failing UI personality runs.

The source path is concrete:

- Canonical `src/ui/shared/shell.js:46–58` applies the accepted named palette and dispatches `siren-appearance` to private windows.
- `src/ui/presentation/window.js:6–7` coalesces accepted Presenter appearance changes and rerenders the current slide through `navigate`. Audience does not receive this private theme control.
- Canonical `src/main.mjs:536` resolves native appearance for each public render job. Lines 1103–1107 read the native appearance store and OS mode, with the existing invalid-preference fallback.
- `src/windows/presentation.mjs:80–94` renders the same saved deck version under a newer sequence, removes private notes, and distributes the resulting public frame to its Audience windows.
- `src/ui/presentation/window.js:11–17` decodes and installs the delivered image and acknowledges that exact version/sequence. `src/windows/presentation-preload.cjs:2` and `src/ui/shared/shell.js:3` exclude Audience from the private appearance bridge/chrome.

Therefore the original inequality is consistent with intentional public theme propagation. The error alone proves unequal encoded images; it does **not** prove a visual regression, correct colour values, or eventual Presenter/Audience synchronization. There is no basis here to change production rendering merely to keep a Dark public image after choosing KPMG.

## Recommended finite fixture correction

Keep the actual controls, all named-palette metrics, imported-colour checks, minimum sizes, Studio synchronization and Lock coverage. Replace only the contradictory cross-theme PNG immutability oracle with a stronger same-frame oracle:

1. Capture the settled baseline Presenter and Audience deck version, slide ID, sequence and image, plus exact saved project/deck/source identities.
2. Change the theme through real input. Wait for the accepted Presenter palette and a newly completed public frame with a higher sequence. Wait for Audience to display that **same** deck version, slide ID and sequence; compare its full image bytes with the Presenter frame bytes.
3. Verify the source and saved project/deck are unchanged, retain strict Audience private-control absence and absence of `sirenShell`, and retain imported explicit colours. Capture full frame identities and complete images or their hashes in the receipt instead of relying on truncated assertion strings.
4. Bind the rerender observer to the intended theme, rather than accepting an unrelated in-flight frame solely because its sequence increased. Existing utility semantic colour assertions can complement this; a raw PNG difference by itself is not a theme correctness oracle.

Add the actual appearance/presentation source and helper identities to this fixture's input capture. Its present 29-item map captures generated role pages and shell output, but omits some new direct appearance/presentation source files. Keep the original failing fixture/receipts before a separate correction and rerun. This report makes no claim that a correction or new run has happened.

## Provenance and observations

The retained API tree belongs to canonical `9120b32861401b892a3e605528e68a5e351b148d`; the hosted integration commit is `411fd552b05995c00d65c97a28d2529980f91212`. Exact local Git blob objects were read using the retained tree IDs; no fetch was needed. The fixture blob `051b91fa1504a4ba9aa7e286537aadbaa3fe7286` hashes to SHA-256 `f2f285a20adb7719aabd6fe1700441b8c54226819c86a48d5e97bf41ecc83916`, exactly matching both original capture maps. Current fixture bytes differ only by CRLF. Historical main/preload/shell bytes were read from canonical blobs because later Help edits make current files unsuitable substitutes. Eleven source identities and all original PNG identities are retained in the companion JSON.

Original receipts:

- `evidence/workspace-surface/ci37629602152/desktop-packaged-evidence-original/evidence/ui-personality/2026-10-07T13-42-00.587Z/result.json`.
- `evidence/workspace-surface/ci37629602152/desktop-native-diagrams-evidence-original/evidence/ui-personality/2026-10-07T13-46-10.478Z/result.json`.
- Supporting native appearance: `desktop-native-sources-evidence-original/evidence/workspace-appearance/2026-10-07T13-45-48.267Z/result.json` under the same retained root.
- Supporting copied appearance: `desktop-packaged-evidence-original/evidence/workspace-appearance/2026-10-07T13-41-33.098Z/result.json` under the same retained root.

The original KPMG Presenter screenshot was inspected: light public canvas, green imported node, light-blue contextual node, and KPMG private chrome. The native Dark Diagram screenshot was also inspected: dark contextual node/canvas and retained green imported node. These are screenshot observations, not exact pixel measurements. The two KPMG Presenter screenshots have the same SHA-256 `f0094abac17fe4ffeba5a9188239447a12df0c456d546480fbdda535a9262be0`.

The full initial Audience PNG was not retained separately, and the assertion's actual/expected strings are each truncated. Both error messages are 20,121 bytes with two truncation markers and identical SHA-256 `b9548d02ef676f6270dd3462438ebbb35ddc7e1e20bc3e2aaa3d10f7260ae177`. No full image diff is possible from those strings. Neither failing receipt captures frame sequences at the failure. Later palette iterations and the fixture's subsequent Audience isolation, minimum-size, Studio and Lock assertions were not reached.

The copied original identifies a 54,596,310-byte ASAR, SHA-256 `2898ce1caa73472e97794eb4ffb198401ade5356ce4333b6ff3786195d271815`, and the unchanged Electron runtime. This review did not extract or execute that hosted archive. Generated output is not tracked in the canonical tree; its historical hashes come from the original receipts. Root's separate local package qualification and hosted evidence retention remain separate evidence classes.

Reviewer lookup/assembly errors are disclosed in the JSON: an unavailable local commit tree, one initially assumed receipt directory, and an object/array input-map mistake were corrected through exact blob reads, actual file discovery and map lookup. No product/test/original artifact was changed. The unrelated Diagram admission timeout was not investigated here.
