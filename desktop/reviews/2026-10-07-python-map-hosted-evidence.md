# Original hosted Python-map evidence

Author: /root/catalogue_view, retention and readback. GitHub Actions executed the hosted checks. This is not independent GUI execution or release approval.

Run [37647458513](https://github.com/Kellas94/siren/actions/runs/37647458513) is **ORIGINAL FINAL FAILURE**, attempt 1, updated 2026-10-07T16:08:47Z. Gate: **ORIGINAL_FINAL_RETAINED**.

Canonical 3151381fbf0cfd5c31430fa128a12a60afa2d675, tree 2636dac3745c0360da38c94df84d5cf9b38d48e4 (2163 blobs, not truncated). Actual integration 7a97d18665f9c032632e7ceb0175f6e7a95df54c has ordered parents 1e5472dde446657e2dbb155868e28e033c6c9c92 then 3151381fbf0cfd5c31430fa128a12a60afa2d675, and the same tree. Exact three immutable workflow blobs were checked. PR/main observations are retained separately; no equality with later local development is inferred.

## Actual jobs and steps

- Qualification scope: **success**; failed steps: none; skipped steps: none
- desktop / windows: **success**; failed steps: none; skipped steps: none
- desktop / Windows packaged workspaces: **success**; failed steps: none; skipped steps: none
- launcher / launcher: **success**; failed steps: none; skipped steps: none
- desktop / Windows native (sources): **success**; failed steps: none; skipped steps: Actual Help and diagnostics; Actual first-session PIN crash recovery; Actual Home saved-backup export; Actual Docs saved-document export; Actual Docs Activity; Actual Presenter captured-notes export; Actual Diagram history and typography; Actual Diagram walkthrough; Actual Diagram Inspector and filters; Actual Diagram pan release; Actual Diagram catalogue; Actual Diagram layout; Actual Diagram layout SVG and Present
- desktop / Windows native (diagrams): **success**; failed steps: none; skipped steps: Actual Help and diagnostics; Actual first-session PIN crash recovery; Actual Home saved-backup export; Actual Docs saved-document export; Actual Docs Activity; Actual Presenter captured-notes export; Actual Diagram history and typography; Actual Code context and commands
- desktop / Windows native (desktop): **failure**; failed steps: Actual Home saved-backup export; skipped steps: Actual Docs saved-document export; Actual Docs Activity; Actual Presenter captured-notes export; Actual Diagram history and typography; Actual Code context and commands; Actual Diagram walkthrough; Actual Diagram Inspector and filters; Actual Diagram pan release; Actual Diagram catalogue; Actual Diagram layout; Actual Diagram layout SVG and Present; Post Run actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
- desktop / Desktop qualification: **failure**; failed steps: Require development and packaged results; skipped steps: none
- SIREN merge qualification: **failure**; failed steps: Require actual results for the selected scope; skipped steps: Post Run actions/setup-node@820762786026740c76f36085b0efc47a31fe5020

## Actual receipt readback

- evidence/workspace-surface/ci37647458513/desktop-development-evidence-original/evidence/ci-native-identity.log: {"tests":[4],"pass":[4],"fail":[0],"cancelled":[0],"skipped":[0],"todo":[0]}; Python assignment regression present: false
- evidence/workspace-surface/ci37647458513/desktop-development-evidence-original/evidence/ci-units.log: {"tests":[1666],"pass":[1666],"fail":[0],"cancelled":[0],"skipped":[0],"todo":[0]}; Python assignment regression present: true

Native group receipts: [{"group":"diagrams","status":"COMPLETE","passed":20,"total":20,"failed":[],"changedInputs":[]},{"group":"desktop","status":"COMPLETE","passed":20,"total":20,"failed":[],"changedInputs":[]},{"group":"sources","status":"COMPLETE","passed":20,"total":20,"failed":[],"changedInputs":[]}]. These report executed child exit results, separately from case booleans.

Python selected-map receipts:

- desktop-native-sources-evidence: COMPLETE; explicitly true 4/4; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-sources-evidence-original/evidence/source-map/2026-10-07T16-00-04.848Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 4/4; inputsUnchanged true; changedInputs null; packageUnchanged true; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/source-map/2026-10-07T15-59-17.053Z/result.json

Help receipts:

- desktop-native-desktop-evidence: COMPLETE; explicitly true 12/12; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-desktop-evidence-original/evidence/help-diagnostics/2026-10-07T15-59-08.046Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 12/12; inputsUnchanged true; changedInputs null; packageUnchanged true; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/help-diagnostics/2026-10-07T15-53-47.557Z/result.json

Home library/search receipts:

- desktop-native-diagrams-evidence: COMPLETE; explicitly true 7/7; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-diagrams-evidence-original/evidence/home-library-search/2026-10-07T16-02-02.038Z/result.json
- desktop-native-desktop-evidence: COMPLETE; explicitly true 4/4; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-desktop-evidence-original/evidence/home-library/2026-10-07T16-03-25.655Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 7/7; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/home-library-search/2026-10-07T16-03-52.374Z/result.json

Inspector / Lock receipts:

- desktop-native-diagrams-evidence: COMPLETE; explicitly true 8/8; inputsUnchanged null; changedInputs []; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-diagrams-evidence-original/evidence/diagram-annotations-native/2026-10-07T16-05-39.836Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 8/8; inputsUnchanged null; changedInputs []; packageUnchanged true; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/diagram-annotations-native/2026-10-07T15-56-04.886Z/result.json

Pan receipts:

- desktop-native-diagrams-evidence: COMPLETE; explicitly true 5/5; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-diagrams-evidence-original/evidence/diagram-pan-release/2026-10-07T16-06-01.341Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 5/5; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/diagram-pan-release/2026-10-07T15-56-24.268Z/result.json

Catalogue receipts:

- desktop-native-diagrams-evidence: COMPLETE; explicitly true 7/7; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-diagrams-evidence-original/evidence/diagram-catalogue/2026-10-07T16-06-19.674Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 7/7; inputsUnchanged true; changedInputs null; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/diagram-catalogue/2026-10-07T15-56-39.651Z/result.json

Layout receipts:

- desktop-native-diagrams-evidence: COMPLETE; explicitly true 4/4; inputsUnchanged null; changedInputs []; packageUnchanged null; evidence/workspace-surface/ci37647458513/desktop-native-diagrams-evidence-original/evidence/diagram-layout-native/2026-10-07T16-06-40.230Z/result.json
- desktop-packaged-evidence: COMPLETE; explicitly true 4/4; inputsUnchanged null; changedInputs []; packageUnchanged true; evidence/workspace-surface/ci37647458513/desktop-packaged-evidence-original/evidence/diagram-layout-native/2026-10-07T15-56-57.517Z/result.json

Original adverse receipts: 1.

- evidence/workspace-surface/ci37647458513/desktop-native-desktop-evidence-original/evidence/home-backup-export-native/2026-10-07T16-04-13.697Z/result.json: status ADVERSE; original error {"message":"UI condition not met: document.getElementById('homeStatus')?.textContent==='Backup export cancelled.'&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'","stack":"Error: UI condition not met: document.getElementById('homeStatus')?.textContent==='Backup export cancelled.'&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'\n    at waitForNativeCondition (file:///D:/a/siren/siren/desktop/tests/native/condition.mjs:11:8)\n    at async file:///D:/a/siren/siren/desktop/tests/native/home-backup-export.mjs:71:2"}

## Retention and boundaries

6 original ZIPs, 32462836 bytes, 649 extracted inert files, 9 complete connector-decoded job logs. Every original result, nested native-group receipt, error, screenshot/log identity and build receipt remains in its extraction and/or the attributed JSON. 35 prior hosted report files remain byte-identical, including original37640219262 FINAL FAILURE. JSON SHA256: 60c9a0160f03d9ca8379921950b2bb20c064c7a2a08de94fbb8862a470d6e6fb.

- GitHub Actions executed these hosted checks; the retention author did not independently execute GUI/product/tests/builds or downloaded code.
- Original job/step outcomes and receipts are preserved. Skipped or absent cases are not passing; successful sibling jobs do not override FINAL failure.
- The launcher executable remains only inside its exact opaque ZIP and was not extracted or executed. Other extracted files are inert evidence.
- Exact ZIP hashes/lengths match the API. API metadata and complete decoded logs use UTF-8 JSON transport; raw HTTP/compressed-log byte equality is not asserted.
- Hosted package BUILD-IDENTITY fields are original runner receipts, not independent local readback of its ASAR/runtime. Nested receipts are not indiscriminately summed.
- Canonical source3151381 and integration7a97d belong to this run only. Later Terminal changes and local working-tree state are outside its qualification scope.
- All prior hosted reports remain byte-identical. New results do not erase earlier original failures or prove their historical causes closed.
- No push, rerun, cancellation, branch/main mutation, merge, release or approval is performed or inferred.
