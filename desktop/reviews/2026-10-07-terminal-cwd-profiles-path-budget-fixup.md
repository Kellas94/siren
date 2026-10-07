# Terminal cwd/profiles path-budget fixup

Author: /root/hosted_resume_retention — **implementer and own verifier**, not an independent evaluator. 2026-10-07T16:15:40.940Z. Status: fixed bytes frozen for independent recheck; **native execution NOT_ADMITTED**. Original independent ADVERSE/P2 OPEN report and original implementer report are immutable. This local tranche postdates preview041.

The independent review correctly found that both evidence functions expanded all prefixes of an8192-component path before checking the bounded provider ancestry. Own scratch reproduction confirmed both64MiB OOMs on preserved original source. A16386-character path fits the existing32768-character range; empty/malformed ancestry must refuse without allocating quadratic prefix data.

## Exact correction

Only src/terminal/{cwd,profiles}.mjs and tests/terminal-{cwd,profiles}.test.mjs changed. Both source functions validate canonical path and a nonempty ancestry array bounded to128 first. They then split the requested/parent path once and compare its component count against that bounded array **before** map/slice/path.join prefix construction. Prefix expansion is now bounded to<=128. No canonical/range/identity/reparse/protected-root/authorization contract or ceiling was relaxed.

Each permanent test adds a real worker probe with four cases: control3 malformed ancestry,8192 malformed ancestry, exact128 valid ancestry accepted and129 refused. Worker old-space64MiB, young-space8MiB and deadline10000ms are unchanged. The new tests were run against original source before patching.

| Actual retained execution | PASS / total | FAIL | Exit |
| --- | --- | --- | --- |
| own scratch originals |2/4|2 OOM|1|
| permanent tests before source fix |63/65|2 OOM|1|
| same permanent assertions after source fix |65/65|0|0|
| unchanged scratch assertions on fixed modules |4/4|0|0|

Final focused run includes52 owned tests plus13 existing policy/contract tests, no skipped/cancelled cases. Fourteen inputs match before/after execution and final report capture. Separate nonempty-ancestry probes verify the actual count guard rather than just the empty-array branch:8192-component paths with1 or128 supplied records exhaust memory on both original modules (four retained OOM outcomes), while all four corrected runs return the explicit refusal with exit0 under the same heap/deadline. Four frozen source/test inputs remain unchanged during those controls.

ROOT separately reported original full1720/1720 with667 unchanged inputs; that run predates this correction, was not executed/read here, and does not close P2. No full suite/build/GUI/Git/package/native/PTY/host/IPC operation occurred in this fixup.

## Frozen corrected identities

- src/terminal/cwd.mjs: dc38aae936a933636c7400d7dc5cfef19081943fa557c8daa639392211782dbb
- src/terminal/profiles.mjs: 7779835f11b510004addb7e03857fa6f788be166e805589be401d491822bce10
- tests/terminal-cwd.test.mjs: 1e9a78429aef98fcf67a8e053c00807924bd15e1f5f9b82d8719f45aa5badf3f
- tests/terminal-profiles.test.mjs: 56838cb1bb741905eeb087eb85c647c8f7a236321bfb842b7752beeaab04c257

Original independent report hashes remain MD19be0d835bf2b5c92e3c527c1565dc2485e15c5635170ff9e911c6cb2bda0122 and JSONf850c16a5a14c023250fbf07fea8da354dcb68a3a202438bf4e77b1bae5b35f2. Original implementer reports, original module snapshots and adverse receipts are preserved and inventoried in JSON. Actual logs and receipts live in evidence/workspace-surface/terminal-path-budget-fixup/ plus the permanent RED/GREEN logs in terminal-cwd-profiles-implementation/.

This report establishes the implementer's byte-specific correction and own probes only. A separate reviewer must decide current-byte P2 closure. Real filesystem/reparse/native authority, pre-spawn TOCTOU, atomic ownership and eventual product/package qualification remain separate and unchanged.
