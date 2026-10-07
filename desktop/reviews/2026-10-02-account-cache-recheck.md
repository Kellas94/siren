# Independent account-cache repair recheck — 2 October 2026

Reviewed scope: uncommitted credential-serialization repair over local HEAD
`2e5a499084c10857a45926b59603bf8aa63d76a0`, branch
`feature/portable-foundation`. Prior reports and the independently reproduced
failing cache-race probe were preserved unchanged. This report addresses the
new P2 recorded in `2026-10-02-current-batch-recheck.md`; it does not rewrite
that earlier snapshot's finding or qualify a whole release.

The delayed account-cache overwrite is repaired in the byte-identified snapshot
below. I did not reproduce an additional actionable issue in this scoped
recheck. No whole-release PASS or release approval is issued.

`AccountService.withCredentials()` at `desktop/src/account/service.mjs:15`–19
serializes credential operations and makes its continuation usable after a
rejection. `getAccess()` now queues its complete read/verify/cache-write/state
path. Login queues its previous-record read and final credential/policy commit,
while logout queues credential clearing and policy change. Browser login,
entitlement requests, and `beforeCommit()` execute outside that queue; the final
renderer flush can therefore revalidate account access through `canPerform()`.

My independent new proof uses the real `AccountService`, persistent
`CredentialStore`, `ProjectStore` and `RecoveryStore`, current native
login/logout/save handlers extracted from `main.mjs`, and validated
`invokeDesktop()` dispatch. It uses generated signed A/B permit fixtures,
controlled protocol results, delayed/error-injecting wrappers around actual
credential persistence, and an owned test codec in place of DPAPI. Its final
guard performs an actual native workspace save; it does not render the full
desktop UI. Recorded outcomes:

- Delaying an already-started A timestamp write held login until that write
  completed. After release, the final native flush saved A's latest work, B
  committed, and both cached and freshly read disk credentials were B. A later
  access check retained native account B.
- The same delayed A timestamp write held logout. After release, the latest
  original-project work was saved, logout cleared credentials, and fresh disk,
  memory and subsequent native account identity remained empty. The old write
  could not resurrect A after logout.
- Both final guards completed through actual native save → project permission →
  `AccountService.canPerform()` → queued `getAccess()`, with a two-second
  deadlock bound. Browser-result and entitlement-result waits also left access
  checks usable. This specifically checks that the credential queue is not held
  across the transition's permission-rechecking flush.
- An injected credential-read rejection was reported, and a later access check
  succeeded. An injected B commit rejection retained A and was followed by a
  successful access check and B login. An injected logout-clear rejection
  retained A and was followed by successful access and credential clearing.
  Those failures did not poison the queue.

Node `v24.16.0`, from `desktop/`, executed exactly:

```powershell
node --test tests/account-service.test.mjs tests/native-transitions.test.mjs tests/renderer-storage.test.mjs
node evidence/independent-account-cache-recheck-2026-10-02/probe.mjs
```

Repository test census: **14 tests, 14 passed, 0 failed, 0 cancelled, 0 skipped**,
duration 3858.0967 ms. These files contain six account-service tests, five
source-level native-transition tests, and three renderer-storage tests. The
real 180-second callback test is in another file and was not executed. This is
a scoped run, not a full-suite result.

The five independently authored probe scenarios completed successfully. Source
and final output are retained in
`desktop/evidence/independent-account-cache-recheck-2026-10-02/probe.mjs` and
`result.json`. Exact inspected byte identities:

| File | SHA-256 |
| --- | --- |
| `desktop/src/account/service.mjs` | `e43ebc22d1cbbd23f8147ec25c9033436bc3dded80d462808ed31bebaba9f63f` |
| `desktop/src/account/credentials.mjs` | `0ff92fb4c5530fd958d5a2d59161366342869a5a5ec5ee3204e8e35bd88d6d73` |
| `desktop/src/main.mjs` | `37226418feabb7fddc44b41db47cf2cddb3ecdff2ef90138407c29e8f3167060` |
| `desktop/tests/account-service.test.mjs` | `a2f0dcace1c88870f3fe3c4d8a3b0c6dc2b8f961c83de9b95c3e6472a08da175` |

The waiting/error fixtures constrain the tested interleavings; they do not prove
every scheduler, file-system, or failure ordering. The codec is an explicit
owned persistence fixture, not encrypted credential or DPAPI qualification.
The renderer final guard is modeled by an actual native save that rechecks
permissions; full renderer/DOM focus, keyboard/timer behavior and private Code
integration belong to the separately bounded earlier recheck and coordinator
native evidence. I did not launch Electron, run production login, inspect new
native screenshots, rebuild/run a package, dispatch CI, or test clean Windows
11/cross-user credential portability here. Read/commit/clear failures were
controlled injections, not actual protected-storage I/O faults. No implementation
file or prior report/probe was modified by this review.

Open production issuer/feed, renewal/revocation, launcher/helper/apply/rollback,
key rotation, full licensing/security, Windows race/crash and clean-PC gates
remain open. This repair recheck asserts no named human reviewer identity or
release-admission receipt.
