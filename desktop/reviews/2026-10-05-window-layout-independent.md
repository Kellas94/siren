# Independent scoped Window layout follow-up

Author: Codex reviewer agent `/root/review_home_clean_close`.
Date: 2026-10-05, Europe/Bucharest.
Base supplied for this lot: `1bdb9b2a9c4642f53d0d52f09734bcfec72ce7d4`.

This is a separate addendum. It does not replace the earlier synchronous ADVERSE review, asynchronous coverage review, or any retained execution receipt.

## Scope and method

I inspected the asynchronous `desktop/src/windows/layout.mjs`, main/focus wiring, package whitelist, real-registry unit-test source, native layout and keyboard instrumentation, native probe caller, and retained native result JSON. Registry grant validation and geometry validation were also examined during this review sequence. I consulted Electron v44.5.1's official MenuItem implementation to verify callback return behavior.

I ran no tests, builds, applications, native probes, or diagnostic experiments; spawned no agents; and changed no source, test, generated artifact, index, HEAD, or prior report. The only authorized write is this newly authored report. Execution results below are observations of root-produced retained receipts, not executions performed by this reviewer. I did not independently audit the reported focused test log.

## Strengths and resolution of earlier findings

- Requests capture genuine native origin and target grants before scheduling. After each native pause, validation checks origin and target identity, current grant/epoch, the native-handle mapping, disposal, generation, and display fingerprint. It does not substitute a fresh grant for the captured authority.
- One active operation prevents interleaving. Automatic requests invalidate the old generation and coalesce into a subsequent operation using fresh displays. Concurrent explicit requests return false, matching the stated busy policy.
- Bounded observations check normalization, positioned normal bounds, and final normal bounds plus original maximize/fullscreen modes and the intended minimized state. Setter return alone no longer establishes success.
- Conditional failure restoration checks current target authority before mode changes. Locked, replaced, retired, destroyed, or disposed targets cannot be revealed through rollback. Native exceptions produce an unsuccessful operation.
- Main closure unbinds display listeners and disposes the controller. The package whitelist now includes `layout`, resolving the missing imported dependency at source level.
- New tests exercise fullscreen native failure, Lock during native observation, origin replacement before scheduling and during completion, disposal before scheduling and during completion, and superseded display geometry. These materially address the previous Important asynchronous boundary-test gap.

The earlier synchronous readback, partial-state handling, and whitelist findings are addressed in the inspected source. The coalescing completion limitation below remains explicit.

## Native evidence and instrumentation assessment

The retained `desktop/evidence/window-focus/2026-10-04T22-24-56.626Z/result.json` remains ADVERSE with four completed cases. Docs and Diagram normal geometry is contained, maximize/fullscreen is preserved, and Code remains minimized. This is consistent with an explicit command arriving while automatic recovery is active, when the controller intentionally refuses it. Intermediate visible geometry was insufficient to establish automatic completion.

The retained `2026-10-04T22-27-47.148Z/result.json` remains ADVERSE with four completed cases and the actual error `undefined` versus expected `true`. Electron's MenuItem wrapper invokes the application callback without returning its result; asserting that MenuItem.click returns the controller Promise was invalid. This characterization is supported by the [official Electron v44.5.1 MenuItem implementation](https://raw.githubusercontent.com/electron/electron/v44.5.1/lib/browser/api/menu-item.ts), lines 95-108.

The current screen instrumentation calls the actual bound listeners, collects their returned recovery Promises, awaits them, and restores the listener functions in finally. This correctly separates completion of automatic recovery from intermediate native position. It synthesizes a screen event inside the owned, PID-checked main process; it does not expose production IPC or simulate physical monitor removal.

The native menu instrumentation observes the actual final main.focus method call and invokes the original method. It does not obtain the controller's boolean result: its true means the focus boundary was observed. This distinction is correctly stated in the probe. Independent normal-bounds and mode assertions remain necessary and are retained. The same distinction applies to the new Ctrl+Alt+B instrumentation.

The retained `desktop/evidence/window-focus/2026-10-04T22-28-39.194Z/result.json` is COMPLETE with seven successful cases and matching before/after captured inputs. Its recorded state shows Docs normal bounds `1860,892,700,500` with maximize preserved, Diagram normal bounds `1860,892,700,500` with fullscreen preserved, and Code normal bounds `1840,892,720,500` with minimization cleared. Caller assertions preserve the selected project and exported source bytes; Lock destroys satellites and allows recovery of the permanent PIN window without a snapshot.

I verified that the current service hash `9c8d56b2cfff197dbac4e9021e6686bbf31ed9fc21adaabf94e6767e56ce3747` and main hash `d3f8a40da4dcee3728fc29b37de4646349a91dacd8005bd55a12e171d3ab5709` match that COMPLETE7 receipt. The native helper and layout probe have subsequently changed to add Ctrl+Alt+B. I inspected that addition statically: it uses actual WebContents.sendInputEvent and retains independent geometry/mode assertions. COMPLETE7 does not qualify the added B case. The new frozen qualification is active and receives no execution verdict here.

## Findings

### Critical

None identified in this scope.

### Important

No remaining blocking controller finding identified in the inspected source. The previous asynchronous test-coverage finding has been substantially addressed by the added cancellation and rollback cases.

### Minor

**Coalescing test establishes latest-area intermediate geometry, not completed coalesced recovery.**

File: [window-layout.test.mjs:104](C:/Claude/SIREN_WORK/portable/desktop/tests/window-layout.test.mjs:104), especially lines 109-111.

The test resolves when Docs.getNormalBounds reports the latest position, checks main geometry, then disposes the controller. That read can occur before the coalesced operation finishes its final bounds/mode verification. The test demonstrates cancellation and use of the latest workArea; it does not establish successful completion of the coalesced operation. A regression after setBounds but before final verification could escape this oracle.

Keep this limitation explicit and add a bounded final-completion assertion in a later unfrozen pass. This is a coverage limitation, not an observed service failure or a reason to reinterpret an ADVERSE receipt as PASS.

## Declined to judge

- The active final frozen qualification and added Ctrl+Alt+B runtime case: no completed receipt was inspected for those inputs.
- Reported focused 22/22 execution: unit-test source was reviewed, but I neither ran the suite nor independently audited its log.
- Physical keyboard, monitor removal, mixed-DPI, and arbitrary display hardware behavior: owned native input and synthesized events do not qualify them.
- Generic listener-instrumentation compatibility with arbitrary third-party/once listeners: this helper is scoped to the owned fixture, not a general listener-preservation library.
- Packaged runtime, launcher, hosted CI, release admission, and whole-branch readiness: not exercised by this reviewer or established by the inspected local COMPLETE7 receipt.
- Home guide wording/generated-size qualification and the complete native-workspaces plan: outside this narrowly scoped controller/test/instrumentation review.
- Successful completion of coalesced recovery under all asynchronous native event sequences: the retained native success is concrete local evidence, while the unit completion limitation remains above.

## Assessment

No additional blocking source finding was found. The staged controller and the exact COMPLETE7 service/main inputs have convincing local native evidence for the observed geometry, presentation-mode, source-preservation, and Lock cases. The scoped controller is suitable to proceed through final qualification and commit review, with the minor coalescing-oracle limitation recorded.

This is not execution PASS for the active qualification, qualification of later optional inputs, package/hosted approval, full Task 6 completion, or approval of the whole branch/main/release. All original ADVERSE receipts retain their original status.
