"""
Embed ELK, and take both external hosts out of the policy.

THE OWNER'S DECISION, 26 August: one build, not two. So the layout engine travels inside the file
and the Content-Security-Policy stops naming a host at all - not opt-in, not default-on, absent.
A firm's IT department reads one line and is finished.

What this does:

  1. inlines the flattened engine built by tools/build_elk_inline.py, before the application IIFE
  2. replaces the dynamic import with the local object
  3. removes cdn.jsdelivr.net and unpkg.com from script-src and connect-src

After it, the policy is `default-src 'none'` with no host allowance anywhere in it. There is no
external URL left in the file for the application to reach, so "it cannot phone home" stops being a
claim about behaviour and becomes a property of the document.

Cost, measured rather than estimated: +1,639,753 bytes, +19.1%. The 501KB in the round 12 report was
the TRANSFERRED size, gzipped over the wire; an inline copy is three times that.

NOT DONE HERE, deliberately: ELK is still offered on all twenty diagram types and measurably changes
the drawing on seven (flowchart, swimlane, state, ishikawa, class, ER, requirement). Hiding it on the
other thirteen is the honest follow-up and belongs with the type-true work, not with this.

Anchor-guarded, not SHA-pinned.

Usage: python patch_elk_embedded.py <path-to-siren.html> <path-to-elk_inline.js>
"""
import io, os, sys, hashlib

path, bundle_path = sys.argv[1], sys.argv[2]
s = io.open(path, encoding="utf-8").read()
bundle = io.open(bundle_path, encoding="utf-8").read()
print("input  SHA-256 %s  %d bytes" % (hashlib.sha256(s.encode("utf-8")).hexdigest().upper()[:24],
                                       len(s.encode("utf-8"))))


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch(
    "1. the engine loads from inside the file",

    "          const module = await import('https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs');\n"
    "          window.mermaid.registerLayoutLoaders(module.default || module.loaders || module);",

    "          // The engine is inlined above the application rather than fetched. This line was the\n"
    "          // only reason the policy named an external host; with it gone the policy names none,\n"
    "          // and \"this file cannot reach the internet\" is a property of the document rather than\n"
    "          // a claim about how it behaves.\n"
    "          if (!window.__SIREN_ELK) { elkLoadState = 'failed'; return false; }\n"
    "          window.mermaid.registerLayoutLoaders(window.__SIREN_ELK);",
)

patch("2. script-src stops naming a host",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;",
      "script-src 'self' 'unsafe-inline';")

patch("3. connect-src stops naming a host",
      "connect-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;",
      "connect-src 'self' blob:;")

# The bundle goes immediately before the application's own script block, so window.__SIREN_ELK
# exists by the time anything can ask for it.
ANCHOR = "<script>\n    (() => {\n      'use strict';\n"
assert s.count(ANCHOR) == 1, "expected exactly one application IIFE opening, found %d" % s.count(ANCHOR)
s = s.replace(ANCHOR, "<script>\n" + bundle + "</script>\n    " + ANCHOR, 1)
print("  applied: 4. the engine is inlined ahead of the application")

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
n = len(s.encode("utf-8"))
print("output SHA-256 %s  %d bytes" % (hashlib.sha256(s.encode("utf-8")).hexdigest().upper()[:24], n))
