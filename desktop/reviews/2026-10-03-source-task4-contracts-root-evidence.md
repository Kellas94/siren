# Sources Task4: isolated transport and client contracts

Author: root implementation coordinator. This report records actual root verification; module implementation and independent reviews retain their separate authors.

SourceIPC accepts only typed source IDs, versions, bounded ranges and operations under an actual WindowRegistry caller. A synchronous native access policy is checked before dispatch, at repository publication and after awaited results. Internal repository writes which omit sourceId are bound solely to the captured mutation/project/source/action. Reads cannot acquire that write exception. Output contains projected metrics, a bounded text range or an exact source operation receipt; no renderer-supplied project/path/role authorizes an operation.

The client holds one source identity/version/hash, serializes mutations, checks exact native receipts and bounds pending work. Failure fences later writes without silently rebasing; reset/dispose suppress late replies and notifications. The bounded recent operation cache evicts old entries instead of stopping editing at 4096 operations; native storage remains the long-history duplicate authority. Tests include 4100 successful sequential acknowledgements. The insertion bound is 8 MiB UTF-8 and each read is at most 131072 UTF-16 units. These are transport bounds, not an integrated performance qualification.

Root actual focused run: `node --test tests/source-client.test.mjs tests/source-ipc.test.mjs`, **32/32 passed**, zero failures/skips/cancellations, **1495.5446 ms**. Full frozen desktop suite including these modules: **347/347 passed**, **181123.9769 ms**, no changed inputs; log SHA-256 `bc070acb4e577885a863debef650eb66566777d45dcb1c9d3639b9ff2b92c551`.

Independent SourceIPC review was authored by `/root/terminal_contract`, reviewing `/root/recovery_diagnostics`'s implementation: author suite 10/10 and eight separately authored owned-repository cases passed. Independent source-client review was authored by `/root/recovery_diagnostics`, reviewing `/root/terminal_contract`'s implementation: eight independent cases and combined 40/40 passed. Each reviewer captured stable source/test identities and found no blocking finding in that scope. The client review exercises the actual client → SourceIPC → registry → owned repository chain and independently computes expected UTF-8 hashes; no full source bytes or private provenance are copied into grants.

Publication revocation, stale epochs, readonly access, Unicode/no-op edits, idempotent native receipts, checkpoint degradation and original immutable bytes have their own assertions. A source journal receipt means durable draft; a blob commit receipt means committed/recovery-degraded source bytes. Neither acknowledges selected-manifest or explicit Docs save. Lock immediately after selection may withhold the now-stale successful reply even though native bytes committed; subsequent recovery reads preserve that truth.

Frozen SHA-256 identities:

- SourceIPC `4261e0315589c66140b22df681cfe1866608f44bd09a9f3052adc17aed858447`.
- SourceIPC tests `b7ecc2956f33dee54519267b3efe0514ab489a0b45123a9fbf488f2d4c7891dd`.
- Source client `a2715ff2a1cb140fcdb7a4cfa8344626c13ce7aac201170d210a15e4f84a414e`.
- Source-client tests `403502a5702f0c764f3dffbd0a33954905e0e7b0e6236ef3092e9e2a16c06dd7`.

Task4 remains **partial**. No main channel, preload, editor mount, CodeMirror product dependency or package integration is installed by this batch. Live authority must derive source IDs from verified schema2 references; a generic Docs ID in a workspace roster is insufficient. Multiple-view subscriptions, selected-manifest transactions, explicit Docs linking, large-source native editing/restart/capacity and full dirty-window coordination remain subsequent approved work. The preceding native data-free shell probe does not qualify these transport contracts as a live feature.
