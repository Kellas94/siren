# Terminal cwd/profiles: original independent review

**ADVERSE — one P2 remains OPEN in both frozen modules. Native execution remains NOT_ADMITTED.** Focused 63/63 and thirteen other independent pure probe groups pass; neither result closes this finding.

## P2: bound ancestry before expanding path prefixes

- `src/terminal/cwd.mjs:46` calls chain(requested) before validating ancestry length. Its helper at line41 builds every prefix with parts.slice/map/path.join.
- `src/terminal/profiles.mjs:32` performs the same prefix expansion before its length check at line33.

A drive-absolute path with 8192 one-character components is 16386 characters, inside the accepted 32768-character limit. A DATA provider response with an empty ancestry array must be refused. Instead, both modules allocate quadratic prefix data and exhaust a 64 MiB worker heap. Separate actual bounded probes record ERR_WORKER_OUT_OF_MEMORY; three-component controls return CWD_REFUSED/PROFILE_UNAVAILABLE correctly. Neither probe runs a filesystem adapter, dialog, shell or application.

This is a pure authority availability failure, not evidence of an actual native-main crash or renderer exploit. Before future integration, check component count and parents.length against the existing 128-entry ancestry ceiling before expansion, or compare bounded prefixes linearly. Preserve the current heap/deadline and original adverse outcomes.

Exact originals and both worker results are retained in `reviews/2026-10-07-terminal-{cwd,profiles}-independent-original.mjs` and the corresponding `*-path-budget-original-adverse.json` files. Coordinator accepted the P2; this report does not evaluate any later fix.

## Frozen input identities

- `src/terminal/cwd.mjs`: `2d4454097da8c0093a1b4ff7e6040a90b97a9602d2eb848ebcdbceec5e53c948`.
- `src/terminal/profiles.mjs`: `af028b9b8542ce290541e75b185ff33b5a89b45ccf39f7fc70ffc71d20c2efa8`.
- `tests/terminal-cwd.test.mjs`: `d77af1c9d95513482ce93bd35ee0405b2c91c76cc0715d12648fa6714c90efc3`.
- `tests/terminal-profiles.test.mjs`: `76551c8911618ee95597f0b87accd8375ad27bd641e1555aeeae410c7fa98c9f`.

## Actual verification

- Focused pure tests: 63/63, exit0; 50 new cwd/profile tests plus 13 existing policy/contracts tests. Log: `reviews/2026-10-07-terminal-cwd-profiles-focused.log`.
- Independent non-budget probe groups: 13/13. They bind actual TerminalPolicy to native-object-set/admission mocks and check default refusal, eligible project peer versus clone/foreign/epoch, Lock rollback/late selection, live writable mode after awaits, constructor snapshots, readonly profile-list versus create, environment/getters, disposal and dispatch controls.
- Two independent 64 MiB/10-second worker probes are ADVERSE on the deep-path case. Each small control completes with the specified refusal. Both original source hashes and all four frozen file hashes remain exact.
- Eight captured source/test/dependency/original-copy hashes agree before/after. Existing implementer RED/adversarial artifacts are read and hashed without changes.

The first broader probe attempt was 12/13 because my oracle incorrectly expected an ordinary unprotected User path to refuse after mutating the original root array. The corrected probe verifies successful selection and inspection of the original copied protected root. Both probe versions and results are preserved; no product file changed.

## Dispatch-zero scope

The existing profile test calls the real dispatchTerminalRequest boundary with five forbidden-extra payloads, so its zero spy count proves shape refusal. It does not prove mode/PIN/ownership. My positive valid terminalCreate control reaches that callback once while a separate real policy correctly returns READONLY, confirming the distinction. This is expected for the documented shape-only contract.

A separate review-only final-handler model binds real policy plus a native-admission bit, rejects readonly/not-admitted requests before fake dispatch, and reaches a normal/admitted fake positive control. It is labelled model evidence, not an implemented or qualified production host boundary. Cwd/profiles themselves import no host.

## Limits

- Pure injected providers/finite Node worker probes only. No GUI/build/install/dependencies/PTY/native shell/host/IPC/package execution or edits to the four frozen files; no commit.
- These files postdate preview041e6166 and package verification. No package or GUI claim includes them.
- Native providers still must establish actual Windows file/reparse identity, relocated protected roots, trusted OS directory/environment and credential provenance. Pure snapshots are not those witnesses.
- Path revalidation leaves pre-spawn TOCTOU. Previously returned path/envelope snapshots cannot revoke themselves; the future adapter must recheck native admission/policy after all awaits immediately before host side effect.
- Native capture callbacks must be bound to actual registered identity/admission epoch and live PIN/mode/write selection. Profile catalogue is request-bound by supplied native callbacks; no caller identity is minted by profile strings.
- Unsettled old provider operations continue to occupy bounded pending capacity until settlement; revoke clears authority, not external provider promises. No claim of cancellation/abort liveness beyond that bound.
- Original owner RED/adversarial failures are preserved. Initial owner48/48 and final63/63 success do not close this independent P2; a separate later byte-specific fix review is required for closure.
- Coordinator reports original full 1720PASS/667inputs unchanged; its receipt was not supplied/read here and that reported suite is not independent evidence or P2 closure.
- No general native ownership, startup/spawn race, process cleanup, security sandbox, physical monitor, production/release or installed-app qualification.

This original review remains ADVERSE/P2 OPEN. A repair and its exact new source hashes need a distinct follow-up review.
