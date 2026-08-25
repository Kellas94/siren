# C4 verification — knowledge provenance

Patch: `patches/C4_knowledge_provenance.py`  
Independent prerequisite fix discovered during verification: `patches/A12_initialize_release_identity.py`

- Exact-count anchors applied atomically to a copy of the current A12+C1–C3 application. A second application stopped at the first moved anchor and left SHA-256 unchanged (`0F9604F6…`).
- `syncheck.py` extracted one inline application script (2,662,850 characters); `node --check` exited 0.
- The real Docs importer accepted an explicit path/system value and an offset ISO timestamp, canonicalised it to `2026-08-19T08:20:30.000Z`, and left a legacy row's two new fields empty. An invalid `yesterday` value produced the honest report `1 item arrived, 0 items kept`.
- The rendered Agent Spec shows one quiet Source origin field and one UTC date field per knowledge row. Visual evidence: `output/playwright/C4-knowledge-provenance-ui.png`.
- UI-driven HTML, Word, PDF print view, Markdown, JSON and Excel exports all retained the explicit origin and canonical UTC value. Excel was unzipped and inspected; provenance and payload occupy separate readable rows.
- Release verification captured R1, changed only the confirmation date, then captured R2. Both package and knowledge fingerprints remained equal; both snapshots retained their respective dates and source origin. This also reproduced and verified the separate A12 first-release crash fix.
- Fixture and repeatable UI runners: `qa/c4_knowledge_provenance.json`, `qa/c4_export_ui.js`, and `qa/c4_release_hash_ui.js`.
- Present/Map/deck/ambient functions and selectors are absent from the C4 and A12 patch anchors.
