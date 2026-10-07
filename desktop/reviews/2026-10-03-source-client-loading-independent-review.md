# Source-client document loading independent review

Reviewer: Codex subagent `/root/source_authority_review`. Date: 2026-10-03. Scope: new `loadDocument` behavior in `src/ui/code/source-client.js`, focused loading/previous-client/loader tests, and independent renderer contract controls. No product edits, full suite, native launch or package/release admission. This does not qualify a complete editor or live preload integration.

## Initial result: changes required

Client SHA-256 `1c551d656076a74715f4072391c9cb95a62f26d1269653f03ff505c4a4767f08`; loading test SHA-256 `c1169ecc17600c4dbeda5d91810e440c5921de36ead435aa1d667ac09cc945ed`; loader SHA-256 `2e3bf966a63c17df7d1aee8cf268fddfcf44af43b45b38441cef2a061f029ab4`.

The reviewer ran the three tracked focused files: 35/35 pass, Node exit 0, 475.9553 ms. Output: `evidence/source-client-loading-independent-review/tracked-focused.log`, SHA-256 `067e89107211d778f4dc8d5535f9e4d98b0d9c397586ac9c02a4efb424ba826b`. An earlier reviewer command used the wrong output directory and failed redirection before running Node; its empty exit variable was not a test outcome. The directory was corrected before this actual run.

Independent controls found a final external-cancellation race. A synthetic successful `closeRead` ACK queues a real external AbortController abort through five microtasks. The loader completes its final signal check, then the abort executes before the client continuation's `finally` removes the external abort listener. `loadDocument` nevertheless returns `{ok:true, doc:...}`: its final check covers generation and read revision but not the controller's signal. Expected: `SOURCE_LOAD_CANCELLED` without a document. This was reported immediately to the implementation owner. Recommendation: retain generation/disposal precedence, then check the owned controller's aborted state at final client publication.

The first independent run passed 4/6, failed 2/6, Node exit 1, 79.7863 ms. Original test and log remain unchanged at `evidence/source-client-loading-independent-review/controls.test.mjs` and `controls-initial.log`. The reviewer then identified that the depth-six reset/disposal and external-abort assertions were overbroad: these changes can happen after the client promise has settled and before the caller resumes. They do not demonstrate a client defect. A direct event-order observation distinguished depth five (`abort`, `client-finally`, successful caller) from depth six (`client-finally`, `abort`, successful caller).

A separate narrowed control file limits the scheduling sweep to depths zero through five. It passed 5/6 and failed only the concrete external-abort race at depth five, Node exit 1, 76.244 ms. Output: `controls-narrowed-red.log`, SHA-256 `8bc1ce0d2161c6f2548cd56ff89274b0863c2ddf866199eab5b4ad4e486acd81`; narrowed control SHA-256 `a5311948c848f9095dca8c20216521369cac4ec73a0a7877416d0421fe037e9d`. Initial log SHA-256 `976d1b2fab086a51cee4d422057907389bca811c51d92555a7a3cf5cb31282c3`; original control SHA-256 `7a9a738282fe0efec0fcb3d1e678618e3381066717c9cfe24705bd9c037a8807`.

Independent passing controls cover old four-method bridge compatibility, optional bridge accessors not being evaluated, pending chunk cancellation and read closure, simultaneous-load busy refusal, pre-aborted signal avoiding native open, edit refusal fencing an in-flight load without document publication, and reset/disposal before final publication. Focused existing tests cover exact verified CodeMirror text, no text in client state, durable edit identity advancement, loader hash/Unicode checks and close ACK identity. These are source/unit observations using synthetic bridge receipts; tracked loading tests additionally use actual SourceRepository bytes.

## Repair and final independent result

The implementation owner repaired the final client continuation to return `SOURCE_LOAD_CANCELLED` when its owned controller has aborted, after the existing generation/read-revision checks. This preserves `CLIENT_DISPOSED` and `STALE_RESULT` precedence for disposal and reset. The owner also added a tracked regression with an actual repository and an event-order assertion that cancellation occurred before external-listener cleanup. The reviewer did not change product files or tracked tests.

The reviewer reran the unchanged narrowed six controls together with the final 36 tracked focused tests:

```text
node --test tests/source-client.test.mjs tests/source-client-loading.test.mjs tests/source-loader.test.mjs evidence/source-client-loading-independent-review/controls-narrowed.test.mjs
tests 42; pass 42; fail 0; cancelled 0; skipped 0; todo 0
duration_ms 553.1749
Node exit 0
```

Output: `evidence/source-client-loading-independent-review/controls-final-green.log`, SHA-256 `9a147ac2c25467068f6ad4bea2bc251cf9ecd5ca3ad6e4e201cde937fde035b7`. The narrowed controls remain byte-identical to the controls that reproduced the concrete failure. Original adverse files remain unchanged; the overbroad post-settlement oracle was not presented as a product finding.

Final hashes captured after the successful run:

| File | SHA-256 |
| --- | --- |
| `src/ui/code/source-client.js` | `1bfb2282189f09286f0256b8284fb8eb54bb980b00481e2eaf67ed8f1540c8a2` |
| `tests/source-client-loading.test.mjs` | `6d41dfdb2b25e1038d2b4bd8c294d58c0d91c6cd2e5856dbc80b8854f31032a8` |
| `src/ui/code/source-loader.js` | `2e3bf966a63c17df7d1aee8cf268fddfcf44af43b45b38441cef2a061f029ab4` |

Final verdict: approved for this isolated client loading source/unit scope. The reproduced cancellation race is resolved, and no outstanding actionable finding was identified. No approval of live integration, complete Code/Docs editor behavior, native runtime, package, release or CI is implied. The owner's earlier full-suite run predates this repair and new test; this review does not attribute that run to the final bytes.
