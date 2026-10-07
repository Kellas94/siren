# Diagram preview-space correction — independent receipt recheck

Author: `/root/diagram_history_final_review`, 2026-10-07. Native executor: `/root`. This author read and rehashed evidence only; no native/GUI, build, source or test execution/modification.

Actual uninstrumented native receipt `evidence/diagram-build/2026-10-07T02-06-06.508Z/result.json`, SHA256 `d80dd9e18df53373090275bf57be3347d7d293b0dc556f6178b05e5a72c99ad7`, records **COMPLETE7**, all seven cases true, no error, inputsUnchanged true. I compared all31 receipt input/afterInput entries: zero differences. Compared with original ADVERSE2 receipt, those captured inputs differ only in `src/ui/diagram/window.html` and `generated/windows/diagram.html`.

Current files independently rehashed and matched the new receipt:

| Input | SHA256 |
| --- | --- |
| tests/native/diagram-build.mjs | `c3d36cb3cd49a2b3a80fe2af170664b6f439caaf3786b4bdd4fb54d381719763` |
| src/ui/diagram/window.html | `358eafa3281589ca38ae72aaa144e3e9b06b36dc987cc7b4b270a5d4881282d2` |
| generated/windows/diagram.html | `6acc234a288b62c66ed12734cd7aeaa8e1ce2ab42b81412d66f729fa69cbde80` |
| src/ui/windows/diagram.js | `1900c032ae0599f5ebd8e225af70fba6148d37ca049d18d64ad4c8abc64cc5dd` |

The original harness hash is unchanged. Its line55 still requires `diagramViewport.getBoundingClientRect().height > innerHeight * .6`, following exact saved-workspace/source assertions and the imported-fill check. The new completed third case therefore establishes that the corrected preview passed this unchanged threshold in this native execution; it does not provide an exact measured height. All later recorded style, Build and common Lock cases also completed. This is a development native receipt, not a copied-package receipt or a whole-suite claim.

Current walkthrough helper independently remains SHA256 `c6623d7681ad2613f073dadc19734f5dbb16f779a6184cdff6ea6367015697c3`; it is not listed independently in this harness's31-source input map, so no independent runtime-source-map capture is attributed to that receipt for this file. The emitted Diagram renderer hash is captured and matched above.

Original analysis remains byte-exact SHA256 `b599c193ac4b48ea145ecfe0aca238eb53585b0056666e46bdd01b2645eb85ff`. Original passive ADVERSE2 and this later uninstrumented COMPLETE7 remain separate evidence. The latter supports the narrow preview-space correction; it does **not** establish the cause or closure of the historical hosted Save→Attach mis-target. That cause remains OPEN. No new hosted, package, release, merge or installed replacement qualification is inferred.
