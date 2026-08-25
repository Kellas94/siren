# C6 — measured performance pass

Status: verified on a disposable copy of the post-C5 application, then applied to `SIREN_v1.35.0_for_codex.html`.

## Patch integrity

- Baseline SHA-256: `3579173E9E2887ADF8670DDC970D18C8B60132E7E900831B60CF81740A76F8E3`; applied result: `7697D1AC10934EF9179CDD2A70D022B684AC7E910F559848DE1B557C44B93A70`.
- Patch: `patches/C6_performance_pass.py`; SHA-256 `A5B4981CAE2902402F3CA8B9DC441254A084969BF53721FE909BEBDA7107B97D`.
- The exact-count patch compiles, writes through a sibling temporary file and commits with `os.replace`. `syncheck.py` found one inline script and `node --check exit 0`.
- Reapplying stopped at the first moved anchor and left the applied hash unchanged.

## Measurements and decisions

All interaction samples were driven through copies of the real application over HTTP. Medians are reported unless stated otherwise.

| Path required by the brief | Post-C5 baseline | C6 candidate | Decision |
|---|---:|---:|---|
| Initial boot, 7 reloads, DOMContentLoaded / load / rendered plus 2 rAF | 80.0 / 99.4 / 283.6 ms | 114.3 / 134.7 / 298.0 ms | No change. Docs code is not invoked while Docs is closed; Mermaid/startup variance dominated and no reproducible regression was fixed. |
| Switch among 25 real diagram tabs, 51 clicks, sync / rendered / 2 rAF | 4.9 / 23.5 / 33.2 ms; p95 7.8 / 42.0 / 52.9 | 5.5 / 25.2 / 35.1 ms; p95 7.6 / 39.4 / 54.3 | No change. The path was already fast and the differences are noise. |
| Type 9 real keys near block 39, input / 350 ms marker scan / 160 ms primary save | 1.2 / 1.2 / 3.2 ms | 1.4 / 1.2 / 3.5 ms | No change. No user-visible slow path reproduced. |
| Open the 39-block document, sync / 2 rAF | 24.2 / 35.5 ms | 23.5 / 34.5 ms | Timing delta is modest, but the baseline eagerly assigned 261,941 characters across six textarea values. C6 keeps all 254,000 knowledge characters canonical and defers their DOM values until reveal/edit/find. |
| Search a 25-document, approximately 6.3-million-character register, 42 non-empty key events | 13.1 ms/key median, 15.9 p95, 18.0 max | 0.3 ms/key median, 0.6 p95; one 38.2 ms cold build after 120 ms debounce, then 0.5 ms warm scan | Fixed with a per-document WeakMap text cache, edit invalidation and a 120 ms register-search debounce. Six typed characters move from about 78.6 ms spread across handlers to about 1.8 ms of handlers plus one deferred cold build. |

The boot-ready raw baseline samples were 246.4, 251.1, 257.6, 283.6, 294.8, 315.4 and 336.0 ms; candidate samples were 283.4, 292.4, 296.3, 298.0, 375.6, 394.6 and 397.9 ms. These are recorded to avoid turning a noisy measurement into a claimed improvement.

## Large-document correctness

`qa/c6_large_doc_smoke_ui.js` imported the supplied 311,895-byte fixture through Docs in the disposable real app.

- Before reveal: five Knowledge controls, `valueCharacters: 0`, `deferredCharacters: 254000`, zero open rows.
- Ctrl+F for the unique tail `if __name__ == "__main__":` returned `1 of 1`, opened exactly one Knowledge row, hydrated 228,182 characters, selected the exact phrase and left 25,818 characters deferred.
- No page errors occurred. Find-in-document therefore still searches the canonical deferred value and hydrates only the selected control.

## Deliberate boundaries

- No O(n²) change-marker rewrite or duplicate drift-call change was retained because the measured typing path was already fast.
- No Present, Map, deck, card or ambient code was inspected for modification or changed.
- Measurements are Chromium/Windows samples on this workstation, not a browser or hardware matrix.
