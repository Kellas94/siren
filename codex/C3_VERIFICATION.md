# C3 — image evidence verification

Status: the package was first verified on the disposable C1 baseline below, then rebased after C2 and applied by the parent review to `SIREN_v1.35.0_for_codex.html`.

## Landed

- `patches/C3_image_evidence.py` is a standalone, exact-count anchor-guarded patch. It writes to a sibling temporary file, flushes and `fsync`s it, then commits with `os.replace`.
- It adds a closed `image` workpaper block: complete PNG/JPEG data URI only, 2,097,152 decoded-byte limit, picker and clipboard paste, caption, JSON persistence/import, and printable HTML/PDF plus multipart Word output.
- External `src`, `url`, or `href` values are removed and reported as rejected items. Image revision digests use a cached fingerprint over the complete encoded payload, not a suffix.
- No Present or Map code is anchored or changed. The package subtask did not write the main file; the parent review applied it after the disposable verification.

## Verified on the current C1 baseline

Disposable target: `qa/SIREN_C3_after_C1_test.html`, copied from the real application when its SHA-256 was `09DBD7E2723E12E796A694C40871464AEB49F8C88AECAB50B30BD579E468122C`.

- Python compiled with warnings as errors; applying the patch to the disposable copy succeeded.
- `syncheck.py qa/SIREN_C3_after_C1_test.html`: one script block, 2,644,932 JavaScript characters, `node --check exit 0`.
- Reapplying to an already-patched copy stopped at an exact-count assertion (`expected one anchor, found 0`); SHA-256 before and after was identical.
- In SIREN's real Docs UI, created an Image evidence block, selected `output/logo/in-app-paper.png`, and saw the rendered preview, caption control, Replace/Remove actions, and honest metadata: `223,113 bytes`.
- After reload, SIREN's own draft recovery restored the image, filename, byte count, and caption, exercising the stored project/JSON state round-trip.
- Imported `qa/c3_external_url_import.json` through the workpaper Import UI. The report said: `external image src (offline data URI required) — 1 item arrived, 0 items kept`; the browser recorded no dynamic request for the rejected URL.
- Rendered result was visually inspected: `output/playwright/c3-after-c1-image-evidence.png`.

## Deliberately not claimed

- The HTML/Word/PDF image branches are installed and syntax-checked, and the three formats remain visible in SIREN's export dialog. This pass did not open the resulting `.doc` in desktop Word or complete a system print-to-PDF dialog.
- C2 was not present in this historical verification baseline. The parent subsequently reran the anchors on the post-C2 application before applying C3.

## Repeat

```powershell
Copy-Item -LiteralPath SIREN_v1.35.0_for_codex.html -Destination qa\SIREN_C3_test.html
& '<bundled-python>\python.exe' patches\C3_image_evidence.py qa\SIREN_C3_test.html
& '<bundled-python>\python.exe' syncheck.py qa\SIREN_C3_test.html
```
