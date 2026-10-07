# Independent recheck: actual 300k-line bundle parser correction

Author/reviewer: `/root/native_menu_trace_review`, 2026-10-07. Verdict: **the demonstrated repeated-group base64 overflow is addressed at the corrected parser identity below, with canonical validation and specified integrity/budget refusals retained**. I did not author this parser correction. No product/test/generated source edits, GUI or global suite were performed for this recheck.

The original adverse report remains unchanged: `2026-10-07-source-bundle-300k-base64-adverse-reproduction.md`, SHA256 `6946278bb45a19709a49d0d186f5e8167dd03270df2df9219c6e4f0c27e055f1`. The earlier genuine 2MiB positive remains valid within its original scope. This new recheck neither deletes nor reclassifies either result.

## Source inspection and actual reproduction

Corrected `src/sources/bundle-import.mjs` SHA256 `df8c9ff13a91cbb6769dba8faa90b7512d4fd62715d26da8c88345a1e960839f` replaces only the repeated-group base64 expression/size expression with a flat invalid-alphabet scan and explicit terminal padding-placement check. Modulo-four validation, exact decode/re-encode equality and predecode source/aggregate byte budgets remain. Reference membership, full provenance equality, source hash and actual metric checks remain unchanged. No cap was widened.

My own probe requires an explicit frozen parser SHA and refuses a mismatch. It reads the exact retained parent native adverse artifact, after a16MiB file-size bound:

```text
evidence/source-bundle-import-native/2026-10-06T21-13-58.626Z/actual-export.siren-backup
SHA256 8aa3e968d9944bc8fcadd89d3c0f7c54bfa9a8334d840fbe380d27c12a09eee3
```

The corrected parser successfully admits this **9,454,085-byte** wire file and its **7,088,891-byte / 300,000-line** source. I independently decoded the original base64, matched every byte, canonical encoding, SHA256 (`59126169b62cb5d52d9e0d5fa29c600fcd3dde12c876f9f6c3aaa4e1cc515eb6`), complete reference/provenance, snapshot and parsed metadata. Actual `verifyParsedSourceBundle` also accepts the parsed result exactly. The parser and retained input file hashes are unchanged at the end.

The expanded independent run is **21 bounded cases COMPLETE, exit0**: one actual-file positive and twenty negative controls. Malformed/omitted/excess/misplaced padding, internal whitespace, junk alphabet, trailing newline and nonzero unused bits produce `BUNDLE_BASE64_INVALID`. Canonically encoded altered bytes fail source hash verification. A record's forged provenance or missing record fails exact reference validation. Forged line count and longest-line metrics fail actual-source comparison even after changing both reference copies and recomputing the actual manifest request hash. Lower wire, per-source, aggregate decoded, reference, metadata node/depth and provenance caps still refuse; expanding the configured maximum is itself refused.

## Evidence and focused tests

```text
node --max-old-space-size=192 evidence/source-bundle-copy-route-independent-2026-10-07/parser-300k-recheck.mjs --parser-sha=df8c9ff13a91cbb6769dba8faa90b7512d4fd62715d26da8c88345a1e960839f

evidence/source-bundle-copy-route-independent-2026-10-07/parser-300k-recheck.mjs
SHA256 cdcd312775d6476940d3c5b77ccc573e3dc176ec5d47d8a30c8b30cff306aa98
evidence/source-bundle-copy-route-independent-2026-10-07/parser-recheck-2026-10-06T21-20-22.275Z/result.json
SHA256 067adc201354772a3af352a719e9bcbdc4088647b2331b02206edb82f7ee9003
```

The first19-case corrected probe at `parser-recheck-2026-10-06T21-20-05.428Z/` is retained; the later21-case run adds the explicit forged-metric controls and is the complete scope claimed here.

I also ran the existing focused file, `node --test tests/source-bundle-import.test.mjs`: **12/12 pass, exit0**, including actual backend-emitted300k Unicode export, earlier2MiB control, empty/one/two/no-padding valid shapes and invalid canonical padding cases. Inspected test SHA256 `e63946a634e2444b40e9e0afb17ecf6a121cd74305c55315560bc59b92a3d8d2`. These author tests supplement the independent exact-retained-file probe; they do not substitute for it.

## Limits

This proves the specified parser correction on the exact previously failing artifact and listed controls. It does not qualify the full64MiB wire/32MiB source/256MiB aggregate maximum, native Home/Code/Docs import, restart, packaging or CI. Root owns separate actual-native qualification. The192MiB option limits V8 old-space, not process RSS; recorded end-of-probe RSS/heap are observations, not parser peak measurements or application capacity guarantees. No new actionable finding in this corrected parser boundary.
