# Diagram attach-back independent intermediate review

Author: /root/workspace_surface_review. Recaptured 2026-10-05T20:33:34.908Z. Base HEAD d87abc0c502bcc1dbd4dac1621a3b954ecb1962d; product candidate is an uncommitted working tree over this commit. This review does not transfer qualification from the prior process-stderr source/package snapshot to the new working tree.

Verdict: no concrete new product defect found in the inspected static scope. Intermediate qualification only: current native/full/package results are pending or adverse, not independently qualified here. No Electron launch, remote execution, build, product/test/helper edit, or commit was performed by this reviewer. Prior reports are unchanged.

## Actual reviewer checks

I read the candidate diff and the owned-surface factory, registry, dock IPC, native focus routes, Diagram transfer controller/build/preview, shared shelf, guide, unit changes and new native probe. I independently ran from the repository root:

`node --test desktop/tests/workspace-surface-factory.test.mjs desktop/tests/window-views.test.mjs desktop/tests/window-focus.test.mjs desktop/tests/diagram-draft.test.mjs desktop/tests/diagram-session.test.mjs desktop/tests/native-verification.test.mjs .github/ci/qualification.test.mjs .github/ci/qualification-cli.test.mjs`

Actual tool execution: exit 0, 47/47 passed; zero failures, skipped, cancelled or todo; duration 2575.9801 ms. These are reviewer unit executions, distinct from the root agent's RED/GREEN and native runs. The added Diagram registry regression uses actual surface ownership, retains the same frame/draft, checks peer visibility, refuses borrowed Code IDs and refuses activation after entity retirement. Factory tests keep Presenter/Audience outside the surface path.

A separate read-only inspection of generated/windows/diagram.html found exactly three inline scripts; all compiled with Node vm.Script. The third script is byte-exact current diagram-transfer.js, and the second ends with exact current diagram.js. All three computed SHA256/base64 values match the generated CSP. The policy remains default-src none, exact script hashes, base/form/object none; no unsafe-inline script allowance was added. No build was executed.

## Authority and lifecycle assessment

Diagram is added to the existing private BaseWindow/WebContentsView path, rather than a copied editor. The factory verifies the private surface identity and identical webContents, keeps sandbox/context isolation/node integration/web security settings, denies unexpected navigation/window creation and awaits actual cleanup on initialization failure. The surface module itself is unchanged at c8c1ad80…; its existing failure-retention and asynchronous destruction contract therefore remains applicable.

Registry readiness checks captured actual sender/main-frame, project/epoch/entity authority and transition fences before movement. All attached peers are preflighted before ownership/visibility changes. Selecting or returning to Workspace changes native visibility without navigation. Diagram shelf metadata remains finite and excludes draft content. Satellite dock IPC exposes only its own window ID; workspace can address registered surfaces; getters, extra identity fields, borrowed IDs and presentation roles remain refused. A read-only Diagram can move as a view, while Diagram edit authority stays separate; this is not a claim that readonly movement is prohibited.

Native transfer now admits Diagram under the same captured-origin/selected-attached-view rules. The existing Ctrl+W/Q asynchronous working-copy preparation, coordinated Lock/selection/Quit and failure cleanup paths were not replaced in this lot. Main menu wording becomes generic. Presenter/Audience retain their separate factory, preload and role authority. This static inspection does not establish exhaustive presentation privacy or failure behavior.

The Diagram toolbar reads finite own-view/shelf metadata and calls the existing attach/detach IPC, without source assignment, reload, copying or persistence. Reentrancy is bounded by busy/refresh flags and unload clears the polling interval. Main authority still rechecks each request. Preview redraw now calls transform instead of fit, preserving current zoom/pan; explicit Fit still resets both, and initial zoom/pan remain 1/0. Guided/session/draft and save preparation code are unchanged. The guide correctly distinguishes Code/Docs right-click transfer from the Diagram toolbar/block menu.

## CI and native proof scope

Registration retains the original 50 children plus the existing Close/Quit and privacy checks, adds original diagram-dock once, and produces 53 children in groups 20/17/16. The workflow adds its package invocation with failure propagation and result/log/PNG patterns to each of the three existing named upload blocks. The new planted-misplacement regression refuses moving a result pattern to a different block despite the unchanged global count. This qualifies policy/code inspection only; it does not prove an actual future upload or hosted success.

The current new native script was read, not executed by me. It asserts three exact Diagram renderers/frame identities, nine toolbar attachments, native detach/attach keys, same DOM/time origin, dirty source/selection/zoom/theme, exclusive drawn ownership, Code/Docs peers, borrowed/wrong-role refusal, real host bounds, explicit Fit, exact coordinated Close/save, and common Lock. Its retained root adverse attempts must stay adverse. In the currently captured f3ddbe20… script, Close leaves the readonly reader attached but hidden, followed by a CDP Refresh click without selecting that reader. The parent has identified that fixture gap and plans actual shelf selection plus native drawn control before Refresh. This report qualifies neither that execution nor its future amendment. Readonly snapshots require explicit Refresh; no automatic readonly refresh behavior is claimed.

The current script does not establish Guided tentative-field retention, real Diagram Undo/Redo, physical monitor/DPI transfer, exhaustive failure races, or permanent hosted process-identity reliability. No whole Task4 completion, production release, package approval or hosted PASS is stated. Final native/full receipts and hashes need separate review after the candidate/probe freeze closes.

## Exact current raw-byte snapshot

SHA256 values below include working-tree newline bytes, not normalized Git blobs.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| .github/workflows/desktop-verify.yml | 34112 | 5b6b1702f1ce238c6a9ac5af518d25c64756014aae8065b5533a1a2ca656020c |
| desktop/scripts/native-verification.mjs | 3938 | 7d26a7f744c37ef9f5fd5783fc136defdca1aa4cf0d9ffc093f1a1944a0cedc7 |
| desktop/src/main.mjs | 88382 | 795ad830735c0caa74807c8016d2ae870b4e6208ce327eda78697b39dfbb52c5 |
| desktop/src/windows/factory.mjs | 5133 | 6e9ae972df36ed40c5ea0cdfd628db2dece21f7171d47684e53b9d493f82e3e3 |
| desktop/src/windows/registry.mjs | 34738 | 23a1f81537758bbd2c08acebac118cc928e14ad187411ddac5e4e46920bdf1af |
| desktop/src/windows/surface.mjs | 7712 | c8c1ad80b087911a33a3ca38276f507079524d69f9690b28a444d1312a3d9cde |
| desktop/src/windows/focus.mjs | 5389 | 39fdef5104e0c3e3721b5635d966cb8aca696230b3a7b35806343a94c6ba4bd1 |
| desktop/src/windows/dock-ipc.mjs | 2184 | a84f31193088494efd4492bd1fc074c44b71e812f11ec856ebd0d8294ac74226 |
| desktop/src/windows/preload.cjs | 8980 | 9beb8c60916657b12238f7704c4c020daa809838acd361072bf928f582893042 |
| desktop/src/windows/presentation-preload.cjs | 3446 | 9ced3c1fe2d113657e33b1149bced807144e13cac159cc46e36d1f972f5a7b0b |
| desktop/src/windows/diagram-edits.mjs | 4463 | 919ee63d1f7198075a5868519d3ea70dcc10ef2711a56937e9696241aee6c1a5 |
| desktop/src/ui/windows/diagram-transfer.js | 2075 | a2740f4b41d4103a2b3f4473df8eb372521a9f4458a890a1f258ba3e860f8422 |
| desktop/src/ui/windows/diagram.js | 18824 | bacfb9915777617b14bb0f950203ec3193f3f93dde7f3f4338297f16d5612bd8 |
| desktop/src/ui/windows/shelf.js | 3158 | 7e48b4dacbd46e9e86e2519721ab1eba94c5a1171b4877ee12caa9402b6a966b |
| desktop/src/ui/windows/shelf.css | 1395 | cda1428a6a6a8b616ef1ff8b7f994d35a2674d937e5e1d02d6269a87b69e3ec3 |
| desktop/src/ui/workspace/home.js | 34459 | 5b1259c7b23425485ff84e0eea61db8d1235832a4d40e3ef3233bd35bb22f7ad |
| desktop/build/diagram-window.mjs | 3083 | b505bc570309b0cbb10a2603e3a01da65f33566256ffb90b453daa3ddf3b27ca |
| desktop/generated/windows/diagram.html | 7303996 | 7ab1689363120516ff420354f0a6d2e31f47739bba3b8adb9e357c219955980f |
| desktop/generated/home.html | 59678 | 7ebc657464d2feb88e8460bf203b73cc2169841abb53829c490961c395527692 |
| desktop/tests/window-views.test.mjs | 10085 | 1c90ac58a0f0eb832323dbc724cd9fb94c2514ed5efe7fc3a899cb30c0cb1381 |
| desktop/tests/workspace-surface-factory.test.mjs | 3748 | f0b7c7e72000d9c1719cfa120739b8209978c3b89c768c6ad52d6a4d387e6d83 |
| desktop/tests/native-verification.test.mjs | 6281 | 14c5e51dbb8c504824857e57bc4d56bd0ddff47706de59c0d1a2022ec46ce8f5 |
| desktop/tests/native/diagram-dock.mjs | 15801 | f3ddbe20165dd968eb45212720fbcc18c46373cf6fcb7acb92510226a20e71d5 |
