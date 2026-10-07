# Package staging lifetime — owner qualification

Author: /root. Source commit: 6e96e1cf7272529a813dd64fe94fe59a956d04fa. Status: **QUALIFIED_BOUNDED_BUILD_FIX**.

Development builds used to retain their own input staging directory after both success and failure. The actual-builder RED tests caught both leaks. The fix cleans only the invocation's fresh staging after settled success/failure/cooperative rejection, refuses observed links or directory replacement, and reports cleanup failures without losing the original error. It preserves preview output, historical staging and user data.

Validation: focused **19/19**, full Windows suite **1736/1736**, no failures/skips/cancellations; all **672 captured inputs unchanged**. README was added during the full suite outside its captured set and separately hash-bound/reviewed. Integration tests use actual renderer/ASAR work with explicitly synthetic, never-executed Electron bytes. Original two RED failures are preserved.

The genuine independent reviewer **/root/package_staging_review** accepted the frozen source and README and independently passed **4/4 probes**, including real Windows file locks producing EBUSY. Its original reports and exact probe/code outputs are retained separately. This reviewer did not execute the owner suite, builder or native GUI; no such attribution is made. All stated review exclusions were accepted as bounded exclusions, not hidden passes.

A separate real development package was built from the committed fix: **305 exact ASAR members**, **72 Electron files**, exact native helper/notices and committed source content. All 672 inputs remained unchanged, prior protected BUILD/ASAR bytes remained exact, and staging count was **0 before / 0 after**. ASAR **a84e0d7b340e73a8f18a6ada7e0eb259cfe6d76b0acd34da11fa29a51e9f9a7a** is byte-identical to the previous qualified preview. No new native GUI execution or installed-app replacement was performed.

Preview: C:\Claude\SIREN_WORK\portable\desktop\dist\development-f76d3621-ccab-41c6-9115-b827779045d4. The existing installed/current preview remains unchanged.

The policy is cooperative lifecycle cleanup, not a filesystem sandbox or forced-termination recovery mechanism. It adds no global historical retention or cancellation API. No production release, native Terminal execution, activation or signed-update admission is granted.

Original hosted run **37654899907 remains FINAL FAILURE**: native aggregate abandoned, no native matrix jobs/receipts, cause UNKNOWN. Its exact original records remain separate. No workflow assertion was relaxed and no rerun was used to hide the original result.

See the JSON companion for exact raw evidence paths, hashes, independent authorship and limitations.
