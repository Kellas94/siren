# Independent final packaged lifecycle-boundary addendum — 2026-10-02

Author: `/root/review_native_launcher`. This addendum records the final coherent-boundary refinement to owned `tests/native/packaged.mjs`. The earlier CI24 recovered-snapshot addendum and its exact 8e7 test PASS at `evidence/packaged-2026-10-02T19-19-13.702Z` remain frozen. No runtime/product, preload, storage adapter, drive helper or other original test was edited.

## Why the additional boundaries matter

The earlier CI24 failure combined JSON from one current-project read with a hash from a later read. The initial-copy proof was corrected to use immutable native bootstrap/revision-1/checkpoint records, followed by one drained current snapshot. Source review then identified the same comparison problem in two other places, without needing repeated attempts to hit a fast read window:

- The acknowledged editor snapshot was independently verified by rereading current.json, which could already name a newer revision. The final test locates the immutable revision file matching the acknowledged revision, requires exactly one such file, verifies its complete serialized bytes/hash and deep equality with the acknowledged snapshot. A later pointer move cannot redirect that proof.
- The relocated project's complete copied snapshot was compared with the pre-copy normal-exit snapshot only after an unlocked renderer could initialize/save. The final test proves copying before launch, while locked and through the immutable native initial bootstrap. After normal initialization it separately drains production saves and verifies a single latest snapshot's full payload hash, new project ID/revision, exact edited source and active-diagram source.

These are predeclared lifecycle boundaries. No expected record is reset after a mutation, no assertion is retried, and no native method or storage value is replaced. Original inactive-project full snapshot equality remains mandatory throughout, as does exact stable recovered/original equality in the damaged-journal native read-only variant.

## Final actual qualification

Final test SHA-256: `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541`. Syntax check passed. One exact final native execution passed, exit 0, at `evidence/packaged-2026-10-02T19-25-15.713Z`. The source hash was independently rechecked afterward and was unchanged.

Command: `& 'C:/Program Files/nodejs/node.exe' tests/native/packaged.mjs dist/development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`, desktop cwd, require_escalated PowerShell, Node v24.16.0. The unchanged development receipt binds source `b6249016cc9a001c646cc183f3c38884da678b1d`, renderer `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`, archive `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5` / 14,277,106 bytes and runtime `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

The final run checked actual pointer/keyboard editing and production acknowledged flush, advancing the original from revision 1 to 2 with SHA-256 `4c3fc28b74539c7eb1388ac5ba855fdde9340471ace3c5c69cdfb90f64663ef2`. The matching immutable acknowledgment record was checked independently. Recovery created a distinct project whose immutable revision 1, complete native bootstrap and native saved checkpoint exactly matched the selected checkpoint JSON/hash. After production drain the active recovered project became revision 2 / `c674f364380d3a625300c5dbb840ae508e26b376226af432c9037e0e4ba97a1d`, with exact edited source in workspace and active diagram. This legitimately different current envelope was checked coherently rather than compared with initial-copy bytes.

After acknowledged normal exit and clean-close, the source and copied directory inventories contained exactly equal 207 entries: 163 ordinary files with exact byte lengths/SHA-256 and 44 directories, including empty directories. No path or file was excluded. This proof occurred before launching the copied package; folder-copy.json retains both inventories. Complete recovered and inactive-original snapshots also matched before launch and during locked startup. After actual PIN unlock, the production bootstrap exactly matched the normal-exit copied snapshot. The subsequent drained current snapshot retained exact source/active diagram, valid complete payload hash and the same recovered project ID. The runtime hash also matched its receipt.

The third damaged-journal copy remained natively readonly after a correct PIN; its save was refused with ACCESS_REFUSED and both original/recovered snapshots remained exactly equal to their stable pre-safety records. Locked null bootstrap/PIN_REQUIRED, rejected development CLI, unavailable require, actual local PIN setup/unlock, native save/checkpoint readback, pointer recovery, normal clean-close, Unicode movement and precisely unconfigured updates all still passed.

## Evidence and limits

Relevant final receipts: result.json, save-diagnostic.json, restore-boundary.json, recovered-at-restore.json, recovered-initial-revision.json and folder-copy.json under the final evidence directory above. Earlier CI23/CI24 negative artifacts and all local pre-save timeouts remain untouched. The parent separately owns named diagnostic retention in the private workflow.

This is one successful exact final local packaged execution. It does not authenticate a later hosted CI result or qualify a different archived digest. The retained local post-reload CDP timeout cause, CI23's missing save-response code and original CI20 identity failure remain unconfirmed. No runtime fix or speculative native-dialog claim is made. Only owned synthetic project/PIN fixtures and isolated package copies were used; original user Data was untouched. No production release, signed-update or launcher-race admission follows from this probe.
