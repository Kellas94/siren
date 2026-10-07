# Terminal ancestry-budget P2: independent follow-up

**P2 verified closed on the fixed pure-module bytes below. Native execution remains NOT_ADMITTED.** The original ADVERSE report and both original OOM results are unchanged.

Both modules now reject empty/inconsistent ancestry before constructing prefixes. The existing 128-entry array cap plus exact component-count comparison limits subsequent prefix expansion to 128 ancestors. Scope is this resource-bound fix, not native host admission.

## Fixed freeze

- `src/terminal/cwd.mjs`: `dc38aae936a933636c7400d7dc5cfef19081943fa557c8daa639392211782dbb`.
- `src/terminal/profiles.mjs`: `7779835f11b510004addb7e03857fa6f788be166e805589be401d491822bce10`.
- `tests/terminal-cwd.test.mjs`: `1e9a78429aef98fcf67a8e053c00807924bd15e1f5f9b82d8719f45aa5badf3f`.
- `tests/terminal-profiles.test.mjs`: `56838cb1bb741905eeb087eb85c647c8f7a236321bfb842b7752beeaab04c257`.

## Actual verification

- Original own worker bodies were replayed exactly; only output filenames differ. Limits remain 64MiB old generation, 8 MiB young generation and 10000ms deadline. Both three-component controls and both 8192-component original cases now exit 0 with CWD_REFUSED/PROFILE_UNAVAILABLE. No heap/deadline increase.
- Eight further independent workers verify ancestry 128 accepted and 129 refused in each module, plus 8192-component mismatches with one or 128 provided ancestors. Cwd boundary acceptance includes exact resolve; profile acceptance checks fixed NoLogo/NoProfile args.
- Focused pure tests: 65/65, exit 0. Both prior test files remain present byte-for-byte inside the expanded files; only Worker import/new appended regression is added, with no original assertions removed or weakened.
- Thirteen independent pure authority/snapshot/policy/dispatch groups also pass on the fixed modules.
- All 14 original owner input paths are stable during follow-up. Relative to pre-fix, only the four authorized source/test inputs differ; the other 10 are exact.
- All 25 original report/evidence/source-copy identities are unchanged. Exact original reports, ADVERSE captures, first reviewer-oracle attempt and corrected probes remain preserved.

## Preservation and limits

Original report SHA256: `19be0d835bf2b5c92e3c527c1565dc2485e15c5635170ff9e911c6cb2bda0122`. Original JSON SHA256: `f850c16a5a14c023250fbf07fea8da354dcb68a3a202438bf4e77b1bae5b35f2`. All exact comparisons, probes and final input hashes are in this follow-up JSON.

- Pure injected providers and finite Node workers only. No GUI/build/full suite/install/dependency/PTY/host/native shell execution, product/test/generated edit or Git mutation/commit.
- Fixed modules postdate preview041e6166; this is not package or GUI qualification and grants no host admission.
- Windows canonical/reparse/file identity, trusted OS directory/environment, credentials and relocated protected-root provenance require future real native adapter evidence.
- Pre-spawn path TOCTOU remains. Returned path/envelope snapshots still require native policy/admission rechecks after every await and immediately before future host side effects.
- Dispatch-zero still qualifies shape refusal only; review-only policy/admission positive/negative harness is not production IPC/ownership proof.
- No broader native ownership/startup/cleanup/release/security sandbox/installed-replacement claim.
- Original ADVERSE report, both OOM outcomes and original source copies retain exact previous hashes; this follow-up neither overwrites nor relabels their original results.

This closes the reproduced P2 for cwd `dc38aae936a933636c7400d7dc5cfef19081943fa557c8daa639392211782dbb` and profiles `7779835f11b510004addb7e03857fa6f788be166e805589be401d491822bce10` in pure scope. The original report continues to describe its original adverse bytes.
