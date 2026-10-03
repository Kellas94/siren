# Source loading foundation — root evidence

Author: root implementation coordinator. Independent reviews have their own authors and retained reports. This is not an independent approval or a release gate.

## Change and measured problem

Repeated `SourceRepository.readRange` calls rebuilt and verified the entire source model for each chunk. The original Node matrix measured 17,342.15 ms read wall time for the 18.6 MB, 300k-record Python fixture. Exact-end chunking also split a Unicode surrogate pair and refused both Unicode fixtures. The original adverse report and raw results remain unchanged.

The repository now offers an explicit version-pinned read snapshot. It verifies owned disk bytes on opening, reads from that immutable model, and reports the actual Unicode-safe chunk end. The old fresh-disk `readRange` contract is preserved. New opens still discover disk corruption; a captured snapshot cannot silently switch to a newer edit. The native owner must share and dispose the pool. Its hard limit is two pending/active models, with finite expiry and the existing 32 MiB UTF-8 per-source limit. This bounds source count/input size, not RSS or arbitrary project/editor copies.

One independently authored initial snapshot comparison measured **130.717 ms opening + 28.797 ms transfer wall** for the same Python fixture. All six exact stream hashes and original disk/pointer/project bytes were preserved, including the previously refused Unicode fixtures. That measured reader preceded later capacity/publication hardening; its report records those different hashes explicitly. It is a Node measurement, not a live editor latency qualification.

## Isolated integration

`SourceReadService` provides typed open/chunk/close requests. Opaque read IDs remain bound to actual registered caller/window/frame/epoch/source/version authority; they are not bearer tokens. One shared pool includes pending opens. Copied IDs cannot be consumed or closed by another registered view. Native policy is revalidated after async work. Receipts whitelist metadata/text fields, reject wrong source/version/hash and preserve genuine corruption errors. The module installs no main/preload channel.

`loadSource` builds actual immutable CodeMirror `Text` without normalizing literal CR, BOM or source offsets. It validates chunk progression, complete UTF-8 size/SHA-256 and exact close acknowledgement before returning a document. Cancellation exposes no partial document and closes delayed open receipts when they arrive; individual bridge requests have a finite 15-second deadline. The final SHA check temporarily assembles/encodes the complete source, so this implementation does not claim a streaming-hash/RSS limit.

`sourceClient.loadDocument` binds that loading path to its existing immutable identity. Reset, disposal, mutation/fence and external cancellation suppress stale completed documents, including cancellation between nested async completion and the client's outward continuation. Clients retain metadata/receipts, not a document cache. Existing read/edit/commit methods remain compatible with bridges that do not provide the new optional read methods.

The pinned 15-package CodeMirror runtime closure and build-only esbuild dependency are recorded with actual installed versions/entry/license hashes. `buildPatchedPython` extracts the exact frozen local Python patches into a deterministic module sharing the installed Lezer instances. The independent review qualifies trusted build extraction/inventory only; no new editor bundle or executable-source publication is implied.

## Actual verification and preserved failures

Root observed RED before implementation and repairs. Capacity/expiry mutation, expired-pending reservation, exact microtask open/read publication, null native rejection, adapter receipt projection, delayed cancelled-open cleanup, captured open/close identity and final client external-cancellation regressions are retained in separate logs. One initial pending-open RED harness waited indefinitely on its own gate; only its exactly identified owned Node PID 46680 was stopped. A bounded corrected harness then reproduced the actual reservation failure. Invalid initial read-service native-window fixtures were corrected before the missing-module RED; they are not counted as product findings.

Independent final reviews: Python 9 author + 4 independent controls; readers 11 + 10; read service 7 + 8; loader 9 + 13; client loading 36 tracked + 6 independent controls. Counts overlap across reports and are not added as unique coverage. Reports preserve intermediate failures, corrected overbroad/helper oracles and before/after identities.

Root's **final frozen desktop suite passed 388/388**, zero failed/skipped/cancelled/todo, **181,043.0853 ms**, actual Node exit 0. All captured source/build/test/package/baseline inputs remained unchanged. Evidence: `evidence/source-loading-qualified-suite-{start,result}.json` and `.log`; final log SHA-256 `b83fca97d26f842a9b754afcd93c48f9c52b5bbea370c7087456692033040bda`. Prior 365/387 runs are separately retained and explicitly precede subsequent publication/cancellation repairs.

## Limits and next boundary

This batch qualifies isolated source/unit loading and build foundations. Main/preload transport, actual EditorView integration, coordinated dirty-window barriers, explicit Docs linking, native multi-monitor/Presenter and Terminal process-family ownership remain open. No editable satellite or new large-file UI feature is enabled by these modules. The previously qualified package remains the older source40ce793 development package; it does not contain this new loading integration.

Private GitHub PR2 remains draft/unmerged. Synchronization through local3d7d035 created remote head `d1a65f52a86f98084fd09da66b76a833dde9537a` and tree `ca91600fdc58e999a090d7aab7cb2d9cbf78eaf9`; 118 changed blob identities were checked and 813 unrelated legacy blobs preserved. Main remains `688c48528ff7bdab77908faf041806d10acc54dc`. That remote commit excludes this then-uncommitted batch. Hosted CI27 failed its unit step and skipped renderer/native/package stages; CI18 launcher succeeded. The authenticated CI27 archive `797582dc480bdb7cef82844b5b078f342f600045e0facc8cecb147ec2767ef16` is retained. Its short Windows TEMP alias and six-minute outer step interruption are under separate diagnosis; no local PASS changes that hosted result. No CI rerun, main merge or public release occurred.
