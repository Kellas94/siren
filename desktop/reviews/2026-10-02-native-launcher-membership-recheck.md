# Independent candidate 6 native membership review — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. The original review and attachment recheck remain unchanged.

**Disposition: the source provides a reasonable final census mitigation for file additions present when re-enumerated. Original finding 1 remains open for hostile concurrent modification. No native CI GREEN or release PASS is asserted.** No new must-fix issue was found within the expressly limited development mitigation reviewed here.

## Snapshot and evidence boundary

The coordinator supplied frozen private CI source commit `00ee38ff1acfdb9b8599f958390f79fb484cdd40`. That object is absent from the local checkout's Git database. I independently inspected and hashed the current local source below; remote commit/source mapping remains coordinator-supplied. Hosted native CI and the exact release binary probe were pending when this assessment was authored.

| File | SHA-256 |
| --- | --- |
| `desktop/launcher/src/selection.rs` | `fe3cb66ab347611f612d772e62c1050bf74a23eefaa784021ee9adfd38ed3e5b` |
| `desktop/launcher/src/main.rs` | `cf75f0eb63245961d3ed71becfc695ac95c45362f829bbdd28f48fc16e50e825` |
| `desktop/launcher/tests/selection.rs` | `44bae9d0dea65756110aec2013a24a0fe45d8cfacdddb5841bfb59c6ba8aa9bb` |
| `desktop/launcher/tests/launch.rs` | `edc0bfb4b0d9d816fbb95ed0b86a1049d20a178c63732981cdcf78ee079e2314` |
| `desktop/launcher/tests/fixtures/app-probe.rs` | `c3854748e40747a15d46aff29641039a50e7d47fc9415b6d61e2ed94653bdf54` |
| `desktop/launcher/README.md` | `542ae1e45e0a619127afdcadf116673796c78889b8de1aa132f57d8bf8cebfee` |
| `.github/workflows/launcher-verify.yml` | `5c4eb0fe34924fab63a7fff757ea10457c5ee8d245de8090747958476aaeb0fa` |

I did not install or invoke a local Rust compiler, launch this candidate, modify product sources, or change Windows Application Control. I reran the preserved direct Win32 directory probe: `python desktop/reviews/native-launcher-directory-lock-probe.py` again produced `directory_handle_valid=True; unlisted_child_created_while_held=True`. This independently reconfirms the original filesystem limitation, not the execution of the new Rust mitigation.

## Source assessment

`Selection` retains the verified initial file-membership set alongside its existing file/directory guards. `Selection::recheck()` traverses the selected version executable's parent, validates paths and opened objects through the same `hold()` checks, and compares the exact current file set to that original set. A previously absent safe file inserted before its directory is re-enumerated produces a membership mismatch and the error `LATE_ASSET_MEMBERSHIP_REFUSED`. Unsafe paths, reparse/hard-linked files and unreadable members also refuse through existing identity checks.

The final traversal counts every encountered entry, including directories, and refuses over 100,000 entries; it also refuses over 50,000 file members. Component/path validation bounds the depth of recursive traversal. This makes the **final membership pass** bounded. The initial `inspect_assets()` still has no separate count limit on directory breadth, so the final bound should not be presented as a bound on every stage of the entire launcher.

`main.rs` builds the fixed executable command, then calls `selected.recheck()?` directly before `command.spawn()`. `--verify` also calls the recheck before returning its development JSON. Normal launch keeps the original `Selection` alive through `child.wait()`, so the existing verified file handles are not released by the temporary recheck handles. Avoiding a second content hash pass is coherent with the Windows existing-file share locks; the new pass specifically addresses membership.

The public library `select()` by itself does not perform the later census; the reviewed executable's call sites do. This assessment binds to those executable call sites and does not claim that an arbitrary library caller automatically uses the same launch sequence.

## Fixture and workflow assessment

The alias test now appends `/App/..` to a raw `OsString`, constructs the `PathBuf` afterward and asserts that the text still contains `..`. This is a meaningful fixture correction: it submits the actual alias text to the refusal boundary instead of allowing Windows verbatim-prefix `PathBuf::join()` to normalize the alias away before the function sees it. The product's root-alias refusal was not relaxed.

The native launch fixture now compiles `app-probe.exe` in a sibling `probe-build` directory outside the selected `App/versions/0.1.0` payload, then copies only the declared executable into the version. An incidental MSVC PDB no longer pollutes the selected version census. The fixture still uses the real launcher binary and a real owned native child executable; it does not whitelist arbitrary compiler sidecars or weaken the asset manifest.

The added selection test selects the fixture, writes a new unlisted DLL while guards remain alive and expects `recheck()` to refuse. This exercises the ordinary late-addition mechanism when run on CI. The valid native fixture's `--verify` and actual child launch are still needed alongside it to show that the new recheck does not simply reject every valid selection. I inspected these tests but have not observed their execution passing.

The workflow separates selection, actual native root-launcher and default-feature production-refusal logs. Native and default-feature test steps run under `if: always()` to preserve their independent evidence even after an earlier failure. The exact release/static-CRT artifact is built after passing test stages and is transported with its declared commit, feature and hash receipt; it is still a separate artifact from the debug test launcher. The coordinator's planned exact release-binary probe remains necessary evidence and has not occurred within this review.

## Original finding 1 status

The original assumption that directory handles prevent new children is removed from the current README. The source comment and README expressly acknowledge the insertion race between enumeration and image/DLL loading and restrict these checks to development damage detection.

The new census reduces the exposure window; it does not establish atomic tree membership. Insertions into a directory after that directory's final enumeration, insertions after `recheck()` returns, or insertions during the child lifetime remain possible. This timing limitation can apply to a coinciding ordinary writer as well as a hostile actor. Empty directory additions/removals are not included in the compared file-member set, although traversal counts and validates encountered directories. No Electron injected-DLL execution has been demonstrated by this reviewer.

Therefore the original finding is **mitigated for additions already present at the relevant final census, explicitly accepted only within the narrowed unsigned development scope, and unresolved for production qualification**. Publisher authentication, hostile concurrency, durable apply/recovery and release admission remain open Task 6 contracts.
