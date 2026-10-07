# Diagram history/typography native select transport observation

Author and native executor: `/root/media_batch_review`. Date: 2026-10-07. Scope: actual development app only, owned isolated fixture/profile; no package/CI/release approval and no product modifications.

## Retained original outcome

Original unchanged harness `tests/native/diagram-history-typography.mjs`, SHA256 `ba0d90fe00b820e068c916b3674ec09158d08403eca6d2e4cd5993deeef68aa0`, ran against corrected generated Diagram `1a8e1f0dcb95f2ddb5e5641e6e50508351e42abb656465c27f7ff686a7284b17`. Receipt `evidence/diagram-history-typography-native/2026-10-07T00-20-29.149Z/result.json`, SHA256 `a9bda87ae1aa04948df5f5667d75cfdf3178fe25bb4cc5eb58b3ca44a4e533d0`, remains ADVERSE with one completed case and unchangedInputs[]. Startup/read/render now succeeded. The first case exercised actual readonly controls plus coalesced source input and Ctrl+Z/Shift+Ctrl+Z/Ctrl+Y. The next phase failed waiting for the global font select to equal Verdana. The genuine screenshot shows Georgia; trusted trace contains Home, four ArrowDown events, then Tab. Original source snapshot is retained alongside that receipt.

The helper enumerated all options, including disabled index-zero Theme default. Native Home selects the first enabled option. Thus counting four arrows from that enabled origin reaches Georgia instead of the intended Verdana. This is a harness navigation defect, distinct from the earlier proven controller CSP defect. The original receipt is not relabelled as a product pass.

## Authorized diagnostic

Ignored driver `evidence/workspace-surface/diagram-history-typography-select-diagnostic.mjs`, SHA256 `d480da758a0c2d94e3bf55d150d9031b3c237d0695ae55b8ae7d1406e6a7d69b`, corrects relative helper imports and counts only enabled options before genuine Home/End/Arrow/Tab navigation. It retains the original scenarios, assertions and wait deadlines and adds passive refusal readback. No DOM value assignment, synthetic DOM events, direct controller invocation or storage adapter was used. The tracked original harness and all captured product inputs remain unchanged.

Executed once under approved normal Windows token with Electron sandbox retained. Receipt `evidence/diagram-history-typography-select-diagnostic/2026-10-07T00-21-59.527Z/result.json`, SHA256 `ec6bf73c87965ae97e026dd9f672a3c10bc53b96dc0155c92a6411d17bccf350`, is COMPLETE with eight cases and unchangedInputs[]. Execution lasted 21.424 seconds; two trusted text input chunks took 42 ms. The owned process closed after capture.

The eight actual scopes were readonly/Text semantic history; Build and Style edits/typography; refusal retaining incomplete Add/Connect and invalid block size; same-renderer attach/detach; acknowledged Save then Undo+Save with current CAS/hash; explicit inheritance removal and oldest-state optional-key absence; separate diagram/window history with source-declared global font protection; and ordinary common Lock saving both owners and retiring Diagram targets. Exact full workspace, opaque/private metadata, source pointer/bytes/provenance and saved checkpoint checks remained in the original assertions.

Computed SVG text readback was A: Georgia, 22px, 700 (source-declared); B: Courier New/Courier/monospace, 24px, 800 (local selected typography). Both node colours remained subject to the existing assertions. This evidence covers supported bounded fixture correctness, not arbitrary Mermaid graphs or history capacity.

## Visual inspection and limits

I inspected both diagnostic screenshots. The attached KPMG surface visibly contains the shared toolbar, compact Style controls, history popover and styled diagram. At the wider attached size the controls fit in two rows, and the source-protected A and locally styled B are visibly different. The narrower detached surface wraps controls into more rows, and number-input placeholders Theme default/Inherit are clipped by their short width. The history popover overlays part of the source/style area while open. The screenshot after cancelling a deliberately invalid edit still displays the earlier refusal status, despite subsequent valid history and save assertions succeeding. These are bounded visual observations, not closure of general UI consistency or physical multi-monitor UX.

The diagnostic success does not qualify the still-unamended tracked harness. A final genuine development run should follow the authorized enabled-option correction after the common freeze ends. No package run, full-suite result, hosted evidence, maximum-size claim, historical CI375341 timeout explanation, or independent release approval is asserted here. Earlier startup/CSP adverse receipts and reports remain unchanged.