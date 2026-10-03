# Independent review — verified source read snapshots

No remaining blocking finding in the final captured pure reader implementation. The reviewer inspected `SourceReaderPool`, the actual `SourceRepository.openReader` integration, repository verification code, and the original tests. The final author suite passed 11/11 and the frozen independent controls passed 10/10. Two reviewer findings were reproduced as RED, repaired by the root author, and verified independently. This review does not admit live renderer IPC, an editor, native windows, a packaged release, or a source-loading performance envelope.

## Authorization, retained versions, and limits

`openReader` requires an explicit positive safe-integer version. Its trusted guard calls the real repository's throwing `access('read', projectId, sourceId)` policy; a Boolean predicate supplied directly to the pool is not the guard contract. The pool reserves capacity before awaiting authorization, verifies the requested disk version through the repository's existing owned-path/journal/blob/hash checks, and checks authorization again after loading. Each chunk checks before accessing the retained model and after computing its text. The repaired implementation also checks the closed state synchronously in the outward continuation after each awaited guard/load and immediately before publishing a chunk or reader grant.

The opened model pins the verified requested version. A later edit or pointer selection does not change its text or hash. Existing readers intentionally do not reread disk on every chunk; a subsequent fresh reader verifies disk again and discovers corruption. Invalid UTF-8 cannot create a reader. `info` is a frozen whitelist of source/version/hash/metrics/encoding/BOM/newline fields, with no provenance, native path, or source text.

Reads validate the starting UTF-16 boundary, accept `maxUnits` from 2 through 131,072, and shorten an endpoint that would split a surrogate pair. The reported end is the actual boundary. Independent literal BOM, CRLF/LF/CR, accented text and emoji reconstruction preserved every original byte, with forward progress until the valid empty EOF chunk. Invalid versions, negative/noninteger offsets, split starting boundaries, and invalid caps are refused.

Validated private configuration admits at most two readers per shared pool, with a default 60-second lifetime and a maximum configurable lifetime of 300 seconds. Pending guard/load work occupies a reservation. Disposal or expiry fences its eventual result but retains that reservation until the pending open settles; neither operation cancels its asynchronous I/O. Successful readers release capacity on disposal/expiry, and failed opens release capacity after settling. A permanently unresolved trusted operation can therefore keep its slot occupied, failing closed.

The native owner must explicitly share one pool across fresh repositories and dispose it on Lock/selection transitions. Separate default pools have separate budgets: the independent test demonstrated this scope rather than presenting a global cap. The limit bounds retained source-model count and concurrent pending opens in that pool, not RSS, journal reconstruction allocations, all pools in a process, or text already returned to a consumer. Disposal cannot retract text or metadata already returned. No live owner integration was exercised here.

## Findings and preserved RED history

1. **Writable configuration bypassed the hard pool budget.** The initial implementation stored validated limits in public properties. The reviewer set `maxReaders=3` and a third actual owned-repository reader was admitted. The original eight-case run passed seven cases and failed this expected-budget refusal, taking 602.6635 ms. The root repaired configuration with private fields and separately hardened expiry and pending reservations. The root's earlier RED/GREEN evidence is author-reported, not reviewer-witnessed.
2. **Nested asynchronous guard completion left a publication gap.** On the private-field implementation, an exact three-microtask disposal scheduled through the real repository authorizer ran after `check()` resolved but before the outward continuation resumed. A computed private chunk was still returned; the same ordering returned a late reader grant after pool disposal. The final precise ten-control RED run passed eight and failed these two controls, taking 726.2645 ms, exit 1. The root added same-continuation closed checks. The unchanged precise controls both passed on the final repair.

The intervening exploratory nine-case run passed eight and failed at depth three, taking 693.8222 ms. It is retained separately. Its loop stopped at that first failure; deeper microtask schedules were excluded from the final oracle because they may dispose after valid publication. The initial pending-disposal control expected fresh admission before previous guards settled. That assumption was explicitly corrected in a separate final test copy to require refusal until the old work settles, preserving the original test/log rather than silently rewriting its history.

## Actual final evidence

Working directory: `C:/Claude/SIREN_WORK/portable/desktop`. Runtime: Node `v24.16.0`, Windows x64. The two independent focused commands ran concurrently against different test-owned temporary project roots:

- `node --test tests/source-readers.test.mjs`: **11/11 passed**, exit 0, **2,967.8901 ms**.
- `node --test evidence/source-readers-independent-review/final-independent.test.mjs`: **10/10 passed**, exit 0, **765.7792 ms**.

Both runs had zero skipped, cancelled, or todo cases. Fourteen source/test/helper identities were captured immediately before and after these runs; an actual comparison confirmed all fourteen unchanged. The controls use real owned ProjectStore/SourceRepository, verified disk files and deferred authorizer/load gates. Teardowns close owned pools/readers and remove only their temporary roots. No native shell or GUI process was launched. No product or original test was edited by this reviewer, no full suite was run here, and no commit was made. The coordinator's earlier full-suite result predates the final race repair and is not used to qualify this final source.

| File/artifact | SHA-256 |
| --- | --- |
| Final `src/sources/readers.mjs` | `c68d1efea2b205caa9d710bb1f5ea944b06a290080f4d83037d8a5768c8f684d` |
| `src/sources/repository.mjs` | `af78ecd33712e94ec05385bd4d7a8ee466dbd2f52376edccb16ebd91dd5164bf` |
| Final `tests/source-readers.test.mjs` | `fa903252bfd588b797391688a5a6eca5e5d8b21e9d2a70a24d9f0a8f7f941bc1` |
| Frozen independent controls | `5f6e5ab93dec0f097c65e55bf7981cd173abd1ec14be9a37d694a1c9bc1f817a` |
| Original budget RED log | `5934c08c49c9c6092dc0244106bcf19941e049bffc20ce3bcc29af76dcc7d361` |
| Exploratory publication RED log | `4ff5a1043839a12f500d20b17ac40b90c5006ee94f07ffee92edcd20038033190` |
| Precise two-boundary RED log | `303713807c98ee845319edee5afad12f8c475f9c0165b47ebd3e4584746d709b` |
| Final author-suite log | `1bb23b7988afc30a5375abd5cdbfb1c948b113f421d20dc03c997337992ac980` |
| Final independent log | `f617420c3cff73f26da7dc55ad0b9447e7e001dd0aa8dbb732b8c39ef3acf6ef` |
| Start identities | `97378f532c9a9f03f9c1d193686f6603d91ff40ca975169000ee9198a05a5aaf` |
| End identities | `42ede6ec41d5cd327ac3dc3063150954af75181da3284d2970b0981d38e74246` |

All reviewer controls, copies, manifests, and logs reside in ignored `desktop/evidence/source-readers-independent-review/`. Initial reader identity was `05b6163fcdfadc06c338e70af42aa75a3d1a2549b615c0c86891a6e6cc79c30d`; the first budget repair inspected here was `b4eb8887ba932147ef46cf7aeeafb3ae4a897c44b65ac762ddbc3af9b1d386eb`. Those earlier runs did not have the final fourteen-file before/after manifest and are attributed only to their captured reads/logs. Deferred native owner wiring, source selection/manifest policy, live transport and editor qualification remain separate work.
