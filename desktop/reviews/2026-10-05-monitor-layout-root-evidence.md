# Native monitor selection and layout memory — root execution evidence

Implemented a main-owned Window menu monitor chooser and bounded layout memory in Data/UI/window-layout.json. Normal bounds, maximize/fullscreen state and duplicate view slots survive restart separately from project/source content. Imported Docs/Diagram metadata identifiers now pass the existing registry grammar consistently; project/source/operation path rules remain strict.

Final source qualification: original full suite 1010/1010, zero failures/skips, 183422.1832 ms (`evidence/monitor-memory-qualified-full-tests.log`). Six native groups exited zero with unchanged captured inputs (`evidence/monitor-memory-source-probes-result.json`): monitor-memory 3, window-focus 9, home-library 4, docs-edit 4 with 300k lines, source-link 4 with 300k lines, presentation-windows 6 with 300k lines. Final Home is 54970 bytes, SHA256 f078d829e46457505864f59f0242bd60115b6fba896ea5de563f3c1386b06ae3.

The actual native monitor probe used the two existing Windows displays. It invoked the real main-owned menu callback and its selected closure, checked exact duplicate Code geometry/maximized state, Docs fullscreen state, clean Quit/restart, common Lock, and exact project/source bytes. This is not a physical menu click, monitor disconnection or DPI-settings-change test. The final successful trace is `evidence/monitor-memory/2026-10-05T00-01-00.746Z/result.json`.

The independent reviewer report is preserved separately. Its two P2 findings (metadata identifier reservation and transient fullscreen persistence on cancelled placement) were reproduced and repaired with root RED/GREEN tests. Subsequent Home identifier and native DPI/frame corrections were discovered and tested by root; they are not independently approved by that earlier report.

All adverse traces remain retained, including catalog omission, native move refusal, exact restart frame drift and strict factory refusal of native rounding. The correction uses staged position/size, bounded native readbacks and at most one measured frame compensation; success still requires exact geometry over two native turns. Driver-only selector, unfinished Home handoff and debugger-attached Quit failures are distinguished in their retained traces.

This record is authored by the implementer. It does not admit a production release, installed-app replacement, hosted CI, whole Task6 completion, physical unplug/mixed-DPI qualification, attach-back, accounts or updates. A fresh development package is qualified separately after this source commit.
