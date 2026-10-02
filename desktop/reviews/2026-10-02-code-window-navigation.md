# Independent Code window navigation review — 2 October 2026

Scope: the uncommitted desktop Code-window repair over local HEAD
`87df79c788f2bbd1785430ad1b3a1d9998b8cd04`. Product delta reviewed:
`desktop/build/renderer.mjs:18`–22. Test delta reviewed:
`desktop/tests/native/desktop-ui.mjs:47`–50 and the new
`desktop/tests/native/code-windows.mjs`. Concurrent launcher work is excluded.

## Result

No actionable defect found in this scoped repair. Independent execution of the
actual Electron Code-window probe completed successfully. The change repairs
the reported navigation obstruction while preserving the frozen baseline.
This finding is limited to this repair; it is not release approval or a verdict
on all Code storage, permission, migration, or desktop requirements.

The approved specification requires a floating, nonblocking Code window and
continued application use while it is open or minimised. The baseline window
already has minimise controls, tray restoration, keyboard commands, geometry,
and multiple-instance handling. The failure was that opening it from the Code
library left that full-screen section visible and the main application inert.

The build patch prepends `setCodeSectionOpen(false,false)` to the Code
controller's existing `onRestore` callback. The window's `open()` calls
`restore()`, so this closes the library both on initial opening and subsequent
restoration. The `false` focus argument preserves focus in the floating window
rather than returning to the library opener. The existing minimise path then
returns focus to a usable opener or tray button; hidden library controls fail
its visibility check.

I inspected bounded baseline snippets of `createCodeWindow`, its `restore`,
`open`, `minimise`, `returnFocus` and command handlers, `createCodeController`,
`openCodeWorkspace`, `openCodeSectionItem`, and `setCodeSectionOpen`. Closing
the section hides it, resets its button's expanded state, and clears only the
nodes recorded in `codeSectionInert` when the section opened. Nodes already
inert at that time are not recorded. The change adds no document, source,
draft, history, approval, release, persistence, or permission mutation.
Existing draft selection, editor painting, analysis, commit adapter and
read-only gates retain their implementation. The guarded marker must occur
exactly once and the patch runs only for the pinned baseline digest; it does
not silently modify an arbitrary different baseline.

## Executed and inspected evidence

Independent commands, from `desktop/`:

```powershell
node tests/native/code-windows.mjs
node build/renderer.mjs baseline/R78.html evidence/code-window-review-build
```

The native command exited 0 and wrote
`desktop/evidence/code-windows-2026-10-02T13-57-46.850Z/result.json`,
`minimised-windows.png`, `code-actions.png`, and `electron.log`.
Its actual pointer and keyboard input exercised initial creation and
minimisation from the library, an accessible theme menu after minimisation,
tray restoration, exact Python draft preservation, maximise/restore geometry,
title-bar drag, corner resize, transparency input, Ctrl+Alt+M minimisation,
two simultaneous Code windows and two tray buttons, and the title-bar
right-click menu. Assertions inspected live DOM values and actual geometry;
they did not substitute source-text matching for those behaviors. The driver's
click sensor requires the element to own the center hit-tested pixel before
dispatching mouse events. The right-click assertion proves the command menu
appears; it does not click its minimise item.

The native run used an isolated project/data root under its evidence directory
and the shared generated renderer. The native command required host execution
outside the Codex filesystem token. Electron's own `sandbox: true`,
`contextIsolation: true`, `nodeIntegration: false` and `webSecurity: true`
configuration remained present in `desktop/src/main.mjs:185`; no sandbox-off
switch was added. The driver uses Chromium's occlusion-backgrounding test
switch and remote debugging on a newly allocated loopback port.

The independent isolated renderer build produced the same renderer digest as
the loaded shared `desktop/generated/app.html` and its existing `build.json`.
The frozen baseline digest also matched its Git HEAD blob, computed from the
raw `git show` bytes, and the working-tree baseline had no diff.

I also inspected supplied evidence, without independently rerunning it:

- RED `code-windows-2026-10-02T13-48-05.422Z/failure-state.json` records
  `libraryHidden:false`, `codeHidden:true`, `headerInert:true`,
  `workspaceInert:true` after minimisation.
- GREEN `code-windows-2026-10-02T13-49-04.072Z/result.json` records completion
  of the same Code-window behavior scope.
- `desktop-ui-2026-10-02T13-52-29.965Z/result.json` records actual Dark and
  Warm Light surfaces, an intentional negative occlusion check and Ctrl+K.
- `code-recovery-2026-10-02T13-52-37.398Z/result.json` records a keyboard
  Python draft reaching native recovery without implicitly becoming a Docs
  source, acknowledged native Quit, restart and draft-library availability.

The coordinator reports 83 passing tests; I did not execute or independently
verify that complete suite in this review. These supplied receipts do not
themselves embed source hashes, so their historical byte identity is not
independently established by this report. The reviewer's run/build identities
are listed below.

## Exact reviewed identities and limits

SHA-256 values are for file bytes observed during this review:

| File | SHA-256 |
| --- | --- |
| `desktop/build/renderer.mjs` | `3ad40e52dd541cd1c442cc9807555b1bc50d5925b5a3bcf867a825d5395db1cb` |
| `desktop/tests/native/code-windows.mjs` | `cb18c451bf41ab92535fcfdbef822dda4dd91fda76f0d052db4024b7b2c987e1` |
| `desktop/tests/native/desktop-ui.mjs` | `3bb1ec4c3582b75d9b04216afef013526a33346dc146f44aac86915cbd49a744` |
| `desktop/tests/native/drive.mjs` | `0e67a2bcd752b67dff1e690dec0af31c09b07d430d054743e09a4d73a2d1c05d` |
| `desktop/baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `desktop/generated/app.html` and isolated review build | `a811dc6e90e8ce7e6a786671fcbdb5795fe914028be2da1d5133261db3c0b97e` |
| `desktop/src/main.mjs` | `37226418feabb7fddc44b41db47cf2cddb3ecdff2ef90138407c29e8f3167060` |
| Approved parent-workspace Code spec | `5b1e6ac5ff58800dfb975ecbf54889c83e49ed1ce30f62f687060388e016fe6d` |

The parent specification is
`C:/Claude/SIREN_WORK/docs/superpowers/specs/2026-10-01-siren-code-workspace-design.md`.

The native probe checks a live header action and absence of tracked main-workspace
inert state, but does not edit an actual diagram, Docs document or presentation
while Code is open/minimised. It does not qualify all window sizes/browser zoom,
all themes, OS accessibility, packaged installation, clean Windows behavior,
every close/menu/library entry path, source conflicts, migration, release
immutability or read-only attacks. Data/permission nonregression here is a
scoped source assessment plus the supplied recovery evidence, not a renewed
qualification of the entire Code feature. No product source or frozen baseline
was edited by the reviewer.
