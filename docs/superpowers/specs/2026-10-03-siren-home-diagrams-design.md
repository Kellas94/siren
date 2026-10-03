# SIREN Home, shared navigation and native Diagrams

Date: 3 October 2026. Author: /root. **Written design proposal for review.** The user requested a main entry surface, Continue work, project selection, Diagrams/Docs/Code/Present and diagrams on other monitors. This extends the approved source/native-window work; it does not mark those technical prerequisites complete or admit a new role already.

## Purpose and success

SIREN should make its four main work areas understandable at entry and preserve a recognisable place to return. Home replaces automatic entry into diagram editing after genuine unlock. A consistent project/navigation bar remains available while working; contextual controls stay in their module. The user can move a native Diagram workspace to another monitor without spawning another independent full-project editor.

Success means: application startup shows Intro → PIN → Home with no project-content flash; manual Lock uses its separate vault animation and returns through PIN → Home without replaying Intro; Continue reaches the verified previous project/entity; Home/module switches preserve private drafts; project switching, native detachment, Lock and Quit respect all-view persistence; old or missing resume references have safe understandable fallbacks. Themes, keyboard focus, reduced motion and explicit source-versus-Docs save semantics remain intact.

## Approved constraints and outstanding boundaries

Use the approved large-source and native-workspaces designs/plans, local PIN authority and pure/native source receipts. Desktop is the current target. AI remains hidden without configuration and last in development. Account activation remains deferred; no invented online status. Terminal stays unavailable until its process-family ownership is actually qualified.

No changes to frozen R78. Use desktop module/entry/build seams, exact protocol/preload/package allowlists and one native domain owner. A diagram satellite does not get all Docs, source text, private drafts, PIN data or a mirror of the legacy full workspace. Existing unresolved package/CI/physical-monitor results remain visible; no release or main merge.

## Selected information architecture

Recommend **Home plus a compact shared topbar**, following the existing SIREN theme. An expanded persistent sidebar consumes canvas/source width; palette-only navigation weakens discovery. Neither is the default here.

Home has one primary Continue work card, a short local-project list with Open/import and Create project, and four restrained entries: Diagrams, Docs, Code, Present. The Continue card identifies the project and actual working entity, plus genuine saved/private-draft/recovery state. Empty Home asks the user to choose/create a project; it never silently overwrites or creates one on startup. Recovery is prominent only when the native state requires it.

The shared topbar contains Home, project selector/name, current-module switcher, save state, Find, window shelf and Settings/Lock. The selected module owns its toolbar. Detailed styling, governance/provenance, analysis configuration, diagnostic export and update/download controls move to relevant disclosures/settings. Preserve actual capabilities and clear labels while removing duplicate routes only after the replacement works.

Docs and Code retain their useful empty-state actions. Presenter retains playback controls; authored settings are secondary. Guided/Mermaid, vector export and Code restore are retained. Returning Home does not replay Intro, stop Terminal, save to Docs or discard text. Minimized windows appear in one named shelf with source/document/diagram names.

## Lightweight startup and router

Introduce a small desktop workspace entry/router that can display PIN and metadata-only Home before loading a creative module. It must not eagerly initialize the complete legacy diagram renderer behind a Home overlay. The exact entry filenames are fixed in the implementation plan after examining bootstrap reuse, but the authority rule is fixed: native main recognizes a finite explicit set of workspace entry URLs and pins the actual current frame/URL in its grant.

Routing stays inside one permanently bound native workspace window. Entering a data module waits for genuine authorization and a ready selected-project context. Existing legacy diagram rendering is loaded only when chosen. Other modules consume source/document/domain adapters rather than full independently writable project copies. Native module navigation retires old frame authority and activates a fresh grant only after the actual new entry is ready.

Home bootstrap contains only native-selected mode, capability flags, bounded project summaries and validated UI locations. No source text, diagram source, full export bag, account token or credential appears in it. Locked PIN bootstrap has no real project names or thumbnails. Main derives data roots and selected-project IDs; the renderer supplies no filesystem paths or authority claims.

## Native Home and location contracts

Implement a separately validated navigation store, outside project content/recovery records:

```text
NavigationLocation = {
  schema: 1,
  projectId,
  surface: diagrams | docs | code | present,
  entityId?,
  sourceRef?: {sourceId, version, sha256},
  cursor?: {anchor, head},
  scroll?: {x, y},
  layouts?: bounded native view/layout references
}
```

Only own data fields and finite numeric budgets are accepted. Keep at most 64 project locations, 16 view/layout references per location and 12 recent-project summaries per Home response; the complete navigation file is capped at 64 KiB. Labels are bounded to 256 characters. Cursor offsets are nonnegative safe integers validated against the resolved source; scroll and geometry are finite and constrained by the current native bounds service. Reject unknown fields and over-budget records without truncating content or replacing a valid prior record. The native store derives project scope from registered authority, validates entity membership and copies the small record. It stores no content, executable commands, code paths or secrets. Updating navigation does not advance a project's content revision or create content checkpoints.

Home methods return bounded summaries and typed receipts: list Home state, select/open an owned project, resolve Continue, and record location. Each request validates actual sender/frame/role/epoch and native PIN/safety state before and after asynchronous work. Project picking/import uses existing explicit native selection. A location or returned opaque window ID is not a bearer grant.

Continue resolves references through the native project/domain owner. A missing entity or unavailable immutable source version falls back to project overview with a reason; it does not select a look-alike entity or reset the source to an arbitrary newer version. Read-only/recovery mode preserves its restrictions. Verified private drafts are offered through their actual recovery identity. Recreated windows receive fresh grants and current visible geometry; old frame/epoch identity is never resumed.

## Native Diagram view

Add a dedicated `diagram` view role through explicit native factory, registry, IPC/preload, protocol and package allowlists. Main authorizes only a diagram belonging to the selected project. An exact registered Diagram caller can request its own required diagram state and typed edits; it cannot consume Docs/source grants merely because IDs share a namespace.

The shared domain owner applies diagram intents against the exact diagram version and workspace revision. Different-entity edits merge at the owner; stale same-entity updates refuse and preserve local work. Satellites never retry stale full-envelope saves with a fresh revision. Diagram receipts and project/source receipts have separate declared scopes; UI cannot relabel one as the other.

The view presents Build/Mermaid/Guided and the preview, with contextual tools and theme support. Native Windows titlebar provides move/minimize/maximize/resize. Its internal editor/preview split is resizable. Attach-back waits for the correct receipt and preserves draft/entity identity. Shared window shelf and native menus restore it from any module. Keyboard actions operate on the focused view without duplicate native/renderer dispatch.

## Transition and recovery behavior

Returning Home or switching modules in the same project preserves verified private drafts and view identity. The existing coordinator supplies explicit pause/flush/drain behavior when frame ownership changes. Project selection, Lock, Quit/update and native close freeze admission, collect every dirty-view acknowledgement, drain native intents and only then revoke/retire affected views. A failed acknowledgement is visible; work is retained/exportable and no clean-close or successful transition is claimed.

Lock includes Diagram, Docs, Code, Presenter/Audience, minimized windows and Home project metadata. Terminal input is fenced before the first await while already-started commands continue, as separately specified. Wrong PIN never restores grants. Crash recovery opens a verified new project copy; UI locations cannot select damaged unverified data or erase the original.

Restore geometry uses current work areas/DIP and the approved bounds service. Missing monitors rehome reachable titlebars. Simulated geometry tests do not qualify physical mixed-DPI or multi-monitor behavior.

## Verification and delivery boundary

Tests must cover metadata-only locked/Home bootstrap, exact caller/role/frame/epoch checks, bounded malformed location refusal, Continue to each real module/entity, missing/version-conflicted/read-only/recovered states, unchanged content revision after navigation, private text retained across Home/module changes, and simultaneous different-entity writes without stale full-envelope overwrite.

Native probes cover Intro/PIN/Home sequencing without content flash, real keyboard/pointer/focus, 200% zoom and smaller desktop windows, light/dark/reduced motion, Diagram detach/attach/resize/maximize, Save-in-flight Home/Lock/Quit, crashed/unresponsive view and recovery. Exact source/diagram/doc hashes and untouched originals are independent oracles. A committed-source package needs new entry/module/notice identities plus unchanged existing package probes. Physical monitor limitations are reported explicitly.

Implement in focused batches: source editor qualification and domain owner → Home/location/router/common bar → coordinated native Diagram view → full transition/package/monitor qualification. No feature is labeled delivered merely because its card exists. The current audit and [navigation proposal](../../research/2026-10-03-siren-home-navigation.md) inform priorities; fresh evidence remains distinct from design recommendations.
