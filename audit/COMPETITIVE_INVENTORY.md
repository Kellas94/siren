# SIREN — where it stands, and what to build next

**Written 21 August 2026.** Subject: `C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html` — **3,971,254 bytes, `APP_VERSION = '1.44.4'`**.

Every claim carries a tag. Do not let the tags blur:

| Tag | Means |
|---|---|
| **[I DROVE IT]** | I ran it in this session and read the result. Served byte-exact copy on port 12437 (`Content-Length: 3971254` = disk). Screenshots in `scratchpad/verify/out/`. |
| **[SOURCE]** | I read SIREN's own code and quote the line. |
| **[AGENT]** | A parallel agent drove it; their evidence files are on disk; I checked their arithmetic but did not re-run the build. |
| **[READ]** | A vendor's published page. Nobody tested it. Could be marketing. |

---

## What I threw out before writing this

Three agents worked in parallel and handed me benchmarks. **I dropped or corrected ten claims.** They matter, because several were about to become sales copy.

| # | The claim | What is actually true |
|---|---|---|
| 1 | "v1.44.2, 3,960,930 bytes" / "v1.44.3, 3,971,101 bytes" | **v1.44.4, 3,971,254 bytes.** [I DROVE IT — version read off the screen] Both benchmark suites measured older builds. Their action counts are still directionally right; their exact numbers are not current. |
| 2 | "It runs offline from one file." | **Materially wrong, and this is the biggest correction in the document.** Mermaid is *not* inside the file. It is fetched from `cdn.jsdelivr.net`, falling back to `unpkg.com` [SOURCE, line 17052]. See the section below — the real story is better than it sounds, but it is not what you have been told. |
| 3 | "36 themes" | **37.** [SOURCE — 37 `data-theme` blocks, 37 options in the theme picker] |
| 4 | "Collapsible sections have no `aria-expanded` — a screen reader can't announce them" | **False in 1.44.4. All 6 section headers carry `aria-expanded`.** [I DROVE IT] They are still `<div>`, not `<button>`, which is a smaller, real problem. Drop the accessibility scare. |
| 5 | "8 section headers, 45 form controls, 10 visible at rest" | **6 headers, 64 controls, 29 visible.** [I DROVE IT] Different build, different panel. Do not quote the old figures. |
| 6 | "ELK layout engine — a real knob backing the auto-layout story" | ELK is a **CDN download**. SIREN's own hint says so: *"ELK downloads once and needs internet the first time."* [SOURCE]. It is not an offline capability. |
| 7 | "Paginated PDF export" | True, and SIREN writes real PDF bytes itself. But **diagram pages are raster images tiled across sheets** — `/ProcSet [/PDF /ImageC]`, `/XObject /Im0` [SOURCE, line 72101]. Text pages in the report/workpaper PDF *are* real text — real `Tj` runs in base-14 fonts [SOURCE, lines 26715–26726]. Consequence in §1.4. |
| 8 | "Word export" | It emits **`.doc`** — `application/msword`, an HTML document with a Word extension [SOURCE, `exportDocsWord`, line 70577]. Not OOXML `.docx`. |
| 9 | "14 node shapes" | **12.** [SOURCE — 12 `data-shape` buttons, 12 shape options in the inspector] |
| 10 | "The visual builder switches off when the parser refuses" (implying the canvas dies too) | Only `addVisualNodeButton` goes disabled. `connectModeButton` stays **enabled** and fails later with a toast [I DROVE IT]. Small, but it means the guard is inconsistent. |

I also dropped **every wall-clock second** any agent reported. All of it was machine-paced with the agents' own sleep timers. The only real timing figure anyone measured is SIREN's 602 ms preview debounce. Action counts transfer between tools; seconds do not.

---

# PART ONE — WHERE SIREN STANDS

## 1. The bad news, first

### 1.1 The offline story is not the one you have been telling

I blocked every external host and loaded SIREN [I DROVE IT — `verify/steps_off.json`, Chrome with `MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`]:

```
{"renderer":"Basic offline renderer active","hasMermaid":false}
```

- A **flowchart renders fine.** The full benchmark — 11 blocks, decision diamonds, Yes/No labels, a Finance subgraph — drew correctly with SIREN's own built-in renderer. Screenshot: `verify/out/o01_flowchart_offline.png`. I looked at it. It is good.
- A **sequence diagram does not render at all**: *"Sequence diagram requires the Full Mermaid renderer. Connect to the internet or place mermaid.min.js next to this HTML file."* Same for gantt, class, ER, C4, mindmap, timeline, kanban, journey, git graph, XY, pie — everything in your diagram-type list except flowchart. [I DROVE IT — `o02_sequence_offline.png`]

So the accurate sentence is: **"One file. Flowcharts work anywhere with no internet and no install. Everything else needs either the internet once, or a copy of `mermaid.min.js` beside the file."** That is still a strong claim. But the version you have been repeating — "everything, offline, one file" — will not survive a demo in a locked-down client network, and a KPMG network is exactly where it will be tested. If you want the full claim to be true, inlining mermaid is a packaging decision, not a code rewrite.

### 1.2 A free tool beats yours in several places, and here is the list

**This is the paragraph you asked for.** draw.io is free forever, needs no sign-up, is open source, and has a desktop app [READ — drawio.com, 21 Aug 2026, verbatim: *"Free forever • No sign-up required • Open source"*]. It beats SIREN at:

1. **Free positioning.** You know this one. A draw.io box goes where the user puts it. SIREN has no node-positioning layer at all — `nodePosition`, `nodeXY`, `userPositions`, `savedPositions`, `dragNode`, `manualLayout`, `freeform`: **zero hits each** [SOURCE]. Dragging a node does nothing.
2. **Node creation speed.** draw.io's hover-arrow → shape-picker creates a node, an edge and a label in **2 clicks + typing** [AGENT, measured]. SIREN's form needs ~5 mouse actions for a connector alone.
3. **Inserting a step into an existing flow.** Drag a node onto an edge in draw.io and it splices: `A→B` becomes `A→C→B`, **one drag** [AGENT, measured]. In SIREN that is roughly 15 actions. For audit process flows — *"we forgot the review step"* — this is the most common edit there is.
4. **Shape library.** draw.io ships thousands. SIREN ships **12** [SOURCE]. You will not close this and mostly should not try.
5. **It already speaks Mermaid.** I opened draw.io myself: version **31.3.1**, Insert menu contains **"Mermaid…"** [I DROVE IT — dumped the live menu: `Rectangle, Ellipse, Rhombus, Line, Note, Text, Link…, Image…, Shape…, Polygon…, Template…, **Mermaid…**, Freehand, Generate, Layout, Advanced`]. Paste Mermaid, get real editable shapes, keep the source, re-open it from a pencil icon, re-apply and it re-lays-out [AGENT, measured — 4 actions, no cleanup]. Excalidraw does the same in 3 clicks [AGENT, measured].

And the rest of the field beats SIREN at:

6. **Real-time co-editing.** SIREN has none. Zero WebSocket code, zero collaboration code [SOURCE]. draw.io (via Drive/OneDrive), Lucidchart, Whimsical and Excalidraw all do multi-user editing on free or near-free tiers. For an auditor working alone this is irrelevant. The day you sell to a department it becomes objection number one.
7. **A shareable link.** SIREN's "Copy share link" base64s the entire diagram into the URL fragment and prefixes it with **the file's own location** [SOURCE, `buildShareLink`, line 70862]. Send it to a colleague and it only opens if they already have the same file at the same path. It is a bookmark, not a share.
8. **Vector text in exported PDF.** A reviewer cannot Ctrl+F a control name in a SIREN diagram PDF, because the diagram page is a picture. draw.io and Lucidchart export vector PDF. In an audit file that is a genuine loss.
9. **Visio.** Lucidchart Individual at $9/month does Visio import *and* export [READ, 21 Aug 2026]. SIREN does neither — no `.vsdx` anywhere [SOURCE]. Large clients live in Visio.
10. **Trust furniture.** SSO, admin console, enforceable sharing restrictions, SOC-style assurance, an update channel. Lucidchart Enterprise sells precisely this. A 4 MB HTML file emailed around has none of it, and procurement will ask.

### 1.3 The visual builder switches itself off on ordinary input

Worse than a missing feature. I verified both cases live [I DROVE IT]:

| Pasted source | Result |
|---|---|
| `A[Start] --> B[Review] --> C[Approve]` | **Builder disabled.** *"Advanced Mermaid mode: Connector chains such as A --> B --> C are edited in code or Guided mode (line 2)."* |
| `style A fill:#f00` | **Builder disabled.** *"Advanced styling or interactions require code mode (line 3)."* |

A parallel agent tested nine realistic variants and **seven were refused** [AGENT]: chains, `classDef`/`class`, `style`, `direction` inside a subgraph, nested subgraphs, `%%{init}%%`, and `click`. I re-measured two of the seven and both reproduced exactly.

Your buyer pastes a flowchart from ChatGPT. Your headline mode goes dark and tells them to use code mode. That is the demo failing in the first minute.

### 1.4 Two output defects that a buyer will notice

- **Word output is `.doc`, not `.docx`.** Modern Word opens it with a format warning in hardened configurations, and it will not round-trip styles. Fixing it means writing OOXML — you already write PPTX and XLSX OOXML by hand, so the machinery exists.
- **PDF diagram pages are images.** Fine for a slide. Not fine for a workpaper that gets searched, and not fine if a client's document-management system indexes text.

---

## 2. The matrix

Rows chosen because a buyer asks about them. Not to fill a grid.

| | **SIREN 1.44.4** | **draw.io** | **Mermaid Live** | **Mermaid Chart** | **Lucidchart** |
|---|---|---|---|---|---|
| **Price for real use** | your call | **$0, forever** [READ] | **$0** [AGENT] | $10/user/mo Plus, billed annually [READ] | $9/mo Individual, $10/user/mo Team, billed annually [READ] |
| **Account needed** | no | **no** [I DROVE IT] | no [AGENT] | yes | yes |
| **Drag a box where you want it** | **no** [SOURCE] | yes | no | yes (visual editor) [READ] | yes |
| **Tidy-up after a structurally correct diagram** | **0 actions** [AGENT] | ≈16, and still not clean [AGENT] | 0 (impossible) [AGENT] | unknown | user's problem |
| **Accepts pasted Mermaid** | it *is* Mermaid | **yes, Insert ▸ Mermaid…** [I DROVE IT] | yes | yes | no |
| **Emits Mermaid text** | **yes** (`.mmd`) [SOURCE] | **no** [AGENT — export menu dump] | yes | yes | no |
| **Imports draw.io files** | **yes** — `.drawio`/`.xml`, converted to Mermaid, uncompressed only [SOURCE] | native | no | no | via Visio path only |
| **PowerPoint with editable shapes** | **yes** — real `p:sp` + `p:cxnSp`, picture only as fallback [SOURCE, line 72760] | **no PPTX at all** [AGENT] | **no** [AGENT] | AppSource add-in, mechanism unverified [READ] | add-in, mechanism unverified [READ] |
| **Excel with editable shapes** | **yes** — `xdr:cxnSp`, `prstGeom` [SOURCE, line 72605] | no | no | no | no |
| **Multi-page PDF** | **yes**, own PDF writer, tiled [SOURCE] | yes | **no PDF on free** [AGENT] | yes | yes |
| **Searchable text in exported PDF** | **no — diagram pages are raster** | yes | n/a | yes | yes |
| **Documents attached to the diagram** | **yes** — full editor: headings, tables, checklists, test runs, links to nodes, releases [SOURCE] | no | no | no | no |
| **Review submit / approve / reject / reopen + trail** | **yes** [SOURCE — `reviewSubmitButton`, `reviewApproveButton`, `reviewRejectButton`, `reviewReopenButton`, `reviewTrailList`] | no | no | no | "Customizable document status" — **Enterprise only** [READ] |
| **Comments** | yes | yes (needs a cloud backend) | no | yes | **yes, on Free** [READ] |
| **Present the diagram itself** | **yes** — camera flights, stops, chapters, checkpoints, branching decision stops, speaker notes, presenter view, annotation, spotlight, autoplay [SOURCE — 90+ `present*` controls] | **no. View menu has "Fullscreen" and nothing else** [I DROVE IT — live menu dump] | no | Markdown slide deck with diagrams embedded [READ] | **"Presentation mode" on Free** [READ] |
| **Version history / restore** | yes, restore points [I DROVE IT — visible in UI] | local only | no | yes | Team tier |
| **Real-time co-editing** | **no** [SOURCE] | yes | no | yes | yes |
| **Hosted share link** | **no** — link is the file path + payload [SOURCE] | yes | yes | yes | yes |
| **Works with no internet** | **flowcharts yes; every other diagram type no** [I DROVE IT] | desktop app; web app caches [READ/AGENT] | PWA [AGENT] | no | no |
| **Shape count** | **12** [SOURCE] | thousands | n/a | dozens | thousands |
| **Visio import/export** | no | partial | no | no | **yes, $9/mo** [READ] |
| **SSO / admin** | no | n/a | no | Premium [READ] | Enterprise [READ] |

---

## 3. Where SIREN is genuinely alone

I applied the strict test you asked for: **alone means no rival does it at all**, not "SIREN does it differently". That test kills most of the list. Four survive.

1. **A workpaper bound to the diagram, with test runs, sign-off and a review trail.** None of the four has a document editor attached to a diagram. Lucidchart Enterprise gets closest with a *status label* on a document — that is the status half, not the document half, and it is behind "contact sales". [SOURCE for SIREN; READ for Lucid]
2. **Excel export containing real, editable shapes.** SIREN writes `xdr:cxnSp` connectors and `prstGeom` shapes into a worksheet drawing. Nobody else exports to Excel at all. [SOURCE]
3. **An audit pack out of one file** — the diagram *plus its documents* as PPTX, XLSX, multi-page PDF, CSV and a portable project ZIP, with scope selection over both diagrams and docs. Every rival exports a picture of a diagram. None exports a document set. [SOURCE — `exportDocsPdfButton`, `exportDocsPptxButton`, `exportDocsXlsxButton`, `exportWorkpapersButton`, `exportTrailButton`]
4. **Being a file rather than a service.** No server, no account, no installer, no tenancy. The customer holds the artifact and can drop it on a controlled share. draw.io's desktop app is the nearest thing and it is still an installed application with its own format. This is a *procurement* feature, not a diagramming feature, and in your market it may be worth more than the diagramming.

**What did not survive the test, and why:**

- *Presentation mode* — Lucidchart Free lists "Presentation mode" verbatim; Mermaid Chart ships a presentation builder. You are alone on **guided camera flights through one diagram with branching decision stops**, which is genuinely unusual, but "we can present" is not a differentiator.
- *Audit metadata per node* — draw.io has Edit Data (arbitrary key/value); Lucidchart has data linking. You ship an opinionated audit schema on top of a mechanism both rivals already have.
- *Mermaid support* — see below.
- *Offline* — Excalidraw and mermaid.live are installable PWAs; draw.io has a desktop app.
- *Themes* — 37 is a lot. Nobody buys on themes.

---

## 4. What the free tools give away, and what you therefore cannot charge for

| You cannot charge for | Because |
|---|---|
| "Make a diagram" | draw.io: free forever, no sign-up, open source, unlimited [READ, verbatim] |
| "We understand Mermaid" | draw.io **Insert ▸ Mermaid…**, 4 actions to a full editable diagram [I DROVE IT + AGENT]; Excalidraw, 3 clicks [AGENT] |
| "We round-trip Mermaid" | draw.io stores `mermaidData` on the wrapper and reopens the source from a pencil icon; edit, Apply, it re-lays-out [AGENT, measured] |
| "You can present it" | Lucidchart Free: "Presentation mode" [READ, verbatim] |
| "You can comment" | Lucidchart Free: "Commenting" [READ, verbatim] |
| "It works offline" | Excalidraw and mermaid.live register service workers; draw.io has a desktop app [AGENT / READ] |
| "Version history" | Whimsical Free: "7-day version history" [READ, verbatim] |
| "PNG and SVG export" | free everywhere |
| "Auto-layout, so you never tidy" | mermaid.live does the same for $0 — the difference is that SIREN lets you *do something with the result* |

**What is left to charge for is narrow and real:** the workpaper + review + sign-off chain, editable Office output, the draw.io import path, and the file-not-a-service posture. Notice that Lucidchart puts document status behind *Enterprise / contact sales*. You are selling an enterprise-tier capability from a file. That is your pricing argument — not features-per-dollar against draw.io, which you lose on every row that a generalist buyer counts.

---

## 5. Pricing as published

All read **21 August 2026**. Quotes verbatim. Page dumps in `scratchpad/rivals/*.txt`.

**draw.io / diagrams.net** — [READ, drawio.com] *"Free forever • No sign-up required • Open source."* No paid tier on the product itself. Desktop app available. (Atlassian marketplace plugins are separately priced; not checked.)

**Mermaid Live (mermaid.live)** — free, no account. Export: PNG, SVG, Kroki, Copy Image, Copy Markdown [AGENT, measured from the live menu]. **No PDF, no PPTX.** Its "Edit visually" button is not a feature — it is an outbound link to the paid product carrying your diagram in the URL, `utm_medium=visual_edit` [AGENT, intercepted]. There is no visual editor in mermaid.live.

**Mermaid Chart** — **`mermaidchart.com/pricing` now 301-redirects to `mermaid.ai/pricing`. The product has rebranded.** [I DROVE IT — I fetched it and got the 301 myself.]

| Plan | Price, verbatim | Includes |
|---|---|---|
| Basic | **Free** | "3 Diagrams" in the headline, **"Up to 6"** in their own comparison table — *their page contradicts itself*; "Limited diagram size" (60); "Limited AI" (15 credits) |
| Plus | **"$10 per user / month — BILLED ANNUALLY"** | Unlimited diagrams, "Limitless diagram size", 300 AI credits/year |
| Premium | **"$20 per user / month — BILLED ANNUALLY"** | 2,000 AI credits/year, "Unlimited free viewer seats", SSO |
| Enterprise | "Custom — BILLED ANNUALLY" | "Secure diagram ownership management (IP transfer to admin)", dedicated CSM |

Their own footer compares them against **Whimsical, Draw.io and PlantUML**. That is the competitive set they believe they are in — note that it does not include Lucidchart, and it does not include anything with a review workflow.

**Lucidchart** — `lucidchart.com/pages/pricing` → `lucid.co/lucidchart/pricing` → `lucid.app/pricing/lucidchart` [I DROVE IT — two hops, both 301].

| Plan | Price, verbatim | Free tier includes, verbatim |
|---|---|---|
| Free | **"$0 USD"**, "No credit card required" | "3 editable Lucidchart documents", "75 shapes per Lucidchart document", "100 templates", "Basic data linking", **"Presentation mode"**, **"Commenting"**, "Lucid AI" |
| Individual | **"$9 USD per month when billed annually"** | Unlimited documents/objects, 1 GB storage, **Visio import and export** |
| Team | **"$10 USD / user per month when billed annually"** | "Revision history with versioning", password-protected publishing, M365/Confluence/Jira |
| Enterprise | "Contact sales" | **"Customizable document status"**, SAML, enforceable sharing restrictions, Process Capture |

The Free tier's real constraint is **3 documents and 75 shapes**. That is the crack SIREN fits through: an auditor with thirty process flows cannot use Lucidchart free, and at $10/user/month a twenty-person audit team is $2,400/year.

---

# PART TWO — THE VISUAL BUILDER

## The one change to make first

### Stop refusing connector chains. Half a day. Near-zero risk.

**Why this and nothing else:** every other improvement on this list is worthless while the builder switches itself off. A pasted `A --> B --> C` — the shortest, most natural way anyone writes a flow, and what every LLM emits — disables the entire visual mode. I watched it happen [I DROVE IT].

**Why it is half a day:** the fix uses a value the code is already holding.

```js
// line 73643, inside parseVisualFlowchartSource (which begins at line 73579)
const visualChain = parseStructureChain(normaliseInlineEdgeLabel(line).trim());
if (visualChain && visualChain.steps.length > 1) {
  return incompatible(statement, 'Connector chains such as A --> B --> C are edited in code or Guided mode');
}
```

`parseStructureChain` (line 22190) already returns `{ nodes[], steps[] }` — the fully decomposed chain. The parser asks for it, confirms there is more than one step, and **throws it away**. Walk `nodes` and `steps` into the same `upsertNode` / `edges.push` calls the single-edge branch below already uses, and chains parse. The serialiser writes them back out as one edge per line, which is correct Mermaid and renders identically.

**Cost: half a day, one function, one code path.** Nothing else on this list changes as much per hour spent.

Two caveats, stated so you can hold the developer to them: the round-trip is *lossy in formatting* — a user's three-line chain comes back as three separate edge lines. That is already true of everything else the builder touches (`serializeVisualFlowchart` re-emits the whole file canonically; after one connect-mode click, `EXC[Exception queue]` became bare `EXC` [AGENT, measured]). Warn once, on first use, and move on.

---

## The ranked plan

| # | What | Days | Why here |
|---|---|---|---|
| **1** | **Expand connector chains in the parser** | **0.5** | Prerequisite for everything. Turns the builder on for the most common real input. |
| **2** | Accept `style` / `classDef` / `class` by carrying them through untouched | 1–2 | Second-largest refusal class. They do not affect topology; the builder should ignore them, not surrender to them. Keep refusing nested subgraphs and `%%{init}%%` — those genuinely restructure. |
| **3** | **Fix the rename dialog bug — ship it today** | **0.02** | Double-click a *block* and you get a modal titled **"Rename diagram"** with the field label **"Diagram name"**. Confirmed live, screenshot `verify/out/v01_rename.png`: value `PO raised`, title `Rename diagram`. `handlePreviewNodeDoubleClick` (line 28358) calls `requestRename(label, cb)` with no third argument, so it falls through to the diagram defaults in `requestRename` at line 20410. Pass `{title:'Rename block', label:'Block label'}`. Ten minutes. |
| **4** | **Hover-arrow → picker → connected successor**, on the preview | 4–6 | draw.io's single best interaction and it is **100% topology** — the placement is the tool's, never the user's, which is exactly what auto-layout gives you free. 2 clicks + typing produces node + edge + label. The plumbing exists: `resolveNodeIdFromElement` (line 28301) already maps a click to a model node with three fallback strategies, and `handleConnectModeClick` (line 28410) is a twelve-line proof that a canvas gesture is `parse → mutate → apply`. |
| **5** | **Drop a node onto an edge → splice** (`A→B` becomes `A→C→B`) | 2–3 | One drag in draw.io. ~15 actions in SIREN. It is *the* audit edit: "we forgot the review step." Pure topology, trivially expressible in Mermaid. |
| **6** | **Make connect mode the default way to draw connectors** | 2–3 | Connectors are **68%** of a visual build [AGENT], and 48 of those clicks are nothing but operating two `<select>`s — I confirmed `visualEdgeFrom` and `visualEdgeTo` are plain selects carrying 11 options each on the benchmark [I DROVE IT]. Connect mode already does the same job in 2 clicks and stays on so you can chain. Surface it, don't hide it behind a toggle. Also: it is currently *enabled* on sources the builder has refused, and fails with a toast — gate it properly. |
| **7** | Cheap panel fixes, taken together | 1 | Return focus to the label field after a shape swatch is clicked (7 wasted clicks per build [AGENT]); open the Edit section when a block is selected instead of making the user click twice; grow `visualGroupMembers` from `size="4"` — it is a 4-row porthole onto 11 options [I DROVE IT]; make section headers `<button>` (the `aria-expanded` is already there). |
| **8** | Reframe the marketing around **rank order, not position** | 0 dev days | The single most-requested "let me drag this" is *"put that box on the other side."* That is edge **order**, not coordinates: swapping two source lines swaps the two boxes on screen [AGENT, measured — Director x=928/Manager x=1167 became Manager x=931/Director x=1170]. Ship it as "Move left / Move right" and you satisfy the request without positions. Honest limit: order controls sideways placement only. Rank is graph distance; you cannot drag a box up a level, ever. |

**Do not build:** align, distribute, bring-to-front, resize-to-fit, clear-waypoints. Those exist in draw.io only to repair damage draw.io allows. Dagre never overlaps and Mermaid sizes shapes to their labels — the other agent had to autosize both decision diamonds *twice* and they still overflowed, then a manual corner-drag broke the incoming edge angle [AGENT, measured]. **Their tidy-up bill on the identical diagram was ≈16 actions and the result was still not clean. SIREN's was 0.** That number is the product.

## Keep Mermaid

The strongest case for dropping it is that positions are the one thing users ask for and the format forbids. Every point in that case argues for something other than a format change.

- **Positions**: you already have the pattern. `edgeRoutes` stores waypoints **normalised against their endpoints**, survives re-layout, migrates across renames, and round-trips through import/export [SOURCE]. A `nodeHints` sidecar would be architecturally identical. You do not need to abandon Mermaid to let people nudge — you need to decide whether nudging is a feature you want, and the tidy-up numbers say it is the thing you win by *not* having.
- **Compatibility**: a 40-line parser bug, not a property of the format. Item 1.
- **"Mermaid already holds almost nothing"**: seven sidecar stores live outside it — `nodeStyles`, `nodeMetadata`, `nodeClasses`, `links`, `icons`, `edgeStyles`, `edgeRoutes`, all migrated on rename by `structureRemapNodeId` (line 22372) [SOURCE]. That is the argument *against* abandonment: the architecture already tolerates everything Mermaid cannot express, and Mermaid does its one job well enough that a 356-character paste reproduces the whole benchmark in four actions.
- **Interop**: draw.io ingesting Mermaid is your *front door*, not a threat — and you have the return path they don't. **SIREN imports `.drawio` files and converts them to Mermaid** [SOURCE], and SIREN emits Mermaid; draw.io has no Mermaid export [AGENT]. "Bring your draw.io diagrams with you" is a migration story nobody has written down yet.

**What you permanently give up: any diagram whose *meaning* is spatial** — floor plans, seating charts, rack layouts, geographic maps, BPMN pools with real lane geometry. Say it out loud in the marketing. It is the boundary of the product and it is a long way from where your customers work.

---

### What would change my mind, and what nobody has measured

- **Real human timings.** Every second in every benchmark is machine-paced. A stopwatch on two real auditors — one on SIREN, one on draw.io, same diagram — would settle the speed argument in an afternoon and is worth more than all three agent reports.
- **Whether the refused Mermaid patterns are actually common.** Nine constructed variants is not a corpus. Take fifty real diagrams from your own work and from ChatGPT, run them through the parser, count the refusals. If chains are 60% of failures, item 1 is even more urgent than I have made it. If they are 5%, reorder the list.
- **What the Mermaid Chart and Lucidchart PowerPoint add-ins actually insert** — image or shapes. Both are behind logins, so I did not test them, and "editable PPTX is unique to SIREN" rests on that gap.
- **Connect mode at scale.** It was measured for *one* connector, not twelve. Item 6's payoff is arithmetic, not observation.
