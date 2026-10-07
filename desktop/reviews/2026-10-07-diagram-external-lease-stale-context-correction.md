# Guided/Style stale pending-context correction

Correction author and focused-test executor: `/root/media_batch_review`. Original independent finding author: `/root/disk_inventory`. This is my own implementation correction record, not an independent approval of it.

## Accepted adverse evidence

The independent review `2026-10-07-diagram-external-lease-independent-review.md`, SHA-256 `37a87a911bed2003722e60da6f9af4eabf3284ef68571a1efcd06540e6dee2c9`, demonstrated four failures in ten adversarial cases. Original Guided49aed/Style7e55 correctly refused lease restoration after equal-source context replacement, but late blur/change or explicit commit could still apply the old pending private field. The author's first report and tests stopped before that later mutation and did not protect this branch.

I read the actual report and probe source, accepted the finding, and preserved the exact pre-correction Guided/Style/new-test sources under `evidence/workspace-surface/diagram-external-lease/pre-stale-correction/`. The original author report dd5b and independent adverse report37a8 remain unchanged, as do the reviewer's original logs/observations. The earlier focused successes do not override this adverse evidence.

## Actual RED and bounded correction

Four new own regression cases first failed against the retained pre-correction source: **16 prior controls passed, four new cases failed**, captured in `stale-context-red.log`. Each controller is tested after equal-source token replacement and failed restoration, both through a late implicit event and through explicit commit followed by repaint/Escape. Assertions protect exact source/history, original mounted DOM/value, external focus and refusal of a new lease over the stale field.

Guided now stores the stable context token with its editing closure and refuses finish—including late blur and explicit commit/cancel—if that edit belongs to another context. It leaves the old pending field local, without applying or repainting/refocusing it.

Style stores the token at the first input/change of a pending batch. All subsequent mutation-capable apply/commit/target paths and pending input/cancel/repaint paths verify that batch binding. Equal-source replacement cannot adopt or apply the old pending values, erase them through Escape/repaint, or reacquire a valid lease over them. The caller can retire/dispose the old private context using its ordinary lifecycle. Empty pending batches still admit new edits; same-context explicit commit and invalid-value refusal retain existing behavior.

The optional default `contextFor=()=>undefined` remains compatible with existing callers, but cannot identify equal-source context replacement. Root integration must supply a stable admission/retirement token and retire/dispose private interactions at actual context teardown. No lifecycle integration or authority was changed here.

## Actual verification

- New lease cases plus unchanged original Guided/Style/model/draft/history suites: **54/54 passed, exit 0**, `stale-context-focused-green.log`.
- I executed the independent reviewer's unchanged ten-case adversarial probe against the correction: **10/10 passed, exit 0**, separately retained as `stale-context-reviewer-probes-green.log`. That is my execution of another author's probes, **not that author's independent correction recheck**.
- Both edited scripts passed Node v24.16.0 syntax checks.

These checks execute actual controllers and real draft/history with simulated DOM and event delivery. They do not qualify native focus/IME/Lock, persistent Save, catalogue creation, copied-package or hosted behavior. Root explicitly owns scheduling of full-suite/build/GUI; none was executed by me.

## Corrected frozen identities

| File | SHA-256 |
| --- | --- |
| `src/ui/diagram/guided-view.js` | `8e5970ecedaeccf302f79d1e25ffc727b741ecd2932ebf5a8ba12921b58db21d` |
| `src/ui/diagram/style-view.js` | `301c067b09597b7c7e3487a3962ce65f8fb6b6c5c532aed197f7ca875dbf236e` |
| `tests/diagram-external-interaction-lease.test.mjs` | `912761d04ddd00d65a9512f201acaf8267ac106316bdc73b392cd00982b69617` |

Closing identities and log hashes: `evidence/workspace-surface/diagram-external-lease/stale-correction-frozen.json`. This closing capture is not a retroactive before-test or whole-tree stability claim. No original tests, window/integration/main/build/generated/workflow files were edited. No GUI, full suite, package, commit, push or release was executed. Historical pan and Save-to-Attach failures remain separate.
