# Local PIN native regression

Scope: actual local PIN setup, unlock, change, lock, and full restart of an owned synthetic project. Product implementation belongs to the root and native-service agent; reviewer changes are `tests/native/drive.mjs`, `tests/native/local-pin.mjs`, diagnostic evidence, and this report. This is not an online-account or release approval.

## Preserved failures and diagnosis

The first real native RED (`local-pin-2026-10-02T16-49-05.349Z`) lacked getPinState on the native bridge. After the UI landed, native startup passed withheld-bootstrap and hidden-workspace checks but Escape dismissed the PIN dialog (`local-pin-2026-10-02T16-55-55.836Z`). Two observational probes preserved actual keydown/cancel events. In `local-pin-2026-10-02T16-58-58.186Z`, keydown was cancelable, while the subsequent dialog cancel was not; the UI's cancel.preventDefault therefore could not protect first Escape. Root repaired startup Escape at keydown. The regression retains that assertion and does not dismiss the gate.

The explicit helper's CDP Page.reload path timed out (`local-pin-helper-2026-10-02T17-00-15.407Z` and `17-01-57.012Z`). Captured Page events showed navigation/loading starting and stopping, without a completed replacement context or javascriptDialogOpening. The exact CDP cause is not established. Using the actual UI's renderer location.reload after successful native receipts passed (`local-pin-helper-2026-10-02T17-04-08.423Z`): raw startup was locked with null snapshot, real native setup unlocked it, and reload exposed a newly owned normal project. No credentials, bootstrap, or project authority were patched by the helper.

Two intermediate full-UI failures were test input timing/target errors, preserved as adverse evidence: `local-pin-2026-10-02T17-05-22.010Z` typed while focus was still on the native PIN-length select; `17-07-07.648Z` sent the correct PIN before the preceding wrong-PIN response finished. The test now clicks the actual transparent password/dots input after selecting length and waits for the real incorrect-PIN message plus enabled controls. No forced focus, DOM click, or occlusion bypass was added.

## Initial complete UI proof

`tests/native/local-pin.mjs` passed against generated renderer `2bfdf1b2b01f0631e80841fdc4d68277fed81a5f59a463f547a541bf733781d0`, evidence `desktop/evidence/local-pin-2026-10-02T17-09-04.300Z`, project `fbbc25eb-43da-43bf-ae94-33c38e4ed8a1`. Result JSON records build and source hashes, native receipts, state changes, and saved revision; screenshots and Electron log are retained.

The real pointer/keyboard flow verified:

- Raw first startup is locked. Bootstrap snapshot and recovery project identity are null, with no owned label/source/private-draft markers exposed. The workspace is hidden, keypad is actually hit-testable at settled opacity, and Escape keeps startup PIN open.
- Native save and export refuse even when the caller already knows an owned project ID. Their failures are actual bridge receipts.
- Four-digit setup uses round keypad buttons and Delete, then keyboard confirmation. Native state reports configured, unlocked, and length4.
- An actual keyboard Mermaid edit reaches native save/readback. The dedicated private Python draft stays byte-exact.
- Settings rejects an incorrect current PIN without destroying the existing unlocked session; correct current PIN permits selecting length6, keyboard new PIN, and pointer confirmation.
- Manual lock restores withheld bootstrap and native save/export refusals. Previous PIN is refused. Wrong six-digit UI input is refused; correct six-digit input unlocks.
- Quit completes actual owned process exit before restart. Full restart is locked and requires the new PIN; keyboard unlock restores exact edited Mermaid source and private Python draft.

## Explicit fixture helper

`unlockDesktop(driver,{pin,autoSetup:false})` requires a caller-supplied four- or six-digit controlled fixture PIN. Unconfigured storage requires explicit autoSetup true. It validates setup/unlock receipt.ok and actual getPinState configuration/authority, then uses renderer reload when the old bootstrap is locked. `launchDesktop` never auto-unlocks. Raw lock/first-paint probes can continue observing honest startup. The helper establishes only native PIN authority; normal startup recovery/read-only rules remain observable after reload.

The final helper qualification, `desktop/evidence/local-pin-helper-2026-10-02T17-11-52.263Z/result.json`, also passed the explicit configured/length4/unlocked assertions after actual native setup and renderer reload. No automatic authentication was added to raw launch.

## Frozen cooldown and startup Escape qualification

The expanded test retained a genuine additional failure in `desktop/evidence/local-pin-2026-10-02T17-14-19.395Z`: after five wrong six-digit UI submissions and actual Quit/restart, native bootstrap correctly withheld the snapshot and retained the cooldown, but Escape dismissed the dialog while the disabled input left focus on the body. The earlier screen-level keydown guard did not receive this key event. Root repaired the product with a document-level capture guard while the PIN screen is open, including startup/busy states; this review did not edit product code.

The expanded real native test then passed on renderer `240a2b60f014d2be861c608b265e024b91373c12dfdda6fd580b4ff2abc2aca6`, evidence `desktop/evidence/local-pin-2026-10-02T17-16-20.276Z/result.json`, owned project `10334bcf-de06-459b-9a14-440fd0404794`. It repeats all UI and exact source/private-draft assertions above, then qualifies persisted cooldown through actual UI actions:

- Five wrong six-digit submissions returned actual incorrect-PIN responses; the fifth disabled input and showed the countdown.
- Native retry time was 29,976 ms before actual PIN-screen Quit and 26,363 ms after actual process exit and raw restart. Restart remained configured, available, locked, and blocked; UI showed the retry countdown rather than storage-unavailable messaging.
- Escape kept the startup gate open during the disabled-input cooldown. Native save/export still refused and bootstrap remained withheld.
- Within the bounded 45-second wait, native retry became zero, blocked became false, and UI input enabled. Correct six-digit keyboard input unlocked; edited Mermaid source and private Python draft remained byte-exact.

The final screenshot readiness also requires the animated centre to reach opacity greater than .99 with no running centre animation, as well as an actually hit-testable keypad. The inspected `first-locked.png` is legible and contains the synthetic PIN introduction without owned project content.

The final result binds the native product and test sources:

| File | SHA-256 |
| --- | --- |
| main | `cd92ffdb54ef48f400eb904eb3c372b875df98453b4a47be683e0c27491dd72f` |
| preload | `198353950873f884d48604e0238e3cf270412da2679666b2c7238b70d89f9206` |
| UI PIN module | `9f03d50e545fcc979bd63ba23d49d3c1064907e8c39a9cf960a1b26356c898ba` |
| Native PIN service | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| `tests/native/drive.mjs` | `1f8a61052d2a9e5ada06ffd14ede6b96e6260cad678f288369c2c0dea48f647f` |
| `tests/native/local-pin.mjs` | `987578e446a01e5b3dbe0bf7d1bba424c79ccfeee621dc7f1ef8d642919e6ee0` |

Syntax and diff checks passed. This proof is one actual Windows host and synthetic owned projects; it qualifies one persisted cooldown restart, not every clock/retry edge case, display size, Windows-owner change, or remote CI result. The native service's separate tests own credential-format and retry/atomicity coverage. Root's separate 17-11 native run and full unit results are not represented as independently executed by this reviewer. This is a scoped native regression result, not a release approval.
