# Source bundle zero-diagram admission correction

Author/implementer: `/root/native_menu_trace_review`, 2026-10-07. This is an implementation record, not independent approval of my helper. Product ownership was limited to `build/source-bundle-metadata.mjs`, its unit test and the two owned native metadata runners. No main/catalog/parser/copy/transport/build-builder/generated source was edited. Original reports remain unchanged, including the other author's changes-requested review `2026-10-07-source-bundle-transport-helper-independent.md`, SHA256 `4c49273d58119242e3c53210131dcadda19edc4dde0a62e193dae06144cd140b`.

## Change

An explicitly empty `diagrams:[]` is valid for a native source workspace containing Code or Docs. The frozen legacy portable validator rejects it before validating those domains. The helper now uses the actual frozen major-version check, `validateCodeFiles` and `assertPortableProjectWorkpapersFit` for that source-aware empty-list case. It then runs the same existing exact-field comparisons, frozen `prepareProjectWorkpapers`, agent/release/governance gates and original-document file-signoff stamping. An explicit active diagram is refused when there are no diagrams. A nonempty list still enters the full unchanged frozen portable/Mermaid validation.

No diagram is invented even in the validation projection. No defaults or sanitized replacement are saved. The original source pointers, opaque metadata and byte-backed records remain the basis of the admitted metadata and signoff transformation. The source parser remains responsible for membership/hash/byte validation outside the isolated metadata-only window.

## Preserved RED and fixture correction

- Unit RED before helper correction: `evidence/source-bundle-metadata-zero-diagram-red.log`, 9 pass / 1 fail, SHA256 `95381746fc4bfcc5ef1f503c8f318d92beeb3119dbf08a74c7f087f09f039da7`.
- Genuine-builder native RED before helper correction: `evidence/source-bundle-metadata-native/2026-10-06T21-09-13.508Z/`, exit1 and ADVERSE. The actual backend-emitted Code-only export was refused with “The project contains no diagrams. The current workspace was not changed.” Result SHA256 `5f5973fed74f2160e14db867f5ac1156e3f9b98d3e5f023cfd3163dd2dfae705`; native result SHA256 `cb6dafa8320e144360f556fd5b3ff393531d703e9c2a5e77a9bea0368e487d57`.
- First post-correction native run `2026-10-06T21-09-56.026Z/` stays ADVERSE. Code-only admitted with matching original/admitted metadata hashes. The new Docs-only fixture incorrectly retained `dangling:false` for a link to a removed diagram; the exact semantic gate correctly refused `documents[1].links[0].dangling`. I corrected only the fixture to mark the truly dangling link and set negative-fixture links according to the actual supplied diagram list. This was not a product defect or a reason to weaken the gate. Both hidden windows closed and remainingWindows was zero.

## Actual verification after fixture correction

`node --test tests/source-bundle-metadata.test.mjs`: 10/10 pass. The new bounded unit case observes the frozen version/Code/Docs calls and checks no invented diagram, preserved pointers, newer-major refusal, dangling active diagram refusal and Code80 budget.

`node tests/native/source-bundle-metadata.mjs --zero-diagrams`: actual ProjectStore/SourceRepository/manifest/checkpoint/export followed by the genuine root builder and real isolated Electron validator, **16/16 COMPLETE, exit0**, retained at `evidence/source-bundle-metadata-native/2026-10-06T21-11-07.684Z/`. Code-only metadata is byte-exact with original source/base/draft pointers. Docs-only retains current/revision/release linked rows and allowed file claims, with no diagram, no active diagram and no Code file invented. Fourteen negatives cover unsafe Docs/presentation HTML, truncation, unknown block kind, test row dropping, approval loss, revision cap, 81 Code files, duplicate identities, invalid Mermaid, inline source collision/history, newer major and dangling active diagram. The presentation/Mermaid negatives explicitly supply a real diagram, so they exercise the full frozen path. Result SHA256 `5b65cbc29c239ba7983e71a387b3b8307966c2361bbfe348c0dea9cb814f5b1a`; native result SHA256 `325f5698891997d6d5e0b02e5e0964d0d076ff4aa780a4c46950aa6deac0dfcf`.

`node tests/native/source-bundle-metadata.mjs`: the existing nonempty-diagram native fixture/regression remains **13/13 COMPLETE, exit0**, retained at `evidence/source-bundle-metadata-native/2026-10-06T21-11-28.614Z/`. Result SHA256 `e94100fc8440d05a40da095eb7b19a2aef0dbd3adad1b1bfa7245269cf68bf37`; native result SHA256 `00f221d6b404c64e1264374d47b6eedba443118a8463dc5acb31b4358c5fc9ac`.

Both genuine runs record no owned helper injection, all captured input hashes unchanged, all hidden sandboxed windows without preload destroyed, remainingWindows zero, and original emitted files unchanged. No GUI remains active. These prove the specified native metadata admission cases, not Home/end-to-end import, packaging, CI or release qualification.

## Frozen authored inputs

```text
build/source-bundle-metadata.mjs 8351c63024d31447389424c4001b7ddd07649dac522e1ddb317bc97d063eef42
tests/source-bundle-metadata.test.mjs 8c6f80fbdf5d5f177735364b56d330bace1e2e2cb2d0819599b584c47088b121
tests/native/source-bundle-metadata.mjs 2de71825ccbee3739c4ffa0c09df4634631179f4fcbfbc53a5f6bb81c9561d6f
tests/native/source-bundle-metadata-app.mjs aa006aa583db1a355c11f3eb23eddb3ddc8a22d3000151b5789fde5f556540e9
build/import-validation.mjs 4165c09ea6199f7a503225563f9997a163f1b46a6a6372c1d8e7683434499696
baseline/R78.html 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4
```

Another author is reviewing this correction independently; this record does not replace that approval.
