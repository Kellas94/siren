# Terminal bounded output: pure implementation

Author: `/root/terminal_contract`, 3 October 2026. Scope: `desktop/src/terminal/output.mjs`, `desktop/tests/terminal-output.test.mjs` and this report. No PTY dependency, shell host, native owner, main/preload/IPC/UI/package wiring or commits were added by this task. The [native candidate ownership failure](2026-10-03-terminal-candidate.md) remains open; Terminal is not admitted.

## Concrete interfaces

`createOutputRing({maxBytes=4194304})` returns `append(data)`, `read({fromSequence=0,maxBytes=32768})`, `clear()` and `stats()`. `data` is a well-formed JS string; invalid input is refused before mutation. Storage accepts a single large callback without constructing its full UTF-8 copy. Encoding writes into independent fixed-size buffers of at most 32 KiB; small callbacks pack into those blocks, so metadata does not grow with callback count. Oldest complete buffers are evicted until retained UTF-8 bytes fit the configured cap. No consumer, ACK, timer, I/O or PTY pause is needed to append.

Sequences are **absolute UTF-8 byte offsets**, starting at zero; `nextSequence` is exclusive. This makes cursor gaps exact without retaining an unbounded index of evicted callbacks. Future/negative/noninteger cursors refuse, and an offset into a scalar continuation byte refuses as `INVALID_UTF8_CURSOR`. The manager must use this byte-cursor convention for delivery and ACK; this module does not implement attachment leases or credits.

`append()`/`stats()` return `{firstSequence,nextSequence,retainedUtf8Bytes,droppedUtf8Bytes,blockCount,allocatedBytes}`. `firstSequence` identifies the oldest retained byte; empty/cleared rings use the current exclusive end. The raw retained-data cap is 4 MiB, not a claim that the entire process occupies 4 MiB; allocation includes finite block slack. Clearing drops retained bytes and preserves monotonically increasing cursors and cumulative omission accounting. UI clear-view must not invoke this native history clear implicitly.

`read()` returns:

```ts
{
  chunks: Array<{sequence:number,data:string,utf8Bytes:number}>,
  nextSequence:number, // exclusive cursor after this page
  endSequence:number,  // producer's exclusive stream end
  firstSequence:number,
  gap:null | {
    fromSequence:number,resumeSequence:number,droppedUtf8Bytes:number,
    marker:string,resetParser:true
  },
  requiredBytes:null | number
}
```

One page contains at most 32 KiB UTF-8 in total; no returned string splits a Unicode scalar. A smaller requested page that cannot fit the next scalar returns no partial scalar and names `requiredBytes`. The gap is exact `firstSequence - requestedCursor`, with a plain marker such as `Terminal history omitted: 6291456 UTF-8 bytes.` It is metadata, not a VT command inserted into output. After an omitted range, the consumer must reset its filter/emulator parsing state and show incomplete history; this module does not reconstruct an exact alternate screen.

`new VtBudgetFilter({maxSequenceBytes=4096})` returns a streaming filter with `push(data)`, `reset()` and `stats()`. Each input push is limited to 32 KiB UTF-8. It holds incomplete ESC/CSI/OSC/DCS/SOS/PM/APC controls, including C1 introducers, until completion. A control that exceeds 4 KiB drops its entire held prefix and future payload through its terminator, retaining only finite parser flags. OSC accepts BEL or ST; the other control strings require ST; CSI requires a final byte. Split ESC-backslash ST and CAN/SUB cancellation recover across pushes. Ordinary valid ANSI/Unicode is preserved.

`push()`/`reset()` return `{data,chunks,omittedUtf8Bytes,omittedSequences,marker}`. `chunks` contains UTF-8-safe delivery strings, each at most 32 KiB. `data` is the logical concatenation and can be up to the current input plus the previous 4 KiB pending sequence; **send `chunks`, not the aggregate `data`, as individual transport messages**. The finite logical aggregate is retained only for the current call. Omission values are deltas for this call; `stats()` gives cumulative totals, current mode, pending bytes and discard state. Reset omits a bounded incomplete control and returns corresponding marker metadata.

The filter is a budget guard, not a privilege sanitizer. It preserves short OSC commands, so later xterm configuration must still disable OSC52/native clipboard, title/link/image/native actions. It never parses HTML, executes commands, generates protocol replies or controls shell input. Replay/input disabling, Lock epochs, caller authorization, xterm callbacks and per-attachment/global credit limits belong to the separate manager/view work.

## Actual test sequence and retained result

I used the test-driven-development skill. Before writing the implementation, `node --test tests/terminal-output.test.mjs` failed its explicit missing-interface assertion: **1 failure, 10 skipped because the component did not yet exist**. This was the actual RED run; no claim is made that all ten dependent cases ran before their imports were available. The implementation was then added, and the same focused command passed **11/11**, zero failures/skips, reported duration **84.636 ms**.

Focused tests exercise: exact 4 MiB tail and 6 MiB gap from a 10 MiB line; UTF-8 page/cursor boundaries; 10,000 small writes with bounded metadata; producer progress without consumers; clear accounting; invalid input/options/cursors without mutation; split ANSI; 4 KiB OSC boundary and long discarded payload; C1 and other string terminators; cancellation/reset; and a completed pending control plus full input page split into compliant deliveries. Expected Unicode text and byte/gap values are independent literals, not produced by the implementation under test.

One whole desktop run was performed, without repetition: `npm.cmd test` from `desktop`, using local build **Node v24.16.0**. Actual result: **230 tests, 230 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**; command exit **0**; reported duration **180938.4719 ms**. It includes the existing real 180-second OIDC callback test (**180061.5177 ms**) and actual existing Windows identity tests. This output component did not start a native Terminal probe.

The original whole-suite command was not redirected to a file. Its complete tool transcript is initial exec chunk `41b784` and final poll chunk `d420ec` on session `64642`; intermediate polls returned no text. Neither returned output chunk was truncated. The final transcript enumerates the six Terminal contract cases, eleven output cases and twenty-eight registry cases as well as the Source, persistence, security and update tests. These tool chunk IDs identify evidence retrieval and are not test/artifact identities.

No whole-repository start-hash manifest was captured before that run. Accordingly, it is actual whole-suite evidence for that invocation, **not a claim of a frozen complete branch identity or proof that unrelated concurrent edits stayed unchanged throughout it**. Current output/test hashes below were captured while the suite was running; those two files had already been frozen and were not changed afterwards.

The coordinator subsequently reported its combined registry/contracts/output run passed **45/45**, with saved log SHA256 `30092ca7ee714ac789650e357bc84b660d62932232cba2fc92e3f209255f7b22`. It also reported the independent review passed **17/17** checks plus **2,500 UTF-8 ring states, 51 VT splits and 200,000 small writes**, with no blocking core finding. These are coordinator-reported results, not additional executions by this task. The coordinator identified commit `cbd3efd` as registry-only and confirmed that source was unchanged while the whole suite ran. No output source/test edits or repeat test runs followed the freeze.

| Frozen file | SHA256 |
| --- | --- |
| `desktop/src/terminal/output.mjs` | `13617af44f8b0023cd8dff735c90638c780671e58ae0840c7e2bf9108b0c1baf` |
| `desktop/tests/terminal-output.test.mjs` | `486bc5114d73f24f8d094a614650bf22d1627fdefef2c55ead4be52179a29877` |

Native flow-control latency, process memory plateau, actual Locked view destruction, xterm replay replies, aggregate eight-session delivery credits, shell ownership and packaged/native artifact admission remain unqualified. This pure component neither replaces those conditions nor creates another behavioral approval request.
