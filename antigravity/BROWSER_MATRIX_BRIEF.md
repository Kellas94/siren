# Does SIREN work in a browser that is not Chrome?

Nobody knows. That is the whole job.

## Why this matters

SIREN is **one HTML file** that its owner sends to people. A colleague double-clicks it in whatever
browser they happen to have. Every measurement ever taken on this application — every gate, every
probe, every one of the hundreds of assertions in its regression suite — has been taken in
**Chromium**. The accepted test suite records this in its own words as a coverage gap:

> *"The full Firefox/WebKit matrix was not run."*

So the app may be perfect in Chrome and quietly broken for half the people it is sent to, and we
would not know.

## What this job is

A **report**. Not a patch, not a fix, not a redesign.

Your deliverable is one document, `BROWSER_MATRIX.md`, that answers: **what works, what degrades
honestly, and what fails silently, in Firefox and in WebKit/Safari.** Where something fails, say
what a person would see.

## Hard rules

1. **Do not modify the application.** Work from a read-only copy. If you produce a patch it will be
   discarded unread.
2. **Do not report a result you did not observe.** Every row needs evidence: a screenshot you looked
   at, a console message you captured, or a measured value. "Could not test" is a good answer and
   will be treated as one. A guess presented as a result is the only thing that makes this job
   worthless.
3. **Say which browser and version** for every result. "It works" is not a result; "Firefox 128,
   worked, screenshot attached" is.
4. **Do not expand the scope.** If you find something interesting outside the list, put it in a
   separate section at the end.

## The base

- **`C:\Claude\SIREN\codex\FROZEN_1_66_0.html`** — 8,438,995 bytes, SHA-256
  `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`

Copy it into your own directory. Open it **as a file** (double-click / `file://`) as well as over
`http://localhost`, because the owner's real usage is the double-click and the two are not the same
for storage and for some APIs.

## Start from these — they are the named suspects

I grepped the shipped file for browser-sensitive APIs. These are the ones it actually uses, with
occurrence counts. Establish for **each** whether it is guarded with a fallback or used bare, and
what happens in a browser that lacks it:

| API | uses | why it is a suspect |
|---|---|---|
| `showSaveFilePicker` | 5 | Chromium only. **Already guarded** — I checked: `saveProjectAs` tests `typeof window.showSaveFilePicker !== 'function'` and toasts *"This browser cannot save directly to disk. Use Export ▸ Project file instead."* Use this as your example of a good fallback, and find the ones that are not like it. |
| `showPopover` / `hidePopover` / `popover=` | 5 | The toast system uses it. Safari before 17, Firefox before 125 do not have it. If it throws, **every message the app shows could disappear** — including the refusals that protect the owner's work. |
| `clipboard.write` | 8 | Safari requires user activation and restricts types; Firefox is partial. "Copy as Markdown", "copy the template for Copilot" and the diagram copy paths all depend on it. |
| `OffscreenCanvas` | 7 | Safari 16.4+. Used somewhere in rendering or export — find out where and what happens without it. |
| `createImageBitmap` | 4 | Same family. |
| `BroadcastChannel` | 5 | The multi-tab mirror in `sirenStore`. Safari 15.4+. Without it, does a second tab overwrite the first? |
| `:has()` | 5 | CSS. Firefox 121+. Older Firefox loses whatever styling depends on it — find out what. |
| `structuredClone` | 74 | Widely supported now, but it is load-bearing (74 uses, including the project export payload). Confirm rather than assume. |
| `<dialog>` / `showModal` | 4 + | Every confirmation and refusal in the app. If modals fail, the app's "refuse out loud" behaviour fails with them. |
| `inert` | 21 | Focus management. Safari 15.5+. |
| SVG favicon (`data:image/svg+xml`) | 1 | **Safari does not support SVG favicons at all.** Cosmetic, but it is the tab icon. |

## What to actually exercise

For each browser, go through this and record what happened:

1. **It opens.** Boot from `file://` and from `http://`. Time to first paint. Any console error.
2. **A diagram renders** — do a flowchart, a sequence, a gantt, a mindmap and a pie.
3. **Editing works** — add a block through the visual builder, drag a canvas handle, rename a block.
4. **Messages appear.** Trigger a toast (add a block) and a refusal (try to delete a block whose
   removal would lose a path). **If toasts do not appear, that is the most important finding in this
   report** — say so loudly.
5. **Storage works.** Make a change, reload, is it still there? Open the file in two tabs, change one,
   what happens to the other?
6. **Every export.** PDF, PNG, SVG, PowerPoint, Word, Excel, Markdown, JSON, `.siren`. For each: does
   the download happen, and does the file open in the right application? Record file sizes and
   compare them to the same export from Chrome.
7. **Import.** Take a `.siren` file exported from Chrome and import it in Firefox, and the reverse.
8. **Docs.** Write a document, add a heading, use the `/` inserter, check the heading rail.
9. **Present.** Open Present, move through a walkthrough, exit.
10. **The tab icon and title.**

## The output

One table per browser:

| what | result | evidence | what a person would see |
|---|---|---|---|

Then a short list, ordered by severity, of everything that **fails silently** — where the app does
nothing and says nothing. Those are worth more than everything else in the report combined, because
they are the ones that cannot be discovered by using the app normally.

Then, separately: anything that **degrades honestly** — where the app notices and says so, like the
save-picker fallback above. Those are not defects and should be praised as the pattern to copy.

## What this is not

Do not fix anything. Do not propose an architecture. Do not touch the visual builder, the exports,
or any other work in flight. Two other engineers are working on this file right now and your job is
the only one that requires no changes to it at all — that is deliberate, and it is why this job is
yours.
