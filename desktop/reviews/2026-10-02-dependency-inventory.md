# Offline dependency inventory

Author: `/root/launcher_implementation`. Read-only inspection, 2026-10-02. No installation, dependency update, network lookup, user-account access or product edit. This records what is present; it does not assert the newest upstream versions or approve licensing/release admission. Machine-readable evidence: `2026-10-02-dependency-inventory.json` in this directory.

The inspected current portable candidate is explicitly selected by `desktop/evidence/pin-firstpaint-package.json`: `desktop/dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`. Its application source is `b6249016cc9a001c646cc183f3c38884da678b1d`; renderer `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`. Its root native launcher has a **different source commit**, `dc41c29351dad382adf6df900e388d5b843f7fa2`, Rust 1.99.0 and the development-preview feature. Actual archive, Electron binary and launcher hashes match the package receipt. Other retained preview identities are enumerated separately; their presence does not make them the current candidate.

| Component | Observed version | Role / evidence |
| --- | --- | --- |
| Electron | 44.5.1 | Distributed runtime; actual `SIREN.exe` versions, runtime `version`, MIT manifest and LICENSE |
| Chromium | 152.0.7977.130 | Inside Electron; actual binary `process.versions.chrome` |
| V8 | 15.2.124.28-electron.0 | Inside Electron; actual binary `process.versions.v8`, aggregate runtime notices |
| Node in SIREN | 24.21.0 | Inside Electron; actual binary `process.versions.node` |
| ICU | 78.2 | Actual binary versions; aggregate runtime notices |
| Mermaid | 12.0.0 | MIT, embedded baseline script, exact hash matches retained Mermaid provenance |
| ELK wrapper | @mermaid-js/layout-elk 0.1.7 | Inlined baseline attribute/header; exact underlying engine version/license unresolved locally |
| Python grammar | @lezer/python 1.1.19 with local corrections | MIT upstream manifest/LICENSE; shipped grammar is modified |
| Parser core | @lezer/common 1.5.3, @lezer/lr 1.4.10 | MIT; entire upstream CJS bytes occur unchanged in baseline |
| Syntax highlighting | @lezer/highlight 1.2.5 | MIT; entire upstream CJS bytes occur unchanged in baseline |
| Local build Node / npm | 24.16.0 / 11.13.0 | OS build tools, separate from bundled Node; npm metadata Artistic-2.0 |
| CI Rust / Cargo | 1.99.0 / 1.99.0 | Exact hosted build log and workflow; no local compiler installation implied |

The actual packaged binary was queried in Electron's documented Node mode with only selected `process.versions` fields; it exited 0 without opening SIREN Data/UI. It reports OpenSSL `0.0.0`; that placeholder is **not** treated as an identified OpenSSL or BoringSSL release.

Python execution is absent. SIREN includes a grammar and source visualizer, plus contextual links to `https://docs.python.org/3.14/`. It does not carry CPython, Pyodide or a complete offline Python manual. Any OS Python used by historical maintenance scripts is separate and was not queried here. The grammar's explicit local corrections cover empty class patterns, parenthesized with-items and form-feed indentation; upgrading the upstream package requires preserving or retesting these corrections.

The editor, UI and export controls are SIREN-authored HTML/CSS/JS using native DOM, SVG and Canvas, with Lezer token highlighting. No separate CodeMirror/Monaco/UI framework or PDF export npm package was found in the inspected baseline scripts and desktop manifest. This does not exclude libraries internal to the Mermaid bundle; its upstream dependency ranges are retained, but a complete resolved transitive renderer SBOM has not been reconstructed.

The desktop manifest pins `jose 6.2.12`, `jsonc-parser 3.3.1`, and `openid-client 6.8.8` as main-process dependencies. The archive additionally carries locked transitive `oauth4webapi 3.8.8`; all four declare MIT, and their archived license hashes match the runtime inventory. `jsonc-parser` serves strict update metadata validation. `jose` and the OIDC clients remain shipped even though online accounts are deferred; their presence is not evidence of an active account service or AI integration.

Build/test dependencies are `@electron/asar 4.3.1` (MIT), `@electron/packager 20.3.0` (BSD-2-Clause), `parse5 8.0.1` (MIT), and Electron's installer/package. The lock contains 57 package entries with actual installed metadata and license-file hashes; no version/license mismatch was observed. Electron is declared a devDependency but its native distribution is shipped, so treating every devDependency as absent from the application would be incorrect.

The launcher has exact direct pins `serde 1.0.229`, `serde_json 1.0.151`, and `sha2 0.11.0`; Cargo.lock contains 22 entries including SIREN itself, source URLs and checksums. Cargo.lock does not contain licenses and matching crate notices were not retained/inspected locally, so the JSON marks those license fields unknown rather than assuming MIT/Apache. The root launcher remains a development selection/verifier/launcher, not a qualified signed update helper.

Existing runtime notices enumerate 780 Chromium components, including V8, Node.js, ICU and BoringSSL. The retained better_any 0.2.1 supplement is hash-bound to this runtime's notice. This inventory preserves those component identities and license-text hashes; it does not independently reconstruct every SPDX expression or settle the embedded ELK/Mermaid distribution obligations. Package `inventoryQualified`, `launcherQualified` and `releaseAdmitted` remain false. The OS build Node LICENSE was absent at the inspected path and is recorded as unknown; that absence does not remove Electron's separately retained Node notice.

For updates, monitor Electron security releases together with its Chromium/V8/Node runtime and promote only after sandbox, safeStorage, startup privacy, Unicode process identity, recovery and packaged/native tests. Track Mermaid, ELK and Lezer through an explicit vendor manifest with source hashes, licenses and a local patch ledger. Preserve exact npm/Cargo locks and include all shipped deferred dependencies in monitoring. GitHub Actions are SHA-pinned and CI Node/Rust are exact; `windows-latest`, the local npm version and the Node engine minimum are not reproducible image/runtime pins.

Regression dependents and actual existing test files are listed in the JSON. Renderer/vendor updates need color precedence, Guided edits, diagram interactions, vector/raster export and Python syntax/source-span/large-file probes as well as portable tests. Launcher changes retain selection, actual native launch, default production refusal and attachment tests. No OpenAI integration or dependency was added during this work.
