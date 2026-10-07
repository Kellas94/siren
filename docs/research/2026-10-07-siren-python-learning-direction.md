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
