# Independent recheck: readonly import and completion uncertainty

Author/reviewer: `/root/native_menu_trace_review`, 2026-10-07. Verdict: **the two specified findings are addressed for the inspected source identities and bounded actual-service/filesystem cases**. This reviews other authors' corrections only. It does not approve my metadata helper or replace the original adverse report `2026-10-07-source-bundle-parser-copy-routes-independent.md`, whose SHA256 remains `21098aab10ad5b3d8192b163bf2e643d2e669446e030c4039a09978e0ef5779a`.

## P1 ordinary readonly/recovery import bypass: addressed

Root's actual `pickProject` service now refuses ordinary import choice in readonly or recovery before opening the file picker. My separate recheck executes the current actual `selected` and `pickProject` bodies through `invokeDesktop`, with real owned stores, original project and actual emitted source-bundle files. All four source-bundle/legacy × readonly/recovery cases returned `ACCESS_REFUSED`, invoked the file picker and isolated validator zero times, created zero projects, kept original selection/mode and original snapshot unchanged, and retained input bytes unchanged. This directly checks the admission boundary that the original actual-service reproduction bypassed; explicit recovery remains a separate route.

## P2 contradictory completion result: addressed

Media author's copy now latches `completionAttempted` immediately before writing its final owned completion marker. A failure from that point returns `BUNDLE_COMPLETION_UNCONFIRMED`, `completion:'unconfirmed'`, the actual `retainedProjectId`, and underlying reason; it supplies neither `incompleteProjectId` nor a successful snapshot. This is deliberately conservative when final publication starts but has not been accepted. It makes no rollback/cleanup claim and performs no unauthorized readback after revocation.

My independent actual parser/copy/atomic/checkpoint/catalog fault probes establish:

- Final marker `before-rename` failure: unconfirmed retained result; actual strict marker remains incomplete; exact schema2 snapshot/checkpoint exists; ordinary discovery excludes it and opening is refused.
- Final marker `after-rename` failure: same unconfirmed contract; strict marker is complete and matches the saved revision/hash/checkpoint; catalog discovery includes it; no selection file is created.
- Authority revocation after final marker rename: unconfirmed retained result with `reason:'ACCESS_REFUSED'`; actual copy is complete/checkpoint-bound and remains unselected. The probe's later strict-reader observation is a separate independent read, not an extra copy operation after revocation.
- Actual normal `pickProject` service with the same post-rename fault: returns `BUNDLE_COMPLETION_UNCONFIRMED` and does not select the complete retained copy. Original selected project/snapshot remain unchanged; no selection pointer is created. The service's public failure message describes the unfinished import operation and does not assert a durable incomplete marker.

Thus the original result/marker contradiction is removed while discovery still follows the strict durable status. Earlier failure paths remain separate; this recheck does not reinterpret them as completed.

## Actual retained evidence and checks

New probe, preserving the original adverse probe unchanged:

```text
evidence/source-bundle-copy-route-independent-2026-10-07/recheck.mjs
SHA256 1f83f89671ed1319b9b7d62ed6b7432a17367342a93725d359830162f45a66de
evidence/source-bundle-copy-route-independent-2026-10-07/recheck-2026-10-06T21-12-55.567Z/result.json
SHA256 e6bf3beaa8da32a62ba917e97e814dd67cb5512cb7b59ea6bdb9c5fb15749609
```

`node evidence/source-bundle-copy-route-independent-2026-10-07/recheck.mjs`: 8 bounded cases COMPLETE, exit0; captured product/test input hashes unchanged before/after.

`node --test tests/home-import-main.test.mjs tests/source-bundle-copy.test.mjs tests/source-bundle-selection.test.mjs tests/package.test.mjs`: 30/30 pass, exit0. Includes the existing five main import cases, actual copy fault/status/source fidelity cases, guarded selection faults and six package static/allowlist tests. This is a focused run, not the global suite or a built-package runtime qualification.

## Inspected identities and limits

```text
src/main.mjs ddcbb10cc560d3c74a22550e19860deb617383bd801b25105d168443874440a1
src/navigation/source-bundle-copy.mjs 0104184330691d6e04d54c31c06237a8bbab32fdb95a5613c25defdd3e8b488c
src/sources/bundle-import.mjs 551dc265aae802b35e46e9bc5fab44f8adbbe35a8157166facc2ef60cda20345
src/projects/import-admission.mjs 13131f80a2a7cc96a15e683256c0df6631d045cac9b5702ba4672a35290ff491
src/projects/import-status.mjs 720e3de3fa3fa3574a37bb9f30322d4ac331d6b2403d436cb412251bff5818e5
src/navigation/catalog.mjs dc0ca149d425b1debc1f0350301b5b801775e03649ae7e10a4de3d9bd09181c5
tests/home-import-main.test.mjs 30fd5df6f6e00921537718dabc9560bee52e66a0f0aa43323304946f29dc041f
tests/source-bundle-copy.test.mjs 2d960b1cb18d91ac1a543a96f6d425894f514991db7f1cf376c72c076e447777
```

No product/test/generated source edited during this recheck. No GUI, CI, global suite, packaging or installation was run. Hidden validator results and all-view preparation remain controlled boundaries in this no-GUI main-service probe; I make no native UI or end-to-end concurrency claim from it. My original parser/copy/routes report's other scope boundaries remain intact. No new actionable finding in these two corrected boundaries.
