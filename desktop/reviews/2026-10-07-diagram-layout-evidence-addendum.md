# Independent final evidence addendum: Diagram layout

Author: `/root/catalogue_view`, 2026-10-07. The reviewer performed read-only record/hash/assertion checks. **All GUI/native and full-suite executions discussed here were performed by `/root`.** This addendum is not package, hosted CI or release approval.

## Completed evidence

The later full-suite record `diagram-layout-full-suite-2026-10-07T11-22-28.486Z/result.json` is `COMPLETE`: identity **4/4**, units **1580/1580**, with 635 identical before/after input entries and `changedInputs: []`. This is a new successful execution; the earlier 1578/1579 ADVERSE suite remains retained unchanged.

After that suite, the only change among its 635 captured files is `tests/native/diagram-layout-render-app.mjs`: `ce0656ed…` became `20fc76a8…`. All captured product and unit files still match the suite snapshot. The reviewer hashed every captured file rather than inferring this from working-tree labels.

The supported-scope diagnostic `2026-10-07T11-24-22.387Z/result.json` is `COMPLETE` with **27 cases** and identical input maps. It executed the retained owner harness `diagram-layout-supported-scope-app-owner.mjs` at hash `6c97f6c8…`. The 1,608-character declaration/oracle segment promoted into the permanent native harness is byte-identical. The diagnostic also captured the older permanent harness hash; it is not mislabeled as execution of the later permanent file.

The final serial development regression record `layout-native-regressions-2026-10-07T11-26-49.499Z/result.json` is now `COMPLETE`: **10/10 commands, 79 cases**, all exit code zero. Its final utility run executes the promoted permanent harness and completes **27 cases**. All 635 final capture hashes match current bytes, with exact before/after maps and no changed inputs.

| Root-executed development probe | Completed cases |
| --- | ---: |
| Diagram layout controls | 4 |
| Diagram style | 6 |
| Diagram Guided | 4 |
| History and typography | 8 |
| Diagram catalogue | 7 |
| Diagram Build | 7 |
| Diagram edits | 4 |
| Diagram vector | 8 |
| Presentation style | 4 |
| Diagram layout SVG/Present utilities | 27 |

The reviewer checked each aggregate receipt against its separately retained `result.json`, verified each recorded harness hash against its current file and recomputed equality of each receipt's input maps. This independently verifies the stored evidence relationship; it is not independent execution of those probes.

## What the expanded geometry cases establish

Class, state, ER and requirement fixtures now record respectively **4, 6, 4 and 2 semantic groups** for each engine. The snapshots use node text, transforms and finite bounding boxes, with strict SVG/public-slide geometry equality and different Dagre/ELK geometry. These are concrete geometry assertions for those fixtures, rather than nonempty SVG or changing select labels.

Supported global frontmatter/init layout cases compare both saved preferences with the explicit Dagre baseline. Supported scoped `layout` cases compare both saved preferences with **the exact source-only rendering** and require the parser to retain the scoped key. That proves metadata preferences do not displace source-only rendering. It does not separately assert that the scoped source-only geometry equals the global Dagre baseline.

Ignored scoped `defaultRenderer` cases explicitly require the actual parser to return the empty scope object and compare each saved preference with its corresponding actual engine baseline. This preserves strict assertions while removing the previously unsupported legacy-key oracle. The independent local sanitizer review supplies separate evidence for why that key is ignored.

Flowchart utility cases retain imported-fill, engine distinction and global frontmatter precedence checks. The four additional families cover their specified sources, not every possible diagram or configuration. SVG/Present comparisons are semantic DOM geometry; they do not assert decoded PNG pixel equality or physical-monitor behavior.

## Original adverse records

The read-only checker confirms the following original records still say `ADVERSE` and retains their hashes/error text in JSON: the original full suite, native SVGRect recorder failure, RoughJS path-control-point mismatch and both incorrect legacy-key geometry oracles. Successful later runs do not rename or overwrite those records.

No production fix is invented from the recorder/oracle corrections. The original full-suite scheduling failure and test-local deterministic PIN timer correction remain separately documented. The current successful full suite is valid evidence for its own captured bytes.

## Scope and reproducibility

`reviews/2026-10-07-diagram-layout-evidence-addendum.check.mjs` reproduces the read-only integrity assertions. Its first execution completed successfully; the companion JSON preserves that output, source identities and original record references.

This addendum closes the previously pending development evidence review. It does **not** approve a copied portable package, hosted workflow, release, real IME, physical multi-monitor behavior or universal geometry correctness. Qualification attaches to captured working-tree hashes, rather than treating the record's base-commit label as proof that every changed byte belongs to that commit.
