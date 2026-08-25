# SIREN Round 13 apply order

Base: `FROZEN_R13_BASE.html`  
Bytes: `8,598,565`  
SHA-256: `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697`

Apply each script to the same HTML path, in this order. Every script checks its exact input hash, every replacement anchor has an exact expected occurrence count, and the final write uses a same-directory temporary file plus atomic rename.

| Order | Job | Script | Script SHA-256 | Application input SHA-256 | Application output SHA-256 |
|---:|---|---|---|---|---|
| 1 | BE | `R13_BE_marker_gestures.js` | `14AC7650467DB6A2D96CD57CE6D4DC6E5D35C5B0F37C7E1AD463FDFD10EDA568` | `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697` | `178F8BB844AD532FC6C0CAA9E6D61244FB5B82F78790B5722B925215B349E3F1` |
| 2 | BF | `R13_BF_restore_pptx_wrapping.js` | `DFEE46AF68952398EA378FAE96F405CEE46718BC05C4B61C4EF4F9213D4EF87D` | `178F8BB844AD532FC6C0CAA9E6D61244FB5B82F78790B5722B925215B349E3F1` | `7E1A4A4FF0B30B853227C00F6FF770A1BB315574D08D539368E9F913C7C6AD9B` |
| 3 | BG | `R13_BG_truthful_reference_jump.js` | `A1FA81D9CC87C6DDE7D4A75D0EAB4D6E65C5FADD38A9B34CC4A6F4EF5F10F511` | `7E1A4A4FF0B30B853227C00F6FF770A1BB315574D08D539368E9F913C7C6AD9B` | `E3B8E7D56ADDB2E8D828A661060075EDAD15E72B06C4BA6FB55360CB4AF4EE17` |
| 4 | BH | `R13_BH_visible_reference_arrival.js` | `F6ACBA33789D601E544FDD2A150DFFB2E75BB47201F7C282A2E38FCD64D0AC80` | `E3B8E7D56ADDB2E8D828A661060075EDAD15E72B06C4BA6FB55360CB4AF4EE17` | `92D2026B5032FC517908942C937815AA854D2ABD338DBE7EAB1F696A5C907705` |
| 5 | BI | `R13_BI_accessible_welcome_tour.js` | `30D5A84BC52082BBE4842D14D7C9E935A82E3F659B9B21966E93203815C19FF1` | `92D2026B5032FC517908942C937815AA854D2ABD338DBE7EAB1F696A5C907705` | `6560C3DCC0B0E7A4CFC2500295271D3496CBE31AE26BB0A85A14028B1A2E7CA4` |
| 6 | BJ | `R13_BJ_navigation_keys_do_not_edit.js` | `F51AA3B75B5E8DAF74920A07AF6CB28882631465915F60B76CC814731619A5F9` | `6560C3DCC0B0E7A4CFC2500295271D3496CBE31AE26BB0A85A14028B1A2E7CA4` | `60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A` |

Final bytes: `8,601,839`  
Final SHA-256: `60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A`

Anchor drift: **none**. Every text anchor named in the six scripts matched exactly once on its pinned input. BF required a correction to the proposed mechanism (both live export routes can supply one flat line), but its unique `deckShapeTextBody` anchors did not move.

Example:

```powershell
node .\R13_BE_marker_gestures.js C:\path\to\SIREN.html
node .\R13_BF_restore_pptx_wrapping.js C:\path\to\SIREN.html
node .\R13_BG_truthful_reference_jump.js C:\path\to\SIREN.html
node .\R13_BH_visible_reference_arrival.js C:\path\to\SIREN.html
node .\R13_BI_accessible_welcome_tour.js C:\path\to\SIREN.html
node .\R13_BJ_navigation_keys_do_not_edit.js C:\path\to\SIREN.html
```

Replay evidence: the six scripts rebuilt `round13_replay_final2/SIREN_R13_FINAL_REPLAY.html` from a fresh copy of the frozen base and reached the exact final hash above. Each script was also invoked against the already-patched replay; all six rejected that wrong input hash, exited non-zero, and left the target byte-identical.
