# SIREN

A visual workspace for diagrams, documentation, code exploration and presentations.

SIREN is evolving from an offline HTML application into a Windows desktop application.
This repository keeps the implementation, build scripts and retained verification records.

## Start here

| I want to… | Open |
|---|---|
| Follow desktop development | [Desktop workspaces — draft PR #2](https://github.com/Kellas94/siren/pull/2) |
| Inspect the desktop implementation | [Desktop source](https://github.com/Kellas94/siren/tree/feature/portable-foundation-2026-10-02/desktop) |
| Run the development checkout | [Desktop setup and launcher](https://github.com/Kellas94/siren/blob/feature/portable-foundation-2026-10-02/desktop/README.md) |
| See implemented behavior and remaining work | [Implementation status](https://github.com/Kellas94/siren/blob/feature/portable-foundation-2026-10-02/desktop/IMPLEMENTATION-STATUS.md) |
| Inspect dependencies and versions | [Dependency inventory](https://github.com/Kellas94/siren/blob/feature/portable-foundation-2026-10-02/desktop/reviews/2026-10-02-dependency-inventory.json) |
| Understand the earlier HTML releases | [Release history](RESUME_HERE.md) · [Tracked snapshots](releases/) |

## Desktop development

The desktop branch develops Home and project navigation, native Code/Docs/Diagram/Present
windows, local PIN locking, project recovery and incremental editing of larger Python sources.
Individual capabilities and qualification limits are recorded in the implementation status
and retained reports; this is an in-progress development build.

The desktop implementation is in `feature/portable-foundation-2026-10-02` and draft PR #2.
`main` retains the earlier HTML development history. A desktop production release, online
activation and a signed automatic update feed are not announced here.

## Repository map

| Area | Purpose |
|---|---|
| [Desktop branch](https://github.com/Kellas94/siren/tree/feature/portable-foundation-2026-10-02) | Current desktop implementation, plans, tests and review records |
| [tools/](tools/) | Earlier HTML patch and build scripts |
| [qa_exports/](qa_exports/) | Earlier browser verification harnesses |
| [codex/](codex/) | Historical briefs, handbacks and patch chains |
| [audit/](audit/) · [antigravity/](antigravity/) | Earlier reviews, plans and investigation records |
| [releases/](releases/) | Tracked earlier HTML application snapshots |
| [AGENT_CONVENTIONS.md](AGENT_CONVENTIONS.md) | Historical conventions for the HTML patch workflow |
| [Original README](docs/history/README-before-desktop-navigation.md) | Preserved earlier repository introduction |

## Verification

Changes are checked against their exact source or package inputs. Reports identify whether
evidence came from local tests, actual native application probes, hosted CI or an independent
review. A later passing run does not rewrite an earlier failure or its authorship.

For desktop checks and known limitations, use the branch's implementation status and review
records. Workflow results are available in [Actions](https://github.com/Kellas94/siren/actions).

## License notices

Existing license and dependency notices are retained, including [mpl.txt](mpl.txt) and the
desktop branch's [dependency notices](https://github.com/Kellas94/siren/tree/feature/portable-foundation-2026-10-02/desktop/licenses).
