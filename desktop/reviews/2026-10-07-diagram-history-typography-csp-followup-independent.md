# Independent CSP follow-up: native Diagram history and typography

Reviewer: `/root/diagram_history_final_review`. Date: 2026-10-07.

Verdict: the narrow final-script newline correction resolves the independently reproduced generated-HTML/CSP mismatch. No additional confirmed finding remains in this follow-up scope. This is source and parsed-artifact verification; actual native startup and copied-package execution still require the separate executor's evidence.

The original review (`5b0d75fa1337a2fac09b618d902d7da8d5beba2c98b602e4297474af9d0c281b`) and original frozen recheck (`75f356d293143c8b937b37926ce5f639fb7e506f7e7f99dd7fa3f1c0f01fb941`) remain unchanged. The prior 52-test source/controller/domain recheck did not exercise browser-parsed final HTML against its CSP. Its green scoped result did not establish native startup.

## Independently reproduced original defect

Read and parsed the actual original generated Diagram artifact SHA-256 `31df3b1e64b673064221bb183be169885e11361bfbb27e88c2c0348b4b80a410`. Its third inline script contained one carriage return. The raw text matched admitted hash `/YbbdsRWvfqaOCkuts+cd7eAvVxd8uX1NQayftkxhd0=`, but HTML parsing normalized its text to hash `AIyOxNhu7h8UvofwOgTS4ooeQwYT9Hr9ffS/oQXyv50=`, absent from the actual `script-src` directive. The first two inline scripts matched; external `siren://app/assets/shell.js` was classified separately.

Evidence: `desktop/evidence/diagram-history-independent-review/csp-original-generated-probe.json`, produced by `csp-probe.mjs`. The original generated artifact was still present when inspected, while root's narrow source correction had already begun; its captured builder hash must not be misread as proof that the corrected builder produced the original artifact. The observed mismatch is sufficient to explain the reported controller-blocking CSP error, but this reviewer did not independently run that native session.

## Frozen correction and bounded verification

Inspected `desktop/build/diagram-window.mjs`: CRLF and lone CR normalization now runs on every final inline script after fragment concatenation, history insertion and transfer placement, and before syntax validation, CSP digest calculation and emission. The same normalized strings are checked, hashed and emitted. The closing-script guard remains in place; the correction does not enable `unsafe-inline` or loosen the script allowlist.

Inspected `desktop/tests/diagram-entry-build.test.mjs`: the existing raw script hash checks, byte-exact transfer source assertion and generated artifact identity assertion remain. The additional parse5 walk selects inline scripts by absence of `src`, then checks their parsed digests. An earlier regression-setup failure counting the external shell script was identified during inspection and corrected by root; the root retains its original adverse log separately. The reviewer did not execute the renderer build tests or claim root's test results as independent execution.

After the corrected freeze, independently parsed the actual generated Diagram SHA-256 `1a8e1f0dcb95f2ddb5e5641e6e50508351e42abb656465c27f7ff686a7284b17`:

- Three inline scripts; all raw and parsed texts match exactly, contain zero carriage returns, and have their hashes in the actual CSP `script-src` directive.
- The third script now admits `AIyOxNhu7h8UvofwOgTS4ooeQwYT9Hr9ffS/oQXyv50=`.
- External shell.js remains separately allowed.
- In-memory negative controls independently injected CRLF and lone CR into the third script and admitted each changed raw hash. Parsing rejected only that script in both cases, demonstrating that the check detects the original defect class rather than merely searching the whole HTML for a digest string.
- Six narrow input/report hashes remained identical before and after the follow-up verification. Import-validator SHA-256 remains `a424a8247de09788a791fa055e804c315c9a4201a7a0a79a536532a4354d6af3`.

Actual retained evidence, all under `desktop/evidence/diagram-history-independent-review/`:

- `csp-corrected-frozen-probe.json`
- `csp-followup-verification.mjs`
- `csp-followup-verification-result.json`
- `csp-followup-verification-corrected.log`

The first reviewer negative-control setup used a literal replacement string containing JavaScript dollar replacement patterns, producing malformed test HTML. Its failed assertion is retained in `csp-followup-verification.log`; it was a probe construction error, not a product result. The corrected probe uses a replacement callback and its actual successful output is retained separately.

No source, tests, generated outputs, GUI, native harness, renderer build, full suite, hosted workflow, release or installed files were changed or executed by this reviewer. Only separate authored review/evidence files were written. The original native adverse result and historical Diagram timeout remain adverse evidence; this parsed-artifact correction alone does not close either native execution outcome.
