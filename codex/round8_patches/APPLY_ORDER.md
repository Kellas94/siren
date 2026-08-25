# SIREN Round 8 — application order

Base: `FROZEN_R8_BASE.html`  
Bytes: `8,552,615`  
SHA-256: `F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56`

Apply each script to the same private HTML copy, in this order:

| Order | Job | Script | Script bytes | Script SHA-256 | Required input SHA-256 | Exact output SHA-256 |
|---:|---|---|---:|---|---|---|
| 1 | AI | `R8_AI_docs_slash_typing.js` | 5,512 | `AE05B66B7F34261EF6EF792874EA4E4B9139E909E339AC5528341339DD2319AE` | `F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56` | `6885555CE62C50D030E0948439C9193AFADD45E7A82638A74862D92913CF5A3E` |
| 2 | AJ | `R8_AJ_title_undo_ownership.js` | 10,464 | `B3C40F1F415F7509FC6EE222D63AD66C7351060DA0AA864089BB94010624BF49` | `6885555CE62C50D030E0948439C9193AFADD45E7A82638A74862D92913CF5A3E` | `AC14DB72BC38EF72799B8A323DB649057F63227E84588FD18D79C438E824F844` |
| 3 | AK | `R8_AK_short_docs_block_menu.js` | 6,049 | `A9296DB68BF54BCBECD8A34EF613B00B12B5B64D2D94476DE2A8BE287DF637C3` | `AC14DB72BC38EF72799B8A323DB649057F63227E84588FD18D79C438E824F844` | `03CD3978B819D993BA9DC0B2E749D134BD40DE35D1BB54D57A2D97C88267167F` |
| 4 | AL | `R8_AL_docs_submenu_point.js` | 7,586 | `2B1A91E1DEA7FD9B770917D9E3EA17A701748D0372FA81DB5A0D2EF728D9C854` | `03CD3978B819D993BA9DC0B2E749D134BD40DE35D1BB54D57A2D97C88267167F` | `5F0CD90E49AD707D52071B571865A6A3944E07BB860F1F5D785156407E87246A` |
| 5 | AM | `R8_AM_mermaid_frontmatter.js` | 6,793 | `F0DA09427159E32297D805E7832B80D743E672281E230C5F81EFA0BD99A26FEB` | `5F0CD90E49AD707D52071B571865A6A3944E07BB860F1F5D785156407E87246A` | `B3714C1748274D6C13C1149162D62193FE488ADCE6492AC183BCD82354A99DBB` |

Example:

```powershell
Copy-Item -LiteralPath .\FROZEN_R8_BASE.html -Destination .\SIREN_R8_PATCHED.html
node .\round8_patches\R8_AI_docs_slash_typing.js .\SIREN_R8_PATCHED.html
node .\round8_patches\R8_AJ_title_undo_ownership.js .\SIREN_R8_PATCHED.html
node .\round8_patches\R8_AK_short_docs_block_menu.js .\SIREN_R8_PATCHED.html
node .\round8_patches\R8_AL_docs_submenu_point.js .\SIREN_R8_PATCHED.html
node .\round8_patches\R8_AM_mermaid_frontmatter.js .\SIREN_R8_PATCHED.html
```

The scripts reject the wrong input hash before writing, assert the exact occurrence count of every anchor, write atomically, and verify the exact output hash. A clean replay produced `8,557,663` bytes and the final SHA above.

Test-suite companion adjustment: Job AL changes the uniquely mutation-tested call from `buildDocsContextMenu(target)` to `buildDocsContextMenu(target, point)`. `qa_round3/surface_suite_additions.js` was therefore re-anchored to the new exact call; this is test code, not a sixth application patch.
