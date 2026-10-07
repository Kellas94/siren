# Independent package byte and receipt review — stderr refusal lot

Author: `/root/workspace_surface_review`. Date: 2026-10-05. Scope: actual local development archive from committed source `de99cad7ba566ca1d3835c3d475c4544e303b1e4`, unchanged original package probes/driver, and the three completed implementer-run receipts with five actual package copies. This reviewer executed read-only byte/header/Git/receipt checks, not Electron or the native probes. No captured product/test/helper file or prior report was modified.

**Verdict: exact application archive/copy bytes and the three original local probe receipts are independently verified, within their stated scope.** This is not blanket package/release approval, a process-provider reliability guarantee, hosted package-retention qualification or Task4 completion.

## Actual archive and committed source

Package: `dist/development-e7689455-492a-4103-a0aa-a77d699f470c`. I independently hashed the actual `App/versions/0.1.0/resources/app.asar`: **53,568,726 bytes**, SHA-256 `1d0227258d98e4c1d4f3e263feb755ed3998d5f42c2c2e73eace5572f6f98fbd`. Actual SIREN.exe is **245,726,208 bytes**, SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`, exactly matching the installed original Electron executable. BUILD-IDENTITY exactly matches the retained build receipt and declares development-preview/releaseAdmitted false.

Using the actual production inventory and unchanged `collectApplicationInputs`, I independently constructed the expected file set and compared it with actual ASAR entries: **243 expected, 243 actual, 243 unique; zero extra/missing files**. I inspected the raw archive header as well as individual entry metadata: zero links/unpacked entries. Every extracted file is byte-identical to its current raw local application input. The packager hash is `6bbc5506c1161005e2c3b46c68b59ed790ee3a3f87666f22a46faeb9c696a746`.

Of the 243 application inputs, 95 are tracked at source commit de99cad7: 92 match Git blob bytes exactly. The remaining three differ only by CRLF/LF: `src/ipc.mjs`, `src/main.mjs`, `src/preload.cjs`. For these, the archive matches the actual raw working file, not the distinct Git blob bytes. The other 148 inputs are generated/dependency files outside that commit's tracked set; their actual raw bytes were independently compared with the archive. No line-ending normalization was used to claim package byte equality.

Actual/raw main SHA-256 is `ecb49919db6af95538cd52aa104d5f908310e51680df9c9b353ba98ff7232d2e`; its committed LF blob SHA-256 is `f41ca64c75fc5225117377f3827b3ec3451e17b585fd5119ee4e0ab752d7b659`. The corrected provider is included exactly with SHA-256 `1f550636541ff7eda3ebe3cb01eb2833a84303a6bae80268f990e217c50a02e9`.

My first read-only ASAR metadata lookup used slash-separated paths against the Windows API and refused a lookup. I corrected that verifier call to the API's Windows separators, then completed the entire closed-set/header/byte comparison. That was a verifier API mismatch, not a missing product file or relabeled package test outcome.

## Original oracle and copied launch

The runner directly invokes the original `packaged.mjs`, then original `diagram-export.mjs --300k --package`, then original `window-close-keys.mjs --package`. I verified those three files and the original `drive.mjs`, `condition.mjs`, `attach-page.mjs` are byte-identical to their committed de99cad7 blobs and unchanged from commit 404131. Therefore their assertions, original deadlines and native driver are preserved; no controlled derivative substitutes for these probes.

| Original input | SHA-256 |
| --- | --- |
| packaged.mjs | `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24` |
| diagram-export.mjs | `eeec83bb9c88c316adbea5fd9a1f9868b8bdc4c660f1d96f3ba7bbc5b07691f5` |
| window-close-keys.mjs | `da83f02649a4aeb08ae4c98bfa97a9b67a21cdabbea6d25da26c03768f0cd885` |
| drive.mjs | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| condition.mjs | `caa3c18db9d750d52917ec1b351b6d6b8948b1529e659842c570bcd18feda8d4` |
| attach-page.mjs | `026e108019a2560a2f79b1488f9dcefdd0c01426946cbb42424c522647124770` |

The original package options copy the package into isolated Unicode-named evidence directories, use each copy's executable and Data/selection fixture, and retain the original file/project preservation assertions. The runner hash is `5474523fc3e968601aaa9d1287e160fa126dbb6a02a033680e8dd78ca681b015`. No reviewer native execution is attributed here.

## Actual completed receipts and five copies

I directly read the actual aggregate and all three original results/logs. All three owned runner exits are zero/null signal and their original final summaries match the result paths. The copied native cases all report ok; Diagram export uses the actual 300,000-line fixture. I recomputed all 30 captured export/close input entries against current and complete before/after maps without mismatch. Original portable supplies its exact probeSha256 and completed flag, not an equivalent complete before/after input map; that schema limit is preserved.

| Actual original result | Status | Result SHA-256 | Runner log SHA-256 |
| --- | --- | --- | --- |
| packaged-2026-10-05T20-08-27.914Z | completed true | `d80de011d25400b48285e779db220cbddaa9a5af26feeb6a53818e5a9f84502b` | `fff5fcbb3510c49d3717f3e81b3bc7374e6212eccff5ddd76246b629a149f1ac` |
| diagram-export/2026-10-05T20-08-58.514Z | COMPLETE5, 300k | `7f86ec2a6d243ec8e88c53d57770e8dbf41b1eb5aadbc9387ae0666dc3d588bc` | `32ae7644c0567e944a494b94294b3fe7ef303461b8dd53479ef5e87543063c0e` |
| window-close-keys/2026-10-05T20-09-18.550Z | COMPLETE4 | `5adcb05156d0c88d435ca553b9b26881ddbc5c165580efe2658c5024c6feeb58` | `6c11f4abf0ff584fd866573023b44ac4c1603008e67a1a2593083fa60c458b86` |

I independently hashed actual archive/executable files in all five executed copies: `Mutat-Știință-2`, `Pachet-Știință-1`, `Siguranță-readonly-3`, `Pachet-Știință-SVG`, `Pachet-Știință-Comenzi`. All are ordinary files and exactly match the original archive/runtime sizes/hashes above. Every copied BUILD-IDENTITY is also exactly equal to the original build receipt with source commit de99cad7. Archive equality carries the independently verified 243-file contents to those copies; it is not a separate claim about every unrelated runtime/profile file.

The actual light/dark export PNGs are nonempty, have valid PNG signatures and hashes `640003226811f85c884349c565066d0612cc526d42a49aa114249b390764bee5` (35,603 bytes) and `da1558ad94f892d473bfed5f813f70e2b4ecc404eb9ed25e981de4002c154a28` (39,101 bytes).

Recaptured root files: package build SHA-256 `c069797fd12ab27754417f1258e444fddea525939e28bbbdb21bae969d2cab14`; byte receipt `97712d61d8a2cdca3e1a6f3f01fe0f763940ed8aae159e15ae0d6dc398aeb465`; final package receipt `59b98a77a612f8a111e1f66ba2184436f680a476ad34dd16778a015cb9bb711d`; latest aggregate `10bb8b85702fd6ecfb5b3ef18095085119b4805d4a2054e7bd3af311a3ba39a6`.

These local executions are attributed to `/root`. They do not diagnose or erase the original hosted zero-output cancellation, prove packaged fault-injection of native stderr, qualify all other native roles/flows, or demonstrate hosted package artifact retention. The separately retained hosted completion metadata records run 37364770356 FAILURE; that earlier canonical run remains adverse. Existing reports remain immutable.
