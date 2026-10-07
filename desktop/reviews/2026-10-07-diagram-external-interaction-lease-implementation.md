# Diagram catalogue Task2: pending Guided/Style lease implementation

Author and focused-test executor: `/root/media_batch_review`. This is an implementation record for my own code, not independent review or native approval. Scope: only `src/ui/diagram/guided-view.js`, `src/ui/diagram/style-view.js` and new `tests/diagram-external-interaction-lease.test.mjs`, under the approved catalogue plan Task2. Root owns future catalogue integration, creation, lifecycle, build and GUI scheduling.

I read the approved catalogue plan and the genuine creation/admission preflight. The latter correctly identifies that focus movement can apply Guided blur and Style change even when creation IPC does not save the origin. No creation operation or catalogue UI is implemented by this tranche.

## Contract implemented

Both controllers accept optional `contextFor=()=>undefined`, and expose `beginExternalInteraction()`. It returns a frozen `{restore, retire}` handle, or null for disposed/composing controllers. Repeated acquisition in the same live context/source returns the same handle. The captured binding includes the source text and actual mounted focus/input identity; it does not rely on `getDiagram()` snapshot object identity. Root must supply a stable admission/retirement context token to distinguish equal-source context replacement.

`restore()` validates the current context/source/DOM and private visibility, restores the original focus and supported input selection **before** release, and returns false for stale/disposed/disabled/hidden fields. Repeated restoration is false. `retire()` idempotently releases without applying, reconstructing DOM or refocusing. Focus restoration failures release and return false.

During a live lease, Guided blur/select-change do not finish the field, Style change/target/colour events do not apply, and Style paint does not overwrite live field previews/errors. Original mounted pending DOM, value, selection, source and real draft/history remain intact in focused tests. A successful external new-window operation can retain the handle without restoring focus; the caller owns genuine return handling. Nothing here automatically refocuses a newly opened window.

Explicit Guided Enter/Escape and `commit()`, and Style Escape/`commit()`/explicit `select()`, retain their existing purpose. Explicit commit retires the lease and invokes existing validation; invalid values still refuse and remain visible. Actual composition start/end events guard acquisition and commit, and composition key events do not imply completion. This is event-level behavior only, not physical IME evidence.

Guided pause/dispose retires its lease. Style dispose retires its lease. Root integration must retire handles at common private-context teardown/Lock and acquire them before any pointer/keyboard/programmatic catalogue focus movement; the unimplemented UI cannot yet claim that integration promise.

## Actual test chain retained

Evidence directory: `evidence/workspace-surface/diagram-external-lease/`.

- `original-red.log` retains the first attempt, including a test DOM stand-in traversal error on text nodes. Its source snapshot `original-fixture.mjs` remains retained. That setup error is not counted as a product finding.
- After correcting only the new fixture traversal, `contract-red.log` records twelve expected failures for missing `beginExternalInteraction`.
- The first implementation produced 24/24 focused successes including unchanged original Guided and Style view regressions.
- Self-review added genuine RED cases for late disposed Guided input and disabled restoration: `late-private-red.log` records three failures. The retained field's late blur could apply after disposal; the minimal fix refuses finish on disposed/noncurrent editing identity. Restoration now truthfully refuses disabled fields. `private-green.log` records 27/27.
- `style-paint-red.log` records one genuine failure where repaint overwrote a live colour preview during a lease. Style paint now defers while leased; ordinary explicit commit first retires then paints/validates.
- `final-frozen-green.log` records **50 tests, 50 passed, zero failed, exit 0** across the new sixteen lease cases plus unchanged Guided/Style model/view, draft and history/view suites. The final tests explicitly compare actual draft history as well as source/status and mounted DOM. Both edited source scripts passed Node syntax checks.

Command executed with Node v24.16.0:

```
node --test tests/diagram-external-interaction-lease.test.mjs tests/diagram-guided-view.test.mjs tests/diagram-style-view.test.mjs tests/diagram-guided.test.mjs tests/diagram-style.test.mjs tests/diagram-draft.test.mjs tests/diagram-history.test.mjs tests/diagram-history-view.test.mjs
```

Tests execute the actual controllers, extracted actual Guided/Style helpers and real draft/history in a VM with explicitly simulated DOM/focus/composition delivery. They are not browser, native, physical input or genuine IME qualification.

## Frozen source identities

| File | SHA-256 |
| --- | --- |
| `src/ui/diagram/guided-view.js` | `49aed83caabe2c72c99d943b419e85ec8ee846d9cf98a6f4aefa568c119c47c1` |
| `src/ui/diagram/style-view.js` | `7e55f095bbf7d46f01eed8058558af3a23a7f9bb1e310956d7c573901159b48d` |
| `tests/diagram-external-interaction-lease.test.mjs` | `6e892d851a7057f6ccf85f22a70591a6899ee72533c88a3b490c22ef6b8e53f3` |

Closing identities and evidence hashes are in `frozen-inputs.json`. This is a closing snapshot, not a retroactive before-test capture or whole-tree stability claim. Original Guided/Style tests were not edited. Main, window/integration/build/generated/workflow and creation authority were not changed by me.

## Remaining qualification

Root explicitly restricted this tranche to focused tests and owns full-suite scheduling; I did not run the global suite. No build, GUI/native run, copied package, CI, commit or deployment was executed. Future integration must verify actual focus ordering, context retirement, pending title/Build/Inspector, Save/prepare handoff and new-window activation. The finite helper behavior does not qualify a catalogue that is not wired yet. Earlier Docs qualification and historical hosted failures remain separate.
