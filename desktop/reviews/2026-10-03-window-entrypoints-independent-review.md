# Independent review: narrow Code/Docs shell entrypoints

Reviewer: `/root/terminal_contract`, 3 October 2026. Reviewed actual factory, satellite preload/entry script, role builder, narrow renderer/protocol/workspace-preload/package changes and entrypoint tests authored by the coordinator. This reviewer edited only this report and ignored `desktop/evidence/window-entrypoints-independent-review/` assertions/logs/generated fixtures. No product/main edit, package build, full-suite run, native experiment, commit or physical-monitor test occurred.

**No blocking finding in this reviewed shell boundary.** Own focused tests passed 12/12; separate independent assertions passed 11/11 groups. All nine reviewed file hashes stayed unchanged from the recorded start through independent assertion completion. This review covers data-free Code/Docs shells and their pure factory/resource/build/bridge logic; shared editors, Source 4/domain Task 2 transport and Presenter/Audience are not admitted by it.

## Actual review and checks

`nativeViewFactory` accepts only Code/Docs, a lowercase UUIDv4 window ID and the exact registry role URL. It constructs a nonmodal, unparented hidden window with sandbox/contextIsolation/webSecurity and no renderer Node integration. It uses current native workArea DIP input, including tiny/negative areas, without claiming physical display qualification. Popup, webview, foreign navigation and subframe navigation paths are denied. Loading must finish at the exact URL/main frame without a destroyed window before the factory returns. Registration/revalidation/show remain the main owner's responsibility; read-only integration context confirms main checks registered caller/epoch before ready notification and show.

Independent factory doubles additionally verify failed load, wrong final URL, already-destroyed load and creation-hook exception cannot return a window, and failed destruction (throw or no-op) yields `WINDOW_DESTROY_FAILED`. These are actual pure tests, not proof of Electron's native event/order/destruction behavior. Main must keep its existing failed-handle tracking and refuse new admission when destruction is unresolved.

The generated role HTML is independent of the full workspace renderer. Its inline script is syntax checked and SHA256-bound in CSP; default resources are denied, with no unsafe-inline scripts, external script assets, project bootstrap, source/workpaper/Code-file snapshots or local/session storage. Script content has no innerHTML/eval path; status uses textContent. The builder emits only Code and Docs, with deterministic role-file hashes in the build receipt. Role entry logic reads native grant metadata and close receipts; readiness serials reject stale completions. It supplies no editor/content transport or new workspace detach/shelf controls.

The satellite preload exposes just five enumerated window invoke methods and a ready callback/disposer. It exposes no desktop bootstrap, generic IPC, file/process/shell capability or source API. Independent VM checks confirm native ready-event/payload data are not forwarded to the renderer callback. The workspace preload adds the same enumerated invoke channel while retaining its pre-existing desktop bootstrap for the workspace only. Role permission/scope remains enforced by the independently reviewed narrow main-side IPC; merely exposing method names in a satellite does not grant workspace list/open permission.

For added role resources, the protocol requires an exact lowercase Code/Docs URL and sole UUIDv4 `windowId` query. Raw traversal is checked before path normalization; decoded traversal, duplicate/extra query, fragment, encoded role/query, wrong host/port/user-info, invalid UUID and Presenter/Audience/preload resource variants are rejected in separate assertions. Realpath containment/file checks remain present. The pre-existing app.html resource branch is unchanged; caller authority must still come from registry main-frame/native-object checks, not resource serving alone.

Package additions are exact positive source/role-file entries. Independent assertions reject extra roles, maps, tests, raw UI/build scripts, unknown native modules and notes JSON. This exercises the allowlist/candidate logic only; no shipped ASAR/portable artifact or end-user runtime was built by this reviewer.

## Evidence and identity

Own focused command from the portable root: `node --test desktop/tests/window-entrypoints.test.mjs desktop/tests/shell.test.mjs desktop/tests/package.test.mjs`. Result **12/12 pass, 0 fail/cancel/skip/todo**, exit 0, **129.4286 ms**; log `focused.log` SHA256 `e43840651a9270868be7f194691c6e780609fdd7e91f5ea2f6eb264f9544d394` (tool chunk `113e17`). This is a new focused invocation, separate from the coordinator-reported prior 12/12 run.

Own independent command from `desktop`: `node evidence/window-entrypoints-independent-review/assertions.mjs`, **Node v24.16.0**. It passed **11/11 groups**, exit 0, recorded interval `2026-10-02T23:27:06.601Z`–`2026-10-02T23:27:06.612Z` (tool chunk `ae9328`). Script SHA256 `4f6eca78015c98dbfb1bbc12e10308b81da219ec2833443fe1539f8d5a55748c`; `result.json` SHA256 `4b64c17a7ff2106c84eea19ffee9fa6b83fcc2f36445898a948952f31bb98d5c`. Start manifest `start.json` and result end hashes match:

| Reviewed file | SHA256 |
| --- | --- |
| `desktop/src/windows/factory.mjs` | `3cbdf1e52f0512a94af6148a6b531892fe6a439c3726ada46562c4e1d835437d` |
| `desktop/src/windows/preload.cjs` | `a9c8efbdd81c4a9c55964530211be2ca819beb439d3283f4634a9ab45f38871b` |
| `desktop/src/ui/windows/entry.js` | `db86d62cfa7319e5cc8242804d5bc80607485cf1726afd8ea97aa3386e144215` |
| `desktop/build/windows.mjs` | `c97851b46a41d1bf44068641b8d597d425daa19b9771a89848ff7f4dbb8a297e` |
| `desktop/build/renderer.mjs` | `a1e9579bf376c8d90f0dbed44fbfb325ca231c15ed910c26be40891c577a9fe2` |
| `desktop/src/protocol.mjs` | `2e9494bc36a63557fd921ed79d2284d6e6452a6f998ed5350e3f342c686538b3` |
| `desktop/src/preload.cjs` | `0d83b1152d1dfc17b6a37f621f18b40a10f4a8929dabdeea6a9da2c37d160d75` |
| `desktop/scripts/package.mjs` | `a9296b1ffa29dcd4366d8900833bd9a6a39665eaddb60da4d55ef76f2950adfd` |
| `desktop/tests/window-entrypoints.test.mjs` | `41a32b8348c7a91a6567bbf047c967f33919ba03ddf0ad9596550b10687e56b1` |

Own deterministic generated fixtures (not a native package): Code HTML SHA256 `bd4cd24dac119d2841b65daf9f6422b412aa17ef19d4c6900a5a14285e71f477`; Docs HTML SHA256 `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11`.

The coordinator reports retaining its original missing-generated-entrypoint RED and explicitly states factory tests followed factory implementation. This reviewer did not witness those authoring runs or inspect a bound original RED log, so they remain coordinator-reported provenance; this report does not turn postimplementation factory tests into TDD evidence. No independent assertions failed in the reviewed snapshot.

Actual Electron shell creation/readiness, native registry/show races, minimized/locked role destruction, portable ASAR resource/preload loading, physical mixed-DPI monitor events and full project/editor interactions still need the separately planned native qualification. No physical monitor, editable satellite, Source/domain transport or presentation claim follows from this review.
