# Terminal pure components independent review

Date: 2026-10-03. Author/reviewer: `/root/source_authority_review`, independent child reviewer assigned by `/root`. Scope: `desktop/src/terminal/contracts.mjs`, `output.mjs`, and their two focused test files, against `docs/superpowers/specs/2026-10-03-siren-terminal-design.md`. Request contracts were reviewed after their final handoff; output tests were executed only after the owner declared that module frozen. The reviewer owns only this report and made no runtime/test edits, dependency installs, native launches, package builds, commits or full-suite runs.

Verdict: **APPROVED for the pure request-shape and output-data component boundary**, at the exact hashes below. No blocking correctness finding was identified in this scope. Terminal process ownership and product shell execution remain **NOT ADMITTED**. Passing this review does not qualify a terminal, ConPTY/node-pty, native ownership guard, manager, caller/epoch policy, bridge, xterm view, Lock behavior or package.

## Contracts assessment and independent verification

The validator accepts only the ten declared Terminal method payloads and exact required keys. It rejects unknown methods, renderer command/argv/env/path additions, invalid IDs/numbers/dimensions, symbols/hidden fields, accessors, and non-data prototypes. Descriptor-based reads avoid executing payload getters. Accepted fields are primitive values copied into a frozen null-prototype payload; the original object cannot mutate the normalized request. Input counts exact UTF-8 bytes, accepts at most 32 KiB, and refuses malformed surrogate input without replacement encoding. Defaults match the design's finite budgets.

Standalone focused command from `portable/desktop`: `node --test tests/terminal-contracts.test.mjs`. Actual live result: **6 passed, 0 failed/skipped/cancelled, exit 0, 68.8976 ms**.

A separate reviewer-authored ephemeral assertion script checked 16 exact UTF-8 boundary acceptance/refusal cases using ASCII, accented characters, CJK, emoji, BOM, NUL, ESC and CRLF. It also checked that a null-prototype accessor payload executes no getter; extra/circular/large unexpected payloads and a revoked proxy are refused; and malformed surrogate combinations are refused. Actual exit 0: `independent contract assertions passed: 16 exact UTF-8 boundary cases, no getter execution, extra/circular/huge/revoked payload refusal, malformed surrogate refusal`.

These contracts are request-shape validators only. `dispatchTerminalRequest` passes the immutable typed copy to a trusted dispatcher; it does not grant permission or itself authorize an execution side effect. Event/receipt validation, role methods, live caller/project/PIN/epoch/session/lease checks, input idempotency and sequence handling, queue limits and stop receipts require later native components.

## Output assessment and independent verification

The ring validates well-formed text, encodes into bounded blocks without an attacker-sized UTF-8 buffer copy, packs small writes, drops oldest complete UTF-8-safe blocks when retained payload exceeds its cap, and reports absolute byte cursors and exact dropped bytes. It refuses malformed data, invalid/future cursors, budget overflow and mid-scalar retained cursors. A short delivery that cannot hold the next scalar reports the required byte count. Clear maintains cumulative sequence/drop accounting.

The VT budget filter holds incomplete controls across pushes, caps their retained bytes at 4 KiB, and omits an oversized control through its terminator/cancellation. CSI, OSC, DCS/SOS/PM/APC, C1 controls, split ST, CAN and reset behavior are covered. Omission counters/markers stay explicit; completing a held sequence with a full input push returns bounded delivery chunks.

Final combined command: `node --test tests/terminal-contracts.test.mjs tests/terminal-output.test.mjs`. Actual live result: **17 passed, 0 failed/skipped/cancelled, exit 0, 99.2399 ms** — 6 request tests plus 11 output tests. The focused output suite includes an actual 10 MiB ASCII line, retaining the independently expected 4 MiB tail with a 6 MiB byte gap, and sustained saturated small writes under a smaller cap.

An independent reviewer-authored script checked 2,500 append/read states across 4/7/31/64/128-byte rings using ASCII, accents, CJK, emoji, CRLF and ANSI text. Every state compared exact retained bytes to an independent full Buffer tail oracle; byte counts, first/next/drop cursors, gap accounting, per-delivery UTF-8 validity and scalar-safe progress matched. It checked 51 split-control equivalence/reset cases, including oversized ESC intermediates, OSC, DCS, C1 controls and incomplete sequences, comparing chunked vs one-piece output and exact omitted byte totals. It also checked 200,000 small writes for finite block metadata. Actual exit 0: `independent output assertions passed: 2500 UTF-8 ring states with exact tail/gap oracle; 51 split VT equivalence/reset cases; 200000 small writes with bounded blocks`.

The reviewer then separately saturated the default ring with **4,259,841 one-character appends**, without a consumer. Actual exit 0; independently asserted retained payload ≤4 MiB, block count ≤129, allocated block bytes ≤4 MiB +32 KiB, exact total accounting and a ≤32 KiB delivery. Observed final stats were `{firstSequence:98304,nextSequence:4259841,retainedUtf8Bytes:4161537,droppedUtf8Bytes:98304,blockCount:128,allocatedBytes:4194304}`. The shorter retained tail is expected because overflow drops complete blocks. These are JS component observations, not a 60-second PTY flood, native memory measurement or latency qualification.

All independent probes ran through ephemeral stdin scripts, wrote no product files, and launched no shell/PTY/renderer or process-family probe.

## Integration limits

The VT filter is a **control-sequence byte-budget filter, not a sanitizer**. Under-budget OSC52, title/hyperlink controls and other VT data can pass through; future xterm configuration and transport policy must enforce the design's clipboard/title/navigation restrictions. Output remains VT text, never HTML or executable IPC.

Ring output sequences are absolute UTF-8 byte offsets and `nextSequence` is exclusive. Manager/transport ACK and lease semantics must explicitly map that representation to typed events; these helpers do not validate grants or fence shell input. Consumers must use the returned bounded `chunks` for delivery: the convenience `data` value from the filter may contain a completed previously held control plus the current bounded push. Gap consumers must reset the VT parser when instructed. UI clear-view must remain separate from native raw-tail erasure; the pure ring's `clear()` is not a delivered UI action.

Per-ring bounds do not enforce the app's 8-session/32 MiB aggregate ring cap, 2 MiB host credit cap, attachment credits, xterm callback ACKs, input receipt retention, or control-lane priority. Native ownership, cleanup and host/main crash behavior are absent from these modules. The registry does not yet grant a Terminal role or dock; no module/entrypoint bridge or shell dependency was admitted by this review. The owner's separate full-suite run is not reviewer evidence and is not represented here as completed or passing.

## Final reviewed SHA256

Captured after final focused tests and independent output/contract assertions on 2026-10-03:

| File | SHA256 |
| --- | --- |
| `desktop/src/terminal/contracts.mjs` | `1637bc7b9b7687b988ea45b7bee5418727e0c4e00a284e966953d0a56efae79e` |
| `desktop/src/terminal/output.mjs` | `13617af44f8b0023cd8dff735c90638c780671e58ae0840c7e2bf9108b0c1baf` |
| `desktop/tests/terminal-contracts.test.mjs` | `0b3e95567aebbf4abc31472d064951c8915887b366e30f5887fb3130101fb247` |
| `desktop/tests/terminal-output.test.mjs` | `486bc5114d73f24f8d094a614650bf22d1627fdefef2c55ead4be52179a29877` |

The final saturation probe made no source changes. These hashes identify pure source/unit components, not native addon, process-owner, ASAR, binary or runtime admission.
