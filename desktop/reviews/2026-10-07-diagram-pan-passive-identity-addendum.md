# Identity correction for the passive Diagram pan observation

Author: /root/disk_inventory, 2026-10-07. This addendum corrects my attribution of the two raw-byte differences in `reviews/2026-10-07-diagram-pan-passive-observation.md`. The original report is preserved unchanged: SHA256 `cfc6cf81b7a00f0ba93f8265ccc6d5381a9894a373186642aefec38178ceecb5`.

My earlier sentence “These relate to root's separate current Docs work” incorrectly grouped `src/main.mjs` with the actual Docs build change. Raw-byte inequality alone did not justify that attribution.

## Own readback

I read the current files, computed raw SHA256 and SHA256 after replacing CRLF pairs with LF in memory only, and inspected scoped Git status/diff. No files were normalized or edited.

| File | Raw bytes / SHA256 | LF-normalized bytes / SHA256 |
| --- | --- | --- |
| src/main.mjs | 103,067 / 5245350e92ce92c2e442227bf205e809329bbb0dfc3d20d19ab41afc379b4857 | 102,908 / 4df48d13dba30bbe862115f34373ee99a81df4552794e768c05bc012da45732f |
| build/windows.mjs | 22,586 / 0936de4b266f348318ea44cad1d56d0224a73a3b2876079baa856188ff52d50b | 22,585 / d28230bfaee00b3460d9072ab5cdf04d160a1f937f1ba87b6f92c6f6749321f9 |

The LF-normalized main SHA256 **exactly equals** the original hosted main SHA256 `4df48d13dba30bbe862115f34373ee99a81df4552794e768c05bc012da45732f`. Its current contents have159CRLF pairs and1,165total LF characters. Scoped `git status --porcelain=v1 -- src/main.mjs` produced no entry; scoped diff reported no main change. Therefore main's observed raw hash difference is a working-byte line-ending distinction, not evidence of a current Docs product change.

`build/windows.mjs` remains an actual modification: scoped Git status reports ` M build/windows.mjs`, and diff stat reports3insertions/2deletions. I read the actual diff: it imports buildDocumentActivity, composes the Docs activity script, and adds Docs activity controls/styles. Its LF-normalized SHA256 still differs from the original hosted `5df6a7ac89b240abe068fdcd0ed0c11c65dabb79427bfc4e2fe97c59f51229f0`. This is the current Docs-related change among these two captured entries. Scoped Git HEAD during readback was `12631380f5e951c1191ef095d5fb13dfe8bd00c2`; this is readback context, not a claim that the diagnostic executed that whole exact tree.

## Correct interpretation and retained limits

The original diagnostic20-input raw maps still differ from hosted in exactly the two entries documented in the preserved report. That raw-byte statement remains accurate. The corrected interpretation is **one main CRLF/LF distinction plus one actual Docs build-script change**. The eight guarded pan inputs and original receipts remain separately verified as reported. A normalization-based equality is not a raw-byte identity claim, nor proof of full-tree or runtime equivalence.

This identity correction does not alter the root-executed COMPLETE4 observation or its instrumented timing/finish-collection limits. The original hosted pan adverse remains **OPEN, cause unproven**; historical Save→Attach remains separately OPEN. No GUI, build, native run, source/test/workflow/Git mutation or original-report rewrite was performed for this addendum.

