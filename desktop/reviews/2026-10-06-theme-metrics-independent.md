# Independent theme metrics review — 2026-10-06

Author: Codex `/root/shared_workspace_review`. New read-only review of `desktop/build/appearance.mjs`, `src/ui/shared/shell.js`, `chrome.css`, and `shell.css`, including the changed appearance test and related Audience builder/admission code. No production source, generated file, workflow or repository test was edited. All previous review reports remain unchanged.

## Scope and source snapshot

Initially reviewed the uncommitted diff against local HEAD `57cf46a2c53b79783a65d69c634231689e325050`. Final correction recheck independently resolved HEAD to `339d23c29b39200fc21bad8db48295284f84c9de`. Own isolated build/check output is exclusively `C:/Claude/SIREN_WORK/tmp-theme-metrics-review`; no production build was run. The original observation is preserved below, with separate corrected results.

Initial reviewed SHA256: appearance.mjs`fe607f3faec82c2773cf8ee8ba678d41dddd06d91c1bc6692ce36ecdcccdfe0b`; shell.js`c2197003229293d4a962ca015fd60e53f2da10ac9b5e2ff776162d40ce42457b`; chrome.css`f611d4eb2a8b677f326e505157ef99f85b3ee39f13546bafa726ab6b0a7c33f5`; shell.css`2f40038a2e79fbcfc3dc18407b0dce6fa65642220363ec80d49ea8d6a8565c8d`.

## Findings

Critical: none established. Important: none established in this scoped change.

**Historical Minor, corrected in final reviewed commit — radius bounded numeric value but not token length.** `build/appearance.mjs:10` admits a px radius up to 64 with arbitrarily many fractional digits. My own predicate fixture accepts a 1004-character token consisting of 1., 1000 zeroes and px. Shadow has an explicit 512-character bound. All actual original radius tokens are at most 4 characters, and metric input comes only from the frozen build baseline, not runtime project/user/Audience data; this is not an established current runtime security defect. A short explicit radius length cap would complete the lexical bound promise if the extractor is expected to reject oversized literal tokens from any future source. Before-correction proof: `checks-before-correction.json.radiusCharacterBoundary`.

## Independently executed evidence

Own fixture preparation imports production extractor/packer/builders without changing their algorithms. It executes the packed declaration in a VM, then renders original frozen CSS and the changed native CSS/shell in isolated hidden Chromium with mocked appearance IPC. `checks.json` and `result.json` preserve the complete palette/boundary/browser observations.

- Exactly 39 identities, 39 unique IDs. Packed palette decodes exactly to the uncompressed extractor output, including each ID/name/mode, 10 colors and 6 metrics. Identity contracts are unchanged.
- Independent browser comparison: set body.data-theme for every original theme on the original frozen CSS, then read its computed custom properties. Every one of 39×10 colors and 39×6 metrics equals the extracted/packed value; there are no differences. CSS.supports accepts every extracted radius/shadow value. This checks against the browser's cascade, not merely a second invocation of the extractor.
- Actual changed shell/CSS fixture transitions Art Deco→Cupertino→Matrix→Light. Button radius changes 2px→13px; content/rich radius 4px→17px. Matrix's green glow and Light's original soft shadow are applied, and every root metric updates. This verifies angular, rounded and layered/inset metrics in real layout.
- Own rejection boundary cases: radius 64px accepted; 64.1px, 65px, negative, em, var(), url(), calc() and injected second declaration refused. Shadow valid rgba layers/inset accepted; url(), var(), none, injected declaration and 513-character input refused. The radius-character exception above is recorded explicitly.
- Own command `node --test tests/appearance.test.mjs tests/appearance-sync.test.mjs tests/appearance-lifecycle.test.mjs`: 14 tests, 14 passed, 0 failed, duration 2888.6829ms. These are targeted local unit checks, not full-suite, native or hosted qualification.

## Audience isolation

Source review: `build/presentation-windows.mjs:17` adds the shell asset only for Presenter; Audience receives shared static chrome CSS but no private shell script. `shell.js:3` also exits for an Audience role, while native `appearance/ipc.mjs:9` excludes Audience for every method before store/navigation access. Metrics add no IPC methods, project fields, bridge powers or runtime theme input.

Own isolated build of the real Audience template, even with a mock sirenShell bridge deliberately present: no shell bar, Find, private notes or shell resource; no native metric injected on the root; no theme dataset; actual publicSlide computed radius 0px and shadow none. The new generic button/shape CSS does not add shadow/radius to the public slide. Its public DOM is unchanged. This establishes template/CSS isolation in the fixture; it is not a production native-grant or public-pixel/deck regression run.

## Implementation assessment and limits

Only six fixed metric names cross extraction and packing. Color extraction is retained; packing appends metric indexes after the 10 color indexes and decoding uses that same 10-field offset. Literal metrics are assigned through CSS custom properties, not HTML or executable JavaScript interpolation. The shared-asset scanner continues to refuse resource imports/urls and uses exact SRI/CSP resources. Every tested shadow is bounded to 512 characters; the named theme set is fixed 39. The final radius predicate additionally bounds lexical length to 16 characters, as independently checked below.

Shape/shadow rules use native aliases with defaults and limited selectors. The additional narrow/short-window CSS changes main overflow and Code analysis stacking; it does not change native bounds/reservations or attach/detach ownership. I did not exercise actual detached 480–900px controls, selection, OS focus or native save barriers for this styling change, so no comprehensive viewport-usability conclusion follows from the metric fixture.

No owner native/copy/package/hosted result is claimed as my execution. No production persistence, Audience grant, physical presentation-pixel, full reference parity or release PASS is inferred. The isolated fixture processes exited normally.

## Final correction recheck against 339d23c

Own before-correction palette/boundary/browser outputs and rendered fixture were preserved as `checks-before-correction.json`, `result-before-correction.json`, and `native-before-correction.html` before rerunning. Current `checks.json` and `result.json` contain only the final-byte rerun. The original Minor finding remains historical; no unresolved finding was established in this limited final review.

- At `build/appearance.mjs:10`, the explicit 16-character cap precedes the numeric/syntax checks. Own direct predicate check: the same 1004-character token previously accepted is now refused; a valid 16-character fractional px token is accepted, while its 17-character counterpart is refused. Numeric 64px ceiling and resource/declaration rejection cases remain intact.
- Rebuilt only the isolated fixture output using actual final production builders. All 39 IDs remain unique; packed representation is exactly equal to extractor output. Browser cascade comparisons again produce zero differences across 390 original colors and 234 original metrics, and zero invalid CSS metric values.
- At `src/ui/shared/chrome.css:9`, the Code editor selector now consumes `--siren-radius-md`. Own isolated element using the actual `.siren-code-editor` selector under `body[data-role=code]` computed 4px for Art Deco and 17px for Cupertino. This verifies the selector and variable cascade, not the complete Code editor component or native editing behavior.
- Real Audience template checks repeated: private shell/Find/notes/script absent, theme dataset/root metric absent, and publicSlide radius 0px/shadow none. No native admission/OS/presentation-pixel inference follows.
- Own rerun of the same three targeted unit files: 14 tests, 14 passed, 0 failed; duration 2850.0059ms. Own hidden isolated Electron process exited 0 and was closed before reporting. No owner execution is included in these counts.

Final SHA256, read independently after correction: appearance.mjs`d15f023b70f9fe58483e2fda1e8ea4934a5c5c02a9c161ed240483610a97ad77`; shell.js`c2197003229293d4a962ca015fd60e53f2da10ac9b5e2ff776162d40ce42457b`; chrome.css`9f4cbf2e1d9aeaa5919b536db57537105e3d16823ca40027e1f62b36df5cad6a`; shell.css`2f40038a2e79fbcfc3dc18407b0dce6fa65642220363ec80d49ea8d6a8565c8d`. Git status immediately before this report update showed only this new review file untracked. Production/generated files remained untouched by this reviewer.