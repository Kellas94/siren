# What is in this file that can never run?

The owner set a standing rule on 24 August: **no control that cannot work — remove it, or disable it
and say why.** This job is the inventory that rule needs. It is not a cleanup and you are not asked
to delete anything.

## Why now

Two pieces of dead code were found **by accident** on 24 August, while looking for something else:

- **`#diagramTypeChip`** — written on every render with a per-type sentence and tooltip
  (*"Full visual editing is available."*, *"This diagram is code-first…"*), authored `hidden` with
  `aria-hidden="true"` around app.html:18989, and **never un-hidden anywhere in the 8.4 MB file**.
  `updateDiagramTypeChip` faithfully maintains text nobody can read.
- **"Advanced direction"** (`#direction`) in the Style card — a real control, wired to a real
  handler, sitting inside a `<div hidden>`. Measured at runtime: **0×0**, `offsetParent` null.

Neither was hunted. Both turned up sideways. That is the reason to look properly.

**These two are your calibration.** Your report must contain both. If it does not, your sweep missed
something and I will read the rest of it accordingly.

## Hard rules

1. **Do not modify the application.** Read-only copy. **No patches, no deletions, no suggestions
   applied.** A patch will be discarded unread.
2. **State how you proved each item is dead.** Grep is not proof in this file — see the traps below.
   Runtime measurement is proof. A source reading is a hypothesis.
3. **Do not report an item you could not confirm.** Put it in a "suspected, not proven" list instead.
   That list is welcome and will be read; a guess in the main table is not.
4. **Do not expand the scope.** No refactoring advice, no architecture opinions.

## The base

- **`C:\Claude\SIREN\codex\FROZEN_1_66_0.html`** — 8,438,995 bytes, SHA-256
  `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`

## Traps that will produce false positives if you ignore them

- **A vendored Mermaid 11.16.1 bundle is 3,566,060 bytes of this file - 41.8% of it, minified. (An earlier note here said "about 7 MB"; that was wrong by roughly a factor of two.)** It starts near line
  14414. Everything in it will look dead and none of it is yours to judge. **Exclude it and say
  where you drew the line.**
- **The application is one IIFE.** Nothing is on `window`, so you cannot test a function by calling
  it from the console.
- **Dispatch is often by string.** Handlers are looked up by id, by `data-` attribute and by
  delegated listeners on ancestors. A function with no direct call site may still be reachable.
- **Some controls are alive only in a state you have not entered** — a diagram type, a mode, a
  narrow viewport, a read-only document, Present, the deck builder. Before calling a control dead,
  say which states you tried. There are 19 diagram types and several modes.
- **`hidden` is not the only way to be invisible**: `display:none` from a class, a zero-size parent,
  a media query that never matches at any width you tested, `visibility`, `inert`, or a parent that
  is itself hidden.

## What to inventory

Six categories. One table each. Every row: **what · where (line + function) · how you proved it ·
what a person would expect it to do.**

### 1. UI that can never be seen
Elements present in the markup that no state makes visible. This is the most valuable category and
the one the owner's rule is about. Include anything measured at 0×0 or with a null `offsetParent`
across every state you tried, and say which states those were.

### 2. Controls that are visible but can never act
A button that is always disabled, a field whose value is never read, a menu row that is inert for
every diagram type. Different from category 1 and worse, because a person can see it and try it.

### 3. State that is stored and never used
Fields written into the diagram record, sanitised on load, sometimes exported — and never read by
anything that draws or acts. **One is already known: `layout.alignment` is stored, shown in the UI
and written into the Excel export, but is never passed to Mermaid; only an offline fallback renderer
consumes it.** Find the others. This category is worth extra care because it is invisible to a user
and expensive to keep.

### 4. Functions never reached
Declared in the application's own code and called from nowhere. Given the traps above, treat every
one of these as suspected until you can show it. Prefer instrumenting at runtime — wrap it, exercise
the app, see whether it fires — over reasoning from the source.

### 5. CSS that matches nothing
Selectors that match no element in any state you tried. Say which states.

### 6. Two things doing one job
Where the same action exists twice and one route is unused or unreachable. One is known: flow
direction lives in **three** places — the toolbar buttons, `#visualDirection` in the builder panel,
and `#direction` in Style — and the third is inside a hidden div.

## The output

One document, `DEAD_CODE.md`, with those six tables, plus:

- a **"suspected, not proven"** section — everything you could not confirm, with what stopped you;
- a short section on **what looked dead and is not**, because those are the most useful lines in a
  report like this: they stop the next person wasting the same hour.

Do not rank by how much code could be removed. Rank by **what a person could see and try, and be
misled by**. That is what the rule is for.

## What this is not

Do not delete, do not refactor, do not touch the visual builder or the exports. Two other engineers
are working in this file right now; your job needs no changes to it at all, which is why it is yours.
