# Independent patched Python build review

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Scope: `build/python.mjs`, `tests/python-build.test.mjs`, the current editor dependency inventory, and actual installed/package/lock bytes. No implementation edits, full suite, native launch, esbuild execution, packaging, or renderer integration in this review.

**Scoped verdict: approved for trusted build extraction and the inspected installed dependency inventory.** No actionable product finding was reproduced. This is not a broad editor, parser-capacity, binary-execution, license-release, native, package, or production approval. The independent reviewer owns this report and ignored controls, not the implementation/inventory.

The helper accepts only the frozen 13,626,609-byte R78 baseline with SHA-256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`, checks the 32 MiB input bound, and refuses other bytes before extraction/evaluation. It normalizes CRLF to LF, extracts the single expected factory object in a VM with string/Wasm code generation disabled and a one-second evaluation deadline, validates the exact seven factory names and four local function sources, and checks local factory SHA-256 `c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b`. The VM is a build-only extraction step on admitted bytes; this review does not present it as a general-purpose untrusted JavaScript security boundary.

The emitted module is **52,426 bytes**, SHA-256 **`594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589`**, deterministic across distinct output directories. Its only static external imports are `@lezer/common`, `@lezer/lr`, and `@lezer/highlight`; the four local Python factories retain the frozen patches. Independent import verified the parser is an instance of the installed shared `LRParser`, accepts the patched empty-class pattern, and still reports errors for malformed Python. Existing focused tests cover the other admitted local patches against actual unpatched upstream controls, async/decorated syntax, and shared highlighting properties. Parsing Python does not execute it.

The output retains the exact normalized baseline parser license notice, SHA-256 `ca6d81c3c7bea22899cd2e03a1be1455c815c7c9a604889dca1c90da351b28b1`. Independent controls verified hostile baseline content cannot execute its host marker or replace retained output, same input/output is refused without modifying the frozen input, and an existing directory cannot be used as output. The supplied focused test separately verifies hard-link input preservation. The API remains a trusted build-path writer, rather than an IPC/source-text evaluator or proof of concurrent-filesystem-race-resistant output; generated output writes are not a qualified publication transaction.

## Actual verification

`node --test tests/python-build.test.mjs` from `desktop/`: **9/9 passed**, Node exit **0**, duration **362.2454 ms**. Raw evidence: `desktop/evidence/python-build-independent-focused.log`.

The new ignored `desktop/evidence/python-build-independent-review/controls.test.mjs` initially passed **4/4**, Node exit **0**, duration **211.6467 ms**. I then added a check of esbuild's binary checksum manifest. That intermediate control incorrectly selected `.binaryHashes` rather than the manifest's literal key `['esbuild.binaryHashes']`, producing **3 pass / 1 fail**, Node exit **1**, duration **215.5623 ms**. This was my test-helper property-selection error, not a product RED or inventory failure. Its failed evidence is retained as `controls-final.log`; it has not been overwritten or relabeled.

After correcting only that selector in my ignored test, the final independent run `node --test evidence/python-build-independent-review/controls.test.mjs` passed **4/4**, Node exit **0**, duration **202.8197 ms**, raw `controls-final-verified.log`. The four controls contain the installed inventory assertions, hostile-baseline/output preservation, same-input/directory refusal, and deterministic grammar/import/license/shared-parser checks. No runtime/implementation bytes changed between the controls.

## Dependency inventory assessment

The current inventory's **9 exact direct runtime pins** resolve to the independently walked **15-package editor runtime dependency closure**. Actual installed manifests, lock versions/integrity/resolution strings, declared MIT licenses, retained notice bytes/hashes, and recorded main/module entry bytes match the inventory. Its package/lock hashes also match actual files. This compares installed identities and notices; it does not independently redownload or cryptographically verify npm tarball SRI origin, attest how installation occurred, or establish notices in a distributable.

Build dependencies are separate: `esbuild` **0.28.2** and installed optional `@esbuild/win32-x64` **0.28.2**. Their actual manifest/lock identities and retained bytes match. The installed binary is **11,694,592 bytes**, SHA-256 **`c7bee37877d0aa6a046e52783fa0a2cf1a9ce5579d68bb3083bda99d4bff18ef`**; the final control also matches it against the actual installed wrapper manifest's `esbuild.binaryHashes` entry. The binary was **not executed**. The platform package declares MIT without its own separate license file; the wrapper's actual MIT notice is recorded. Only win32-x64 is installed; 26 optional platform lock entries exist, and the other 25 platforms were not verified as installed binaries. The retained candidate inventory's file digest was independently checked; this is not a fresh remote-publisher attestation.

No claim is made that these newly installed dependencies or the generated Python module are already integrated into the live renderer/package. Root's concurrent source-reader work is outside this review.

## Final identities

| File | SHA-256 |
| --- | --- |
| `desktop/build/python.mjs` | `5fd8ce1b2f1ec927bf343f01dde3501afbadffd4f4e9c1eb3244262c65649c77` |
| `desktop/tests/python-build.test.mjs` | `b12f8926d5914bee929eaa9b6d7202e18123b33ec6dfce5fd70e49ee742b4d75` |
| `desktop/reviews/2026-10-03-editor-product-dependencies.json` | `9789b3bb5c31d18c80ae99c8a6461c2f6db58b5f4f32dba5809dcb945fa0e291` |
| `desktop/package.json` | `b88a96a244c88c369ab9934635613896008feeb4ab0165eecb604a51aaba8043` |
| `desktop/package-lock.json` | `dc3cdd517b8dd18759260f2f7cc898c74bc57a0b7151f51e5f3c55be368f3cab` |
| `desktop/evidence/python-build-independent-focused.log` | `e5811fe08d1d39c5d122edc35adafa1dc28c671b5c6851fc3cd31992ce72ceb6` |
| Final `desktop/evidence/python-build-independent-review/controls.test.mjs` | `c8ee5db18bbd32fa6a389565837b5d599de2cf377ebd40dcd6ead04ab938001b` |
| Retained initial `controls.log` | `1092c8436c4d47fcec132280c3bed1da93aafea8b64ddbf624b0ac8f758f069f` |
| Retained failed `controls-final.log` | `197f110a9d0a76faa70ff5fcae56d2c4b70a72af33366ab3b30732e6c8f46051` |
| Final `controls-final-verified.log` | `13b67ab3ba96d54eb5ab2325f74eb90d96aa193b7a88846c9594790bebab48b4` |
| `generated-receipt.json` | `fe53c6c36f299eb769ad63c7c47f9a6914908ae9a9bb544ad2a1b59661064d55` |
| Retained generated `patched.mjs` | `594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589` |

The short evidence names in the table are under `desktop/evidence/python-build-independent-review/`. Product/test/inventory/package identities above were recaptured after the final independent run and remained equal to their pre-control capture. Failed assertions and admitted scope boundaries remain explicit.
