# Code context/commands: original-input passive diagnostic

Author, native diagnostic executor and analyst: `/root/media_batch_review`, 2026-10-07. This is separate from the immutable original ADVERSE4 receipt/report. No source, product, build or tracked test was changed; no oracle/deadline was relaxed.

Ignored diagnostic driver `evidence/workspace-surface/code-context-commands-input-diagnostic.mjs`, SHA256 `226b3f387d6b72510814ba89bbe074eefaebe8a0977cc6a6f7a4642ee154799a`, is an original-harness copy with relative helper imports/evidence directory adjusted and bounded passive beforeinput/input/selection/DOM/source-receipt-attribute observations. Original actions, expected exact bytes and wait deadlines remain unchanged. Native execution occurred once under normal Windows token, Electron sandbox retained, exclusive GUI, owned isolated profile.

Actual receipt `evidence/code-context-commands-input-diagnostic/2026-10-07T00-56-04.657Z/result.json`, SHA256 `c83a656a4f0b09a8d6840626e8014116f01da448b52e8a06f98a1539425241fe`, is ADVERSE4, changedInputs[], controllerexit1. Owned PID28084 was closed/confirmed absent. Original tracked harness remains `c0a026e3b3ccd7e82c45baad9c8a61a66231434dde949c539d545800018c4e7e`. The original result `3c42e520…`, original source snapshot and report `c02343d3…` remain unchanged.

## Proven input boundary

Bounded passive trace has14 entries, below its cap120. Times are actual performance.now values within the working Code renderer:

| Time ms | Observation |
| --- | --- |
| 857.3/858.0 | Trusted Ctrl+End has produced exact editor EOF selection157/157; original8 lines end in an empty cm-line. |
| 939.1 | Trusted beforeinput, inputType insertText, data exactly begins LF then `def newly_saved(context):…`; selection remains157/157. |
| 942.1 | First trusted input event. Actual .cm-content HTML now includes the intended empty cm-line before newly_saved, followed by its return and final empty line. The initial LF was therefore delivered into DOM. |
| 945.8 | DOM/selection attribute observation shows model selection209/209 and syntax-highlight repaint. The empty cm-line before newly_saved has disappeared. Original expected units would be210; resulting source is one LF shorter. |
| 946.2–947.6 | Additional trusted native input/selection events observe the already-shortened, highlighted10-line DOM. |
| ~1005.4 | Main sourceVersion/SHA/metrics attribute publication confirms version3 with212bytes, agreeing with the exact original journal pattern. |

This locates the observed difference after initial native DOM insertion and before the durable source request. It contradicts a simple assertion that Input.insertText or Chromium initially omitted the leading LF, and it does not show SourceRepository losing bytes. The earlier original journal directly showed that the repository was asked to insert text without the initial LF.

## Source inspection and uncertainty

Actual installed @codemirror/view version6.43.13; dist/index.js SHA256 `5626b4f31cdf55fd6a92be66d28cd40e9446d2caeb10a5b3f3e6c1c02be42950`. Its DOMReader (around4035–4070) derives separators using an existing Tile.breakAfter when the previous node already has a tile, and applyDOMChange builds a transaction from the derived DOM range. An old EOF empty-line tile has special separator behavior, making a DOM-reader boundary plausible when native insertion appends block siblings. This exact private branch was not instrumented or independently reproduced, so it remains a hypothesis.

SIREN editor-adapter SHA256 `3ea0de6f6dde5b270a114705699c8a2147169b3e9dabf5ccb9f64f3dd8cd3a20`: applyTransaction iterates the accepted CodeMirror transaction changes, obtains inserted.toString(), updates state, and sends that text to the main source bridge. Source-client SHA256 `804f7568b8b824f2d41814718d22c9ffa372550da9d2e8eca09647c231ca5498`. No trace captures the exact CodeMirror transaction before the SIREN adapter, so the evidence narrows the problem to the editor DOM/model boundary but does not uniquely attribute the dependency or application layer.

No ordinary user clipboard-paste, manually entered multiline sequence, dictation, IME or standalone CodeMirror control was exercised. Therefore this diagnostic does not establish the breadth of a user-facing defect or justify calling the issue harmless harness-only transport behavior. The original exact-byte assertion should remain adverse. Replacing the expected source with the shortened text would conceal the observation. If a different supported input transport is later selected for the functional batch, it must be a separately documented action amendment, with the original loss retained as an unresolved bounded case unless a real correction is demonstrated.

A next bounded investigation could compare the exact original insertion route against a genuine keyboard Enter plus text route and/or clipboard paste, and independently observe CodeMirror transactions before application persistence. Such probes need root coordination and have not been executed here. No product correction is proposed as proved.

Four earlier functional cases remain genuinely completed, but working Undo/Redo/Save/index/reopen and common Lock have not been qualified by this diagnostic. No package/global/hosted/release or maximum-size claim is made.