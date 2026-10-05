# Code/Docs docking — implementer source checkpoint

Author: root implementation agent `/root`. This is implementer evidence, not an independent approval. Date: 5 October 2026. Source base: `437bfd7b670b2e1c6a3af5c08d72c3d85cd0b560`; exact reviewed input hashes are preserved in the separately authored follow-up and `2026-10-05-workspace-dock-source-receipt.json`.

## Delivered scope

Production native Code/Docs now use a genuine BaseWindow and one owned WebContentsView. Attach/detach moves the same renderer below the shared 48px workspace shelf; only the selected attached view is drawn. Shelf tabs restore or select views and return to the workspace. Actual native headers, Window menu/context menu and Ctrl+Alt+A/D expose the transfer; main/cycle shortcuts resolve the logical selected view. Native titlebar controls remain available. Guide explains these delivered controls.

Caller identity, frame, role, project epoch and transition gates remain main-owned. Dock IPC exposes bounded metadata and finite commands. Async factory failure, close, Lock, selection and Quit retirement require actual renderer plus shell destruction; failures retain handles and fence further admission. Attached layout commands capture the actual originating grant before moving the visible host. Exact Windows DIP/pixel roundtrip projection handles the observed 150% display readback without a blanket pixel tolerance.

## Final source evidence

All owned runners closed with exit 0; before/after captures match current files. The machine receipt independently recaptures every named input and result hash.

| Root-owned evidence under `desktop/evidence` | Observed result |
| --- | --- |
| `workspace-surface/full-suite-2026-10-05T17-31-27.083Z` | 1047/1047; zero fail/cancel/skip/todo; 417 unchanged inputs |
| `window-focus/2026-10-05T17-31-13.295Z` | 9 real native focus/minimize/layout/Lock cases |
| `workspace-dock/2026-10-05T17-32-18.973Z` | 5 groups: 12 attachments with two Code/two Docs, identical native contents/frame/DOM/selection, exact Undo/Redo versions, shelf/resize/save, native keys/visible-host monitor transfer and common Lock |
| `docs-edit/2026-10-05T17-33-15.554Z` | 4 groups; 300000-line fixture, explicit edit/save, conflict retention, Close/reopen and Lock; original source retained |
| `source-edit/2026-10-05T17-34-10.297Z` | 4 groups; 300000-line Python edit/save, Close/reopen and Lock; immutable selected version/Docs retained |

The independent review agent `/root/workspace_surface_review` authored `2026-10-05-workspace-dock-integration-independent.md` (SHA-256 `389432fe1e35c82dda57f842b3bfa2ac466ea8a7f0f87705f3fdf04fbcca71d0`), initially CHANGES REQUIRED, and separate `2026-10-05-workspace-dock-followup-independent.md` (`203f0ae050a458f9f696068d766731f8a8cc645b1da98218e117b731ca2c45fb`). Reviewer independently executed 72 tests and original adverse/adversarial probes; inspected root native evidence without claiming to have executed Electron. No report was replaced or relabeled.

## Retained failures and causal corrections

- Initial reviewer P2: resize suppressed by roster freeze left old view bounds. Corrected trusted post-gate shelf/focus remeasurement; original unchanged reviewer probe and RED/GREEN verify catch-up.
- Initial reviewer P2: stale attached peer refusal happened after incoming attachment, drawing two views. Preflight all attached peers and target before movement/selection. Original unchanged reviewer probe proves refusal leaves incoming window detached and only one view drawn.
- Dock `17-12-26.007Z`: fixture confused outer bounds with client viewport. Corrected test to actual client bounds minus shelf; no product change attributed to this failure.
- Dock `17-16-38.930Z`, `17-19-54.399Z`, `17-22-12.065Z`: requested width1120 read back1121 at150% scale. Actual diagnostic proves public roundtrip and actual setSize/setBounds yield1121. Exact projected readback plus unsafe-projection refusal tests and final real native repeat close this measured issue.
- WindowFocus `17-25-41.895Z` parallel and `17-27-23.541Z` solo both failed restoring minimized Code. Actual isolated native before/after probe proves Windows minimized client bounds0x0. Surface now validates, restores, revalidates, then measures; genuine RED/GREEN and final solo WindowFocus9 close the regression. It is not attributed to speculative foreground interference.
- Old native-window-shells privacy-sentinel ADVERSE remains unexplained/unretracted. Historical pre-correction positive artifacts are not final-source receipts. Ordinary sandbox esbuild access failure and evidence-parser reporter-format mismatch remain tooling failures; elevated build/test and exact source-hash checks did not weaken product controls.

## Limits and next checkpoint

This source checkpoint qualifies the named Code/Docs integration and configured native cases. It does not complete whole Task4/Task6, diagram/presentation attach-back, full keyboard/IME/theme matrices, physical monitor unplug/DPI settings changes, online accounts, AI, or a production release. Package construction and actual copied-package qualification follow separately. No installed app replacement, main merge, public binary release or release approval is claimed. Original foundation reports and adverse artifacts remain preserved.
