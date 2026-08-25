# SIREN Round 5 — canonical twelve-patch order

Apply these scripts, in this order, to a private copy of `FROZEN_1_66_0.html`:

`AC → AB → R → S → T → Q → K → L → M → N → O → P`

Every script verifies its pinned input SHA-256 before inspecting anchors, asserts the exact occurrence count of every replacement anchor, verifies its exact output SHA-256, and only then atomically replaces the supplied copy. No merged HTML is part of the handback.

Frozen base: 8,438,995 bytes, SHA-256
`B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`.

| # | Script | Bytes | Script SHA-256 | Required input SHA-256 | Exact output SHA-256 |
|---:|---|---:|---|---|---|
| 1 | `R5_AC_vector_diagram_pdf.py` | 30,545 | `663FFFB698CA23D5321BCC513BE486B1C6E971090302AB723CD88EC079B32447` | `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208` | `E413C6E4A0340525A87428CF244E6F9C7BA0F39B49A3B13C29D165B58E35E26B` |
| 2 | `R5_AB_truthful_office_exports.py` | 31,869 | `A8A4FE9CCF9EEB047D5C95478C63E93ADDA133A897D24939FCF486A309814298` | `E413C6E4A0340525A87428CF244E6F9C7BA0F39B49A3B13C29D165B58E35E26B` | `71B86978684148CC9F5092C2DB7E96E8D1548A792E11BF13BD396CD473016E7E` |
| 3 | `R5_R_guided_source_integrity.py` | 24,864 | `DDEFBCF773D4A6B440A48138A4551A797F98C8D078876A8CF48EA2B674ED7F04` | `71B86978684148CC9F5092C2DB7E96E8D1548A792E11BF13BD396CD473016E7E` | `077A41505B44648EA15AB7285B4A3F9789732ED4BAA81E9412297B39A7EF64FC` |
| 4 | `R5_S_rendered_style_targets.py` | 10,495 | `FB94F465D345D60A120DEC6F58906BD288888D708C6B04EE3E86720897F0A7C6` | `077A41505B44648EA15AB7285B4A3F9789732ED4BAA81E9412297B39A7EF64FC` | `7A3C2E548A2E6C1666A9D2586EE024793407A8929289DD9F42607CAFD8D5C815` |
| 5 | `R5_T_truthful_visual_status.py` | 4,941 | `EC4ED4A62D6BC0C81AA61C751FAD32F7978B90DB038CEC3995203604696F22E1` | `7A3C2E548A2E6C1666A9D2586EE024793407A8929289DD9F42607CAFD8D5C815` | `71A4AE7DC1C189C43D6AC0F902561CC2F211007C29AED5EFE66DFAC7C715B92E` |
| 6 | `R5_Q_docs_heading_rail_gutter.py` | 3,459 | `48376931A6E058D8327B9B1109014B11ABF681A2828FA037B66F9C76946276DA` | `71A4AE7DC1C189C43D6AC0F902561CC2F211007C29AED5EFE66DFAC7C715B92E` | `74E5696FC36DBE2E08D977CB4CC267B46FA19A3072D70689DB3CF3C48CB05151` |
| 7 | `R5_K_attached_note_delete_guard.py` | 6,581 | `57586A85427A533FA02476BA3CC621B012190482B035BCF406DB9BA456B02EE3` | `74E5696FC36DBE2E08D977CB4CC267B46FA19A3072D70689DB3CF3C48CB05151` | `1C0ED8E49749000C57E7AB77AE5E7839A46C4CFC7DD777DA6B7DBBE6CEF16537` |
| 8 | `R5_L_revision_restore_focus.py` | 3,626 | `3AE8FF2D30DB685B95E4094A424AE28B27E3AAA7F0B02B8416E1B82D936D30F9` | `1C0ED8E49749000C57E7AB77AE5E7839A46C4CFC7DD777DA6B7DBBE6CEF16537` | `7D18C881B4AEC2347AF4ED9B6F301042FAC7A7856C860E21F16E0B8B0CF14C24` |
| 9 | `R5_M_zoom_chip_fit_page.py` | 4,036 | `2F712AB92726AA8F10BBD9A82CC76E362154CD01E4F81705C03EBEDF011D2F47` | `7D18C881B4AEC2347AF4ED9B6F301042FAC7A7856C860E21F16E0B8B0CF14C24` | `1F5D29E5579F4FE1A45767E21EEB510FBE6E5511233EF4F4F63774DDCAEEECF8` |
| 10 | `R5_N_tour_docs_lifecycle.py` | 3,516 | `33A9CB55E3AA59BF813A9108A5BA8A048B26BE853B0508FF45920C8FD5AC769F` | `1F5D29E5579F4FE1A45767E21EEB510FBE6E5511233EF4F4F63774DDCAEEECF8` | `B862A7753BDA312330F84581B0C5B6A1B6D760F01B8BFCFFE76492029D2E791A` |
| 11 | `R5_O_docs_read_only_and_slash_escape.py` | 22,943 | `94DD32F2E598A2A42508D4BAD9F6AC9988189CDD1B38457B011AAE78718D940B` | `B862A7753BDA312330F84581B0C5B6A1B6D760F01B8BFCFFE76492029D2E791A` | `3B790F146492B777A2FE221E4BE455FB054693CC0A147E13C49C1C5A8FC0AFDD` |
| 12 | `R5_P_window_identity_and_brand_icons.py` | 38,306 | `BDF3DF23B606040D62FD82B50D0415EB72296FA41EBB776843CA7D9455612CEA` | `3B790F146492B777A2FE221E4BE455FB054693CC0A147E13C49C1C5A8FC0AFDD` | `8C31885AA92050DB7D6BEF8B0949C274497EB845191BBC53E3338D1995E71D28` |

The verification copy is 8,523,978 bytes with SHA-256
`8C31885AA92050DB7D6BEF8B0949C274497EB845191BBC53E3338D1995E71D28`.

## Separate test-only patches

These are not part of the application SHA chain:

- `round5_ab_patches/R5_AB_export_gate_disclosures.py` updates only the owner-supplied fidelity gate. It is pinned `3F30F3ED…E2BEB3 → CC0272EB…969BEF`; script SHA `B1DF67AC065A6C4731BDC63F03A16E91740C556609F1843CCA17B866A4CE3E7F`.
- `round5_suite_patches/R5_A_refresh_job_a_export_contract.py` replaces the stale requirement for embedded PPTX raster media with native-shape/no-picture/no-orphan-media assertions and corrects the K coverage note. It is pinned `ACC72AA…5E1F → 6DDE283F…31CC`; script SHA `EB66E983B3EC880C7AA87FEC806E0AFBC916E7E98FB74B5F960EAEB648831E6A`.
- `round5_suite_patches/R5_A01b_repin_round3_entry.py` re-pins the Job A entry point to that exact core-runner output. It is pinned `0BF9DDC0…253E → 38C34F4B…1F71`; script SHA `9DBF35E5FA5787E985975DEBABE637DFAF297E8F6DEA93EEA762B49D43364392`.

All three apply cleanly from their named inputs; reapplication/wrong-SHA copies exit non-zero and remain byte-identical.

Across the twelve application and three test-only scripts, every active input/output pin is an exact 64-hex SHA. Fourteen scripts retain a dormant `TO_BE_PINNED` comparison branch for authoring compatibility; none has an unresolved placeholder constant.

## Chain audit

`round5_final_audit/audit_round5_final.py` replayed the complete application chain from a fresh base and produced byte-identical final output. Its report passed 106/106 checks:

- all twelve Python scripts compile and have exact 64-hex pins;
- every input pin links to the previous output;
- every script rejects a wrong-SHA fixture before writing and names the mismatch;
- every script applies cleanly from the frozen base;
- replayed bytes equal the final SHA and size;
- `APP_VERSION`, `CHANGELOG` and CSP remain byte-identical;
- no U+0008, `eval`, `new Function`, network call or external endpoint was introduced. OpenXML namespace URIs are classified as non-network identifiers.

Report: `round5_final_audit/report.json`, SHA-256
`C84F265CDB1E2560CEE302EACA04E7A0C791B117709943C0D4A17E5601347422`.

## Anchors moved or corrected

One application anchor moved during authoring:

- **K:** the short candidate beginning `const heal = canvasHealPlan(...)` occurred twice. It was expanded to the unique `canvasDeleteAndHeal` preamble so the neighbouring splice/move path cannot be altered.

No anchor moved because of base drift in AC, AB, R, S, T, Q, L, M, N, O or P. Additional guard corrections that did not move application anchors:

- **R:** the bounded 9,058-byte `structureCodeLine` replacement now verifies the exact old-section SHA `CB67A564…02124`, in addition to its unique boundary counts, so an intervening parallel edit cannot be overwritten silently.
- **AC:** the final single script folds the vector writer and unique-per-page semantic ownership correction into one base-pinned patch; discarded pagination experiments are not part of the chain.
- **AB:** the final application patch has 31 exact replacement groups covering 32 declared occurrences. The late mindmap correction changed an empty-structure fallback anchor inside `buildXlsxStructureSheet`; it did not move a base anchor.
- **O:** source literals for the glyph-prefixed Close control preserve literal escapes and assert zero U+0008.
- **M/P:** postconditions use the exact existing tooltip punctuation and favicon link; their application anchors did not move.
