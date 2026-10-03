# Explicit source-to-Docs linking — root evidence

Author: root implementer, 3 October 2026. Tests below are implementer-run evidence, not independent approval, production admission or release.

The native DocsLinkService takes only an operation ID, document/row identity, expected document content token and source receipt. It reads the selected native project itself. SourceRepository.getCommitReceipt verifies a selected commit ancestry entry, exact requested version/hash and actual blob bytes; an edit receipt, a draft materialization or an orphan commit file cannot prove a saved source. Recovery degradation is derived from the native record/checkpoint, never the caller's durability field.

Explicit linking updates only the existing matching knowledge row's sourceRef. Other Docs, row fields, agent/release identity, historical release refs and unrelated storage bag keys are retained. All retained source refs stay in the new manifest. No inline source duplication or renderer-supplied full snapshot is accepted. A content CAS token hashes native project ID, document ID and complete document: distinct documents can save against the same original project revision through one ordered owner. Equal restored content is the same content version by definition; this token is not a monotonic edit-history number. External project-revision races refuse rather than retrying a stale envelope with a newer revision.

Operation deduplication requires selected manifest ancestry, native project binding, exact request hash, actual linked row/ref and the document content token. Imported/orphan markers alone never prove an operation. Typed immutable Docs receipts and subscriptions are separated from source receipts, contain no text/provenance and cannot be modified by a subscriber. Actual caller roles/entities/access are checked before and after queued native work and at durable publication.

## Adverse controls and correction

The five commit-proof tests initially failed because the method did not exist. After implementation they passed. The initial Docs-owner fixture lacked required native-window interface methods and two controls failed; the fixture was corrected without relaxing the registry.

A new planted selected marker test failed on a real implementation defect: a marker plus selected operation could return success even though the claimed row was not linked. The service now checks the actual selected document token and actual row pointer against the marker/request before duplicate acknowledgement. The original failing assertion was retained as a regression. An actual preselection fault also leaves an orphan revision; explicit retry must genuinely select/read back a new manifest before success.

Focused final check: `node --test tests/source-docs.test.mjs tests/source-commit-proof.test.mjs tests/window-intents.test.mjs tests/source-manifest.test.mjs tests/source-ipc.test.mjs tests/source-repository.test.mjs tests/window-registry.test.mjs tests/window-ipc.test.mjs` — **128/128**, exit0, 6198.8973ms, no skips/cancels/todo. These include exact independent bytes, forged commits, historical receipts, degraded recovery, active envelope preservation, stale/foreign requests, queue serialization, immutable scoped notifications and revocation during native publication.

## Actual native evidence

`tests/native/large-source-docs.mjs`, final `evidence/large-source-docs/2026-10-03T09-14-37.577Z`: COMPLETE, exit0, four groups, two real Code and two real Docs windows; 23 captured inputs unchanged; remaining windows0. Actual renderer IPC proves that an edited draft claiming committed durability is refused; concurrent explicit links retain both Docs and exact independent UTF-8/Unicode/CRLF bytes; historical duplicate/stale/foreign-document semantics hold. Last group invokes the native owner directly with a captured real grant and retires native views inside the actual before-select hook: unchanged selected manifest, no late notice/success. That group is a forced adverse native revocation, not a user-driven graceful Lock or renderer-return proof.

Native result SHA-256 `b1ac5e411be476f7134fa7bd8334862325a7489a2eb84dd3a00d637a7e711f95`; outer `6fcd7d1dd174d964de3a297e5a83a9bc722e00afe5822cccd3df45941c230f57`; prepared `151216164d312b31071261b80cc84c118e05679230a27af7bf01041732b682b8`. Earlier completed09:12:59.689Z probe predates marker hardening; its result is retained separately. Native Electron44.5.1/Chromium152.0.7977.130.

The existing three-Code-window source regression was rerun because shared coordinator/subscription logic changed: `evidence/source-owner/2026-10-03T09-15-00.264Z`, COMPLETE, exit0, four groups, captured inputs unchanged. Prior native failures/results are retained.

No new renderer source channel or Docs UI has been installed in production. Native Code/Docs production entries still show shells. General Docs edits, all-view local-queue flush, Home transitions, production package, larger-source throughput, end-to-end keyboard/UI behavior and physical multi-monitor coverage remain open. This fixture uses small synthetic sources; the name large-source-docs comes from the approved plan and does not itself establish a capacity result.

Full frozen unit/build suite `evidence/source-docs-suite-result.json`: **492/492**, exit0, native identity2/2 (32150.5271ms) followed by remaining490/490 (181620.72ms), zero skips/cancels/todo, zero changed captured src/build/tests/scripts/package/baseline/workflow inputs. Log SHA-256 `5b473fce70ba04e8b131954647c1c657dfa4b8c19e4ba51aeb9a6b01063153f6`. Previous465 result is historical, not relabelled. Read-only native process census found no remaining owned PIDs17096/46920.
