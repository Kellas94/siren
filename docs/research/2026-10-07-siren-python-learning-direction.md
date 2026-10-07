# SIREN as a learning workspace

User direction recorded on 7 October 2026: SIREN should teach the person using it, particularly Python, rather than only display or document their code.

## Product objective

Make the user's own code the starting point. Help a non-programmer understand what a function does, how data moves, what a result means and how to investigate a failure. Keep explanations progressively disclosed so experienced users retain a compact workspace.

## Proposed next design boundary — not implemented or approved as a runtime feature

- Connect a selected source definition or code range to its existing structure map, a plain-language explanation and relevant manual topics.
- Offer levels: purpose first; then inputs, outputs and conditions; then language details and source references. Preserve exact source/version identity beside explanations.
- Add an offline Python glossary with small examples: variables, values and types, function parameters and return values, conditions, loops, collections, exceptions, imports and classes. Explain concepts in context rather than opening an unrelated long manual by default.
- Let users work through finite logical checks, inspect a contrasting example and explain their understanding. Exercises should use separate examples or explicit drafts, preserving original project code.
- Map an identified error to its cause, uncertainty, affected code and a safe next check. Unknown errors remain unknown; arbitrary terminal text must not silently select a diagnosis.
- Distinguish syntax/structure inferred statically from behaviour actually observed during a qualified execution. A structure map is not a runtime trace, and an explanation is not a proof that code is correct.
- A future debugger could support observed stepping and data inspection only after its native execution and ownership boundary is qualified. Real Terminal remains NOT_ADMITTED in the current preview.
- Keep baseline learning available offline and without an AI key. Any later optional AI explanation needs a separate design for consent, source disclosure, secret handling and provider configuration.

## Existing foundation

Code already retains exact saved versions, Python syntax colouring, source navigation and bounded static analysis with explicit coverage. The approved Help & diagnostics module adds a searchable offline reference and Mermaid-independent interactive resolution flows. These are a foundation for learning; the preview does not yet provide a complete Python course, runtime debugger, automatic repair or AI tutor.

## Design and qualification needed next

Review an integrated Code-to-manual teaching flow before implementation. Validate it with a beginner task (explain an input/output, follow a condition, identify an exception) and an experienced-user task (inspect the same source without persistent instructional clutter). Use exact saved-code fixtures, adversarial unknown/error cases and a clear static-versus-observed label. Select any additional manual content or dependency only after checking its current source, redistribution licence and offline update policy.

## First increment recommended after foundation review

The read-only foundation review in `../../desktop/reviews/2026-10-07-python-learning-foundation-review.md` confirms that the current map represents syntax containment, not data flow or an observed execution. It also identified a real parser-node mismatch that omitted assignments. The current repair adds assignment/update nodes and distinguishes annotation-only statements; its implementer and owner qualification are separate from the initial review. A specific annotation hint explains that the statement does not assign a value here or check runtime types.

Reuse the existing collapsible **Structure** panel for an optional **Understand** view. Keep the selected code visible. Show the saved version/range, coverage and “Static · not executed”, then two to four literal syntax facts with exact source links. Expand a concept chip only when requested, with a short explanation and a separate contrasting example. A return expression can be shown as written; it must not be presented as a guaranteed result. A function name alone does not establish the function's purpose.

A separate learning module would disconnect explanations from the code being inspected. A permanent instructional sidebar would reduce editing space and add noise for experienced users. The existing optional panel gives the first increment a smaller, familiar surface, using current themes and keyboard/focus behavior. It requires a reviewed finite fact projection and selection adapter before implementation; no new dependency is justified by the existing editor/parser/manual capabilities.

Start with definitions, parameters, assignments versus annotations, conditions, loops and return sites. Keep general concept explanations visibly separate from facts found in the selected source. The full Python manual, runtime stepping, output prediction, arbitrary exercises, automatic repair and AI explanations remain separate future decisions. The contextual learning view is a design recommendation, not an implemented feature or an approval of a new runtime capability.
