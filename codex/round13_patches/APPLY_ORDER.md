# SIREN Round 13 apply order

Base: `FROZEN_R13_BASE.html`  
Bytes: `8,598,565`  
SHA-256: `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697`

Apply each script to the same HTML path, in this order. Every script checks its exact input hash, every replacement anchor has an exact expected occurrence count, and the final write uses a same-directory temporary file plus atomic rename.

| Order | Job | Script | Script SHA-256 | Application input SHA-256 | Application output SHA-256 |
|---:|---|---|---|---|---|
| 1 | BE | `R13_BE_marker_gestures.js` | `AF0CB1562276F116AE9721E0A0AFA3A62F4C007A6818DEE6312067B8CC0D043A` | `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697` | `3E7AFBE6F60BA1E464C5C758AABD5F2DF68F26F1B3F8572C723FFCEFBB0BB88D` |
| 2 | BF | `R13_BF_restore_pptx_wrapping.js` | `6E46B3F4E3716089C4F16C2E41E55C994B62810A7CA9DD5FDDBA1E441AA847A2` | `3E7AFBE6F60BA1E464C5C758AABD5F2DF68F26F1B3F8572C723FFCEFBB0BB88D` | `AAE20B23D195C73C385040074BEB9B92C923E49C1AEE9FB83C56DC1C5CEBA52B` |
| 3 | BG | `R13_BG_truthful_reference_jump.js` | `0BD1BB408F35FEB68CFDB7B69CDA2BD2D522531125300D12B5CE144802D25D25` | `AAE20B23D195C73C385040074BEB9B92C923E49C1AEE9FB83C56DC1C5CEBA52B` | `EB565797BD2E9C15087DBC69F4B8C8F8004138BF716334724FB5301FCF9D559A` |
| 4 | BH | `R13_BH_visible_reference_arrival.js` | `F2617520CB51C620127022C2A5B449A7524AD233CF5124B775BFDBE9D090E22A` | `EB565797BD2E9C15087DBC69F4B8C8F8004138BF716334724FB5301FCF9D559A` | `5E1325FB393BB6808EC84AD86A942D7B7444754CD5DB442F9B65BC14BE36A01B` |
| 5 | BI | `R13_BI_accessible_welcome_tour.js` | `3BE63C11C783E441C14F8817DFF6B9ADBF1EA0136C8EDEBD0C4E3A31DAB2A430` | `5E1325FB393BB6808EC84AD86A942D7B7444754CD5DB442F9B65BC14BE36A01B` | `F45E595B3285CD3C724F94E3448794A2A588B8FFB6FF33418B92447E5781AEB7` |
| 6 | BJ | `R13_BJ_navigation_keys_do_not_edit.js` | `7AEE15049FBC9760EF625632AAE42519C6562A23D83C7F924C6BF447DAC822F7` | `F45E595B3285CD3C724F94E3448794A2A588B8FFB6FF33418B92447E5781AEB7` | `1638793CF08989F68D8CEA7A8D621067EF5A11F18483F54DFD39B8BD6B2F02F3` |

Final bytes: `8,601,836`  
Final SHA-256: `1638793CF08989F68D8CEA7A8D621067EF5A11F18483F54DFD39B8BD6B2F02F3`

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

Replay evidence: the six scripts rebuilt `round13_replay/SIREN_R13_REPLAY.html` from a fresh copy of the frozen base and reached the exact final hash above. Each script was also invoked against a deliberately wrong-hash copy; all six exited non-zero and left their target byte-identical.
