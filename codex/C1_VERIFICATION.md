# C1 — Find in document verification

Status: applied to the reviewed application. The checklist below describes the package-level coverage; the final post-C6 real-UI regression is recorded after it.

Apply `patches/C1_find_in_document.py` to a copy of the real HTML, serve that copy, and drive its own Docs UI.

- Syntax: `python syncheck.py <patched-copy-if-supported>` or temporarily run the same extraction plus `node --check`; expected exit 0.
- Open Docs and import the supplied 39-block Agent Spec. Press Ctrl+F while focus is in a prompt textarea and while focus is on the document background. In both cases `#wpFindBar:not([hidden])` appears and `#wpFindInput` owns focus.
- Search a known phrase in collapsed knowledge. `#wpFindCount` reports `1 of N`; Next/Previous and Enter/Shift+Enter wrap; the containing `details.wp-knowledge-content` opens and `.wp-find-source-current` scrolls into view.
- Put a phrase across formatting boundaries in a text block, e.g. `alpha <strong>beta</strong>`, and search `alpha beta`. Supporting browsers expose `CSS.highlights.get('siren-wp-find')`; no `mark` element is inserted and the stored/exported `block.html` is unchanged.
- Search text in a heading input, table cell, checklist input, prompt textarea, setting, and knowledge textarea. Form controls receive `.wp-find-source-match`; the current control also receives `.wp-find-source-current` without moving focus from the find input.
- Keep the bar open, switch documents, then add/remove a block and edit matching text. The query is rerun against only the new/current DOM; count updates after about 90 ms and no detached match remains.
- Press Escape in the find input or click `#wpFindCloseButton`: highlights/classes clear and Docs stays open. Close Docs, press Ctrl+F, and confirm `#wpFindBar` remains hidden while the pre-existing editor-find behavior still runs.
- Fallback: before app initialisation, make `CSS.highlights`/`Highlight` unavailable. Matches remain navigable, matching fields are outlined, the current rich-text range uses native Selection, and `#wpFindCount[title]` states the limitation.
- Stress: search a very common token in the 254k fixture. The count remains exact and every match remains navigable; only the first 2,000 text ranges are painted, disclosed in `#wpFindCount.title`.

Final executed regression: `qa/c6_large_doc_smoke_ui.js` imported the supplied 39-block/254,000-character fixture through the real Docs UI, pressed Ctrl+F, found the unique tail at `1 of 1`, opened exactly one collapsed Knowledge row, selected the exact text, left 25,818 characters deferred, and recorded zero page errors.
