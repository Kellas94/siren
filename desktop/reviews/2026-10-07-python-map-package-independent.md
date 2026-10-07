# Python map preview: independent package and receipt verification

Verified within the requested byte/receipt scope, with no unresolved byte discrepancy. This is not independent GUI execution or release approval.

- Frozen source: `041e61662273b3e796cdd5779118874d1e11ba33`.
- Preview: `C:\Claude\SIREN_WORK\portable\desktop\dist\development-754e3bab-d112-469c-a298-c1913cc9a3e0`.
- Reviewer: `/root/terminal_foundation_review`. I previously implemented the Home fixture-only repair, including Home Library Search. That work is distinct from this read-only verification; the native programmes below were executed by the owner.

## Archive and frozen source

The ASAR contains exactly 305 files: 123 runtime source modules, 16 generated files, 165 production dependency files and package.json. Every member size/SHA256 matches both the owner identity list and current local input bytes. The exact member set agrees with the frozen packaging allowlist and frozen lockfile production dependencies. Installed `@electron/asar 4.3.1` list/stat/extract independently agrees for all 305 members.

Of 123 shipped source files, 120 match frozen Git blobs byte-for-byte. Only src/main.mjs, src/preload.cjs and src/ipc.mjs differ strictly by CRLF versus LF; replacing CRLF with LF gives exact frozen bytes. All 16 generated members were compared byte-for-byte, without normalization. Their declared build-entry hashes agree, and generated/build.json equals the renderer receipt. This does not assert that generated files are frozen Git blobs or independently reproduce their build.

All 663 aggregate native input hashes match current files: 637 are frozen tracked inputs (600 raw exact, 37 strict CRLF→LF source differences), and 26 are generated outputs/intermediates. Diagram Annotations additionally captures baseline/README.md outside that aggregate set; its receipt/current/frozen Git hashes match exactly. Every common child input hash agrees with the aggregate.

## Binary identities

| File | Bytes | SHA256 |
|---|---:|---|
| ASAR | 54632434 | `cc6d1ed8606a283012fa47dd66ae47e6e9eb48d569790e97a2983c15d0264af3` |
| Electron runtime | 245726208 | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Process helper | 6144 | `485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3` |

The preview and all five actual native copies have those exact three binary identities, plus identical BUILD-IDENTITY/helper receipt bytes. For the copies alone this independently repeats 15 binary and 10 receipt checks after the recorded native runs exited. The helper source matches the frozen C# source with explicit CRLF→LF normalization; cached helper and fixed compiler hashes agree with the receipt. Runtime equals the original installed Electron executable. Neither binary nor compiler was executed here.

## Actual owner native receipts

| Copied programme | COMPLETE cases |
|---|---:|
| source-map | 4 |
| help-diagnostics | 12 |
| diagram-annotations | 8 |
| diagram-preview | 4 |
| home-library-search | 7 |

Each child result file exactly equals its copy in the aggregate. All five owner programmes report exit 0/COMPLETE, with 35 successful cases in total and exact before/after input maps. Their package commit/ASAR/runtime identities match the preview. External post-exit receipt values agree with independent current file hashes.

The Python map receipt records 300000 base lines and four cases covering the exact eleven-block projection including annotation/assignment/update, source selection/folding/theme and Clear/Cancel/common Lock. Recorded worker activities include complete and cancelled exits. These remain owner observations read from actual receipts, not independently reproduced GUI observations.

## Reviewer-oracle attempts preserved

My first manual ASAR check incorrectly required a distinct offset for every member. ASAR permits content deduplication: seven identical CodeMirror license entries share 1118 bytes and three identical Lezer license entries share 1113 bytes. I verified exact shared ranges/hashes and the installed implementation, then validated 297 unique ranges and all 305 extracted members. The initial failed oracle attempt is preserved in JSON and the tool transcript; it was not a product/native failure.

Further reviewer call assumptions were corrected and retained in JSON: Git tree lookup needed --full-tree from desktop cwd; the Windows ASAR API needed native member separators; child input capture membership differed by the README noted above. No original receipt, product file or test result was altered.

## Capture and limits

All 871 captured input file hashes agree before/after the audit and at final readback. ASAR tool sources and the additional child README also have unchanged readbacks. JSON records exact member/source mappings, six binary sets, receipts, every native case, complete captures and oracle limitations.

- No GUI, build, test suite, application/runtime/helper execution, install, download, product/test/generated modification, Git commit or installed-app replacement by this reviewer.
- Native behavioural observations are read from real owner receipts; this review independently checks those receipts and files rather than independently reproducing GUI interactions.
- 123 shipped source members are checked against frozen Git blobs, allowing only explicit CRLF→LF source normalization. All 16 generated members, 165 dependency members and package manifest are compared byte-exact; generated output is not asserted to be a frozen Git blob or independently rebuilt.
- Dependency member bytes match local installed dependencies and the owner list; production names/versions/licenses are tied to frozen lockfile. Dependency tarball integrity was not independently downloaded/reconstructed.
- Helper binary/source/receipt and original Electron binary identities are verified; helper/compiler execution/provenance or signing is not independently qualified.
- Current native successes do not resolve original hosted input-delivery/prepare-barrier root causes. Original hosted causes remain OPEN and adverse records remain separate.
- development-preview/releaseAdmitted:false; inventoryQualified,launcherQualified,accountConfigured,updatesConfigured all false. No physical monitor, general portability, installer, release, arbitrary Python execution or AI tutor qualification.

Original hosted causes remain **OPEN**. Later COMPLETE receipts are separate evidence and do not establish those original causes. This preview remains development-preview with releaseAdmitted:false and all qualification/configuration flags false. No installed replacement or release admission is given.
