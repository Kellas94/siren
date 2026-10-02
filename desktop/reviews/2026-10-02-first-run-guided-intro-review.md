# Independent first-run, Guided and intro review — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. This is an original assessment of the new desktop startup changes; prior native-launcher reports are preserved.

**Disposition: the reported Guided absence on a fresh development start and workspace-before-intro flash are reproduced as repaired by independent native observations of the current build. No new actionable defect was found in the reviewed paths. No packaged activation, login implementation, Rust change or production release admission is claimed.**

## Reviewed snapshot

Inspected the builder opening-plate patch, the conditional development scratch-project creation, the desktop CSS opacity/fade override, the recovery-mode plate retirement, both new native tests, and their existing storage/startup dependencies. Changes elsewhere in the working tree are outside this scoped review.

| File | SHA-256 |
| --- | --- |
| `desktop/build/renderer.mjs` | `660dde5856df9c251cff4881c3dc9d892bc02eac5a6e4d9b9069e2d41d81af5e` |
| `desktop/src/main.mjs` | `8107996f9c793e261eebe4359db4b2fb05dfd851894da7cacf74b84a09b1a2c2` |
| `desktop/src/ui/desktop.js` | `fa025a5b2e7701e176bb61aae9ec803b56b99e9a5161620a3c12f9ad7dea2d45` |
| `desktop/src/ui/desktop.css` | `1016c0312befab98ea759a1ee4012d6855807a108fcc972cad45b85a1aa79e8a` |
| `desktop/tests/native/dev-first-run.mjs` | `b7303fd2075a6b3faea375af55aefb54b1411c8bcc64b0ffc8f107b3536b3c9b` |
| `desktop/tests/native/guided-intro.mjs` | `e6a9b7cf219ce98167f2e70776f4a65f99c1a4822bd5d4410bd67813fade5f6e` |
| Actual `desktop/generated/app.html` | `f831ec5ce7197e17b660ea068f84c468459a3a2dce46615c6ba5f07b1e56a9e4` |
| Frozen `desktop/baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |

Build metadata reports Electron 44.5.1 and four scripts. The frozen baseline hash is unchanged; startup behavior is patched only in the generated desktop build and desktop sources.

## Independently executed observations

Both requested scripts were run through approved escalated normal Electron execution with synthetic, test-owned Data. No renderer function was substituted to make the editor pass. Native pointer/keyboard controls and saved-project bytes supply the Guided oracle.

1. `node tests/native/dev-first-run.mjs` completed successfully. Evidence: `desktop/evidence/dev-first-run-2026-10-02T15-08-41.295Z/`. No project was seeded or selected by a test project flag. Main created an owned UUID project, bootstrap was `normal`/editable, Guided label edits were saved at revision 3, and the private Python Code draft survived minimise/restore. The workpaper state did not acquire the private Code draft.
2. `node tests/native/guided-intro.mjs` completed successfully. Evidence: `desktop/evidence/guided-intro-2026-10-02T15-09-05.077Z/`. The exact two-line Mermaid source produced a visible Guided pane and semantic chips; pointer/keyboard label editing produced the expected quoted saved source. Explicit intro replay animated and then opened its overview. Fresh-storage first-paint observation retained 175 frame samples, first visible intro at document-relative 242 ms, and **zero observed app-visible frames preceding it** (`flashConfirmed: false`). These timings describe the observed SIREN document, not process-launch latency.
3. I created and executed the separate reviewer-owned `desktop/reviews/native-intro-variants.mjs`. It uses the real unchanged main/renderer, owned project fixtures, a passive frame observer registered before SIREN navigation, and Chromium media emulation only for the reduced-motion scenario. Evidence: `desktop/evidence/independent-intro-variants-2026-10-02T15-11-45.314Z/`.
4. Independently reran `node --test tests/shell.test.mjs tests/renderer-storage.test.mjs tests/native-transitions.test.mjs`: **14 passed, 0 failed/skipped/cancelled**. These cover baseline refusal, tokenized CSP hashing, hostile protocol paths/junctions, IPC sender/request refusal, explicit data-root selection, receipt-based storage and native/account transition authority.

The supplemental variants independently close gaps in the two requested tests:

| Scenario | Observed behavior |
| --- | --- |
| Fresh development with emulated reduced motion | Normal/editable owned project; 171 frame samples; zero visible or animated intro frames; CSS display `none`, plate retired. |
| Returning explicitly selected project | Same project identity and exact source retained; only one project remains; 180 frame samples; zero animated intro frames; plate retired. |
| Damaged explicitly selected project | Recovery/read-only bootstrap; recovery dialog open; normal workspace version never initialized; original damaged revision bytes unchanged; only one project remains; 180 frame samples; zero animated intro frames; plate retired. |

Returning and recovery scenarios each recorded three early frames with the **static opaque initial plate**, followed by retirement, without the running intro animation. This is the current implementation's startup concealment, not proof that returning/recovery users see no plate whatsoever. I visually inspected the saved Guided edit and damaged-project recovery screenshots: the semantic Guided rows are present and the recovery dialog is clear and unobstructed.

## Source reasoning and practical limits

The new main guard requires an unpackaged app, no selected project and `mode === 'normal'`. It creates a blank project through the existing native `ProjectStore` and selects it through the existing durable selection path. That resolves the fresh development `NO_PROJECT`/read-only state which prevented an editable Guided workspace. A valid existing selection is read first and remains selected; a damaged selected project enters recovery before this creation guard. The observed returning/recovery cases retain the original project. Packaged activation predicates and authority checks remain in the save path.

The builder requires exactly one known opening-plate and opening-choice marker in the verified baseline, removes the initial `hidden` marker, and retires the initial plate on the non-first-run branch. The desktop CSS makes the initial plate opaque and keeps the fade opaque until its ending segment. The source's reduced-motion media rule still hides the plate, and `playSirenIntro()` still retires it without animation under reduced motion. The native recovery startup guard returns before normal initialization; desktop recovery UI now hides the initial plate before showing its dialog. This coheres with the independently observed variants.

The requested Guided test itself assumes that the fresh intro becomes visible and was run with reduced motion false. It should not be described as reduced-motion coverage; the independent media-emulated variant supplies that observation. The requested tests also do not themselves exercise a returning profile or damaged-project recovery. Their no-flash evidence is passive requestAnimationFrame observation of the relevant DOM/CSS, not an operating-system compositor trace. It does not prove every conceivable machine/initialization timing has no flash.

The Guided saved-source oracle is exact and durable, but these tests do not await/assert final SVG semantics after the label edit. The inspected screenshot was taken while that asynchronous preview still displayed the previous label; this review does not treat it as a final rendered-diagram oracle or conclude that a transient preview proves a new renderer defect.

The native dev fixture stores an owned scratch project and selected-project record; this behavior is intentionally limited to an unpackaged normal development start with no selection. This review does not infer that an unactivated packaged build creates an editable scratch workspace, or that login/activation restrictions were bypassed.

Username/PIN access remains separately deferred in the approved plan. No PIN was read, echoed or stored by this review, and no login screen was implemented or qualified. Production account/update admission, packaged startup policy and full Task 6 update/recovery qualification remain outside this defect batch.
