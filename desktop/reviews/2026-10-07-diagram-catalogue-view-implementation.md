# Diagram catalogue renderer implementation evidence

Author: `/root/catalogue_view` (implementer). Completed: 2026-10-07 09:17 UTC.
Scope: the delegated renderer view, its CSS and its test file only. This is not an independent review or native UI approval.

## Result

Implemented the frozen `window.SirenDiagramCatalogueView.create({host,bridge,enabled,onClose})` API returning `open/close/pause/dispose/isOpen`. Creation is explicit and sends only `entryId/title/operationId`. The host owns navigation, focus restoration, leases and native admission.

The view browses finite 20-row pages and starter/template groups, shows literal source through `textContent`, explains Build subset versus code-first/Guided source-line editing, and keeps an optional title within 160 UTF-16 units. A read-only catalogue remains browseable. It does not render imported source or mutate the originating diagram.

A saved diagram whose window could not open is shown as saved. Explicit retry retains its operation ID and title, without automatic retries. The view also distinguishes a saved entity that is no longer available. Busy controls cannot enqueue another create or change the request. Success closes with `restoreFocus:false`; cancel uses `true`. Pause/dispose are silent, clear preview data and invalidate outstanding replies. A paused view can reopen.

The theme uses shared `--siren-*` tokens, compact grouped controls and a source preview. A container query stacks the content in narrow desktop panels. **Visual quality and layout have not been checked in Electron.**

## Actual verification and adverse records

The companion JSON retains original complete TAP output and actual command exit codes for every phase:

1. Missing renderer API: **16 failures / 0 passes**, exit 1.
2. Initial implementation: **16/16 pass**, exit 0.
3. Expanded lifecycle and real catalogue: **16 pass / 4 fail**, exit 1.
4. After correcting the VM wire fixture to use structuredClone: **17 pass / 3 fail**, exit 1. Production source was unchanged between these two adverse executions. The fourth failure was a cross-realm fixture defect, not a product finding.
5. After fixing the three real implementation defects: **33/33 pass**, exit 0; zero failures, cancellations or skips. This is 20 renderer VM tests plus 13 existing catalogue-contract tests.

The three real defects were repeated host class accumulation, loss of the saved/open-failed explanation on selecting the same entry, and loss of the read-only explanation after editing its optional title. Their adverse outputs are retained; no evaluator verdict was manufactured.

The real-contract renderer case traverses **all 28 frozen catalogue rows**, checking exact literal sources and page bounds. Other cases cover request shape and UUID, exact retry, title validation, duplicate send refusal, read-only refusal, stale async responses, revoked permissions, malformed pages/receipts, separate instances, listener cleanup, cancel and reopen after pause. The original initial fixture used an invented durability value `complete`; it was corrected to the actual `committed` contract before implementation.

Command: `node --test --test-reporter=tap --test-timeout=15000 tests/diagram-catalogue-view.test.mjs tests/diagram-catalogue.test.mjs`.

## Files at handoff

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| src/ui/diagram/catalogue-view.js | 14744 | 389ab38bb9737f7f6cf2745f90a2f7bdd31782fec9bfc665cf8c5cf6d35f9904 |
| src/ui/diagram/catalogue.css | 5770 | 9c39906cf12925ce646cc845b49eac473e2363fa084a3a427bcfa1fd198a7dff |
| tests/diagram-catalogue-view.test.mjs | 19304 | 1063f91290502bd2b6a5616053a89b40948edadc1ff6298b3ad9e356d6b3f21f |

## Limits and parent follow-up

No main integration, build, GUI, package, Git mutation, installed replacement or release was performed. The parent must qualify native Home/Diagram mounting, focus leases, Lock/rollback and the actual saved-editor opening. Backend marker authority and historical hosted pointer failures are outside this report.

Cancellation invalidates renderer callbacks; it cannot roll back a mutation that main has already committed. The view intentionally does not claim that an interrupted create failed or that closing cancels persistence.
