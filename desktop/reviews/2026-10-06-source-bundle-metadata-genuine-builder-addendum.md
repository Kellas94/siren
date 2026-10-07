# Genuine builder metadata probe addendum

Author/implementer: `/root/native_menu_trace_review`, 2026-10-06. Factual verification addendum, not independent approval of my own implementation. Earlier design, implementation and adverse evidence remain unchanged.

After root integrated `bundleMetadataHelper` before the builder's CSP generation, the **default** `node tests/native/source-bundle-metadata.mjs` completed successfully. Evidence: `evidence/source-bundle-metadata-native/2026-10-06T20-58-43.225Z/`. `prepared.json` records `ownedHelperInjection:false`; the genuine builder and exact hash-pinned entry were used without supplemental modification. All recorded source inputs remained unchanged during the run.

The same 13 actual frozen cases passed, including actual backend-exported source metadata and twelve expected refusals. Exit was 0 without timeout. All 13 owned hidden sandboxed validator windows were closed and their contents destroyed; zero windows remained. The probe process exited, and no GUI/probe remains active from this work. The actual export stayed byte-identical.

This adds evidence for builder integration and real hidden metadata transport/semantics. It does not qualify main-route import/selection, packaged application behavior, hosted CI, maximum import size or independent review. Root was still integrating main/routes. No further helper/test edits were made after this successful run; the following identities are frozen for another author's review.

```text
build/import-validation.mjs 4165c09ea6199f7a503225563f9997a163f1b46a6a6372c1d8e7683434499696
build/source-bundle-metadata.mjs 92e1af5c3e8abb5300935974629bf6faecea9ac8c89b482cf38f0f453985dbd9
tests/source-bundle-metadata.test.mjs 049f8de3cc98ffcfa2c3e57c49d0616a7ab35741b16d5f26e9a868bf3b423c6d
tests/native/source-bundle-metadata.mjs b1a20684b6476e111ffc6755ead2fa0256892a25c8a6a0cdb099fe9a2a5c4c5e
tests/native/source-bundle-metadata-app.mjs 41e6c86288aef8b009c6f684424f1f56c85b048ec359a3decbc1953b0cddff57
result.json 1fe62a901c67cb5cddd73766e2f7fb449dd16837485d658d3740418ec9068d20
native-result.json 098b918211db5958ad3a49858d48a6ee35ac5365010af6434781da8477044208
prepared.json b7cbc00c3e3088137f8a3db6d85500ce8e96c02b2c82e69ea1bb420703d007f4
```
