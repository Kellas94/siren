# Multiline Code input and Home rows — independent follow-up review

Author: `/root/diagram_history_final_review`. Date: 2026-10-07. This is a separate review of `multiline-input.js`, its public CodeMirror extension in `editor.js`, associated tests, and the Home context-row block layout. Earlier original/recheck reports and native adverse records are preserved.

Disposition: **no actionable defect reproduced in this bounded source/unit review**. This does not complete native qualification or close the original ADVERSE4 input observation.

## Evidence and API review

Read the independently authored original native adverse and passive input diagnostic reports. Their evidence shows the leading LF delivered in trusted `beforeinput` and initially present in DOM, then absent after model/highlight repaint and from the durable edit request. The exact private CodeMirror cause remained unproven. This review does not broaden that observation into a claim about ordinary clipboard paste or IME.

The correction uses installed public CodeMirror APIs: `EditorView.domEventHandlers`, `EditorState.replaceSelection`, `view.dispatch`, `EditorView.editable`, `state.readOnly`, `view.composing`, and `Transaction.userEvent`. Installed view documentation and implementation confirm that the first handler returning true suppresses later handlers and built-in behavior; custom handlers precede built-ins and run on the editor content element. The event is prevented before a replacement transaction is dispatched through the existing application adapter. There is no private CodeMirror patch or direct durable write.

The handler requires trusted, cancelable, not-already-prevented `insertText` carrying CR/LF, with both editable and read-only checks. Event composition and view composition cause it to yield to existing handling. Single-line input, paste and noncancelable input are not intercepted. Existing adapter admission still checks read-only, paused, fenced, saving, lifecycle, Unicode and budgets; the handler does not replace these checks. Composition guards were exercised by unit fixtures, not a physical IME session.

Home changes set context-bearing row buttons to block layout and left alignment; existing metadata captions remain block children, with the existing click/open path unchanged. This is a source assessment. The reviewer did not visually inspect the corrected native layout.

## Checks actually run

```text
node --test tests/code-multiline-input.test.mjs tests/editor-adapter.test.mjs tests/code-commands.test.mjs tests/code-view-lifecycle.test.mjs tests/home-commands.test.mjs
```

Result: **38 tests passed, zero failed**. These exercise leading blank LF, selection replacement, Unicode, history Undo/Redo, composition/read-only/editability refusal, plus existing adapter/command/lifecycle and Home command checks. No renderer build or GUI was run.

An additional independently authored executable probe used the actual editor adapter and installed CodeMirror history with an in-memory client receipt fixture. It inserted leading LF, CRLF, lone CR, Unicode and trailing blank lines, verified the exact client edit payload and saved text, then verified Undo and Redo restored exact strings. A paused-adapter write was refused with no extra client operation. This is actual adapter execution but **not native persistence or trusted browser-event execution**; the event object/client were explicit fixtures.

## Frozen inputs and retained evidence

Thirteen inputs, including the installed CodeMirror implementation/type declarations, were captured before and after checks: **no changes**. Both manifests have SHA-256 `d84ba2b5bc8b0f5e07dfc975d4901e44a2435fa689f71a5ba577b3be93e339fc`.

| Input | SHA-256 |
| --- | --- |
| `src/ui/code/multiline-input.js` | `3c6f993d86d2ed75c9846229b277fb3e948688858e9dfeb3e44f0fa0e6086247` |
| `src/ui/code/editor.js` | `cfa3516721b4641382f8885b80a24f85414fd65884c46061cd286b4f59c90260` |
| `src/ui/workspace/home.js` | `42efa9de9ed943d66db0b652ef3badfaf4e48150b63908032a7ca609c0cde8cc` |
| `tests/code-multiline-input.test.mjs` | `7897fdcc75952ce2f4587f30e34336eff182f5eb7007ddae99770c21b27473ab` |

Evidence directory: `evidence/code-source-context-independent-review/`.

- `multiline-inputs-before.json` / `multiline-inputs-after.json`: complete input identities.
- `multiline-scoped.log`: SHA-256 `0ebe56f9296839d78fa8f936812012e726e88576a0275a94f9f4597c34009b76`.
- `multiline-adapter-probe.mjs` and `multiline-adapter-probe.log`: retained independent probe; log SHA-256 `6a1f3e36436668446be1bafaf7d700b9d7d5dccf02a176c18c71d779204bd948`.

No product, tracked tests, harness, build, workflow or generated output was changed by this reviewer. No native/copy-package/hosted/full-suite/release approval is implied. Native execution of the original exact input action and oracle, ordinary input/IME coverage, and corrected Home layout inspection remain separate qualification work.
