# SIREN — conventions for every agent working on the app (read fully before touching anything)

The app is ONE file: `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` (~7.9 MB, one IIFE, strict CSP: no eval / new Function, no external requests; Mermaid is embedded). **Never edit the live file.** You work on your own copy of the frozen base and deliver a patch script; the main engineer integrates.

## Files and places
- Frozen base for this round: `C:\Claude\SIREN\pending\FROZEN_1_62_0.html` (= release 1.62.0). Copy it; never write to it.
- Your working folder: `C:\Claude\SIREN\pending\<your-job-name>\` — create it. Put your copy, scripts, probes, logs and screenshots there.
- Tools: `C:\Claude\SIREN\tools\syncheck.py` (syntax gate: `python C:\Claude\SIREN\tools\syncheck.py "<path to your copy>"` must print `node --check exit 0`), `C:\Claude\SIREN\tools\drive.mjs` (headless-Chrome CDP driver, below).
- History and context: `C:\Claude\SIREN\RESUME_HERE.md` (what shipped and why), `C:\Claude\SIREN\audit\` (specs, critiques, DECLUTTER_MOVES.md), `C:\Claude\SIREN\antigravity\` (a second engineer's export patches — treat as raw material, verify everything).
- Verification libraries available: Python `pymupdf` (rasterise PDF pages to PNG: `import pymupdf; doc=pymupdf.open(p); pix=doc[0].get_pixmap(dpi=110); pix.save('x.png')`), `python-docx`, `python-pptx` (if `import pptx` fails: `pip install python-pptx`). Node 24.

## Reading the file
- Do NOT Read the whole file. Use `grep -a -n` to find things and `sed -n 'A,Bp'` to read windows. Function names are stable anchors; the Mermaid bundle is a giant line near the top — avoid it.
- Key seams: `applyVisualModel(model, reason, preferredNodeId, op, onWrite)` → `surgicalWrite` → `planSurgicalEdit` (planners `surgPlan*`); `openStructureMenu(anchor, options, current, onPick, config)` (the one menu primitive); `handleAppContextMenu` → `buildContextMenu(target)` → surface builders (`buildDocsContextMenu` etc.); `requestConfirmation`/`requestNotice`/`showDialog`; `showToast(text, kind)`; `state` + `scheduleSave()`; `el.<id>` map of elements; canvas module starts at `/* ---- canvas builder` (`canvasOverlayRepaint`, `canvasApply`, `canvasOpenPopover`, `CANVAS_AXES`…); docs module `#wpWorkspace`; exports near `deliverExportBlob`, `buildZip`, `buildWorkpaperWordDocument`, the PPTX writers (`slideOverrides`), the deck PDF (`deckPlanDiagramPages`, `svgToCanvas`).

## How to change the file: an anchor-guarded Python patch script
- Write the script with the **Write tool** (never a bash heredoc — this Bash collapses `\\` to `\`, which silently corrupts `\u`, `\b`, `\r?\n`).
- Shape:
  ```python
  import io, os, sys
  APP = sys.argv[1]                       # ALWAYS a path given on the command line; default to nothing
  s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
  def rep(anchor, new, n=1):
      global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)
  rep("""<exact text copied from the file>""", """<new text>""")
  tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
  print('applied', len(orig), '->', len(s))
  ```
- Anchors are copied FROM the file (sed output), long enough to be unique, and as SHORT as correctness allows: another agent may be editing a neighbouring region. List every function/region you touch in your report.
- Never touch `APP_VERSION` or `CHANGELOG` — the main engineer bumps. Never change `})();` at the end of the IIFE. Never add external requests or `new Function`.
- CSS: the app is theme-token based (`var(--primary)`, `--panel-bg`, `--text`, `--border`, `--muted`, …); every colour comes from a token; dark and light both work.
- Style of code comments in this file: short, plain-language, say WHY (the file is read by a non-coder owner with an engineer's help). Match it.

## How to verify (mandatory — nothing is done until it is measured in the running app)
1. `python C:\Claude\SIREN\tools\syncheck.py "<your copy>"` → `node --check exit 0`.
2. Serve your copy: `python -m http.server <YOUR_HTTP_PORT> --directory <folder with your copy renamed app.html>` in the background; assert `curl -sI http://127.0.0.1:<port>/app.html | grep -i content-length` equals the file size on disk (stale servers have bitten us).
3. Drive it: `OUT_DIR=<dir> PROFILE=<fresh dir> CDP_PORT=<YOUR_CDP_PORT> VW=1440 VH=900 node C:\Claude\SIREN\tools\drive.mjs steps.json`. Steps are a JSON array of `{nav,wait}` | `{js, name}` | `{click: '<css>'}` | `{key: 'Enter'}` | `{hover: '<css>'}` | `{shot: 'name.png'}` | `{wait: ms}`. `js` is evaluated with `awaitPromise`, so an async IIFE that polls is fine. Generate the JSON with a small Python script written with the Write tool; carry newlines in JS as `String.fromCharCode(10)`, never as `\n` inside JSON-carried JS.
4. On boot: dismiss the welcome tour card (`.tour-card` — click its skip/done button) and any open `<dialog>`; a brand intro may play on first run (any click ends it). Seed a diagram through `#source` (`value=…; dispatchEvent(new Event('input',{bubbles:true}))`) and wait ~3.5 s for the render.
5. `grep -c "PAGE EXCEPTION" <log>` after EVERY run; a synthetic `pointerdown` on `#zoomViewport` trips a harmless `setPointerCapture` NotFoundError in `beginPan` — dispatch presses on the node/element instead, and exclude that one when counting.
6. Take screenshots of what you changed and **open them with the Read tool and look** before you claim anything. Measure with `getBoundingClientRect` / `getComputedStyle`; read text from the DOM. Don't assert what you did not see.
7. Known harness traps: `el.*` and app functions are IIFE-internal (not on `window`) — read state from the DOM and from `#source`; a closed `<details>` makes its fields unfocusable; `focus()` is fine (focus emulation is on); keyboard events for app shortcuts go to the focused element / `#zoomViewport`; click a `g.node` by dispatching `pointerdown` on the node, `pointerup` on window, then `click` on the node.

## What you deliver (your final message IS the report; the main engineer integrates)
- Path of your patch script (idempotent against the frozen base), the regions it touches, and the size delta.
- Evidence folder with logs and PNGs, and the exact numbers you measured (before/after).
- A plain list of what is NOT done / known risks. Honesty over completeness: say what failed.
- No commits, no git, no new modules/libraries, no recommendations outside the job.

## Harness bug fixed 2026-08-23 — re-read this if you saw it before

`tools/syncheck.py` used to hardcode the LIVE app path and ignore `argv[1]`: every
"syncheck on my working copy" silently re-checked the live file and always passed. It also
wrote the extracted JavaScript to one shared temp path, so two agents checking at the same
time overwrote each other. Both are fixed: the target is the argument (defaulting to live),
and the temp file is named after the target. **Run it with the path you mean**, and treat its
exit code as the answer:

```
python C:\Claude\SIREN\tools\syncheck.py "<your copy>"   ->  node --check exit 0
```

If you ever wrote your own `syncheck_arg.py` because of this, you were right to; the shared
one is now correct, so use it.

The general lesson, which applies to your harness as much as to mine: **a gate that has never
failed has not been tested.** Break your copy on purpose once and watch the gate catch it.
