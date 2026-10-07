# Independent next-batch analysis: native Docs context and Present authoring

Author: /root/workspace_surface_review. 2026-10-06. Read-only static analysis at local HEAD46192c5069acee395c221818cff91ce7cc7b0ae2; coordinator identifies canonicalce8096/PR2draft and CI37409331278 as active. I did not independently refetch that CI, rerun qualification, launch Electron, inspect new runtime screenshots or change source/tests/generated/workflow. Earlier authored reports remain untouched. This is a proposal supported by source, not implementation or PASS.

## Recommended largest useful bounded batch

**A native project-context workspace plus saved-deck authoring, on the existing Docs and Diagram owners.** Deliver a usable Docs register/context inspector and a Presentation authoring mode for the selected Diagram, while retaining Presenter/Audience as saved-version playback roles. This replaces the largest remaining visible/action gaps with real operations, rather than adding another layer of buttons. It is one milestone with two domain lanes sharing project context, the current common shell and existing save/Lock ownership.

The batch should include: searchable/filterable document register; editable document type/owner and bounded agent identity/context; typed saved-entity references; ordered presentation steps, title/text cards and private notes; save-before-present plus exact explicit refresh. Include the supporting CAS/validation/draft changes in the same batch. This cannot be implemented safely as UI-only wiring.

## Original reference versus actual native doors

| Capability | Trusted R78 evidence | Current native gap / relevant path |
| --- | --- | --- |
| Document register | wpSearch, wpFilter, wpListToggleButton, wpList; filters type/status/current diagram/unlinked/release/drift, lines22135–22159 | Home library is a paged name-search dialog. NativeWindowCatalog projects Docs ID/title/readonly only; no register metadata or filters. |
| Document context | wpType, wpOwner, wpReviewButton, wpRef/wpUpdated/wpSignoff, lines22192–22215 | docs.js renders these non-title/block fields through the generic field() explorer. Docs draft edits title+blocks only. |
| Agent identity/context | wpAgentStrip/renderAgentStrip, lines68308–68384; identity/version/platform/environment/oversight/release/governance navigation | Native has useful prompt/settings block editors, but no own-document agent inspector or identity actions. These are different from editing prompt text. |
| References | wpLinkKind supports diagram/document/block targets, lines22221–22235 | Native provides immutable linked-Code pointers and name/notes edits. Arbitrary document/diagram/block references remain preserved data; a native typed reference writer/navigation service is absent. |
| Review/release/comments/history | wpReviewButton/wpReleasesButton/wpCommentsButton/wpChangesButton and their panels | Existing fields are preserved; no full native operation/trail protocol. Do not render pretend Approve/Release/Delete actions. |
| Deck composition | presentSequenceList, Add a slide, sequence Edit/Reset, lines23179–23190 | Native Presenter displays saved slides and navigates them; no authoring controls. |
| Private notes | presentNotes/owner/duration/source/checkpoint controls, lines23145–23156 | Native Presenter notes are a read-only p element. Presentation deck loader reads saved notes. |
| Playback tools | Original autoplay/live tools/record/export/scenarios/chapters, lines23159–23203 | Current native IPC has navigation/refresh/display/Audience/fullscreen only. These are larger separate transport/media tasks, not part of a first safe authoring batch. |

## Existing ownership makes the batch practical, with specific missing seams

Docs: NativeDocsReads binds an empty getDocument request to exactly one currently granted document. NativeDocsEdits routes through WorkspaceCoordinator and domain.mjs, with documentVersion hash, operation ID, validation, committed receipt/readback and peer-reference notifications. The current draft owns dirty state/history/save/flush and retains the original document's unrelated fields. It builds content={title,blocks}; the normalizer accepts rename/replace-blocks/replace-content only. Agent/type/owner/references cannot be appended to that payload unnoticed.

I independently ran three pure normalization checks, with no durable calls: Docs replace-content plus extra owner was REQUEST_REFUSED; a proposed update-context action was REQUEST_REFUSED; Diagram update-style with presentation was structurally accepted. The last result is shape normalization only, not semantic validation, a grant or a successful save.

Extend Docs with finite context/reference intents and a combined content+context save when both are dirty. Use the same selected-document CAS version and one manifest commit, not a second autosave store. Extend validation using the exact frozen product semantics and preserve unknown agent fields, source pointers, releases, comments and histories byte-for-byte unless an explicitly supported field is intentionally edited. Register projections may expose bounded type/owner/status/agent identity/reference counts to the workspace owner; no document bodies or instructions in the roster and no satellite peer-body reads.

Present: a deck is already the selected Diagram.presentation projection, not an independent presentation file. NativePresentationDecks derives the version hash from the exact Diagram, maps stable slide IDs/notes keys, and explicitly isolates private notes/render context from Audience. domain.mjs includes presentation in the Diagram style allowlist; build/import-validation.mjs delegates it to sanitizePresentation and requires equality with the validated input. NativeDiagramEdits supplies the existing working-view admission and save/Lock owner.

However the renderer Diagram draft's styleCopy currently admits only its six bounded style fields and rejects presentation. It needs a typed presentation draft mutator, not a new button calling setStyle blindly. Let that draft save source/style/presentation together under the existing integer Diagram version and one transaction; stale peer saves must retain the authoring draft and require explicit conflict handling.

Do not make native Presenter writable: main currently assigns Presenter read access, its IPC has no write method, and coordinator treats it as an immutable readonly participant. The preferred first path is **Present library → Edit deck → the selected Diagram's existing working renderer in Presentation mode**. A private Presenter “Edit deck” command, if added, should resolve only its captured deck ID in main and open/focus that Diagram door after existing preparation; it must not accept arbitrary project/deck IDs or grant Presenter a generic Diagram writer. Shell navigate currently accepts only surface, so direct own-deck routing is an explicit finite adapter change, not existing support.

## UI placement preserving the common shell

Keep the existing54px application bar/theme and shelf as the common frame. Turn the Home Docs library into a register view/sheet with search, one compact filter menu, a clear New document action and rows showing name/type/owner/status/link context. The register remains workspace-owned. Opening a row uses native open/focus authority; preserve an existing dirty renderer rather than silently replacing it.

Inside native Docs keep one entity header and the current Save/Edit/Refresh/transfer actions. Put **Context** in an own-document inspector/drawer: type/owner, agent identity/context, and references. At narrow sizes use a sheet with its own scroll/focus trap rather than permanently subtracting a side column. Prompt/settings/knowledge sections stay content; context is not duplicated as another header band. Readonly mode shows the same facts and omits mutation controls.

For the authoring Diagram renderer use a simple **Diagram / Presentation** mode switch below its existing entity context. Presentation mode shows a step list, saved-content preview and an inspector for the selected step's card/notes. Reorder/duplicate/remove are real list actions; Add slide offers only supported types. Primary action remains Save; Present saved version enters the existing readonly player after successful preparation. Audience UI gets no authoring chrome or private fields.

First native card scope should be title/text, which publicCard/cards.js already render. Preserve existing unsupported table/image/embed/doc/facts cards for review; do not manufacture placeholder fidelity. Reveal cards are currently refused by the native card renderer, so do not expose a functioning Reveal toggle before that render/transport contract exists. Keep raw imported notes/settings/sequence extras unless intentionally supported. Review/signoff/release management, image/media import, recording/autoplay/live branch tools and cross-document live cards remain separate batches.

## Acceptance for this future batch

Use actual pointer and keyboard paths for register filters, context edits, references and deck composition. Verify one own-document/own-Diagram grant at every call, cross-project/borrowed-ID/readonly/stale/Lock refusals, and exact conflict retention. Save combined body/context or source/deck once; read back the exact entity and unrelated source refs/history/release/opaque fields. Lock/Close/Quit/navigation must wait for the same genuine dirty-owner receipts; failed validation must leave local edits available.

For presentation, two authoring views racing a Diagram save must not overwrite one another; reorder must preserve notes on stable IDs, duplicates receive new IDs, and unsupported cards remain exact. An open Presenter/Audience remains on its captured saved version until explicit refresh. No draft/private notes/agent context may enter Audience's public frame. At minimum/narrow and normal sizes, require useful content space as well as hit-tested controls and real Tab/Enter/Escape, in attached/detached Docs/Diagram; retain common themes/CSP/budgets and bounded paging. This is future acceptance criteria, not evidence that these operations are implemented or qualified now.

## Exact static inspection hashes (targeted reads included)

| File | SHA-256 |
| --- | --- |
| baseline/R78.html | 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4 |
| src/ui/workspace/home.js | 5dbf51ef13e76f9239e4a5ac6e3aada5878eafd1623220ada4840e14438a3eac |
| src/windows/catalog.mjs | a6e66498c497e5ffeb6451e52619ab1150101a546508390821efaa55c45e6a2f |
| src/windows/docs-reads.mjs | fb6fdba3f63e3338127d196691b9ce506f0c5e397a1e2ee3b7d997740e4aa764 |
| src/windows/docs-edits.mjs | 8a535cc0b66805a8e785f8c52b4f74592de59eff39c947c906072ccba4d42852 |
| src/ui/windows/docs.js | ae30f89d77a618829d70e5876148e980ff2a981430e7bbfa9ada801844a347b9 |
| src/ui/docs/draft.js | 4769569526c2950361c7afc84bdf868cc8b8fe2faabe021c947bebeb1a5d64a8 |
| src/ui/docs/structured.js | 9a2be0cdd94be56d0f6734279f8b775c6770b1deb96b6badc15d1d6271dfa87e |
| src/windows/domain.mjs | 7992c2cfa25bf6ce84a598c83d2f4db7dd520196a12eadcd5b20d409b0c8de9d |
| build/import-validation.mjs | 6891581b3fc1b885ba49c0cea6993a54ddce82717bba67ee12276faa4b0a8d0c |
| src/projects/domain-validation.mjs | a1d4016a04be39f9296ea3c16e72cb2b2aca7bb15c997d4df510a734be48bdbe |
| src/windows/coordinator.mjs | 6940ced31f008afcd65ae66457c6c3ca834463fc759935140fe640bc9b4b1af1 |
| src/windows/diagram-edits.mjs | 919ee63d1f7198075a5868519d3ea70dcc10ef2711a56937e9696241aee6c1a5 |
| src/ui/diagram/draft.js | 0eb8dda1281dab8ddcc10b4bca0a23430f0898dc30fdf6573bc33f327e99916f |
| src/windows/presentation-deck.mjs | 904b3c473c5aebc2dc5dd96ffa0942afa4ff21f93a3c9dd5067e9bdb157f550e |
| src/windows/presentation-ipc.mjs | 9141a114c6974978cbd020c61951de18fefab1bd432b731827590cb36f27af77 |
| src/windows/presentation-preload.cjs | dbf09b4322eaa56836dc5e0859a08bb4a40c5b59af8f51992a3d00747a58e9fd |
| src/ui/presentation/window.js | 116e4bbaa5966fcbbd7e94b630a202098368a1644ea7ab7f86359a3d95dc81db |
| src/ui/presentation/cards.js | 9770ee1c57accb75dcd5e96ca733d38bc233a281e3e0440669aab857a7c4cf1b |
| src/appearance/ipc.mjs | a734cfb2aa0ced3f985a739b1bbcb7e57b1c2cbf3f9e63d02d2da38b80f811a8 |
| src/navigation/document-create.mjs | 8ba075ee638fea866af68dc51c7b87455378c6c4e440dfcdf8b2385683958878 |
| src/windows/entities.mjs | faf1f39f3d0c793e42867e15627a71b89f6027d1954617f8e91b97f88322ffe4 |
| src/navigation/resolver.mjs | 188e53d3c607a0c5669792ca0576a33d499effde1117403263a1e45480b66be6 |
