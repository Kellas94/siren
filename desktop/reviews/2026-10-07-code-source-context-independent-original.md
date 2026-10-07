# Code source context and commands — independent original review

Author: `/root/diagram_history_final_review` (independent reviewing agent, not the product implementer). Date: 2026-10-07. Workspace: `C:/Claude/SIREN_WORK/portable/desktop`.

Disposition: **changes requested — two reproduced P2 defects**. This is the original review of the captured candidate; later fixes must receive separate evidence. Product, tests, workflow and generated artifacts were not edited by this reviewer. Only this report and ignored review evidence were authored.

## Findings

### R1 — P2: recognize the actual Docs plain-text metadata value

`src/windows/source-context.mjs:13,33` passes Knowledge `fileType` directly to a claim function accepting only `python` and `text`. Actual frozen Docs metadata uses **`txt`**, not `text`: the baseline sanitizer calls `wpKnowledgeFileType`, its empty Knowledge row uses `txt`, and the documented finite file-type list at baseline line 75209 explicitly includes `txt` and `python`.

The actual helper probe with one admitted exact reference and a Knowledge row `{name:'notes.txt',fileType:'txt',sourceRef:ref}` returns `language:'unknown'`. With an exact standalone Python claim on that same reference it returns `language:'python'`, ignoring the conflicting explicit text claim. Users cannot find ordinary Docs text sources using the text-language filter; conflicting metadata incorrectly enables Python structure analysis/highlighting instead of showing unclassified plain text.

Normalize the existing Docs `txt` claim to the product's `text` classification at the Docs boundary, preserving exact-reference and conflict checks. Add genuine `txt` cases rather than testing only the invented Docs `text` value. No extension inference is needed.

### R2 — P2: do not discard an exact language claim when its display name is hidden

`src/windows/source-context.mjs:18–21` skips a Code record before processing its exact language when `name()` refuses its display name. This lets a presentation label decide language authority. The concrete pair of exact records `source.py / python` and `folder/source.txt / text` returns `python`; changing only the second label to `source.txt` returns `unknown`. A sole exact Python record with an unsafe or empty label also loses its valid language classification.

This is reachable in admitted metadata: the independent probe executes the actual frozen `validateCodeFiles` function extracted from baseline bytes, and it accepts both records with the path-shaped name and explicit language. The source-bundle metadata gate uses that validator on its content-placeholder projection. Name privacy should suppress the label without erasing its exact language claim. Derive/merge language before independently admitting display names and provenance-name fallbacks.

## Checks actually performed

- Read the scoped plan, prior preflight, changed main adapters, metadata/catalog/read/analysis seams, editor language and command implementation, comparison view, Home register/icon extraction, package list, affected tests and the added CI invocation/evidence retention. Exact source ID/version/SHA remains access authority; no additional concrete access defect was reproduced.
- Ran 16 focused test files: source context, commands, working sources, source reads/main adapter, source analysis, catalog, analysis view, editor adapter/build, package, Home commands, and four appearance files. Original outcome: **114 tests, 113 passed, 1 failed**. The failed editor bundle test reported esbuild `Access is denied` while resolving its temporary fixture under the sandbox; its original adverse output is retained.
- Reran only `tests/code-editor-build.test.mjs` with the normal Windows token: **2 tests passed, 0 failed**. This resolves that scoped execution restriction; it does not rewrite the original run or invalidate R1/R2.
- Ran independent metadata probes with real current helper imports and safe-name conflict negative control. Ran the extracted frozen Code validator on the path-shaped record to establish reachability. These are actual Node probes, not native GUI or import-window execution.
- Real production-adapter Save → v2 metadata/read/analysis tests passed in the scoped run, including unchanged selected manifest/Docs v1, projected grant rejection, exact hash checks, removed membership and Lock. Partial-scan language refusal and relationship filtering beyond the eight caption previews also passed. Such tests do not cover the two omitted metadata cases above.

Command used for the original focused run:

```text
node --test tests/source-context.test.mjs tests/code-commands.test.mjs tests/native-working-sources.test.mjs tests/native-source-reads.test.mjs tests/native-source-read-main.test.mjs tests/native-source-analysis.test.mjs tests/native-window-catalog.test.mjs tests/source-analysis-view.test.mjs tests/editor-adapter.test.mjs tests/code-editor-build.test.mjs tests/package.test.mjs tests/home-commands.test.mjs tests/appearance.test.mjs tests/appearance-sync.test.mjs tests/appearance-replace.test.mjs tests/appearance-lifecycle.test.mjs
```

## Input identity and retained evidence

The before/after manifests contain **34 identical input hashes**; no captured input changed during these checks. Both manifest files have SHA-256 `422eae2cc33abc88d8ae27775d043f4ca1a830c62cc41e1fe724fd50cdda0252`. Full per-file hashes are retained in `evidence/code-source-context-independent-review/inputs-before.json` and `inputs-after.json`.

Key reviewed source: `src/windows/source-context.mjs` SHA-256 `73d0d6a4e88bba8a41815aca5153f0b639100a9e3e75d8a49639b7dd3265d61d`. Frozen baseline SHA-256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`.

The workflow was added after the initial snapshot and separately captured/read at SHA-256 `671366d6d126c0853ec1b77a852a1177e90c29d6a928dba316bfea6566a2be01` (`workflow-before.json`). Its new sources-group invocation, copied-package exit guard and result/screenshot retention are present. This is static review, not a hosted execution claim.

Retained evidence under `evidence/code-source-context-independent-review/`:

| File | SHA-256 |
| --- | --- |
| `scoped-tests-original.log` | `b2df651972add2e2bbe5a7b6b80d21bfc1788aa0bb5dd14896f5f78c573f1057` |
| `scoped-editor-normal-token.log` | `fd5588804ab7e0f6fdb10ba084d35e1606e68fe8de2a084c629a5e2615ac49bf` |
| `metadata-probe-original.log` | `50392796c77bdc74f1e2caa6e853096dea330a7f36f894594cff5abd20946b02` |
| `frozen-language-probe-original.log` | `0fe7084f06ee422f4f70cce87424aef9727ee69ca66fd4fb45ba392fe79da1b6` |

The executable probe sources are retained alongside those logs. Findings were communicated before implementer corrections.

## Qualification limits

No GUI, native harness, copied package, renderer rebuild, full suite, hosted workflow, release or installed replacement was run by this reviewer. The new media-authored native harness was still being prepared and is outside this original review. Existing native fixture edits were captured/read but not executed. Home icon load order and editor/menu behavior received source and focused-unit review, not visual/focus certification. The independent author does not infer native or hosted approval from successful scoped tests, and does not close any historical Diagram timeout or adverse report.
