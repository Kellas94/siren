# Walk through harness — transform oracle correction

Author: `/root/media_batch_review`, 2026-10-07. This is the original harness author's narrowly authorized correction of its own CSS serialization oracle. No product correction, native success or approval is claimed in this preparation record.

Original caption-corrected execution remains ADVERSE1: receipt `a88d930df57ba653dfdbe323ea3a941a06a78955f01136f44098473fe588d8c0` and separate authored report `2026-10-07-diagram-walkthrough-caption-fixed-native-adverse.md` SHA256 `5f8484cd5c8c1ec9262b57c3835b666f89c96a923f3731995a265416abbcf1a0`. Original246a source bytes were preserved alongside that receipt before this amendment. Earlier caption ADVERSE0, passive diagnostic and prepared reports remain untouched.

Updated `tests/native/diagram-walkthrough.mjs` SHA256 `c8215a9e364eef108f62922fb1f2e59ddc19780efd54814ff801c0d2a9c75e4f`; actual `node --check` exit0. Only two transform assertions and their shared read-only numerical helper changed:

- Overview reads actual computed transform through DOMMatrixReadOnly. It requires is2D, exactly six finite numerical components a,b,c,d,e,f and exact identity [1,0,0,1,0,0]. Whitespace serialization can no longer create a false adverse result.
- Actual Zoom must yield finite is2D components with a>1, d>1, b=0 and c=0. Finite e/f may retain legitimate target pan. This strengthens the old textual notEqual, which could falsely accept identity solely because CSSOM inserted a space.

All trusted input actions, waits/deadlines, Unicode/word spacing, colours, exact source/SVG/project/history, pending field values/focus, window/dock and Lock assertions are unchanged. No expected content was shortened, no tolerance introduced, no renderer/controller state written. Product Diagrama531/walkthroughc662 remains frozen. Root independently read the original receipt and expressly authorized these two oracles only.

This record precedes the corrected harness's actual execution; root granted one exclusive GUI run. Any further adverse result must be retained separately before another action. Syntax/numerical self-review is not runtime/package/fullsuite/hosted or release qualification.
