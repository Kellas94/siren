# Fixed Windows process reader

SIREN-owned read-only helper; no added npm/native package or downloaded compiler.
Build with `node scripts/build-process-reader.mjs` on Windows using the installed
.NET Framework 4.x compiler. The portable app ships the compiled binary, not the
compiler or source. Windows supplies the .NET runtime and Kernel32 APIs.

The helper accepts exactly one positive decimal DWORD PID. It opens a
non-inheritable handle with `PROCESS_QUERY_LIMITED_INFORMATION`, reads the
Unicode executable path and100ns creation timestamp from that same handle,
and always closes it. It cannot execute commands, change processes or grant
renderer privileges. Missing and inaccessible processes remain distinct.
Unknown/invalid responses still require protected read-only recovery.

The main-process adapter verifies the fixed source recipe and current binary
hash before each invocation; it never searches PATH or falls back to a shell.
The10-second query deadline and16KiB output cap are unchanged. Source hashes
normalize CRLF to LF to match Git checkout normalization; binary hashes use
exact bytes. Packaging records the source/compiler/binary identities, copies
the helper into `resources`, verifies it, and records the OS-provided runtime
in the application inventory. The launcher inventories and holds all package
files, including these resources. No production distribution approval is implied.

Builds reuse an existing owned binary only when the pinned recipe, current
compiler and exact binary receipt agree. Both missing files permit a first
compile; partial, aliased or mismatched caches are refused. UI builds therefore
preserve an unchanged helper instead of creating a new unsigned PE each time.
This is artifact consistency, not a signing certificate or Windows execution
approval. OS application-control refusal remains fail-closed; no security policy
is changed. Production distribution still needs publisher signing and clean-machine
qualification under the supported Windows policies.

`process-reader-native.test.mjs` cross-checks actual Unicode child identity
against the former independent `Get-Process` query without rounding timestamps.
The native deadline test still injects six/twelve seconds of real external
latency and checks live/unknown ownership with the original bounded deadline.
