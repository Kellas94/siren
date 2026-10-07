# Walk through native harness — authoritative theme control/transport correction

Author: `/root/media_batch_review`, 2026-10-07. Preparation record for the narrowly authorized correction of this author's new fixture, before its next execution. Product Diagrama531/walkthroughc662 is unchanged.

Original c821 harness/ADVERSE6 receipt b61d079c and authored `2026-10-07-diagram-walkthrough-native-theme-control-adverse.md` SHA256 `071771420b5ecde24dae3ec495af8fe09e789a0dddd94581f845c9a4b8ae613d` were preserved before amendment. The original report and all earlier adverse/diagnostic records remain untouched.

New harness `tests/native/diagram-walkthrough.mjs` SHA256 `2761b06ff4c8bef43fe6343f7054bc3cf8fa0251556ef3b53413dc5d9956ad5f`; actual `node --check` exit0. Both theme choices target visible `#sirenAppTheme`, not intentionally hidden synchronization field diagramTheme. The helper reads actual enabled options, caps them64, uses real popup click→Home→bounded ArrowDown→Enter, then waits within the unchanged default timeout for actual chosen value, chooser re-enabled, body.theme and body.diagramTheme equal requested light/dark.

Keeping the popup open matches existing genuine native theme controls and avoids changing preference on an intermediate closed-popup arrow that asynchronously disables the select. Root explicitly ruled on this bounded input transport before execution. No DOM.value write, synthetic dispatch, controller invocation, hidden-control click, preference stub or timeout extension is used.

Unicode/word spacing, imported colour, exact source/SVG/project/history, valid/invalid pending fields and focus, source/error retirement, dock and Lock assertions remain unchanged. Theme is an existing external appearance preference; whole selected project/source invariance remains exact. Numerical transform oracles from the previous disclosed amendment remain intact.

This is syntax/preparation only. One actual native run is authorized next, with any first adverse retained separately. No product fix, runtime/package/fullsuite/hosted result or release approval is asserted here.
