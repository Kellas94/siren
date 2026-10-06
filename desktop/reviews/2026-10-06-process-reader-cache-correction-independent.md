# Process reader output ownership — independent correction review

Author: Codex independent agent `/root/shared_workspace_review`. Date: 2026-10-06. Reviewed source: `85bd74ff53de4b13515115f571a95633738a3409`. Builder SHA-256: `2705add995683af6b7df3d01572c9dd585837a21477122d868e162e0ed7f1f4a`.

Scope: the output-directory correction, its existing ownership primitive, cache controls and independently executed isolated Windows fixtures. No product source, repository tests, production generated files, helper bytes, policy or earlier reports were edited. I did not execute a helper, Electron, a package or a native GUI. The repository test's actual first compilation uses the existing fixed Framework compiler in its isolated OS temporary directory; its resulting executable is treated as inert data.

## Finding and correction

Critical: none established. Important: none established. No new Minor finding established in this scope.

**The previously demonstrated Minor output-ownership gap is corrected for the independently reproduced pre-existing junction case.** `scripts/build-process-reader.mjs:9` imports the existing `ownedDirectory` primitive. Line 19 now awaits it immediately after `mkdir(output)`, before compiler hashing, cache reads or compiler invocation. `src/projects/paths.mjs:5–9` requires a directory, rejects symbolic links/junctions and requires its canonical real path to match the expected path. The correction does not alter source/compiler/binary admission, cache bounds, partial-cache refusal or runtime process querying.

I reran my original case design against the actual corrected builder in a **new** independently authored fixture directory. `native/generated` was an actual Windows junction to another test-owned, initially empty directory, with both leaf files absent. The builder now rejected with `Project path refused`. Independent `readdir` returned `[]`; no executable or receipt appeared in the target. The fixture asserts both refusal and the empty target.

The original report remains OPEN **as of its reviewed source `98ee9550b21c2f5ff1e6d35d5d8ae28f3923b833`**. Its original RED observation, in which the target received an executable and receipt, remains unchanged. This new report records corrected-source GREEN separately. It closes the observed junction case, without retroactively changing the original result or claiming resistance to concurrent path substitution during compilation; that race was not tested here.

## My executions

I independently executed:

```text
node --test tests/process-reader-cache.test.mjs tests/native-process-provider.test.mjs
7 tests; 7 passed; 0 failed; 0 skipped; exit 0
```

These include the actual Windows junction regression, isolated ordinary-directory first compilation/reuse, partial-cache refusal and provider admission controls. They are my executions of repository tests, distinct from owner qualification.

My isolated fixture `C:/Claude/SIREN_WORK/tmp-process-reader-cache-correction-independent/probe.mjs` exercised the production builder with copies of the existing source and admitted helper:

| Case | Independent result |
| --- | --- |
| Exact admitted existing cache | Reused; executable and receipt bytes and mtimes unchanged |
| CRLF version of the pinned source recipe | Exact cache reused |
| Binary-only or metadata-only cache | Refused; existing bytes preserved |
| Malformed JSON | Refused; existing bytes preserved |
| Wrong compiler digest | Refused; existing bytes preserved |
| Changed executable bytes | Refused; existing bytes preserved |
| Oversized metadata or executable | Refused; existing bytes preserved |
| Executable path is a directory | Refused; existing receipt preserved |
| Both leaves absent under junction output | Refused before compilation; target remains empty |

All ten original cache controls retained their expected results, followed by the corrected junction case. The default production helper was read only and had the same before/after SHA-256 `485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3`. The default receipt was independently compared byte-for-byte with the initial fixture copy and remained SHA-256 `01df97b167ee1ad57cd3cdceb87ec36725dcfa696223d3b4c14adda3e492b7f2`.

## Retained evidence and limits

| Evidence | SHA-256 |
| --- | --- |
| Original OPEN report `reviews/2026-10-06-process-reader-cache-independent.md` | `77139eef2fd22485c907ec41a2a7aa1fed40c6879b7429fae373c2174c9132ce` |
| Original RED fixture `tmp-process-reader-cache-independent/results.json` | `e9e98fcf53d1854cfc0ee1e4915beeeeb3449d1a541058143445a4c6a5092f62` |
| New correction fixture `tmp-process-reader-cache-correction-independent/probe.mjs` | `45c295bee41b72150f976729f5888dc71ed96611deed908ecae457c25da42225` |
| New correction fixture `tmp-process-reader-cache-correction-independent/results.json` | `985cf125943b28051e74b5aea6b1537f8c071bf2483193633fa9cf8d47389b46` |
| Existing ownership primitive `src/projects/paths.mjs` | `0f3fe81566b050f0a30f808960325cc2ca7d5027239cf65ed5ffb6a751724554` |

Own test summary is retained separately at `C:/Claude/SIREN_WORK/tmp-process-reader-cache-correction-independent/unit-result.txt`. All fixture/compiler calls completed. This review makes no claim about Windows Application Control policy, unsigned PE approval, performance under hosted load, current full-suite/native/copied qualification, hosted CI repair or release readiness. The prior blocked executable and the original hosted failures are separate evidence. Source/receipt consistency and preserved artifact identity do not constitute signing or independent proof that arbitrary cached executable bytes correspond to source.
