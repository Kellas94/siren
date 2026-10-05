# Independent narrow review — corrected shelf development package and probe adapters

Author: Codex independent reviewer `/root/workspace_surface_review`, separate from implementer/package/native execution author `/root`.

Date: 2026-10-05. Observed HEAD/package source: `3ea917dfa22315515196fb958364439b0c37c2a8`. Scope: actual new ASAR regular-file set and bytes, executable identity, docking-adapter equivalence, and compact-analysis instrumentation against the unchanged original oracle/helpers. **No actionable finding identified in these checks.** Native receipts are qualified separately below; this is not hosted recovery, full Task 4 or release approval.

I independently executed read-only Node checks and inspected source/artifacts. I did not launch Electron, execute native probes, build packages, run broad tests, edit product/tests/helpers/evidence scripts, alter earlier reports, or commit. Only this new report was written.

## Exact inspected hashes

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`; SHA-256.

| File | Hash |
| --- | --- |
| `src/ui/windows/shelf.css` | `cda1428a6a6a8b616ef1ff8b7f994d35a2674d937e5e1d02d6269a87b69e3ec3` |
| Original `tests/native/workspace-dock.mjs` | `5e964ce133db3a321998134fcf48dcf958a82d71259a473cdf1be09e88ce3ce6` |
| Original `tests/native/source-analysis.mjs` | `29a5d05d7cc702b240f4a67caa4195310766dcc57c8dee2bbd68f124be5b47b5` |
| `tests/native/drive.mjs` | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| `tests/native/attach-page.mjs` | `026e108019a2560a2f79b1488f9dcefdd0c01426946cbb42424c522647124770` |
| `tests/native/condition.mjs` | `caa3c18db9d750d52917ec1b351b6d6b8948b1529e659842c570bcd18feda8d4` |
| Previously reviewed `evidence/workspace-dock/packaged-probe.mjs` | `001374e33b12072d9de9db53e63c6f1cc610cec488c630965474675a8ed4df7d` |
| `evidence/workspace-dock/scroll-packaged-dock.mjs` | `36cbb9c6058691f84283c2bd028da9d7db96e8d2c1e07a762d5532e9394ea62b` |
| `evidence/workspace-dock/compact-analysis.mjs` | `501b94d76d5cc549cb8b92702047c4dd337bf1279a3b44b9c085cd93a54cd2c7` |
| `evidence/workspace-dock/prepare-scroll-package-probes.mjs` | `345d728b2a06f25c5e24f95a4570dc0779614c5527488ac6faeebba1a6cc341e` |
| `evidence/workspace-dock/prepare-compact-analysis.mjs` | `b9dedbef9fb0b5e10c7a996ae0ac3dc4335811b10eb2c3f02c140371765b8b16` |
| `evidence/workspace-dock/scroll-package-build.json` | `51e0369276566b7be8956ea8c8a2d6062457c6a212b0fe5ec41f35f8bbd12db5` |
| `evidence/workspace-dock/scroll-package-byte-receipt.json` | `f8ac6d77770e5c908f4ec71b3c7574cf84e342647f04a5adcff1aa7d120feb93` |
| `evidence/workspace-dock/run-scroll-package-probes.mjs` | `30b37e61bcdd014c16f694015a847a78969fdfe56ee1798a9c21e236a4d248c9` |

## Independent checks executed

A read-only Node checker asserted the old docking adapter's exact previously reviewed SHA-256, then compared the entire new adapter against the old text after just two literal substitutions: the build receipt path and the probe self-capture path. Exact equality passed. The original docking assertions, fixtures, native commands, save/Lock cleanup, driver, deadlines, copied executable/Data/selection route and package-integrity refusal are unchanged. The generator's docking branch uses unrestricted replaceAll rather than an occurrence guard; the exact generated-output comparison above confirms the actual output on these captured inputs. No unsupported future-source resilience is inferred from that generator.

The same checker asserted the original source-analysis oracle SHA-256, applied only the four permitted source edits, then compared its complete expected text against the actual compact adapter. Each edit required exactly one source occurrence. Exact equality passed. The edits redirect the two helper imports, add the adapter's path to capture, and insert one command immediately after owned production PIN unlock:

```js
await driver.send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 500, deviceScaleFactor: 1, mobile: false
});
```

There are no other source-text differences. The original bounded-prefix coverage, exact immutable selected range/navigation, Cancel/stale-row, Light/Dark and final running-analysis/common-Lock/null-snapshot/no-satellites/exact-source/project assertions remain intact. The original packaged copy/executable/Data/selection implementation is also retained. The shared driver and satellite helper have their same reviewed hashes; actual nearest-scroll/hit-test refusal and pointer dispatch remain unchanged. Existing 30-second startup/UI and 20-second CDP deadlines are unchanged; the added viewport command uses the existing CDP deadline. This instruments a compact Home CSS viewport and does not represent a physical display or uninstrumented launch.

The checker independently read the new build identity and inventory, asserted equality of `BUILD-IDENTITY.json` with the build receipt and its exact commit/release flag, enumerated application inputs using the existing collector without invoking a builder, and extracted every actual ASAR file for Buffer comparison. All **243 files** matched current application bytes. A separate ASAR list/stat comparison established that its entire regular-file set is exactly those 243 paths, with no extra regular files. Archive/executable byte lengths and hashes matched the receipt; executable hash also matched the original Electron executable. The checker exited 0.

Package root: `C:/Claude/SIREN_WORK/portable/desktop/dist/development-768f3903-66df-4449-8466-be4bc848d75a`.

| Object | Bytes | SHA-256 |
| --- | --- | --- |
| New actual `app.asar` | 53566167 | `6be88008dc0765e62d58950805e11b16ba198089492d0af594694de8d73221e6` |
| Actual `SIREN.exe` / original Electron executable | 245726208 | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

## Root-owned native receipts and limits

The root-owned sequential runner closed with eight exits 0. I inspected the final exact receipt `reviews/2026-10-05-workspace-shelf-scroll-package-receipt.json`, SHA-256 `1b5c63178d7d8616f79ebf33c0beedf7a28a11e51528614c0e65c0a86af7fe75`, and independently checked every original result hash and every runner log hash against it. For all seven results with input/after maps, all captured hashes match both after and actual current files. I independently rehashed archive and executable in all **ten actual copies** listed by the receipt; all match the package identities above. This integrity checker exited 0. No native execution is attributed to this reviewer.

| Root-owned group/result location under `desktop/evidence` | Observed result | Result JSON SHA-256 |
| --- | --- | --- |
| `workspace-dock/2026-10-05T18-14-57.377Z` | COMPLETE 5; 22 unchanged inputs | `a216ebde28882319fa63a8a169c12e15e46b087128e69b1506053019ae8924f2` |
| `window-focus/2026-10-05T18-15-14.263Z` | COMPLETE 9; 13 unchanged inputs | `47f892a2d206fae85956b9b28791dfef7fba75c7dcc839e1628e800d3c78f84a` |
| `docs-edit/2026-10-05T18-15-28.865Z` | COMPLETE 4; 28 unchanged inputs | `134676d1ef2c320e62448d0f4c7d88c44852b852f758cc96abccd2e27dc129b6` |
| `source-edit/2026-10-05T18-15-57.756Z` | COMPLETE 4; 16 unchanged inputs | `e4766a4daabd41ae8846b96f3ef94ce8543b70aab1266d41b70769cbf299638b` |
| `monitor-memory/2026-10-05T18-16-16.974Z` | COMPLETE 3; 7 unchanged inputs | `7f70e0a2d3ad0e1e970b74b18560eef160952c082b20d76244c45a8e11477c26` |
| Original `source-analysis/2026-10-05T18-16-31.925Z` | COMPLETE 4; 300000 lines; 21 unchanged inputs | `73ec8178d6a63beac1be62cf45333a2f9766173c610e14571801771efd897e26` |
| Compact `source-analysis/2026-10-05T18-16-47.486Z` | COMPLETE 4; 300000 lines; 22 unchanged inputs | `a73b2a96b2b027e982833c6d8dfe694791a705b2462726e0f69aa611d72ecbbe` |
| `packaged-2026-10-05T18-17-03.104Z` | `completed:true`; exit 0 | `b2955a2ba84e740eb1ff1b1086a3b5e82e999269a279500ea3308d9c611d6f9a` |

The original and compact analysis receipts contain identical four case names, all `ok:true`, with `inputsUnchanged:true` and `packageUnchanged:true`. Both now complete the original common-Lock case checking genuine worker exit and exact complete project/source preservation; the compact adapter additionally operates its instrumented Home viewport as verified above. The original portable result has no input/after map; I do not claim such a check for it. Its captured probe SHA-256 `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24` matches the unchanged original probe, and its three listed Unicode-path copies were included in the ten copy-integrity checks. Wider oracle implementations of the other groups were not re-reviewed exhaustively here; their behavioral scope remains that of the root-owned observed cases.

All 14 file hash rows above matched at finalization. The six earlier reports by this reviewer were rehashed and are unchanged, including the initial integration adverse report and separate shelf source review. No pending run is described as complete.

The original hosted `37352432832` failures remain failures. Prior positive tests on the previous CSS/package are historical. The separate controlled shelf review preserves its RED/RED/GREEN evidence and unchanged original hit-test oracle; this report extends only adapter/byte checks and the expressly inspected final receipts. It does not silently convert the old hosted failure, or the unrelated old window-shells adverse, into a PASS.

Build identity retains `releaseAdmitted:false` and inventory/launcher/account/update qualifications false. The review does not qualify every Electron support file/license, general portability/security, clean-PC/online-account/launcher behavior, all viewports/zoom/DPI/hotplug, the entire Task 4, hosted CI recovery, or production release. Evidence and this scoped verdict are not user release approval. Earlier reports remain separate.
