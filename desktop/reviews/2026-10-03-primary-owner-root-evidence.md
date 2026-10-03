# Primary persistence prerequisite — root evidence

This report is authored by the implementing coordinator. It is not an independent review or release approval.

The production `saveProject` service now uses `WorkspaceCoordinator` with native primary-frame captures, an owned `PrimaryPersistence` adapter and exact CAS. Source/domain owner methods remain available in the coordinator but their production channels/editors are still unmounted. Whole-envelope legacy saving cannot downgrade a schema-2 manifest.

The actual legacy selection boundary now rechecks access immediately before pointer publication. Revocation retains the prior selection and pending attempted work. Selected workspace commits and private recovery checkpoints are distinct; a private draft never silently updates Docs or advances the project revision. Recovery degradation preserves the exact verified committed revision for the next CAS while refusing a successful save acknowledgement.

Primary acknowledgement and finite flush seals verify the actual selected revision and project-scoped checkpoint bytes. Earlier receipts cannot establish later work. The new scoped checkpoint read avoids loading recovery data from every project. Primary captures contain no entity grants; native entity removal revokes old source/domain captures without preventing a legitimate primary save. The established 64 MiB workspace budget remains separate from the 16 MiB scoped operation queue, with a shared bounded FIFO and bounded total admission.

Sixteen new unit cases were developed with observed RED failures followed by GREEN. Frozen complete workflow-equivalent unit run `evidence/primary-owner-final-suite-result.json`: **568/568**, exit 0, no skipped/cancelled/todo and no changed captured inputs. Started 2026-10-03T13:06:45.644Z; finished 13:10:20.480Z. Identity tests 2/2 and remaining tests 566/566; durations 32311.0184 and 181525.8925 ms. Complete log SHA-256 `f347fc3f590e54e784b42479be9111a22cada6bce39df811e1531c3b5d8de660`.

The first frozen run remains retained separately at `evidence/primary-owner-suite-result.json`: 558/568, ten failures, unchanged inputs. Failures identified missing package dependencies, VM integration adapters and an esbuild temporary-path sandbox restriction. Package closure and integration fixtures were corrected; the final run used authorized access to its own temporary fixtures. No failure was relabeled PASS.

Actual production Electron: Code private recovery/checkpoint/Quit/restart completed at `evidence/code-recovery-2026-10-03T13-07-24.701Z` (result SHA-256 `2f3ba4d6f3a8e1af545dfba11a5eee37d327bb75a86143f31e57814a3fc165b8`). Actual PIN/Lock/change/wrong PIN/cooldown/restart completed at `evidence/local-pin-2026-10-03T13-07-22.315Z` (result SHA-256 `66d02151e9888fb632bc0d3d4b3847ea20114a1465f2a5826e57b94a82d5a64f`). Code two-view flush and explicit Code-to-Docs regressions completed at `evidence/code-view-flush/2026-10-03T13-05-12.480Z` and `evidence/large-source-docs/2026-10-03T13-05-12.159Z`.

After the frozen unit run, only the two native domain fixture files were extended. Actual native run `evidence/domain-workspaces/2026-10-03T13-12-53.264Z`: five groups COMPLETE, owned PID 45032, captured inputs unchanged, zero windows remaining. Native result SHA-256 `c7be54c0d0e52536933cda331c1bfbf529932a896050485c2e038da6d95f6b68`. It adds a genuine pinned primary protocol frame to two Docs/two Diagram frames; native source-aware readonly sealing verifies a schema-2 checkpoint, refuses legacy downgrade and refuses the complete roster after an injected primary checkpoint failure. This is an isolated transport qualification, not production editor/Lock/clean-close or physical-monitor qualification.

Existing user SIREN processes were left running. Each owned fixture reported its own cleanup; no machine-wide zero-process claim is made.

Hosted preceding CI36 run 37122542196 completed SUCCESS for remote 35efce81f861cd14c5657ca40e527ddeeafdc5c2, including units, native groups and development packaging. That result predates this primary batch. CI35's original timeout remains retained with its cause unconfirmed; a later success does not rewrite its evidence.

Still open: production native source/domain/control channels and editors, all-role transition installation, Home/router/first unlock without scratch, Presenter/Audience, source-aware main editing and final independent qualification. The one-time Git graph is unchanged.
