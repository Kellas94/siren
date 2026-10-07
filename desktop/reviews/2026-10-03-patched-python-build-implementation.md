# Sources Task 4 — patched Python build adapter and dependency inventory

Implemented only `build/python.mjs`, `tests/python-build.test.mjs`, and `reviews/2026-10-03-editor-product-dependencies.json`, plus this report and ignored evidence. The adapter extracts the existing frozen SIREN Python factories and exports their parser through the installed shared Lezer modules. All 15 product editor runtime packages match the retained admitted candidate's exact versions, integrity strings, MIT license bytes, and ESM/CommonJS entry bytes. No material mismatch was found.

This qualifies the pure build/parser boundary and the observed dependency identities. It does not qualify a new product bundle, package, native editor, CodeMirror language adapter, theme, input workflow, shared draft transport, or large-source performance. Earlier package passes predate this dependency installation and do not establish qualification for these new dependency identities.

## Fixed build API

`buildPatchedPython({baselinePath,outputPath})` asynchronously writes a `.mjs` module and returns frozen `{baselineSha256,factorySha256,moduleSha256,outputPath,bytes,localModules,sharedModules}`. It emits no product file automatically and exposes no CLI or runtime source loader.

The only trusted input is byte-identical frozen R78, SHA-256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`, 13,626,609 bytes. There is no caller-supplied expected-hash override. Changed or arbitrary source is refused before evaluation/emission; baseline input is capped at 32 MiB. Existing input/output aliases, including hard links, are refused so the baseline cannot be overwritten through those aliases. Output readback is verified.

The admitted candidate extracted from a parse5-normalized renderer. Normalizing baseline CRLF to LF before extraction reproduces its exact local factory bytes/hash: `c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b`. No grammar fix or table was newly authored or regenerated in this task. The four local factories are `@lezer/python`, `@siren/python/terms`, `@siren/python/tokens`, and `@siren/python/highlight`; their existence/types/count and final factory hash are checked before writing output.

Only the hash-verified literal is evaluated in a build-only empty Node VM. Its context exposes no filesystem/process/require/DOM object, dynamic string/WASM code generation is disabled, and execution has a 1,000 ms timeout. Factory bodies are serialized at extraction, not invoked there. This bounds extraction, not arbitrary future parser/analysis work.

The emitted module imports `@lezer/common`, `@lezer/lr`, and `@lezer/highlight` as actual installed shared namespaces. Its private, allowlisted local loader cannot acquire host modules. It exports `parser` and includes the existing baseline's four local parser MIT notices. Actual parser/tree `instanceof` checks and installed `highlightTree` show shared package identities, avoiding duplicate NodeProp/class instances. CodeMirror indentation/folding/language-data adaptation remains the integration owner's task.

## Grammar and TDD evidence

Applied `superpowers:test-driven-development` and its previously read good-tests guidance. Initial RED was one missing-helper assertion failure with eight dependent cases skipped, 70.4285 ms, exit 1; the complete transcript is retained. First implementation passed 9/9, 366.8459 ms. Final frozen run `node --test tests/python-build.test.mjs` passed **9/9**, zero failures/cancellations/skips/todos, exit 0, **364.7825 ms**, Node `v24.16.0`.

Tests verify deterministic emitted bytes and independently calculated SHA-256, immutable baseline bytes, malformed/changed input refusal, refusal of arbitrary caller hash override, oversized baseline refusal, hard-link alias protection, shared installed LRParser/Tree classes, and highlight properties. The output is imported from test-owned temporary paths under ignored evidence; teardown removes those paths.

Three concrete patched controls compare against the actual installed unpatched `@lezer/python` 1.1.19: an empty `Point()` class pattern, parenthesized/multiline `with` items, and formfeed indentation. Each patched parse has no error nodes while the upstream control has error nodes. Decorated async functions, typed/f-string return, multiline list/triple string input, and a malformed-function negative case are also exercised. Python remains text; no Python execution or compiler-validity claim is made.

A concrete ignored output is retained for integration review at `evidence/python-build/patched-python.mjs`: 52,426 bytes, SHA-256 `594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589`. Its receipt is `evidence/python-build/build-receipt.json`. Retaining this build artifact was not a further native or editor test.

## Installed dependencies and actual MIT notices

The product now has nine direct editor runtime imports: commands 6.11.1, lang-python 6.2.1, language 6.12.4, search 6.7.2, state 6.7.6, view 6.43.13, Lezer common 1.5.3, highlight 1.2.5, and lr 1.4.10. Their dependency closure contains six additional runtime packages: autocomplete 6.20.3, Lezer Python 1.1.19, find-cluster-break 1.0.4, crelt 1.0.7, style-mod 4.1.4, and w3c-keyname 2.2.8. The inventory derives the actual installed closure and checks exactly 15 unique runtime packages against `reviews/2026-10-03-editor-dependencies.json`.

All 15 installed package and lock versions, declared MIT licenses, lock integrity strings, actual license filename/length/SHA-256, and actual main/module entry bytes match the retained candidate. The JSON contains each actual complete MIT notice, copyright line, license hash, dependency declaration, installed manifest hash, and entry file hashes. Lock integrity equality is recorded honestly: this worker did not redownload tarballs or independently perform SRI archive verification. The installation with exact pins and `--ignore-scripts` is coordinator-reported; it was not rerun or fabricated as witnessed installation evidence here.

Build-only dependencies are recorded separately: `esbuild` 0.28.2 JS wrapper and the installed optional `@esbuild/win32-x64` 0.28.2 binary package. They are not counted among the 15 editor runtime packages. Wrapper license/entry bytes and both integrity values match the retained candidate. The binary is 11,694,592 bytes, SHA-256 `c7bee37877d0aa6a046e52783fa0a2cf1a9ce5579d68bb3083bda99d4bff18ef`, matching both the candidate bytes and the hash in esbuild's actual published package manifest. It was not executed by this worker.

The platform package declares MIT but contains no separate LICENSE file; its actual files are the manifest, README, and executable. The wrapper's actual MIT notice, Copyright (c) 2020 Evan Wallace, is retained in the inventory as the notice source. Only win32-x64 is installed here; the other 25 optional platform entries in the lock were not installed or verified. No claim is made about native bundler execution or an output containing these packages.

The existing local patched grammar is separately attributed to frozen R78 and its retained local parser MIT comment. It is not relabeled as unmodified upstream Python merely because upstream 1.1.19 remains a lang-python transitive dependency/control. Eventual bundling/redistribution must preserve both the runtime MIT notices and local grammar notices; source-comment presence here does not prove a minifier or final package retained them. The build/dependency inventory leaves that verification to the bundle/package task.

## Frozen identities and boundaries

Seventy-one source/test/baseline/package/dependency entry/license identities were captured immediately before and after the final focused run. All matched, including frozen R78. No main, preload, windows builder, renderer builder, package script, editor, current baseline, or dependency file was changed by this worker. No native process, full suite, new install, or commit was performed.

| File/artifact | SHA-256 |
| --- | --- |
| `build/python.mjs` | `5fd8ce1b2f1ec927bf343f01dde3501afbadffd4f4e9c1eb3244262c65649c77` |
| `tests/python-build.test.mjs` | `b12f8926d5914bee929eaa9b6d7202e18123b33ec6dfce5fd70e49ee742b4d75` |
| `reviews/2026-10-03-editor-product-dependencies.json` | `9789b3bb5c31d18c80ae99c8a6461c2f6db58b5f4f32dba5809dcb945fa0e291` |
| `evidence/python-build/red.log` | `384aa08935e45937ac63ce1f00d78406b3a3e978cb42257aea62a38d2ac5427a` |
| `evidence/python-build/final-green.log` | `05c590e58a134ca2a39540d9b92ef88625f97b1a7a1381ddd79c2ec8938cc8a9` |
| `evidence/python-build/final-start.json` | `f2d4690e58abbc4e7fbc87c66ecac2930e57f876fd061a46bcd468ef62a704ff` |
| `evidence/python-build/final-end.json` | `74ab643d31c872e92d6bcaac7c4b280fee1ea8041817b04d3ca63a295653e01b` |
| `evidence/python-build/build-receipt.json` | `8ea05c28c221e444182a6cdd6a88c31595685b0ad06d1c90ee0d9dc6da79e2a1` |

Source/dependency files are frozen for coordinator integration and independent review. The prior native candidate's six editing cases remain prior candidate evidence; this task does not replay them or convert them into qualification for new product packages or renderer identities.
