# SIREN v1.35.0 — brief for an independent review

You are reviewing **T-Industries SIREN**, a single-file HTML application.
File in this folder: `SIREN_v1.35.0_for_codex.html` (3,413,733 bytes).

**This copy is yours.** Another engineer is working on the live file in parallel, so do
not expect to hand back a merged HTML — hand back **findings and self-contained
patches** that can be applied to a moving target. Anything you deliver will be
reviewed and re-applied to the live file by the other engineer.

---

## 1. What the application is

A Mermaid diagram editor + a documentation layer ("Docs" / Workpapers) + a
presentation mode, in one offline HTML file. Its owner is an audit professional,
not a coder, who uses it to design and document agentic AI workflows (Microsoft
Copilot agents) and present them. It is being groomed for commercial release.

**Architecture facts you need before reading the code:**

- One `<script>` block, one IIFE, ~2.6 M characters of JavaScript. No build step,
  no modules, no dependencies except Mermaid (loaded from a CDN with a local
  fallback).
- **Strict CSP** in a `<meta>` tag: `default-src 'none'; script-src 'self'
  'unsafe-inline' + two CDNs; style-src 'unsafe-inline'; img-src data: blob:;
  connect-src 'self' blob: + the same CDNs; font-src data:`. **Do not weaken it.**
  Anything you add must work offline with no network.
- No `eval`, no `new Function`. Keep it that way.
- Persistence: the whole `state` object is JSON-serialised into IndexedDB
  (`t-industries-siren-db`, store `kv`) behind a `sirenStore` adapter, with a
  localStorage fallback and a synchronous in-memory mirror. Clean-exit flag stays
  in localStorage by design.
- 36 themes driven by CSS custom properties on `[data-theme="…"]`, plus a
  JavaScript palette table (`themePresets`) for the Mermaid renderer, plus an
  `AMBIENT_SCENES` table of canvas scenes.

**Running it:** open the HTML directly, or serve the folder over HTTP
(`python -m http.server 8899`) — some paths behave better over `http:` than
`file:` because of the CSP's `'self'`.

**Syntax check after any edit:** `python syncheck.py` (in this folder; it extracts
the inline script and runs `node --check`). It must print `node --check exit 0`.

---

## 2. What we want from you — three deliverables

### A. A complete bug and quality review

Read it as a senior engineer would read a codebase they are inheriting. We are
specifically interested in the classes of defect that survive a UI review because
they only appear in real use:

- **Correctness**: state mutations that skip sanitisation, async races, event
  handlers that leak, stale closures over `state`, sanitiser gaps on the import
  paths, off-by-one in the many index-based lists (route stops, sequence steps,
  diagram tabs, workpaper blocks).
- **Data loss**: anywhere user content can be silently dropped or truncated
  without a report. This is the owner's highest-value concern — the app documents
  AI agents whose exact prompts and knowledge must survive verbatim. There is a
  reporting mechanism (`WP_LIMITS`, `wpCut`, `wpCutList`, `finishWorkpaperImport`,
  `renderWorkpaperImportReport`) — find the paths that bypass it.
  *Known example to confirm and fix:* importing a document whose diagram links
  point at diagrams not present in the workspace drops those links silently
  (`sanitizeWorkpaperLink`). Reproduce with the fixture in this folder.
- **Persistence and migration**: what happens to a workspace saved by an older
  version, or a `.siren` project exported by one, or a hand-edited JSON.
- **Performance**: the file is 3.4 MB and some documents are 10,000+ px tall with
  250,000-character knowledge blocks. Look for O(n²) rendering, unthrottled
  observers, layout thrash, and anything that re-renders the whole block list on
  every keystroke.
- **Memory**: canvas scenes, `setInterval` engines, ResizeObservers, and the
  presentation overlay all have lifecycle; find what is never torn down.
- **Accessibility and keyboard**: focus traps, roving tabindex correctness,
  elements that are clickable but not focusable, `aria-*` that lies.
- **Dead code**: functions and ids that nothing reaches. (One known leftover:
  `wpNewType` is referenced defensively but no such element exists.)

**Two known defects worth confirming independently**, both reported as
pre-existing and app-wide:

1. **Present mode drops Mermaid arrowheads.** When two flow SVGs are in the DOM
   at once (editor preview + presentation stage), both carry markers with
   identical ids (`t_flow_…-pointEnd`), so `marker-end="url(#…)"` resolves to the
   wrong one and arrowheads vanish. Confirm, then fix by namespacing marker ids
   per rendered instance and rewriting the references.
2. **The presentation step badge** (a translucent ring with a numeral) can land on
   top of an edge label.

Report findings ranked by severity, each with a concrete failure scenario — inputs
or steps, and the wrong output. We would rather have ten confirmed findings than
fifty speculative ones. If you are unsure a finding is real, say so explicitly.

### B. A logo rework

The current brand mark is a small circular badge embedded as a base64 PNG in the
header (search for `class="brand-mark"`). It is a generic industrial roundel and
does not say anything about what this tool does.

**Design a replacement.** Constraints:

- **SVG, inline in the HTML.** No external file, no base64 raster — it must scale
  and it should be able to take colour from the theme (`fill="currentColor"` or a
  small number of `var(--…)` tokens), because the app has 36 themes ranging from
  paper-white to pure-black to neon.
- It sits at roughly **28–36 px** in the header next to the wordmark
  `T-INDUSTRIES | SIREN`, so it must survive being tiny. Test it at 24 px.
- The product is about **making a process legible**: diagrams, documented
  workflows, and presenting them. A siren is also a signal — a lighthouse, a
  beacon, a sweep of light. There is honest material there; use it or find better,
  but avoid the obvious clip-art (no literal emergency siren, no generic "AI"
  swirl, no gradient blob).
- Deliver **3 distinct directions**, each as a standalone SVG plus one sentence of
  rationale, rendered at 24/32/64 px on a light and a dark ground so we can see
  what survives. Then say which one you would ship and why.
- Also propose how the mark and the wordmark lock up together (spacing, optical
  alignment) — the current lockup is a fixed non-theming logo, gold house name,
  hairline rule, project name, quiet version string.

### C. Development work — build these

You are not only reviewing; you are building. The work below is chosen to be
**parallel-safe**: another engineer is actively rewriting **Present mode** (the
presentation overlay, the Map, the deck editor, the slide cards, presenter view).
**Do not touch anything under Present** — no `#presentOverlay`, `#mapLayer`,
`#mapBar`, `#presentBar`, `mapExportRoute`, `mapCardSlideSvg`, or the
`AMBIENT_SCENES` table. Everything below lives in Docs, the editor, exports, or
cross-cutting infrastructure.

Take them in the order given; each is self-contained, so ship them one at a time
rather than as one large patch.

**C1 — Find in document (Docs).** A large Agent Spec is 10,000+ px of continuous
document across 39 blocks. There is a register-level search box, but no way to
find a string *inside* the open document. Build one: a find bar scoped to the
document, hit count, next/previous, highlight-in-place that survives the
contenteditable blocks without corrupting their HTML (this is the hard part —
never write highlight markup into the stored content; decorate at render time or
use CSS Custom Highlight API with a fallback). Ctrl+F inside Docs should reach it
without stealing the browser's find when Docs is closed.

**C2 — Cross-references (Docs).** Let a block reference another block or another
document, rendered as a live chip that navigates on click and survives export as a
readable reference. Reuse the existing link model (`sanitizeWorkpaperLink` and the
link chips row) rather than inventing a second one. Handle the dangling case
honestly — a reference to a deleted block must degrade to visible text, never
vanish.

**C3 — Image evidence in documents (Docs).** Audit documentation needs
screenshots — a control screen, a system configuration, a signed-off report. Add
an image block: paste or file-picker, stored as a data URI, with a caption, and a
size guard with an honest report when a file is too large (the `WP_LIMITS` /
`wpCut` reporting mechanism is the pattern). It must survive JSON round-trip and
appear in the HTML, Word and PDF exports at a sensible size. Note the CSP allows
`img-src data: blob:` — no external images.

**C4 — Knowledge provenance (Docs, agent-spec only).** A Knowledge source row
records name, type, notes, role and content, but not *where it came from* or
*when it was last confirmed current*. Add optional `sourceOrigin` (free text — a
path, a system, a URL as text) and `confirmedAt` (ISO UTC date) per row, shown
quietly, round-tripping through every export. Optional, default empty, never
auto-invented. Backward compatible with rows that have neither.

**C5 — PPTX export.** The app exports PDF, HTML, Word, Excel, Markdown and JSON.
It cannot produce a PowerPoint, which is what an audit team actually circulates.
Build a `.pptx` writer for **documents** (not the presentation deck — that is the
other engineer's surface): one slide per top-level heading, its content as bullets
and tables, diagrams as images. PPTX is a ZIP of OOXML; the app already builds
ZIPs for the multi-document Word export, so reuse that machinery. Keep it honest:
if a block kind cannot be represented well, render it as readable text rather than
dropping it, and say so in the export summary.

**C6 — Performance pass.** The file is 3.4 MB and a real document is 250,000
characters. Profile the genuinely slow paths — opening a large document, typing in
a block near the end of one, switching diagrams with 25 open, and the initial
boot — and fix what you find with measurements before and after. Report numbers,
not impressions.

**C7 — Dead code and unreachable state.** Produce an inventory of functions, ids
and CSS rules nothing reaches, with the evidence for each, then remove the ones
you are confident about. Be conservative: this codebase has features reachable
only by keyboard or only in one theme, and "I could not find a caller" is not the
same as "there is none". Flag the uncertain ones instead of deleting them.

If you find something else worth building, propose it before building it. Keep
proposals proportional — the owner has explicitly rejected turning this into a
governance platform (no compliance engines, no usage tracking, no tiers). Prefer
extending what exists to adding parallel systems.

---

## 3. House rules — these are not negotiable

1. **Patch with anchor-guarded scripts, never by hand.** The pattern used
   throughout this project is a Python script that asserts the anchor's
   occurrence count before replacing, writes to a temp file, and `os.replace`s it
   in atomically:
   ```python
   assert s.count(anchor) == 1, 'anchor moved'
   s = s.replace(anchor, replacement)
   ```
   Never anchor on a line number — the file moves constantly.
2. **A harness is not the application.** If you build a standalone test page to
   try something, that proves nothing about the app. Verify inside a copy of the
   real file, driven through its own UI.
3. **If you claim something looks right, you must have looked at it.** Render it,
   screenshot it, and inspect the screenshot. This project has been burned by
   confident visual claims about code that never painted.
4. **Frame 1 must already be the finished picture** for anything drawn on the
   ambient canvas. The scene engine is a `setInterval` guarded by
   `if (!document.hidden)`, so in a background tab only the first frame ever
   paints. A scene that builds up over N frames renders as a blank.
5. **Measure, don't assert.** Contrast claims are WCAG ratios computed from
   composited colours, not eyeballed. Legibility claims about the ambient canvas
   are `getImageData` samples of the centre third.
6. **Match the surrounding code.** Same comment density, same naming, same idiom.
   Reuse the app's own primitives: `openStructureMenu`, `showToast`,
   `requestConfirmation`, `showDialog`, the `.btn` classes, the theme tokens.

---

## 4. Design direction (so your proposals land)

The owner's standing direction is **Apple's UI philosophy**: intuitive,
uncluttered, progressive disclosure. Specifically:

- One obvious primary action per context; collapsed groups over button piles.
- Short labels with full names in tooltips.
- Filled accent surfaces carry ink that clears 4.5:1, and hover goes **darker**
  than the resting fill, never lighter.
- An Agent Spec document stays **a continuous document with governance as quiet
  orientation** — never a dashboard, never split into tabs.
- Docs stays **generic**: Narrative, Control and Note documents must show zero
  agent-specific UI. Agent surfaces appear only for `type === 'agent-spec'`.
- Internals stay **product-neutral** (Owner, Reviewer, Organisation, Agent,
  Platform, Release) — no client-specific or jurisdiction-specific terminology in
  generic components.

---

## 5. What is in this folder

| File | What it is |
|---|---|
| `SIREN_v1.35.0_for_codex.html` | The application. Your copy. |
| `WP-001_Agent_specification_-_TB_Result_Monthly_Audit_v3_4.json` | A real exported Agent Spec, 311,895 bytes — the stress-test fixture. Import it through Docs → Import. It should produce 39 blocks and ~254,000 characters of knowledge with **zero** trim lines. It is a documentation fixture: never modify the agent it describes, never invent content for it. |
| `kpmg_mark.svg` | An example of the inline-SVG-with-`currentColor` pattern we want the new logo to follow. |
| `syncheck.py` | `python syncheck.py` — extracts the inline script and runs `node --check`. |

---

## 6. Division of labour — read this before you touch anything

Another engineer is working the live file at the same time as you. To keep the two
streams mergeable:

**Yours:** Docs and the workpaper model, the editor pane, all export paths except
the presentation deck, persistence and migration, performance, dead code, the
brand mark, and the review itself.

**Not yours — do not edit:** anything under Present. Concretely, leave alone
`#presentOverlay`, `#presentBar`, `#mapLayer`, `#mapBar`, `#mapRoute`, the
`mapXxx` function family, `mapExportRoute` / `mapViewSlideSvg` / `mapCardSlideSvg`,
the card editor, presenter/audience windows, and the `AMBIENT_SCENES` table.
If a bug you find lives there, **report it, do not fix it** — say exactly what you
observed and hand it over.

**Shared primitives** (`openStructureMenu`, `showToast`, `requestConfirmation`,
`showDialog`, `sirenStore`, the theme tokens, `svgToCanvas`, `buildRasterPdf`) may
be *used* freely but should be *changed* only if you say so loudly in the handback,
because a change there lands in both streams.

Because the live file moves under you, deliver **patches, not a merged HTML**, and
anchor every replacement on a string long enough to survive edits elsewhere in the
same function.

---

## 7. How to hand back

For each finding: severity, the file location by **searchable string** (not line
number), a concrete failure scenario, and the fix. For each patch: a standalone
anchor-guarded script plus a one-line statement of what you verified and how.
For the logo: the SVGs plus the rendered comparison images.

Order the handback so the highest-confidence, highest-value items come first — the
work is going to be re-verified before it lands, and the first things read set the
priority.

Be direct about what you did not check. An honest gap is more useful than a
confident guess.
