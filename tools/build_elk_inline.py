"""
Flatten the ELK layout engine into one inline script, so the offline build can carry it.

WHY. The app fetches ELK at runtime:

    const module = await import('https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/...');
    window.mermaid.registerLayoutLoaders(module.default || module.loaders || module);

That single line is the only reason the Content-Security-Policy names an external host at all. The
owner's decision is one build rather than two, so the engine travels inside the file and the host
leaves the policy entirely - not opt-in, not default-on, absent.

THE SHAPE OF THE PROBLEM. Three ES modules with a shared helper chunk:

    chunk-SP2CHFBE.mjs      854 bytes    esbuild helpers, exported as a, b, c, d
    render-GJFLM4CZ.mjs   1,638,031      the whole engine; imports the four, exports {_5t as render}
    main.mjs                  356        imports {a}, defines a loader that dynamically imports
                                         render, exports the layout descriptor array as default

Naive concatenation does not work: the chunk declares its own `o` (__commonJS) and main imports the
helper `a` UNDER THE NAME `o`. In one scope they collide silently and the wrong function is called.
So each module keeps its own scope and the bindings are passed in explicitly.

The dynamic import inside main is replaced by the already-evaluated render namespace, which is what
makes the whole thing local. Mermaid only requires that `await loader()` yields an object carrying
`render`, so an async function returning it is a faithful stand-in for a module namespace.

Costs, measured rather than estimated: 1,640,095 bytes raw, +19.1% on an 8,599,649-byte app. The
501KB figure in the round 12 report was the TRANSFERRED size - gzipped over the wire - not what an
inline copy costs.

Usage:
    python build_elk_inline.py <dir-with-main.mjs-chunk.mjs-render.mjs> <out.js>
"""
import io, os, sys, re, hashlib

src = sys.argv[1]
out = sys.argv[2]

chunk = io.open(os.path.join(src, "chunk.mjs"), encoding="utf-8").read()
render = io.open(os.path.join(src, "render.mjs"), encoding="utf-8").read()
main = io.open(os.path.join(src, "main.mjs"), encoding="utf-8").read()

# ---- the chunk: drop its export statement, hand the four helpers back by name ----
m = re.search(r"export\{([^}]*)\};?\s*$", chunk)
assert m, "chunk: no trailing export"
pairs = dict(p.strip().split(" as ") for p in m.group(1).split(","))
# pairs maps local -> exported, e.g. {'m':'a','n':'b','o':'c','p':'d'}
chunk_body = chunk[: m.start()]
returns = ", ".join("%s: %s" % (exp, loc) for loc, exp in pairs.items())
print("  chunk exports: %s" % pairs)

# ---- render: strip its import line and its export, keep the local it exported ----
m = re.match(r'import\{([^}]*)\}from"[^"]*";', render)
assert m, "render: no leading import"
render_imports = dict(p.strip().split(" as ") for p in m.group(1).split(","))
# e.g. {'a':'r','b':'EP','c':'YFe','d':'ZFe'}  exported-name -> local-alias
render_body = render[m.end():]
m = re.search(r"export\{([^}]*)\};?\s*$", render_body)
assert m, "render: no trailing export"
render_exports = dict(p.strip().split(" as ") for p in m.group(1).split(","))
render_body = render_body[: m.start()]
params = ", ".join(render_imports[k] for k in sorted(render_imports))
args = ", ".join("__h.%s" % k for k in sorted(render_imports))
render_ret = ", ".join("%s: %s" % (exp, loc) for loc, exp in render_exports.items())
print("  render imports %s, exports %s" % (render_imports, render_exports))

# ---- main: strip its import, replace the dynamic import, strip its export ----
m = re.match(r'import\{([^}]*)\}from"[^"]*";', main)
assert m, "main: no leading import"
main_imports = dict(p.strip().split(" as ") for p in m.group(1).split(","))
main_body = main[m.end():]
dyn = re.search(r'await import\("[^"]*render-[^"]*"\)', main_body)
assert dyn, "main: could not find the dynamic import of render"
main_body = main_body[: dyn.start()] + "__render" + main_body[dyn.end():]
m = re.search(r"export\{([^}]*)\};?\s*$", main_body)
assert m, "main: no trailing export"
main_exports = dict(p.strip().split(" as ") for p in m.group(1).split(","))
main_body = main_body[: m.start()]
main_default = [loc for loc, exp in main_exports.items() if exp == "default"][0]
main_params = ", ".join(main_imports[k] for k in sorted(main_imports))
main_args = ", ".join("__h.%s" % k for k in sorted(main_imports))
print("  main imports %s, default export is %s" % (main_imports, main_default))

BUNDLE = """/* ELK layout engine, inlined. Built by tools/build_elk_inline.py from
   @mermaid-js/layout-elk@0.1.7 so that the application carries no external host.
   Each module keeps its own scope: the helper chunk declares `o` and the entry module
   imports a DIFFERENT helper under the name `o`, so a flat concatenation calls the wrong
   function with no error. The entry's dynamic import of the render chunk is replaced by the
   render namespace already evaluated above it. */
window.__SIREN_ELK = (function () {
  "use strict";
  var __h = (function () {
%s
    return { %s };
  })();
  var __render = (function (%s) {
%s
    return { %s };
  })(%s);
  var __loaders = (function (%s) {
%s
    return %s;
  })(%s);
  return __loaders;
})();
""" % (chunk_body, returns, params, render_body, render_ret, args,
       main_params, main_body, main_default, main_args)

io.open(out, "w", encoding="utf-8", newline="").write(BUNDLE)
n = len(BUNDLE.encode("utf-8"))
print("\n  wrote %s" % out)
print("  %d bytes   SHA-256 %s" % (n, hashlib.sha256(BUNDLE.encode("utf-8")).hexdigest().upper()[:24]))
print("  +%.1f%% on an 8,599,649-byte application" % (100.0 * n / 8599649))
