"""
Bundle the three-file @mermaid-js/layout-elk ESM graph into ONE module, for inlining.

  entry  (356 B)      import{a as o} from chunk ; dynamic import(render) ; export{l as default}
  chunk  (854 B)      export{m as a, n as b, o as c, p as d}
  render (1.64 MB)    import{a as r, b as EP, c as YFe, d as ZFe} from chunk ; export{_5t as render}

Raw concatenation would collide: the chunk minifies to single letters (a, b, c, e, g, h, i, j, k,
l, m, n, o, p) and render has its own. So each body goes in its own IIFE scope, its import line is
replaced by a destructure from the module already built, and its export line by a return.

The entry's dynamic import of render is replaced with an already-resolved promise. That loses the
second level of laziness INSIDE the bundle, which costs nothing: by the time anything imports this
module at all, the person has chosen ELK and render is exactly what they are waiting for.

Usage: python bundle_elk.py <deps-dir> <out-file>
"""
import io, os, re, sys, hashlib

deps = sys.argv[1] if len(sys.argv) > 1 else r"C:\Claude\SIREN\pending\deps"
out = sys.argv[2] if len(sys.argv) > 2 else r"C:\Claude\SIREN\pending\deps\elk.bundle.mjs"

def read(name):
    p = os.path.join(deps, name)
    return io.open(p, encoding="utf-8").read()

entry = read("mermaid-layout-elk.esm.min.mjs")
chunk = read("chunk-SP2CHFBE.mjs")
render = read("render-GJFLM4CZ.mjs")

# ---- chunk: strip its export, hand back a map ------------------------------------------
m = re.search(r'export\{([^}]*)\};?\s*$', chunk)
assert m, "chunk: no trailing export"
pairs = [p.strip().split(" as ") for p in m.group(1).split(",")]
chunk_body = chunk[:m.start()]
chunk_map = ",".join("%s:%s" % (b.strip(), a.strip()) for a, b in pairs)
print("chunk exports  : %s" % chunk_map)

# ---- render: replace its import, strip its export ---------------------------------------
mi = re.match(r'import\{([^}]*)\}from"[^"]*";', render)
assert mi, "render: no leading import"
render_destr = ",".join(p.strip().replace(" as ", ":") for p in mi.group(1).split(","))
me = re.search(r'export\{([^}]*)\};?\s*$', render)
assert me, "render: no trailing export"
render_pairs = [p.strip().split(" as ") for p in me.group(1).split(",")]
render_map = ",".join("%s:%s" % (b.strip(), a.strip()) for a, b in render_pairs)
render_body = render[mi.end():me.start()]
print("render imports : %s" % render_destr)
print("render exports : %s" % render_map)

# ---- entry: replace both imports, strip its export ---------------------------------------
ei = re.match(r'import\{([^}]*)\}from"[^"]*";', entry)
assert ei, "entry: no leading import"
entry_destr = ",".join(p.strip().replace(" as ", ":") for p in ei.group(1).split(","))
ed = re.search(r'import\(\s*"[^"]*render-[^"]*"\s*\)', entry)
assert ed, "entry: no dynamic import of render"
ee = re.search(r'export\{([^}]*)\};?\s*$', entry)
assert ee, "entry: no trailing export"
entry_pairs = [p.strip().split(" as ") for p in ee.group(1).split(",")]
default_local = [a.strip() for a, b in entry_pairs if b.strip() == "default"]
assert default_local, "entry: no default export"
entry_body = entry[ei.end():ee.start()]
entry_body = entry_body[:ed.start() - ei.end()] + "Promise.resolve(__elkRender)" + entry_body[ed.end() - ei.end():]
print("entry imports  : %s" % entry_destr)
print("entry default  : %s" % default_local[0])

bundle = (
    "/* @mermaid-js/layout-elk 0.1.7, three ESM files bundled into one module so the layout\n"
    "   engine can live inside this file instead of being fetched from a CDN. Built by\n"
    "   tools/bundle_elk.py; each original module keeps its own scope. */\n"
    "const __elkChunk = (() => {\n%s\nreturn {%s};\n})();\n" % (chunk_body, chunk_map) +
    "const __elkRender = (() => {\nconst {%s} = __elkChunk;\n%s\nreturn {%s};\n})();\n" % (render_destr, render_body, render_map) +
    "const __elkDefault = (() => {\nconst {%s} = __elkChunk;\n%s\nreturn %s;\n})();\n" % (entry_destr, entry_body, default_local[0]) +
    "export default __elkDefault;\n"
)

io.open(out, "w", encoding="utf-8", newline="").write(bundle)
b = bundle.encode("utf-8")
print()
print("wrote %s" % out)
print("bytes  %s" % format(len(b), ","))
print("sha256 %s" % hashlib.sha256(b).hexdigest().upper())
assert "</script" not in bundle, "the bundle contains a closing script tag and cannot be inlined"
print("safe to inline: no </script sequence")
