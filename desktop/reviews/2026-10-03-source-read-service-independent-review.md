# SourceReadService independent review

Reviewer: Codex subagent `/root/source_authority_review`. Date: 2026-10-03. Author independent of the service implementation. Scope: isolated `src/sources/read-ipc.mjs`, its focused unit tests, and its use of the actual SourceRepository, SourceReaderPool and WindowRegistry. No main/preload/editor integration, full suite, native launch, package or release admission was evaluated. The reviewer changed only this report and ignored evidence controls.

## Initial result: changes required

Initial service SHA-256: `736f7c5bc7af09e250e84d300999aec9699984cdddd6d9c6c00a0788010a0352`. Initial tracked test SHA-256: `8bfc2c8ba5e709bb9f3af68ecc0877528221b37a275cc69fa213427ad0ee1424`.

The initial tracked focused run passed 5/5, Node exit 0, 393.2953 ms, in `evidence/source-read-independent-focused.log` (SHA-256 `662fdb9b7483370307655b60da612d2027e04d52af1710be42061a165adcbfac`). Independent controls then passed 5/8 and failed 3/8, Node exit 1, 538.7864 ms. The original failed log remains unchanged at `evidence/source-read-independent-review/controls-initial.log` (SHA-256 `f66df0061bab95062535e8d6134371105b0e43ec69dd86cd3346a3e963efb966`).

1. A trusted repository adapter rejecting `openReader` with `null` caused `invoke` to reject with `TypeError: Cannot read properties of null (reading 'code')` at original line 107. Expected: a sanitized `SOURCE_REQUEST_FAILED` receipt. This is a concrete public service error-handling defect, reproduced using a real SourceRepository with its `openReader` wrapped.
2. Original open-response spread forwarded additional `provenance` and `rawPath` fields from a wrapped real reader's `info`. Expected: explicit typed metadata projection.
3. Original chunk-response spread forwarded additional `private` and `rawPath` fields from a wrapped real reader's result. Expected: explicit typed chunk projection.

The last two controls deliberately extend the trusted native adapter. The unmodified actual SourceReaderPool already projects its metadata and chunk fields. These failures demonstrated service-boundary resilience gaps; they did not establish a renderer-triggerable leak through the unmodified repository. Findings were sent to the implementation owner before the repair.

## Final resolution and verification

The implementation owner added optional access to rejection codes and explicit open/chunk response projections. Final lines 109-110 sanitize null rejections; line 88 projects ten allowed metadata fields; lines 102-103 project only the typed chunk fields. The reviewer did not edit the implementation or tracked tests.

The exact eight independent controls were rerun unchanged with the seven final tracked tests:

```text
node --test tests/source-read-ipc.test.mjs evidence/source-read-independent-review/controls.test.mjs
tests 15; pass 15; fail 0; cancelled 0; skipped 0; todo 0
duration_ms 590.4854
Node exit 0
```

Actual final output is retained at `evidence/source-read-independent-review/controls-final.log`, SHA-256 `c53973f715b9add82d5d7b19512eb5a98adb6101f0654958f528278107dabb42`. The unchanged independent control file SHA-256 is `1c4b9a8cfaff5aca86ddcc43c2a99a396d8cc1a7d4bdc2844839a230cb51b7e1`.

Besides the three repaired cases, independent controls exercised two pending shared leases before load settles, third-open refusal, disposal of pending admissions, a policy mutation queued after reader admission and before service publication, wrong-hash lease release, Docs-role refusal, copied frame/native numeric-ID substitution refusal, and simulated 60-second expiry with restored capacity. They use actual repository bytes and the actual registry/pool with native EventEmitter doubles, not Electron. Tracked tests additionally exercise copied-read-ID cross-window refusal, Unicode-safe source streaming, hostile payload fields/accessors, epoch/source/version/hash confusion, and truthful disk-corruption attribution.

Final hashes captured after the passing run:

| File | SHA-256 |
| --- | --- |
| `src/sources/read-ipc.mjs` | `1b58e7f3cf86e3b4f7be7bf1e24bd4ff22e2306a5f6543172642d39a8e107c6c` |
| `tests/source-read-ipc.test.mjs` | `091ded3c21d4f32b1ee621ee5da2ac6440bb7314c68b7c65452a0373b5a29a42` |
| `src/sources/readers.mjs` | `c68d1efea2b205caa9d710bb1f5ea944b06a290080f4d83037d8a5768c8f684d` |
| `src/sources/repository.mjs` | `af78ecd33712e94ec05385bd4d7a8ee466dbd2f52376edccb16ebd91dd5164bf` |

Final verdict: approved for this isolated source/unit scope; the three reproduced findings are resolved and no outstanding actionable finding was identified in this review. Production ownership, selected-project access policy, service disposal on Lock/selection, live IPC/preload routing, editor integration, and native/package qualification remain outside this result. Pending filesystem work is fenced from publication, but these controls do not prove cancellation of the underlying I/O or a latency/capacity claim beyond the two shared leases.
