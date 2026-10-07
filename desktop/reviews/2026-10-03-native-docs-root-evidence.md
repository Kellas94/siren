# Native readonly Docs — implementer evidence, 3 October 2026

Written by the implementing coordinator; this report is not an independent approval or public-release verdict.

The actual Docs window now reads only its own selected document through the native FIFO owner. The native registry supplies its document identity; renderer requests contain no project, entity, path or write selector. The document fingerprint is checked before and after I/O. Owner pause, PIN transition, native frame loss and changed selected content refuse publication. Both preloads expose just `sirenDocsRead.getDocument`; production domain factories are readonly and edit/flush/link admission remains explicitly refused. Pending reads participate in the existing native drain set.

The separate CSP-hashed Docs script renders a section outline, expandable structured fields, agent metadata, source-reference rows and release information. Object/array fields initially render up to 40 items per expansion, with additional pages; text initially renders up to 24,576 units, with explicit expansion. Literal imported markup uses text nodes and cannot instantiate images, scripts or external resources. System/Light/Dark, Refresh and standard native Close are available. This is a readonly document inspector; rich-text editing, rendered Markdown/HTML, native attach-back, production Home routes and physical-monitor qualification remain open.

## Verification

- Final frozen full suite `evidence/native-docs-final-suite-result.json`: **618/618**, identity 2 plus remaining 616; exit 0, no failures/skips/cancellations/todo and `changedInputs: []`. Started `2026-10-03T16:50:18.603Z`, finished `2026-10-03T16:53:53.288Z`; log SHA-256 `981d3db3df0f8da1cb953c6c48783db53084125cec91b9a93fd034a1c2653b17`. Focused owner/domain/primary checks 54/54; corrected native integration/Docs controls 10/10.
- Actual production Electron/PIN/Code/Docs probe `evidence/source-read/2026-10-03T16-42-46.503Z`: COMPLETE, five groups, captured inputs unchanged. It opens two native Code views and one Docs view, verifies the exact independently authored document and fingerprint, opens its agent section with real input, checks section/appearance/Refresh controls and literal adversarial imported markup, and refuses Docs reads from Code. Unrelated document/source bytes are absent. The same run opens 300,000 Code content lines, finds the EOF marker through the UI and verifies immutable original disk bytes. Actual Lock destroys satellite targets and refuses old primary source reads. Light/dark Docs screenshots were inspected.
- Package source allowlist/dependency closure and both role-script CSP hashes pass. Docs receives no CodeMirror bundle or full project mirror. Existing native entry, failed destruction and clean-close journal tests retain their original oracles.

## Preserved failures and limits

Three new native Docs tests and two production/preload tests first failed because the transport was absent. The role-entry test first refused the missing second Docs script. A fixture assertion expected an extra undefined argument; it was corrected to the actual two-argument finite IPC call, without changing product behavior.

The first full suite `evidence/native-docs-suite-result.json` is retained as ADVERSE: **613/618**, five `DomainRepository is not defined` failures in the existing native-window VM fixture. Its context omitted the newly imported real native classes. That fixture now imports the actual `DomainRepository` and `NativeDocsReads`, preserving all identity, failed-destruction and journal assertions; the final distinct frozen suite above passed. Original failed log SHA-256 `9930207fa77579c27dc0dbf3785dd99d470cc61477b524db318fb321e6f54bbb`.

No new packaged execution, hosted CI or independent-review success is inferred. Earlier CI39/Launcher30 successes qualify the preceding source-read commit. No main merge or public release was performed. The requested one-time Git graph stays unchanged.
