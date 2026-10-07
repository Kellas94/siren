# Docs Activity TEMP-fixture scheduling review

Author: /root/disk_inventory, 2026-10-07. Read-only review of the scheduling correction and retained owner-run evidence. I did not execute tests, a build, GUI/native probes, or the owner wrapper. This is a static scheduling finding, not a full-suite verdict or proof of the timeout's cause.

## Preserved actual adverse

The original owner full suite `evidence/workspace-surface/docs-activity-full-suite-2026-10-07T03-46-43.909Z/result.json` is ADVERSE: identity3/3, remaining1,454/1,455, total1,457/1,458 successful; no skips/cancellations;577 captured inputs and changedInputs:[].

Its original units.log identifies the sole failure at `tests/fixture-temp-alias.test.mjs:9:9`, because the nested spawnSync returned ETIMEDOUT after15,013.9812ms. The test's unchanged15,000ms timeout was reached. This is an actual failed test, preserved without reinterpretation as a pass.

Owner's isolated original fixture log `evidence/workspace-surface/docs-activity-temp-alias-isolated.txt` reports1passed/0failed,2,332.6377ms case and2,388.0915ms total. I read that existing log; I did not execute the isolated test. Its success in another scheduling context makes contention plausible but does not prove contention, eliminate a fixture/product cause, or replace the first adverse.

## Exact scheduling correction verified

Workflow `.github/workflows/desktop-verify.yml:43`–55 adds fixture-temp-alias.test.mjs to the existing four-entry serial selection and the matching exclusion from the remaining selection:
- Serial identityFiles now contains the three original process-identity files plus fixture-temp-alias.
- The serial invocation still uses node --test --test-concurrency=1 --test-reporter=tap.
- The remaining Get-ChildItem selection excludes all four entries, sorts names and runs afterward.
- Original exit status capture/gates remain.
- The workflow unit-step12-minute timeout remains unchanged.
- No native fixture test body, nested spawnSync options, assertion or deadline was weakened.

I reversed **only** the two fixture list additions and the explanatory two-line comment **in memory**, without writing a file. The resulting workflow SHA256 is `9672e81112bbb0da7e5520101331ba56e69914ad6f9f262b13f6ccf971d6d808`, exactly equal to the first full-suite workflow input. This verifies that those scheduling/comment changes are the complete delta since that first captured workflow. Git diff against older HEAD also includes earlier Docs Activity steps/upload additions; those are part of the separate product batch and must not be confused with this narrow correction.

At readback, tests has235 outer *.test.mjs files. Static partitioning selects4 serial files and231 remaining files, with all required identity files present and every outer file selected exactly once across these two commands. This does not mean the nested native-docs-export test is never executed elsewhere: the unchanged TEMP regression intentionally launches that same file in a nested process to check path spelling. Existing separate probes are outside this exact-once outer partition statement.

The owner evidence wrapper `evidence/workspace-surface/run-docs-activity-full-suite-serial-temp.mjs` mirrors those exact four identity file names and excludes the same four from its sorted remaining list. Its serial child uses --test-concurrency=1, and it awaits exit before starting the remaining child. It captures src/build/scripts/tests/workflow/package/baseline before and after and refuses COMPLETE on a nonzero code, signal, failure/cancellation/skip or changed input. Its console reporter differs from workflow TAP transport, but scheduling sets and order match. This review does not claim the wrapper's active second run has completed.

## Unchanged fixture body

`tests/fixture-temp-alias.test.mjs` remains819bytes SHA256 `272cb3fbad9a2fbfe83158acde6d28b0fb6eb40c61327daef7a6e40655c5a72d`, equal to both the first full-suite before and after capture.

Its nested command still executes tests/native-docs-export.test.mjs with --test/--test-reporter=tap, original environment casing setup and NODE_TEST_CONTEXT removal, timeout:15000,maxBuffer:1024*1024. The assertions still require no spawn error, status0, "# pass 8" and "# fail 0". It remains a real subprocess test with its original deadline; moving the outer fixture does not bypass or stub the nested execution.

## Read identities and bounded finding

| Read input | Bytes | SHA256 |
| --- | ---: | --- |
| First adverse result.json | 123,139 | b37a226745b308d46db337894683e1348792ddd1e10b516ff33c737311750168 |
| First adverse units.log | 159,747 | 654e4f0c8a68e413883882a0086288fade2f9402f70dcab9b59aaa3d9b9d96ce |
| Isolated owner log | 248 | f1b97b6988e13a165180c0a1179ecb0220606810d2286c54b82dc98ea748e80a |
| Serial owner wrapper | 2,516 | 29d6dae6c5bb0032e113877a38c640b3d8ee49dc436baf7b527a676f54c8007b |
| Current workflow | 44,420 | 8a76a528a203264f546629bf2952d80697323c7e83025371faf63801857da0e1 |
| Unchanged TEMP fixture | 819 | 272cb3fbad9a2fbfe83158acde6d28b0fb6eb40c61327daef7a6e40655c5a72d |

No static scheduling omission, duplication or deadline weakening was found in this narrow change. It is a reasonable isolation of a nested subprocess from the large parallel outer suite, with unchanged acceptance assertions. Whether it resolves the observed scheduling-sensitive timeout must come from the actual separately retained second owner run; contention remains an inference. The first adverse remains original. This review creates only this authored report; no product/test/workflow/source/build/Git/evidence originals were modified.

