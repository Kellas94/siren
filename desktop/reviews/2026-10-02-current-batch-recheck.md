# Independent repair recheck — 2 October 2026

Scope: uncommitted working-tree repairs over
`2e5a499084c10857a45926b59603bf8aa63d76a0`, branch
`feature/portable-foundation`. This addendum is separate from the original
`2026-10-02-current-batch.md`; the original report was not changed. It reviews
the native safety/account-transition repairs and final autosave-timer delta,
not the whole portable plan or a release candidate.

## Result

Both originally reproduced issues are repaired in the exact working-tree
snapshot exercised below. A further account-cache persistence race was
independently reproduced and remains actionable. This is not a whole-release
PASS or release approval.

### [P2] An old getAccess cache write can replace a successfully switched account

Locations: `desktop/src/account/service.mjs:16`–26,
`desktop/src/account/service.mjs:51`–52, `desktop/src/main.mjs:99`, and
`desktop/src/main.mjs:104`–107.

`getAccess()` reads a credential record and later writes that same record back
with its trusted timestamp. Those writes have no account generation check or
serialization with login's new credential write. Native `getAccess` remains
available during the account transition; already running access checks are also
outside the tracked project `writes` set. The final renderer guard therefore
does not prevent an older credential-cache operation from completing after the
new account has committed. Because `CredentialStore.write()` changes both disk
and its in-memory record, the old permit/account can replace the new one despite
a successful sign-in response. The next `getAccess()` restores the old native
account identity. Refusing only newly dispatched access IPC is insufficient.

Independent reproduction uses real `AccountService` and persistent
`CredentialStore`, exact current native login/access dispatch, generated signed
A/B permit fixtures, and an owned test codec in place of DPAPI. Hold account A's
timestamp write at a controlled asynchronous wrapper immediately before the
real credential persistence; complete sign-in as B through the native login
handler; inspect disk using a fresh store; then release the A write. Observed:
sign-in returned `online`, disk first contained B, then both memory and fresh
disk read contained A after the old write completed; a subsequent access check
changed native `accountId` back to A. The renderer guard is resolved synthetically
in this specific probe because the race concerns credential persistence after
that guard; independent integrated guard checks are described below.

Fix direction: serialize credential-mutating access/login/logout operations or
bind cache updates to the account generation and perform the identity check
inside the serialization boundary. Include already running timestamp writes in
the transition's barrier. Test this delayed-write interleaving and the analogous
logout boundary. Full renewal/revocation integration remains separately open;
this finding concerns the implemented local credential store.

The native permission gate at `desktop/src/main.mjs:55` now refuses original
workspace/new-project writes when native safety prohibits them, regardless of
active account entitlement. Readiness failure updates the authoritative native
state and emits a safety event at `desktop/src/main.mjs:214`–216. Selection at
`desktop/src/main.mjs:76`–77 preserves that safety state. The renderer receives
the event at `desktop/src/ui/desktop.js:90`; built read-only assignments also
retain the sticky safety flag rather than allowing a later local/shared-mode
change to clear it.

Account login runs `beforeCommit` before credential/policy replacement at
`desktop/src/account/service.mjs:50`. Native sign-in and logout at
`desktop/src/main.mjs:100`–127 invoke the final renderer guard, drain writes,
and retain the old authority if the transition fails. The built guard makes
the body inert before its final save/flush and locks adapter changes after
acknowledgement; failed transitions unlock it. The sign-out UI at
`desktop/src/ui/desktop.js:30` now reloads only on success.

The final renderer patch also clears the debounced save/draft timers in its
close guard and makes background `scheduleSave`, `writeDraft`, and `saveState`
return while the storage lock is active. I inspected those patch markers and
independently exercised a save scheduled before the transition. Native UI
observations supplied by the coordinator are not substituted for my VM evidence.

## Independently executed evidence

Node `v24.16.0`, from `desktop/`, final commands:

```powershell
$testFiles = (Get-ChildItem -LiteralPath tests -Filter '*.test.mjs').FullName
node --test --test-skip-pattern='actual 180-second callback deadline' $testFiles
node evidence/independent-current-recheck-2026-10-02/probe.mjs
node evidence/independent-current-recheck-2026-10-02/timer-probe.mjs
node evidence/independent-current-recheck-2026-10-02/cache-race-probe.mjs
```

Final selected suite census: **80 tests, 80 passed, 0 failed, 0 cancelled,
0 skipped**, duration 6513.9666 ms. The named real 180-second callback-deadline
test is excluded from execution/census by the filter. This is not a full
81-test run. I also ran the same selected suite before the final timer change
(80 passed); the final rerun is the evidence for the timer-adjusted snapshot.

My own probes combine exact extracted working-tree native handlers and
sign-in/sign-out UI callbacks, guards from the newly built renderer, real
`AccountService`, real current renderer adapter, and real project/recovery
files. They use an in-memory `CredentialStore`, generated signed permit
fixtures, controlled login/entitlement responses, and a synthetic DOM. Their
recorded outcomes were:

- A late edit made during the browser-result wait reached disk before the
  account changed. Delaying credential replacement kept the old account and
  credentials intact, kept the body inert/storage locked, refused renderer
  mirror edits and native workspace writes, and delayed reload. After release,
  the new account committed, grants cleared, and exactly one reload was called.
- An injected credential-write failure retained the original account and grant,
  caused no reload, released the renderer lock, and allowed an acknowledged
  resumed workspace write. An injected final-save failure likewise retained
  original authority, unlocked the renderer, and caused no reload.
- An injected credential-deletion failure during logout saved the latest work,
  caused no reload, retained the account, unlocked the renderer, and allowed a
  resumed write. Successful logout saved the latest work before clearing the
  account/credentials and requesting reload; it kept the renderer locked until
  that reload.
- Readiness failure set both native and renderer safety state. A native original
  workspace request was refused, the original revision stayed 1, explicit
  recovery into a new copy remained available, and selecting the recovered copy
  retained native read-only mode.
- The exact built `scheduleSave`/`saveState` and transition guard, with the real
  adapter and a controlled native acknowledgement, were run with a pre-existing
  160 ms autosave timer. After transition and a further 250 ms wait there was
  still only the one final save, no error toast, and the storage lock remained
  active. The recorded states were `saving`, then `saved`.

The updated repository tests additionally exercise packaged startup read-only,
development and packaged readiness failure, superseded private draft receipts,
rejected/disconnected flushes, adapter mutation refusal while locked, and a
paused `saveState` callback that must not touch live controls.

## Exact snapshot and limits

Final generated renderer SHA-256:
`91e3e20e4c6772c2abda15db0c0bcdb4c5f1af67b8ad5d8fb8290e833fecade9`.
The probe's `result.json` contains byte SHA-256 identities for all nine inspected
changed source/test files. Key repair files were:

| File | SHA-256 |
| --- | --- |
| `desktop/src/main.mjs` | `37226418feabb7fddc44b41db47cf2cddb3ecdff2ef90138407c29e8f3167060` |
| `desktop/src/account/service.mjs` | `826d19d4e414783869916d179d40697aef5bc818eefdb086ac7dfa5ae7e75578` |
| `desktop/build/renderer.mjs` | `e1d07563e31f32318d741a7a1452a9961fe3d5f5fa99c614a747f440f4869ba9` |
| `desktop/src/ui/storage.js` | `9691d51e1c90bd850848f0ec3144949ab7a2a9ba792da72e98c545b7387d05a2` |
| `desktop/src/ui/desktop.js` | `9c05c898a5237db611e8b4d6d3761cf460a7b59b8e31818bcfc6ef9e18c48dd7` |

Original report SHA-256 remained
`6f3cff337ff55df1b13cb6af2d28e83c5dbab150710f8f0d3d046b5af05399e7`.
Evidence sources/output are in
`desktop/evidence/independent-current-recheck-2026-10-02/`:
`probe.mjs`, `result.json`, `timer-probe.mjs`, `timer-result.json`,
`cache-race-probe.mjs`, and `cache-race-result.json`.

The integrated probe models control synchronization/save status; it does not
instantiate the entire frozen renderer or a real DOM. The timer probe uses the
actual built scheduling/save functions but controlled native acknowledgements.
Credential write/delete and final-save failures were controlled injections, not
actual DPAPI/disk-full failures. Readiness event delivery was modeled through a
synthetic webContents sender into the actual built safety callback. These checks
do not qualify actual Electron focus/inert/event/timer rendering, native UI
screenshots, production account switching, protected-storage I/O failures, OS
chooser behavior, packaged restore/copy, or clean Windows 11 behavior. I did not
execute the newly added `tests/native/account-transition.mjs`; coordinator native
results remain separate evidence. No implementation file or original review was
edited in this recheck. I also inspected the final workflow addition that invokes
the new native account-transition probe after checking the protected-storage
probe's exit code; it was not executed as CI evidence here.

The original review's open launcher/helper/apply/rollback, production account/feed
and renewal/revocation, signing-key rotation, full licensing/security, crash/race,
cross-user credential, and clean-PC qualifications remain open. This addendum
provides no release-admission receipt and asserts no named human reviewer identity.
