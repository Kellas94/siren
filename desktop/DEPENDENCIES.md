# Development dependency decisions — 2 October 2026

Electron 44.5.1's installed npm manifest exposes `install-electron` and has no
automatic install lifecycle script. Fresh setups run `npm run runtime:install`
explicitly after `npm ci`; this invokes the pinned package's own downloader with
its bundled checksums. No global npm script policy is changed. Source:
[Electron v44.5.1 npm manifest](https://github.com/electron/electron/blob/v44.5.1/npm/package.json).

Exact npm registry/manifests and installed LICENSE texts were read before retention:

| Package | Version | License | Role |
| --- | --- | --- | --- |
| Electron | 44.5.1 | MIT | Included Chromium desktop runtime |
| @electron/packager | 20.3.0 | BSD-2-Clause | Development packaging only |
| @electron/asar | 4.3.1 | MIT | Development application archive builder |
| parse5 | 8.0.1 | MIT | Development HTML tokenizer for correct inline CSP hashes |
| openid-client | 6.8.8 | MIT | Main-process OpenID Connect authorization code and PKCE |
| jose | 6.2.12 | MIT | Signed activation permits and identity verification |
| jsonc-parser | 3.3.1 | MIT | Strict update metadata parsing with duplicate-field rejection |
| oauth4webapi | 3.8.8 | MIT | Transitive production OAuth protocol implementation |

The first regex-based CSP generation was rejected by an actual Electron initialization test. The HTML-tokenized main script had a different SHA-256 from the raw text. parse5 derives hashes from the same HTML tokenization rules, without permitting unsafe-eval or inline script execution generally. A NULL/CRLF regression reproduces this behavior. The lockfile pins transitive integrity records.

Electron's Windows runtime includes LICENSE and LICENSES.chromium.html. Existing embedded renderer library notices remain in the generated artifact. A complete packaged SBOM/license inventory, runtime security requalification and launcher crate qualification remain pending; this document is not distribution admission.

These packages are pinned in package-lock.json. Installed LICENSE texts were read. The development package inventory records the four production npm packages and 780 upstream Chromium entries, preserving their notice hashes. Chromium's better_any entry contains only `../LICENCE-Apache`; its full Apache notice is now preserved from the exact upstream revision and bound to this runtime by the supplemental provenance/hash checks in [licenses/README.md](licenses/README.md). The upstream runtime notice stays unchanged. Embedded renderer components and the launcher also still require complete qualification. No production issuer, updater feed or publisher signing keys are configured. No private keys or source access tokens belong in a package.

Primary references: [Electron ESM lifecycle](https://www.electronjs.org/docs/latest/tutorial/esm), [Electron](https://github.com/electron/electron), [Packager](https://github.com/electron/packager), [parse5](https://github.com/inikulin/parse5).
