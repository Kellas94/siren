# SIREN Round 10 — application order

Base: `FROZEN_R10_BASE.html`  
Bytes: `8,582,897`  
SHA-256: `BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB`

Apply each script to the same private HTML copy, in this order:

| Order | Job | Script | Script bytes | Script SHA-256 | Required input SHA-256 | Exact output SHA-256 |
|---:|---|---|---:|---|---|---|
| 1 | AS | `R10_AS_slash_recovery_reopen.js` | 5,246 | `778B3EBDC676F2838CFE3CF73FAB42A413DE097D28B87F196A38CD2C417F6C9A` | `BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB` | `4E4DE34091AB7C1C424250B3062B8E96A3E7CEC1BBE08120A1158365D5791E71` |
| 2 | AT | `R10_AT_remaining_docs_submenu_points.js` | 5,323 | `13E598B082905A3F7EC808D7411FCF29B1DC2069E8419A2E6005B5BA581B4427` | `4E4DE34091AB7C1C424250B3062B8E96A3E7CEC1BBE08120A1158365D5791E71` | `D7C047E62C159F1C687F7BBD05D2F702D36CDF058C3B62DEC5242611D255D17D` |
| 3 | AU | `R10_AU_post_squeeze_scrollability.js` | 6,399 | `4CB5A15C143707F3F3CEB8D11044E712A8D6155431BAEDBEC50A8B1016E36CBC` | `D7C047E62C159F1C687F7BBD05D2F702D36CDF058C3B62DEC5242611D255D17D` | `D5F5B7DC6C3D7C067435EB1C3E2469C26A5858900EF8E53D64E5C51200C11A3D` |

Example:

```powershell
Copy-Item -LiteralPath .\FROZEN_R10_BASE.html -Destination .\SIREN_R10_PATCHED.html
node .\round10_patches\R10_AS_slash_recovery_reopen.js .\SIREN_R10_PATCHED.html
node .\round10_patches\R10_AT_remaining_docs_submenu_points.js .\SIREN_R10_PATCHED.html
node .\round10_patches\R10_AU_post_squeeze_scrollability.js .\SIREN_R10_PATCHED.html
```

The scripts reject the wrong input hash before writing, assert the exact occurrence count of every replacement anchor, write through a same-directory temporary file and atomic rename, and verify the exact output hash. A clean replay produced `8,584,062` bytes and final SHA `D5F5B7DC6C3D7C067435EB1C3E2469C26A5858900EF8E53D64E5C51200C11A3D`.
