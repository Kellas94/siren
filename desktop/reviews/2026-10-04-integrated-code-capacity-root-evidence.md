# Integrated Code capacity: scoped root measurements

Author: root implementer. This is a measurement, not independent approval or complete 300k-source qualification.

Actual development source0700cbf, reports-only HEAD4dc5d19. Captured src/build/tests/scripts/generated/package/baseline/workflow inputs stayed unchanged. Owned helper and full per-case measurements: evidence/source-capacity-integrated/2026-10-04T13-53-51.943Z/result.json. The helper ran the actual main/preload/native editor with a passive200ms Electron process sampler. It executed no Python and changed no product limits.

Hardware: Windows10.0.26200 x64, Intel i9-13900HX,32logical processors,34,086,969,344bytes RAM, Node24.16.0. Each project has200Docs sharing one exact source reference, retained agent/release/author metadata, one pinned reader and one working Code window. Sources include UTF-8 BOM, CRLF and Unicode; fixtures contain100,000/300,000 generated source lines plus their terminal empty editor line.

| Fixture | UTF-8 bytes | Readonly open | Working open | Trusted beforeinput to second frame p95 | CDP command acknowledgement p95 | Peak summed process working sets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
|100k|2,577,781|431.4ms|553.3ms|27.2ms|139.6ms|902,144KiB|
|300k|8,177,779|900.2ms|1,207.6ms|26.4ms|254.4ms|1,139,312KiB|

Twenty trusted EOF insertions per source were independently verified as exactly the seeded bytes plus20x characters after Save. Native head21 and its hash were read independently; immutablev1 and the entire selected project/200Docs remained exact. Shared Lock removed every satellite. Both owned Electron roots closed; actual helper exit0. The300k screenshot was visually inspected.

The local event-to-frame metric meets the proposed100ms target for this narrow EOF case. The CDP acknowledgement does not: it includes the owned primary-to-satellite command bridge and native work, whereas the first metric begins only at trusted beforeinput delivery. These are different clocks/boundaries, so neither proves complete external-input latency. Opening meets5s for these cases. Memory is the sampled sum reported by app.getAppMetrics, including shared pages; it is not deduplicated physical RSS or a guaranteed peak. Samples34/58; peak private allocations651,708/923,172KiB. No claim of low-memory hardware suitability.

Original setup adverses retained unchanged:13-46-46.603Z failed before attachment with ENOENT because launchDesktop derived Electron under the observer root. Explicit actual runtime path corrected only the helper.13-52-19.980Z failed before Code open because the fixture clicked Home before its module control rendered; an actual control-ready condition corrected only the helper, at original deadlines. Final measurement13-53-51.943Z is separate from both adverse directories.

Observed product follow-through: screenshot shows the working Code header still labelsVersion1/initial bytes after Save advanced the actual source to21. Existing dataset/client identity is updated, but visible summary text is not. Add a genuine RED regression before correcting this misleading status.

Still open: representative complex syntax, beginning/middle input, paste/delete, undo/redo, replace, IME, long lines, CPU/I/O traces, cancellationp95, corruption/crash/disk-full/restart retention, low-memory hardware, and physical displays. Prior isolated CodeMirror results and original80k adverse profiler remain distinct. No full-plan checkbox, package/release admission or unrestricted capacity claim.
