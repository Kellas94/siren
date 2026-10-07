# Pinned supplemental Chromium notice

Electron 44.5.1's Windows x64 `LICENSES.chromium.html` contains only the
relative reference `../LICENCE-Apache` for `better_any`. Preserve that original
runtime notice unchanged. Its SHA-256 is
`7b328b8c7463ac9bfc7dc648c751533517c8441a0b5b21047d6c0b2620e60d70`.

Chromium 152.0.7977.130's [component metadata](https://github.com/chromium/chromium/blob/152.0.7977.130/third_party/rust/better_any/v0_2/README.chromium)
identifies better_any 0.2.1 at revision
`66802eb68397c7dbdaf3be9f5ab51e7506d238ed`. The metadata is preserved here.
The [upstream license at that exact revision](https://github.com/rrevenantt/better_any/blob/66802eb68397c7dbdaf3be9f5ab51e7506d238ed/LICENCE-Apache)
is preserved as received: 10,846 UTF-8 bytes, SHA-256
`769f80b5bcb42ed0af4e4d2fd74e1ac9bf843cb80c5a29219d1ef3544428a6bb`.

`provenance.json` binds the supplement to the exact runtime notice and Electron
version. Inventory refuses altered bytes, unexpected fields or a different
runtime. Packaging includes the full license under `notices/` and verifies its
copied hash. Resolving this reference does not grant release admission or replace
the remaining embedded-renderer and distribution obligations review.
