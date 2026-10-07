# Root-executed passive Diagram pan observation

Author: /root/disk_inventory, 2026-10-07. **Executor of the single native run: /root.** I prepared the evidence-only instrumentation and subsequently read/hashed its actual receipts; I did not launch this scenario. This is a bounded observation report, not a product fix, independent runtime execution by me, release approval or closure of the original hosted failure.

## Actual result and identity

Root's instrumented run at `evidence/diagram-preview/2026-10-07T03-31-54.646Z/result.json` is **COMPLETE4**, with the unchanged original transform oracle returning true. The four successful original cases cover Home/colour/source/cross-role isolation, theme/zoom/Fit/pan/splitter/source visibility, supported previews/invalid source/registered focus, and common Lock satellite retirement/project preservation.

- Native receipt:650,325 bytes; SHA256 `8420f6a4dcc29615af698d8c94d115117c7b9d3cea5a8f430980a34d1b40e43e`.
- Owner execution receipt: `evidence/workspace-surface/diagram-pan-passive-2026-10-07/prepared-2026-10-07T03-31-54.634Z/execution.json`,2,780 bytes; SHA256 `f769f5dbd0c79351369fd9b914599ff071dfb0bdc788ee5d5e9d724566b46208`.
- Corresponding preparation.json:3,589 bytes; SHA256 `1d5bfaf2ee021dbf0f619ae984e86b7349a1dad4ed52c8ff55e6899bd836cbc7`.

The execution.json `author:/root/disk_inventory` labels the diagnostic receipt producer/template, not the actual human/agent executor. Root reported execution, and this report explicitly attributes it to /root.

The eight guarded inputs are equal before/after and, on my later readback, equal to those recorded bytes. The preparation's exact original copy and three helper hashes also verified unchanged. The original fixture's20-input before/after maps are equal (`inputsUnchanged:true`). The original20-input map is **not identical to hosted375651**:18 entries match; the two observed differences are:

| Input | Original hosted SHA256 | Root diagnostic SHA256 |
| --- | --- | --- |
| src/main.mjs | 4df48d13dba30bbe862115f34373ee99a81df4552794e768c05bc012da45732f | 5245350e92ce92c2e442227bf205e809329bbb0dfc3d20d19ab41afc379b4857 |
| build/windows.mjs | 5df6a7ac89b240abe068fdcd0ed0c11c65dabb79427bfc4e2fe97c59f51229f0 | 0936de4b266f348318ea44cad1d56d0224a73a3b2876079baa856188ff52d50b |

These relate to root's separate current Docs work and are not represented as historical candidate equality. This was a fresh development fixture, not a replay of the hosted profile or original ASAR.

## Actual input and geometry

The original center calculation returned `x:630.9140625,y:378.1875`. The exact original dispatches were retained:
1. mousePressed at that center, button:left,clickCount:1.
2. mouseMoved to `675.9140625,403.1875`, buttons:1.
3. mouseReleased at that moved position, button:left,clickCount:1.

The viewport bounds were x333.828125,y197.375,width594.171875,height361.625. Browser inner size was944×575; outer960×640; screen position800,376. DPR1, visualViewport scale1 with zero offsets. The viewport center and all observed pan coordinates were inside the viewport. Initial document focus was true, activeElement the Fit button; after press activeElement was the viewport. Instrumentation did not set focus.

The retained trace contains41 event/mutation rows, zero dropped rows,8 snapshots and3 animation-frame samples. Row counts include repeated capture/bubble observations of the same underlying event, not41 independent input actions:6 pointerdown,6 mousedown,1blur,3focus,6pointermove,1mutation,6mousemove,6pointerup,6mouseup.

At viewport bubble phase:
- pointerdown: trusted:true,defaultPrevented:false,buttons1,pointerId1, exact center. Target/hit was SVG edge path `nativeDiagram_8-L_A_B_0_0`; transform remained `translate(0px, 0px) scale(1)`; viewport.hasPointerCapture(1) was true.
- pointermove: trusted:true,defaultPrevented:false,buttons1,pointerId1, exact moved coordinates. Event target was `svg#nativeDiagram_8`; hit test was the edge path; transform was `translate(45px, 25px) scale(1)`. Viewport/canvas capture flags were false.
- pointerup: trusted:true,defaultPrevented:false,buttons0,pointerId1, exact moved coordinates. Target/hit was the edge path; translated transform remained. Capture flags were false.

No gotpointercapture/lostpointercapture/pointercancel rows were retained. The observed down→move capture-flag change is reported literally; no underlying capture mechanism, missed event or original-failure cause is established from it.

## Transform observations and sampling limits

| Observation label | performance.now | Inline transform |
| --- | ---: | --- |
| installed-before-original-center | 2823.9000000059605 | translate(0px, 0px) scale(1) |
| microtask-after-pointerdown | 2865 | translate(0px, 0px) scale(1) |
| after-original-mousePressed | 2883.4000000059605 | translate(0px, 0px) scale(1) |
| microtask-after-pointermove | 2910.800000011921 | translate(0px, 0px) scale(1) |
| after-original-mouseMoved | 2925.4000000059605 | translate(45px, 25px) scale(1) |
| microtask-after-pointerup | 2946.5 | translate(45px, 25px) scale(1) |
| after-original-mouseReleased | 2967.300000011921 | translate(45px, 25px) scale(1) |
| after-original-oracle | 3010 | translate(45px, 25px) scale(1) |

One observed canvas style mutation carries the translated transform. The pointermove animation-frame sample at2912.300000011921 already shows translate45/25; pointerup frame2951.5 preserves it. Computed transform after move is matrix(1,0,0,1,45,25). The original Boolean oracle is true.

The earlier microtask sample and later viewport-bubble sample have different transform observations within the same move dispatch. This demonstrates phase-dependent sampling in this instrumented successful run; it does not prove the original hosted assertion ran at the wrong phase or establish a timing fix.

The final collection in the original finally reports `errors:[{phase:"finish",name:"Error"}]` and has no final snapshot. The original scenario completed its all-view Lock/target retirement before this finally. The receipt does not retain the exception message, so a specific finish-error cause is not proven. The four earlier observations, including after-oracle, remain retained. This is a genuine diagnostic collection limitation and is not converted into a fully successful final observer read.

No Runtime.exceptionThrown rows were retained in the enabled attached-session interval. This does not establish the absence of all renderer exceptions before enable, in other sessions, or in the original hosted run. Exceptions' raw values/descriptions were deliberately excluded.

## Guarded bytes and unchanged originals

All eight before/after/current-readback guarded identities matched:
- Original diagram-preview.mjs13,492B SHA256179025344c089b855a2314e85f0b89b808cfa9b7f13a538f2c970bde33b0ead9.
- attach-page.mjs2,333B SHA2569adda5678dc537c070fe9dc3c8911f7efa8ba37f81637f434c61fe7b8b3fb7bb.
- drive.mjs12,270B SHA256897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca.
- pointer.mjs1,764B SHA256a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d.
- Diagram controller25,930B SHA256fbc7b0da4bea0ce02ebe19903dd4cf6521c9fd093821f9ed7bba71e30d605fbf.
- Diagram window HTML12,372B SHA256dbc5f16a49c159cff4ccef60cf3c04743825ab1766411674c14715719395bc7c.
- Diagram session1,898B SHA256dbdc13f4b017643d161178d0b29ec615bf3980200696b519a48b56b3fa9c2fa8.
- Generated Diagram HTML7,385,999B SHA256781303141695a95dd64e95281b917fd410c483cfb8d94e8a74f6d197a850e2d9.

I separately rehashed the two unchanged hosted originals:
- Original adverse `ci37565124075/desktop-native-diagrams-evidence-original/evidence/diagram-preview/2026-10-07T03-12-23.838Z/result.json`,6,117B SHA2568e61c17d8708e86ce3e27f90d5dac99003579354f9c21dd5f4863a731946e2f3.
- Original copied success `ci37565124075/desktop-packaged-evidence-original/evidence/diagram-preview/2026-10-07T03-13-22.608Z/result.json`,5,482B SHA2566a277848b562cbfe763fc4fa3a0a9d18956afa2a013cd192afcaa6ec9106d7aa.

## Bounded conclusion

The single root-executed instrumented run proves that its delivered original press/move/release produced the expected45/25 transform and unchanged oracle success in this fresh local context. It did not reproduce the hosted adverse. Event/layout reads and three post-dispatch CDP snapshots perturb scheduling; there was no extra round-trip between original center measurement and first dispatch. No focus repair, forced input, retry, direct handler call, stub or changed assertion was introduced.

The actual original hosted native pan failure remains **OPEN, cause unproven**. Historical Save→Attach remains a separate OPEN issue. No corrective product change or rerun is claimed in this observation. This reporting task launched no GUI/process, built nothing and edited no product/source/test/workflow/original evidence.

