# Python learning foundation — read-only review

Author: `/root/catalogue_view`, 7 October 2026. Source inspection and one in-memory probe of the exact admitted parser. **No GUI, build, Python execution, installation, AI, product edit or feature implementation approval.** Thirty-one input identities and the complete probe are frozen in the companion JSON; observed checkout HEAD was `9bc59a85ab225abe8f136fa77a84bdfa6d03b031`.

## What already exists

`src/ui/code/editor.js` provides CodeMirror Python colouring, search, selection, wrap, history and explicit Save. The local patched Lezer grammar is shared with analysis via `build/python.mjs`/`build/analysis.mjs`; its exact baseline and factory hashes are checked. This is a concrete syntax parser, **not CPython's runtime/compiler AST or interpreter**. Plain text/unclassified languages retain an honest non-Python path.

`src/ui/code/analysis.js` already supplies a collapsible Structure side panel with Source overview, Selected code, Selected code map and Compare sources. The index shows class/function names, async/nested labels, source offsets and lines. Clicking an index entry selects its **name**, not the complete function. The map supports folding, selecting exact code spans, literal labels and hover explanations. The current map is rendered as a nested list/tree; it is not a debugger or an observed flow diagram.

`src/sources/analysis-worker.mjs` emits definition name/range metadata or `syntax-containment` nodes/edges. The map's edges mean “contains”, not “calls”, “next” or “data moves here”. Node IDs are local to one projection, so they are unsuitable as persistent cross-version explanation identities. No returned model currently contains parameters, evaluated values/types, docstrings, return results, effects, resolved imports/call targets or a source-specific purpose explanation.

The service verifies immutable `{sourceId, version, sha256}` source bytes and a trusted worker, gates native Code authority, invalidates stale/dirty/pending source state, and cancels/clears on lifecycle changes. Analysis defaults to at most 2,097,152 UTF-16 units, 2,000 definitions, 200,000 visited syntax nodes and 2.5 seconds; maps have 120-node/120-edge caps. Stored source is bounded to 32 MiB; range offsets and coverage describe text units, not arbitrary line-count guarantees. There are two global worker jobs, 64-entry UI pages and at most 64 comparison choices.

`src/help/catalog.mjs` and the shared Help UI provide an offline **diagnostic** reference: 21 articles, including analysis coverage, with deterministic mappings and small independent decision flows. This is a useful presentation/lifecycle foundation, but not a Python glossary/course. `src/ui/code/docs-links.js` explicitly saves a source version before linking to Docs; it is not an implicit teaching-note save API. Generic Docs knowledge blocks do not establish the presence of a bundled Python manual.

## Confirmed prerequisite defect

`src/sources/map-worker.mjs:1` maps `AssignmentStatement`. The exact admitted grammar actually produces **`AssignStatement`** for `x = 1` and `x: int`, and **`UpdateStatement`** for `x += 1`. A read-only in-memory probe checked baseline SHA-256 `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` and factory SHA-256 `c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b`, then used the current map function on the resulting real tree. With zero syntax errors, assignment syntax was present but **no assignment nodes were emitted**. Yield, await and call nodes in the same fixture were present.

This is a concrete omission, not merely a proposed learning feature. Fix it separately with real-parser regressions before promising variable explanations. Annotation-only syntax must remain distinct from an assignment with a value; searching a label for the character `=` is insufficient. Existing generic assignment wording (“Stores a value…”) must not be applied to annotation-only nodes. This original review is frozen before any subsequent correction and is not a fix verdict.

## Deterministic explanations that are defensible

Start with literal syntax facts: “This saved range contains a function definition named …”, “This block contains a conditional/loop/return statement”, “This call expression is written here”, and “This is the syntax nested inside that block”. Each fact should link to its exact span and separately carry the analysis coverage. Generic concepts such as what a parameter or a loop means can come from reviewed offline content; they are not observations about what this particular program actually did.

The current tooltip dictionary is already a small concept hint, with an explicit caveat for calls. It is not a function explanation engine. A function name does not establish its purpose; a return statement does not establish a guaranteed result/type or that execution reaches it; an annotation is not evidence of a runtime type. Report literal expressions as written rather than inventing values or inferred behavior.

Even `complete` means the admitted parser/projection processed the requested range within its budgets. It does not certify CPython validity, successful execution, every syntax-kind's representation or program correctness. Parsing a selected substring may lose outer indentation, decorator or scope context. The current map does not represent every clause or import; no actual data-flow/call graph follows from its containment edges.

## A compact first flow

Reuse the existing **Structure** panel, with an optional “Understand” view/action inside it. Avoid another global toolbar, window, permanent help column or course landing page. Keep the editor and selection visible, use existing theme tokens/focus patterns, and reveal depth on demand.

1. Choose a saved Python definition or bounded selection. Show its name/version/range, “Static · not executed” and coverage. Dirty drafts require an explicit saved-version choice; opening learning content must not silently save.
2. Show two to four literal structural facts with source links, followed by two or three concept chips. Start with functions/parameters, return sites, conditions and loops; add assignment versus annotation after the prerequisite fix. Calls/exception syntax need explicit uncertainty.
3. Expand a chip for a short meaning and one small contrasting example. Deeper language reference stays optional. Examples are separate from the user's immutable source.
4. An optional “find this statement/parameter” check can validate a syntax span. Predicting arbitrary program output requires execution or a deliberately restricted, separately designed evaluator; it must not be simulated as if Python ran.

A minimal future fact record should bind `sourceRef`, range/units, producer/catalog version, coverage/errors, syntax kind/literal spans, and separate **observed syntax / general concept / unknown behavior**. The current analysis public API has no external Explain/selected-definition method, so a finite selection adapter and a small fact projection would be new work. They must retain source-generation/Lock invalidation and the existing budgets. Do not create a second analysis authority or persist bare map node IDs.

No additional library is justified by this first flow: editor, parser, source selection and Help primitives are already installed. Any future CPython manual import still needs current redistribution-licence, source/version, offline packaging and update-policy review. This review does not settle those external-content questions or claim a specific Python language-version compatibility.

## Scope of qualification still needed

Review the compact flow with one beginner task and one experienced-user task before implementation. Test exact immutable identity, Unicode/range bounds, invalid/partial/capped selections, annotation/update syntax, adversarial literal labels, unknown language, stale results and Lock/cover-resume. Keep a clear distinction between static explanation and observed execution. Existing parser/map test files were inspected, not rerun here; prior 300k-line selected-tail fixtures do not qualify complete semantic analysis of an arbitrary 300k-line program.

SIREN does not acquire an interpreter, debugger, automatic repair, AI tutor or admitted terminal through this learning direction. Neither a complete course nor a huge manual is required to make the first contextual explanation useful.
