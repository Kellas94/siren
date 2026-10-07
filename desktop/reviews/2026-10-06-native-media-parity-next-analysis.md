# Remaining Docs and Present parity after context/deck authoring

Author: /root. Static follow-up at product `2c54954c4e789cf428fd54dd625e717bf369a650`. This is a proposed next batch, not implementation, independent review or runtime approval.

The user-supplied HTML remains the reference. The new batch closes metadata register/context and finite title/text deck editing. It does not close the remaining document and presentation environment gaps.

| Area | Current source evidence | Remaining work |
| --- | --- | --- |
| Docs image evidence | R78 image blocks store `dataUri`, caption and fileName; the native reader only renders heading/text/table/checklist/prompt. | Own-document image display and bounded import/replace/caption/remove, preserving unknown fields and saved evidence. A title or raw preserved-field listing is not an image viewer. |
| Presentation media | `publicCard` preserves the kind/title of non-text cards; `sirenRenderPresentationCard` accepts title/text only and refuses reveal. | Real table/image rendering and authoring, explicit public projection, finite media references and transport/version tests. Do not advertise unsupported cards as playable. |
| Review/comments/releases | Metadata and historic records are retained; Context deliberately does not approve a document. | Explicit append-only review/comment/release intents and exact provenance. Existing hashes or a displayed status are not independent approval. |
| Scale | Docs reads up to 4,096 blocks but the combined save admits 300 blocks/2 MiB; rich inline text is separately bounded. | Separate measurable read/edit/media budgets and incremental document operations before increasing limits. Large imported documents must remain readable and unchanged when edits refuse. |

Recommended next bounded implementation: native Docs evidence images and public presentation tables, using the current own-document/own-Diagram save owners. Start with exact imported legacy records and explicit supported fields. Keep image bytes out of catalog rows, reference discovery, unrelated windows and Audience unless the author intentionally presents that image. No external URL fetch, arbitrary file-path authority or executable SVG/HTML media input.

Before exposing image import, resolve the real storage boundary: the existing code-source repository admits UTF-8 text and is not a binary media store. Large evidence should use immutable content-addressed assets with a coordinated manifest, recovery and cleanup; embedding larger base64 values or relabeling a binary image as code does not provide that contract. A bounded legacy image reader can be a separate first step without silently rewriting imported records.

Qualification should use actual known images/tables, invalid media/signatures, unknown imported metadata, stale saves, two working windows, Lock/Close and copied packages. Record displayed public pixels separately from private metadata and preserve unsupported imported cards. Physical monitor/DPI/IME/accessibility remains a separate open scope. This analysis does not change the current frozen product or hosted qualification.
