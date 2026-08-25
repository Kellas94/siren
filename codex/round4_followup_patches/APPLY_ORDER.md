# SIREN Round 4 follow-up patch order

Date: 24 August 2026

These are two independent exact-input patches. Patch 01 changes a copy of the verified Round 4
application artefact. Patch 02 updates the Round 4 targeted regression runner. Neither patch edits
the frozen 1.65.0 owner file directly.

| Order | Target | Script | Input SHA-256 | Output SHA-256 |
|---:|---|---|---|---|
| 1 | Round 4 application artefact | `R4_FOLLOWUP_01_docs_rail_visibility.py` | `31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707` | `29011D34EFFC8E7F0F88542B3DEBEE3B5190AEDB3A065550DBADB71C6D8BDC22` |
| 2 | `qa_round4/run_round4_targeted.js` | `R4_FOLLOWUP_02_targeted_suite.py` | `2F1D8B00EC9D6C0CEF0FE631DB0E294C764A0BE1CF254F518107184B7C2B462A` | `2C788BC3D3D20B94C943AA0F74156639BA9044994743AF8C2F2E9A763EBE0FD1` |

Example, from `C:\Claude\SIREN\codex`, using the bundled Python runtime:

```powershell
$py = 'C:\Users\tsinc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
Copy-Item -LiteralPath 'round4_work\SIREN_1_65_0_R4_FJ_reapplied.html' -Destination 'SIREN_1_65_0_R4_FOLLOWUP.html'
& $py 'round4_followup_patches\R4_FOLLOWUP_01_docs_rail_visibility.py' 'SIREN_1_65_0_R4_FOLLOWUP.html'
& $py 'round4_followup_patches\R4_FOLLOWUP_02_targeted_suite.py' 'qa_round4\run_round4_targeted.js'
```

Each script checks the complete input SHA before any mutation, requires every replacement anchor
to occur exactly once, validates post-conditions and the exact output SHA, then writes through a
flushed temporary file and an atomic replace. Both scripts also reject a wrong input under
`python -O`; correctness does not depend on Python `assert` statements.
