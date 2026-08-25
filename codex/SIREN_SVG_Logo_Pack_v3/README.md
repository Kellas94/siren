# SIREN SVG identity system — v3

This is a fresh geometric reconstruction of the supplied SIREN identity board,
not a continuation of the ambiguous `legacy` / `refined` pairs in v2.

The source board is preserved byte-for-byte at
[`reference/source_board.png`](reference/source_board.png). Its SHA-256 is
`DDA97B90E1C370C38CFBD1D34FE4DC1D2FE48F1DE5FB649838D9423311E6F28D`.

## What is canonical

- `dist/01_siren_wordmark.svg` — bare product wordmark
- `dist/03_siren_hero_lockup.svg` — wordmark plus product descriptor
- `dist/05_siren_symbol.svg` — standalone square / circle / diamond symbol
- `dist/08_siren_primary_lockup.svg` — SIREN by T-Industries
- `dist/10_siren_enterprise_lockup.svg` — documentation / enterprise lockup
- `dist/12_siren_app_icon_light.svg` and `13_*_dark.svg`
- `dist/16_siren_favicon_light.svg`, `17_*_dark.svg`, and `18_*_currentcolor.svg`
- `dist/19_tindustries_corporate_mark.svg`
- `dist/24_siren_logo_system_board.svg` — vector reconstruction board

There are 24 SVG assets in total. Each production family has one authoritative
geometry, plus only the variants required for light, dark, or CSS `currentColor`
use. The full inventory, viewBoxes, minimum sizes, clear space, accessible names,
and file hashes are in [`asset_manifest.json`](asset_manifest.json).

## Reconstruction decisions

The distinctive letterforms were rebuilt as geometry:

- the `R` has no vertical stem;
- the `N` has a deliberately shortened left stem;
- the top, middle, and bottom paths of the reasoning `E` end in a square, circle,
  and diamond;
- the lower path stops before the diamond rather than touching it;
- primary line endings are flat, while only genuine curves use round joins;
- the standalone symbol, app symbol, and favicon are separate optical drawings.

The canonical ink is `#071829`, measured from the dark interiors of the supplied
raster. The board ground is `#FEFEFE`.

All visible wording in the SVGs is outlined as deterministic monoline paths.
There are no `<text>` elements, font dependencies, scripts, embedded rasters,
external references, filters, masks, or network calls.

## Accuracy and provenance

The key hero geometry is aligned to the raster at 1448 × 1086 and is within
approximately one pixel on the measured S, R, E, and N bounding boxes. The
auxiliary lettering is a deterministic reconstruction of the reference's narrow
tracked grotesk; it is not an extraction of an unavailable original font file.
See [`docs/MEASUREMENTS.md`](docs/MEASUREMENTS.md) for the source and rendered
measurements.

## Build and verification

```powershell
python generate_pack.py
python tools/validate_pack.py
node tools/render_preview.js
```

The generator is deterministic. `validate_pack.py` parses all 24 SVGs as XML,
checks the manifest hashes and matching viewBoxes, and rejects live text,
scripts, images, external references, filters, masks, and duplicate IDs.

`render_preview.js` uses a local HTTP server and Playwright. It saves visual QA
under `output/playwright/siren-logo-v3/` and fails on broken images, browser
errors, or any external request.

The final package was rendered and inspected in Chromium, Firefox, and WebKit.
Each engine loaded all 33 preview images with zero broken images, console errors,
page errors, or external requests. Engine-specific reports and screenshots sit
under the same Playwright evidence directory.

Open [`preview.html`](preview.html) through a local server to inspect the original
and reconstructed boards side by side, every asset, and the 16–128 px optical
size strip.

This package is not installed into the SIREN application automatically.
