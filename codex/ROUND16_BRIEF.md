# SIREN Round 16 — one build that cannot reach the internet

Read `ROUND8_METHOD.md` first; the method is unchanged. The base is round 14's output, frozen:

```
codex/FROZEN_R15_BASE.html
8,599,649 bytes
SHA-256  0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97
```

**The base will be round 15's output**, re-pinned once that round is verified. Nothing in here
touches what round 15 touches — BL is the policy and one loader function, BM is the confirmation
dialog, BN is two sentences — so the two rounds are byte-disjoint and this one can be written against
round 14's output and rebased with no anchor moving.

**The owner's decision, 26 August: one build, not two.** The layout engine travels inside the file
and the Content-Security-Policy stops naming a host at all. Yesterday's answer — remove ELK from an
offline edition and ship two — is withdrawn. He asked why it could not simply be embedded, and the
honest answer was that it can.

---

## BL — embed ELK, delete both hosts, and let the policy name nothing

**This has been prototyped and measured, not reasoned about. Start from the spike; do not
rediscover it.**

- `tools/build_elk_inline.py` flattens `@mermaid-js/layout-elk@0.1.7` into one inline script
- `tools/patch_elk_embedded.py` applies it and strips the hosts from the policy
- `qa_exports/verify_elk_embedded.js` proves it with the network **cut at the browser**, not observed

### What the spike measured

```
the app booted and drew a diagram with the network dead     yes
window.__SIREN_ELK present                                  yes, 5 layout entries
chose ELK, selector reads 'elk'
  geometry before   viewBox  0 0 432.640625 641.71875
  geometry after    viewBox  4 4 417.640625 568.71875      it re-laid the diagram
requests the browser had to abort                           NONE
page and console errors                                     none
resulting file        10,239,589 bytes   (+19.1%)
resulting policy      default-src 'none'; script-src 'self' 'unsafe-inline'; style-src
                      'unsafe-inline'; img-src data: blob:; connect-src 'self' blob:; …
                      no external host anywhere in it
```

Nothing even *tried* to leave. That is the difference the owner is buying: not "it makes no
requests" but "there is no address in it to request".

### The one trap, and it fails silently

ELK is three ES modules. The helper chunk declares its own `o` (`__commonJS`), and the entry module
imports a **different** helper under the name `o` (`__name`). Concatenated into one scope they
collide, the wrong function is called, and **there is no error** — you get a broken engine that
looks installed. Each module must keep its own scope with the bindings passed in explicitly. The
builder already does this; if you rewrite it, keep that property and prove it.

The entry module's `await import("./chunks/…/render-….mjs")` is replaced by the already-evaluated
render namespace. Mermaid only requires that `await loader()` yields an object carrying `render`, so
an async function returning one is a faithful stand-in for a module namespace.

### Also delete the dead Mermaid fallback

Two mentions of `jsdelivr` and `unpkg` survive the spike, and neither is ELK. They are
`CDN_MERMAID_SOURCES`, a fallback chain for fetching Mermaid — which has been embedded in the file
since 1.51.0. Round 12's verification already measured that unpkg is never used at all. Remove the
chain and its now-dead helpers, and **keep the local `./mermaid.min.js` route**: someone who drops
that file beside the HTML must still be served by it.

When this job is done, `grep -c 'jsdelivr\|unpkg'` over the whole file must return **0**.

### Done means

- The file contains no external URL, and the policy names no host.
- ELK still re-lays a flowchart, proved with every non-local request **aborted** at the browser.
- The app boots, renders every diagram type, exports PDF/PPTX/XLSX/DOCX/SVG/PNG and opens Present,
  all with the network dead.
- `?offline=1` and any local-Mermaid route still behave.
- Byte size and the exact policy string are stated in the handback.

### Not in this job

ELK is offered on all twenty diagram types and **measurably changes the drawing on seven** —
flowchart, swimlane, state, ishikawa, class, ER, requirement. On the other thirteen you select it and
the rendered geometry is byte-identical. Hiding it where it does nothing is the honest follow-up and
belongs with the type-true style work, not here. Do not fold it in.

---

## BM — a red button that means it, redone

Round 12's BC is held. Its machinery was right — `requestConfirmation` taking `destructive` with a
safe default of `true`, and the presentation reset that fixed a real notice-to-confirmation leak on
the base. **The classification was wrong on seven callers**, and a destructive action wrongly marked
neutral is worse than the original defect, because it removes the warning from something that does
destroy.

```
create a class, delete it through the real dialog, six ordinary source edits, reload
  selectOptions []        persistedClasses [[]]        #undoButton.disabled === true
  five real clicks on Undo do nothing; all five restore points carry classes:[]
  dialog colour   BASE okDanger=true, red        MERGED okDanger=false, solid rgb(37,99,235)
```

The state dies because the action calls `renderDiagram({ saveVersion: false })` and
`scheduleUndoSnapshot()` only; `undoHistoryByDiagram` is an in-memory Map that dies at reload; and
`saveVersionSnapshot` short-circuits when the Mermaid source has not changed — and creating or
deleting a class does not change the source.

**The seven**: Reset every block style, Delete class, Delete scenario, Reset presentation sequence,
Remove slide, Delete this card, Delete folder. Only Delete folder was ever driven. Two of the
untested ones — Delete scenario, Delete this card — can hold substantial typed content.

**Done means** either the recovery is made real — these callers write a forced restore point,
`saveVersionSnapshot(reason, true)`, so the state survives a reload — or all seven carry
`destructive: true` until it is. **Do not ship the blue without one of the two.** Prove it by
capturing full state before, confirming, doing several ordinary edits, reloading, and showing the
thing is recoverable.

---

## BN — one false sentence, and a stale Guide

**The merge sentence.** Merging into an inactive diagram says *"The current source of that diagram is
saved in the restore points first."* It is not: the snapshot written is of the diagram on screen, not
of the target about to be overwritten. Measured — target's source changed, real Undo did not restore
it, and both restore points afterwards carried the **active** diagram's id and length. The loss is
pre-existing; the sentence is one line. Cheapest honest fix: delete it and say "This cannot be
undone." Proper fix: snapshot the target, and then it can go blue.

**The Guide contradicts the product.** It tells the reader other diagram types need a renderer
"which loads when internet access is available", and to save `mermaid.min.js` beside the file or open
it once with `?offline=1`. After BL none of that is true and the renderer travels inside the file.
Rewrite the callout, and unify the flag name — the Guide teaches `?offline=1` while the newer code
used `?nointernet=1`. Keep the old one as a silent alias so existing links do not break.

---

## The standing rule

Nothing in this app may promise what it cannot deliver, and nothing may ever silently lose what
somebody wrote. BM is the second half of that rule. BL is the first half made into a property of the
document rather than a claim about it.

---

