# SIREN Round 12 — apply order

All hashes are SHA-256, uppercase. Run from `C:\Claude\SIREN\codex`. Each script verifies every input hash and every exact-count anchor before it writes, writes through a sibling temporary file, and verifies its pinned output hash. A wrong input therefore fails before any write.

## 1. BB — no external requests

```powershell
node .\round12_patches\R12_BB_no_external_network_mode.js <private-copy-of-FROZEN_R11_BASE.html>
```

- Input application: `2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030`
- Output application: `1B8279C4D0A04B52858DE26C76E5F8090F1555EE37BD280684632D40B7DC33AF`

## 2. BC — truthful confirmation tone

```powershell
node .\round12_patches\R12_BC_truthful_confirmation_tone.js <BB-output.html>
```

- Input application: `1B8279C4D0A04B52858DE26C76E5F8090F1555EE37BD280684632D40B7DC33AF`
- Output application: `101E2ACE553B7AEB44CDC1FF6C9E02042CDAC7F7038741CD8D3BCDFB5322FD61`

This is the final application hash for Round 12. Size: `8,599,488` bytes.

## 3. BD — shared-gate repair

BD changes test code only. Pass the SIREN repository root containing both `qa\` and `codex\qa_round3\`:

```powershell
node .\round12_patches\R12_BD_shared_gate_repair.js C:\Claude\SIREN
```

| File | Input SHA-256 | Output SHA-256 |
|---|---|---|
| `qa/run_regression_suite.js` | `1103638BED9A41E8D9BDC6F4BD913BB6897AADE479AED51132E46E268B1B63BE` | `C273D3D67D9E9DD4AC8390CB5FF5F93227EFBF05D37F121E3D0603D3EBC0237C` |
| `qa/validate_regression_exports.py` | `2A292273C568DF80842EE7DC19CABE212E22569B7D51DAD23CA4EFA7B2C1D608` | `C10CD713EF9C46B67F192543F8BF0BD5A9978B41F1E30878EB95C3D357B41141` |
| `codex/qa_round3/run_regression_suite.js` | `6DDE283FA3A058C57DD54B413A524E1062CB3375501399C342AC8FAED48131CC` | `EFCBBAB8F36910A6B5ABE85D92D9697BD167E4E65B3EA030D583DCBF5537FB04` |
| `codex/qa_round3/surface_suite_additions.js` | `5FAAB9ADB3AC55F32040302828218DFC2F8A18F70C9ED18E144124D75914700B` | `74616FED7877F6E9091592AC554CE9DE21C66DCF69AA5A53332000841BD41A84` |
| `codex/qa_round3/run_round3_suite.js` | `38C34F4BD2563872C51F4D620DDCF25DA9293B88B38542D0894E940382AC1F71` | `7FBC45A54B18AA482E297C662CA26D6CE77BA69FDA7509078EA30116501F6E0B` |

The wrapper's output embeds and verifies the transformed core-runner SHA. BD leaves the application bytes unchanged at `101E2ACE553B7AEB44CDC1FF6C9E02042CDAC7F7038741CD8D3BCDFB5322FD61`.
