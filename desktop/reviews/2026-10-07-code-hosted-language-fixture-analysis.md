# Hosted Code syntax failure — independent fixture diagnosis

Author: `/root/diagram_history_final_review`, 2026-10-07. Read-only diagnosis; no product, test, harness or build changes, GUI, native rerun, API mutation or hosted rerun. **The evidence supports a missing fixture language declaration after the explicit-language contract changed, not a reason to restore unconditional Python classification.** This is not a passing native/hosted result.

## Original failure and causal chain

I read the retained original hosted Sources receipt at `evidence/workspace-surface/ci37556787785/desktop-native-sources-evidence-original/evidence/source-read/2026-10-07T01-30-45.387Z/result.json` (owner-retained SHA256 `b354c060469a0daba20348e14e9524204bb69efa5934bd18b1008a6ba6002003`). It records ADVERSE after one case, `inputsUnchanged: true`, failing `assert.ok(editorState.syntaxSpans>0)` at `tests/native/source-read.mjs:91:132`. Its captured source-read harness hash equals the current exact file hash: `e260bf75b20a9ab4e6db6453be1af1ea571e5b897f2e8f622fdec26f226de551`.

The fixture creates Python bytes with the original dataclass prefix and 300,000-line body. Its exact Docs Knowledge row contains `sourceRef`, but no `fileType`. The block title `Selected Python source` is descriptive text; it is not a language claim. The selected snapshot has workpapers rather than an exact codeFiles language claim. `createSourceContext` therefore returns `unknown` while correctly retaining the exact Docs association.

Production main supplies `selectedCodeMetadata(...).language` to NativeSourceReads. Native Code passes `context.language ?? 'unknown'` into the editor; the editor installs Python language support only for explicit `python`. Consequently this fixture no longer requests Python syntax spans. Inspection of `e5d05be^` confirms the previous editor always installed `pythonSupport(pythonParser)`, and native Code supplied no language argument. The old syntax oracle relied on that unconditional behavior. The new behavior deliberately preserves unknown/plain text and conflicting metadata instead of inferring Python from contents, titles or extensions.

`home-navigation.mjs` and `view-control-rollback.mjs` set their respective mode flag and import this same source-read module. Their early failure at the shared syntax assertion follows the same fixture path, before the later wrapper-specific coverage. This is not evidence that those later features themselves failed.

## Independent bounded reproduction

Executed `node evidence/code-source-context-independent-review/hosted-language-probe.mjs`, exit0. The probe evaluates the actual current fixture's single `const doc=...` literal with a valid exact reference, serializes its metadata into a real schema2 snapshot, then invokes both actual `createSourceContext` and production `selectedCodeMetadata`. A minimal current Code registry scope admits that exact source/version. It does not invoke a copied implementation or infer language from bytes.

| Metadata case | Both actual functions returned |
| --- | --- |
| Unchanged native fixture | `unknown` |
| Exact row adds `fileType: 'python'` | `python` |
| Exact row declares `text` | `text` |
| Exact row declares `txt` | `text` |
| Exact Python and text rows conflict | `unknown` |
| Python title plus `.py` filename only | `unknown` |
| Python declaration belongs to another source | `unknown` |

All seven classification assertions matched; each selected source retained one exact Docs association. These are bounded function observations, not a native editor or source-size test. The registry in the probe is a minimal scope model; no production access-control or rendering qualification is inferred from it.

## Recommended correction and required follow-through

Declare `fileType: 'python'` on the existing exact selected Docs row in the owned source-read fixture. Keep the 300,000-line bytes, selected source/version/hash, original syntaxSpans assertion, readonly/write guards, deadlines and wrapper paths unchanged. Do not enable Python for unknown sources, infer language from the block title/filename, remove the syntax assertion, or skip these shared probes. Existing negative controls for text, unknown and conflicting metadata must remain.

After a separately authorized fixture correction, execute the unchanged behavioral scenarios for source-read and both wrappers against a coherent build; preserve new receipts separately. A later success cannot relabel original hosted run37556787785, whose owner evidence reports FINAL FAILURE. Its copied Code COMPLETE6 does not fill the skipped focused development Code step. The retained original Diagrams20 completion and unrelated Diagram walkthrough work do not settle this failed syntax oracle.

## Snapshot and limits

Eight captured harness/product inputs were unchanged before/after this investigation. Source-context SHA256 `56c7341c5ecb282443c375dba316883953f925072493e5ad341f94158ece07ca`; native Code controller `9447182b4ecc95b5bf1f8aa427d481eae4af2d71010fb46d6df49915c3a2e0ff`; editor `13c55dab216bc759ced6f5893bf27ce99e8747dd926f060f06a0f6d16419d0c7`. Full identities and actual probe evidence are retained under `evidence/code-source-context-independent-review/`:

| File | SHA256 |
| --- | --- |
| hosted-language-inputs-before.json | `8a3a0c34cd5530d15a6d9ddf9ff4253edb96948ec69cd2382f01d4d374d86808` |
| hosted-language-inputs-after.json | `b280a6563266c3ad9126f40aae523e662e82375f98b82f5aac0c14738c173877` |
| hosted-language-probe.mjs | `22b6e8591969fdae5f7776ea374327e431097e9a70926b7062090b0bc69cbefc` |
| hosted-language-probe.log | `4f017906d66a3f9076e6df561b921a7b00c128d08dd5846436a074cf7a43f104` |

I read the disk owner's final hosted report and the retained original failing receipt; I did not independently query live CI or rehash all ZIPs. No suite/build/GUI execution or final native qualification is claimed. Other unrelated defects remain possible outside this causal analysis; the original hosted failure remains preserved.
