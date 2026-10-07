# Code source context and commands

Goal: make saved Code discoverable by its document/agent relationships, make comparison visible, and give the native editor consistent commands and honest language behavior.

Architecture: derive bounded metadata from the current owner snapshot and exact immutable source references. The workspace catalog stays workspace-only. Code receives only its selected language and bounded comparison labels; existing native grants, CAS saves, cancellation and Lock remain authoritative. Use existing CodeMirror, Python parser, native analysis worker and theme tokens; no dependency or code execution is added.

Specifications: approved `C:/Claude/SIREN_WORK/docs/superpowers/specs/2026-10-01-siren-code-workspace-design.md`, later native-workspaces/large-sources plans; scoped analysis `desktop/reviews/2026-10-07-native-code-parity-next-analysis.md`.

Constraints: source ID/version/SHA determine identity; names never grant access. A document pinned to an older version must not mark the latest version documented. Agent metadata is an authored claim. Catalog paging remains 64 rows / 4,096 searchable rows and relationships have explicit finite caps. No document bodies, paths, recovery drafts or generic execution bridge. Preserve all original adverse reports. Do not merge main, publish a release or replace the installed application. Do not push while hosted run 37552477003 is active.

Review focus: exact-version links versus earlier-version associations; same-name/hash collisions; metadata bounds and getters; owner/Lock races; text analysis refusal with text comparison available; shared toolbar/context command guards.

## Task 1 — owner-derived source metadata

- [ ] RED: exact links, earlier-version links, duplicate names, unknown/text/Python metadata, unsafe labels and bounded associations.
- [x] GREEN: shared pure source metadata helper; native selected-source language and bounded comparison names; finite non-Python static-analysis refusal in main service.
- [x] Verify existing source-read, analysis and package-admission tests; record scoped result.

## Task 2 — Code register and visible comparison

- [ ] RED: workspace Code details/filters, body exclusion and existing grant/Lock behavior; native comparison UI routing.
- [x] GREEN: compact Code register filters and relationship captions in existing Home picker; visible Compare command and saved-source names without replacing diff implementation.
- [x] Verify existing Home/analysis tests and actual native scenarios with ambiguous names and older links.

## Task 3 — editor commands and language

- [ ] RED: Python/text editor modes and command refusal while read-only/paused/pending/fenced/disposed.
- [x] GREEN: Python highlighting only for owner-recorded Python; plain-text fallback; shared compact command menu and right-click dispatch through existing editor handlers.
- [x] Verify source editing, search, undo, save, selection, keyboard shortcuts and Lock without new authority.

## Task 4 — qualify one coherent batch

- [x] Freeze inputs and obtain genuinely authored independent review; fix validated findings with separate evidence.
- [x] Fresh build, appropriate full suite, native development scenarios and copied-package identity/native scenarios; state all limits.
- [x] Commit product and separate qualification, update resume records, then synchronize canonical PR only after the current hosted run is final. Keep original hosted evidence and main unchanged.

Not covered: a persistent in-Code project explorer, arbitrary language interpreters, live unsaved-draft comparison, new dependencies, physical multi-monitor certification or a new maximum-size claim.

## Qualification-discovered integrity corrections

Original native harness c0a026e3 remains unchanged. Its first ADVERSE4 and passive diagnostic proved a leading blank LF was delivered to DOM but lost before the CodeMirror model/native journal. The narrow trusted, cancelable, non-composing multiline insertText handler uses public replacement transactions; exact text/history tests and a separate independent follow-up passed. The next original-harness run preserved exact bytes through Undo/Redo/Save, then exposed ADVERSE5 at common Lock.

That Lock failure is a clean working window remaining at saved v5 while another advances to v6. Fresh CAS correctly refuses v5. Correction reuses only an exact real native commit operation for a clean unchanged view, invoking native idempotent verification again. Imports/uncommitted drafts receive no synthetic proof. Dirty edits still require fresh CAS; historical commit publication cannot regress or invalidate newer working references. Final all-view reconciliation must still prove the latest source version is actually committed. Original adverse results, the independent design analysis, RED regression and separate corrected qualification remain distinct.

- [x] Reproduce leading-LF loss and preserve original adverse/diagnostic; public-API correction with exact text/history checks.
- [x] Reproduce clean stale Lock refusal, retain independent analysis, add real-repository/client/working-grant regressions and optional proof admission/race tests.
- [x] Independent review of commit replay and unchanged original-harness native rerun; copied-package and final source qualification.

Qualified local checkpoint: source e5d05be2f067b818b443de9858b96401c8dc21cd; final source/unit suite 1,361 tests (isolated identity 3 + units 1,358), no failures/skips/cancellations, unchanged captured inputs. Unchanged native original six scenarios COMPLETE in development and an actual portable copy after separate multiline/replay corrections. All 296 packaged files and fixed helper match; copied shell/core/300k import complete. Owner qualification MD/JSON retain original adverse records and actual authors. Hosted qualification remains pending; this is not release approval.

Canonical synchronization: df7acd653ce431480d6001b7e920a8e1b8d142c4 / tree 34664e8919cf1417c8799f1499c44c59a372a3ef; PR2 remains open draft and main unchanged. Actual new hosted run 37556787785 observed queued; original final outcome retention is assigned separately. See owner canonical-sync MD/JSON. Next local sync base is qualified checkpoint 4f8d4a0e57425be4f16a6df325b1ac40c2a4b630.
