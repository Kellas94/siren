# Independent coalesced-completion follow-up

Author: Codex reviewer agent `/root/review_home_clean_close`.
Date: 2026-10-05, Europe/Bucharest.
Reviewed local base: `d1c78d7157a286bfe0a02b95a3c666ab810790f0` plus the uncommitted coalesced-completion changes.

This is a separate addendum. The earlier `2026-10-05-window-layout-independent.md` remains unchanged, with verified SHA256 `0824ef9e860885ebbb703f7fb59726bd606d56c59a46e24073b5778db7353a96`. Earlier findings and ADVERSE execution receipts retain their original historical status.

## Scope and read-only limits

I inspected the current controller and diff in `desktop/src/windows/layout.mjs`, strengthened real-registry tests in `desktop/tests/window-layout.test.mjs`, and the new native burst instrumentation/oracles in `desktop/tests/native/native-keyboard.mjs` and `desktop/tests/native/window-layout.mjs`. I read the retained coalesced-completion RED log and the summary/tail of its GREEN log.

I ran no tests, builds, applications, native probes, or experiments, spawned no agents, and changed no source, tests, generated artifacts, index, HEAD, or previous report. The only authorized write is this new report. The frozen qualification was reported ACTIVE and receives no execution verdict here.

Reviewed SHA256 values:

- `src/windows/layout.mjs`: `4ca1db35a263619ea6253e80d1b6601666d4c1f04b7338b08695483f41d11aed`
- `tests/window-layout.test.mjs`: `df4820dfdfd649d9553386fe39e07ebd3bc6264d901b2bf271046a4ba9351de5`
- `tests/native/native-keyboard.mjs`: `1f4a06eb3ec2031bdbecaa2d1362bc9bac29030eb849acf67afee1425827c632`
- `tests/native/window-layout.mjs`: `825bf2cad6b6db851736a8cc886d21b493f9f7509c998f94998c2ad1e46ff215`

## Strengths and ownership assessment

The new deferred completion correctly distinguishes an active predecessor from its queued successor. Superseding automatic requests increment generation, cancel the predecessor, and share one pending Promise rather than receiving the predecessor's result. The stronger test verifies Promise identity explicitly.

In the active operation's finally block, the controller clears active ownership, detaches the pending record, and forwards the newly launched operation's actual result to that record's resolver. The queued operation captures fresh display areas and grants through the existing start path. Failed capture or a later native failure resolves false through that same path; success still depends on the existing final native bounds/mode readbacks.

The implementation retains one active operation and one queued record, not an event-length work queue. A later burst arriving after handoff can create a subsequent queued record and cancel the now-active operation. Previously returned completion then reports that operation's cancellation; it is not a Promise that waits indefinitely for every future display event. This is consistent with bounded per-operation ownership.

Disposal resolves the still-queued record false and clears it immediately. If the record has already been handed to a running operation, existing disposed/current/generation checks cancel that operation and its result resolves the transferred completion false. No new native mutations or restoration authority are granted by the Promise change. Explicit busy refusal remains unchanged.

## Oracle assessment and retained evidence

The previous Minor finding is **resolved** by the strengthened unit oracle at [window-layout.test.mjs:104](C:/Claude/SIREN_WORK/portable/desktop/tests/window-layout.test.mjs:104). It now awaits the second and third completion results rather than resolving from an intermediate normal-bounds getter. It asserts the predecessor returns false, the two queued callers share a Promise and return true, every target has exact latest-workArea normal geometry, fullscreen/minimization is preserved, and automatic recovery does not focus main. Disposal occurs after those completion assertions.

The retained `desktop/evidence/window-layout-coalesced-completion-red.log` shows an actual failure at the new completion assertion: false versus true, with zero passing and one failing test. This is direct evidence that the stronger oracle rejects the earlier predecessor-result behavior. The retained `window-layout-coalesced-completion-green.log` reports 53 tests, 53 passing, zero failures. These are root-produced execution logs inspected by this reviewer, not reviewer-run tests.

The added queued-disposal test verifies both the pending completion and original operation resolve false with no target movement. Existing origin-retirement, disposal-mid-await, and conditional failure-restoration tests remain present.

The native helper emits three actual synthesized screen metrics events through the owned process's existing listeners, awaits their actual returned Promises, and restores listener functions in finally. The probe requires exact results `[false,true,true]`, then independently reads native Code normal geometry/minimization and Docs/Diagram modes. This is a meaningful completion oracle; it does not retry geometry setters or weaken the existing source/Lock assertions in the caller. It remains synthesized event evidence, not physical display-hardware qualification.

## Findings

### Critical

None identified in this scoped change.

### Important

None identified in this scoped change.

### Minor

No remaining finding. The earlier intermediate coalescing-oracle limitation is resolved in the inspected test source and supported by the retained RED/GREEN characterization.

## Declined to judge

- Active frozen full/native qualification: no completed current-input execution result was inspected.
- Continuous real display-event storms and physical monitor removal/mixed-DPI hardware behavior: current probes exercise a finite synthesized burst.
- Packaged runtime, launcher, hosted CI, and release admission: outside this source and retained-focused-log review.
- Generic preservation of arbitrary third-party/once screen listeners: the native helper is scoped to the owned fixture.
- Full native-workspaces Task 6, whole plan, whole branch/main/release, and unrelated source changes: outside this narrowly scoped follow-up.

## Assessment

The inspected change closes the prior Minor completion-oracle gap. No further source changes are requested by this scoped static review. Pending completion ownership, cancellation, handoff, and disposal are coherent, and the stronger oracle now judges final coalesced completion rather than an intermediate position.

This supports proceeding with the scoped lot's qualification and commit review. It is not PASS for the active frozen execution, packaged/hosted approval, or whole-feature/branch/release approval. Earlier reports and ADVERSE receipts remain unchanged.
