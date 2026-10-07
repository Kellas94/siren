# Scoped independent review: source-bundle admission and metadata helper

Author: `/root/media_batch_review`, 2026-10-07. This report reviews other authors' working-tree admission/transport/helper changes. I authored the parser/copy primitives used by admission; this report is **not independent approval of those primitives**, nor release, package, CI, main-route or catalog approval. I changed no product, root tests, generated assets or baseline. No GUI or global suite was run.

## Scope and identities

Repository HEAD observed: `f11d0eacb0352a7a3695b13ff2452dbbd15ae788`. The four reviewed files were unchanged between this review's source read/test execution and final hash capture:

```text
src/projects/import-admission.mjs 13131f80a2a7cc96a15e683256c0df6631d045cac9b5702ba4672a35290ff491
src/projects/import-validation.mjs 26357fef8d66ded37b4a3153e3ee5b6a556fff316ca60bd698ba46165adb1dfd
src/projects/import-validator-window.mjs 648787b9fb5d9d5a17badf93ce6afad6c59218832644cf11691c2c98da4a4987
build/source-bundle-metadata.mjs 92e1af5c3e8abb5300935974629bf6faecea9ac8c89b482cf38f0f453985dbd9
tests/source-bundle-import-admission.test.mjs bbe12c9961be8713824dc56d797a444c5e4da6c2f58d0917ba0329eec71cb40c
tests/import-validator-window.test.mjs a709e5f460fb9101a8a9e0af0df78aebd2c116ac95d5d4cf5a3cf7aff3fc7942
tests/source-bundle-metadata.test.mjs 049f8de3cc98ffcfa2c3e57c49d0616a7ab35741b16d5f26e9a868bf3b423c6d
baseline/R78.html 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4
```

Main, catalog, navigation/build integration were still being integrated and are outside this snapshot. I read the amendment plan, helper implementation/design/genuine-builder reports, and retained native evidence. None is treated as independent approval merely because it exists.

## Finding: valid backend Code-only bundle is refused by inherited diagram requirement

**P2, compatibility boundary gap.** `build/source-bundle-metadata.mjs:155` unconditionally calls the frozen `validatePortableProjectForImport` with the linked-source projection. That calls `validatePortableProject`, whose guard at `baseline/R78.html:94739` refuses any empty diagram array. A schema-2 source manifest can be saved, reopened and genuinely exported with `diagrams:[]`, workpapers empty and Code source pointers. Indeed, root's own real-export admission fixture at `tests/source-bundle-import-admission.test.mjs:16` uses this shape, but substitutes a successful mocked semantic helper.

My independent 3,014-byte real backend export contains two Code sources totaling 31 bytes, opaque prototype-named data and a draft/base pointer. `ProjectStore`, `SourceRepository`, `commitManifest`, readback and `exportSourceSnapshot` accepted it. Running the actual helper against the **exact extracted frozen project-validator function bodies** rejected its metadata with `The project contains no diagrams. The current workspace was not changed.` Adding a valid starter diagram passes a positive control. The rejection precedes the dependencies stubbed for this bounded VM probe, so neither mocked Mermaid parsing nor downstream document preparation causes this adverse observation.

This proves backend export/helper incompatibility. I did not prove that the current main/UI can create an empty-diagram project; do not advertise a demonstrated user-UI regression beyond that boundary. Root confirmed in review coordination that native source workspaces **must** import with zero diagrams while retaining exact pointers/data; this is a compatibility requirement, not a requested loosening of Mermaid or Docs validation. The source-aware helper needs a narrow empty-diagram-aware validation path that still validates Docs/Code and versions without inventing a diagram or weakening the legacy import door. A genuine helper regression should include Code-only and Docs-only source exports. Existing native 13-case evidence covers a starter diagram and does not settle this case.

## Actual verification and observations

- Independently executed root admission/native-window tests: **11/11**, Node24.16.0, exit0. These use real bounded source/export fixtures and mocked native-window/semantic replies; they are not native Electron execution. Existing timeout tests prove deadline refusal and owned fake-window teardown, late replies ignored, shared busy fencing and literal argument encoding.
- Independently executed helper unit tests: **9/9**, exit0. Their frozen sanitizers are deliberately mocked. Prototype-named opaque keys survive as data, explicit known field/array loss refuses, source placeholders remain only in the validation projection, originals are used for file-claim stamps, state context restores on rejection and overlapping calls refuse.
- Own expanded probe: **12 expected observations**, exit0; one observation is the adverse compatibility finding, not a successful import. Real export metadata only reaches admission's semantic method; actual source/base64 bytes are not transported. Unknown metadata/prototype names remain data without polluting the host object prototype. Source-bearing entity reorder, deletion, substitution by another **valid** bundle source, and valid `baseSourceRef` substitution all refuse after semantic reply.
- Own admission probe observes access false after validation, then raw access true again during disposal: admission still returns `ACCESS_REFUSED`. A successful semantic reply with failed disposal returns `IMPORT_DISPOSAL_FAILED`; no admitted object is published. Project enumeration and original emitted bytes stay unchanged.
- Own helper probes with deliberately transforming preparation dependencies refuse an explicit boolean-to-number conversion and unsafe-HTML removal rather than returning unsanitized original metadata as accepted. These test the comparison contract, not a new real-browser sanitizer execution.
- Own fake-native probe replaces `mainFrame` at the same owned URL **while metadata JavaScript is pending**: the reply refuses with `IMPORT_ENTRY_REFUSED`, and the owned fake window is destroyed. This extends the pre-call frame replacement check with an after-await observation.

The helper intentionally ignores the full-project validator's return value, but the inspected frozen validator returns the same original payload after checking it; I found no demonstrated result-discard defect there. Original metadata is retained while detached known-field projections are compared with actual sanitizer results. Optional unknown data remains opaque and must not be described as validated operational semantics or authenticated author identity.

## Native evidence read, not executed by this reviewer

I inspected sibling `/root/native_menu_trace_review`'s `evidence/source-bundle-metadata-native/2026-10-06T20-58-43.225Z/{prepared.json,result.json,native-result.json}` and its genuine-builder addendum. It records `ownedHelperInjection:false`, 13 completed cases, unchanged inputs, no timeout, and 13 hidden sandboxed validator windows closed with contents destroyed. The actual case is a native backend-exported starter-diagram workspace with sparse Docs, public tables/title/text, linked current/revision/release sources, drafts and file claims; twelve refusal cases include unsafe Docs/Present HTML, truncation, unknown block kind, dropped evidence rows, approval loss, revisions, Code count, duplicate identity, invalid Mermaid and inline collisions/history. Current reviewed helper/transport hashes agree with the recorded ones. This supports those exact native cases only; I did not run them or independently inspect physical-monitor UI, installed/package behavior, lock flow, main-route import or hosted CI.

## Retained reviewer evidence and limits

```text
evidence/source-bundle-transport-root-tests-independent.log db5fcf67cf1629754251e2fce50d2542dc37bf9a06d6581685b736a4834bf70d
evidence/source-bundle-helper-unit-independent.log 43fe8841ccf590acb2bc515594b633cb8275cf86a080037f0b6aea7f962f3d49
evidence/source-bundle-transport-independent-2026-10-07/probe.mjs f7bec231fbd7e64c4de2e4e24500432d20cfe4547a85321c36d25fb63ffe3ef1
evidence/source-bundle-transport-independent-2026-10-07/result.json a26dc7feaff623c2cacef521ce9e707b21b067c88cadccce8b766b1814dfe9c5
extracted frozen validator body 467a87dabece08f475357f48416ae4a739d19d7720dcade673cc884d157f883a
```

The first own probe exited1 because I misspelled the expected pointer error as `SOURCE_POINTER_GRAPH_CHANGED` instead of actual `BUNDLE_POINTER_GRAPH_CHANGED`. The product already refused correctly. Retained `first-probe-assertion-error.txt` records that fixture correction; original nine-case `probe.log` and expanded twelve-case `probe-expanded.log` remain. Product/test inputs were not altered. Own tiny data directories remain for inspection; this review made no deletion/cleanup claims.

No additional demonstrated acceptance, timeout, frame, disposal, source-transport or semantic-loss defect was found in the bounded reviewed scope. This is a scoped finding/result statement, **not a global PASS, native/package approval, maximum-size claim or independent sign-off of my parser/copy code**. Future integration still needs exact-pointer and imported-provenance preservation, durable incomplete-copy fencing and main-route/selection qualification by another author.
