"""
Swap the embedded Mermaid bundle, 11.16.1 -> 11.17.1.

The app carries Mermaid inline: 3,566,060 bytes, 41.8% of the file. Measured, a normal boot makes
ZERO external requests and the renderer chip reads "Full Mermaid", so the embedded copy is the one
that runs and the CDN list further down is a fallback for when the embed is absent. Nothing updates
underneath a shipped file - the version moves only when this script is run.

11.16.1 -> 11.17.1 is +6,597 bytes on 3.5 MB: one minor and one patch inside the same major. Small
as a diff, and still the largest possible blast radius in this application, because every diagram
type, every export and every theme is drawn by it. Do not ship this without the full regression
suite AND qa_exports/run_export_fidelity.js.

Also updates the three CDN fallback URLs to match, so a machine that ever does fall back does not
silently drop to the older renderer.

Anchor-guarded, not SHA-pinned.

Usage: python upgrade_mermaid_11_17_1.py <path-to-siren.html> [<path-to-mermaid.min.js>]
"""
import io, os, sys, hashlib, re

path = sys.argv[1]
bundle = sys.argv[2] if len(sys.argv) > 2 else r"C:\Claude\SIREN\pending\deps\mermaid.min.js"

s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("input  bytes   %d" % len(s.encode("utf-8")))

new_js = io.open(bundle, encoding="utf-8").read()
assert "</script" not in new_js, "the replacement bundle contains a closing script tag; it cannot be inlined as-is"
assert len(new_js) > 3_000_000, "the replacement bundle is suspiciously small: %d bytes" % len(new_js)

# ---- 1. the embedded bundle -----------------------------------------------------------
m = re.search(r'(<script id="embedded-mermaid"[^>]*>)', s)
assert m, "no <script id=\"embedded-mermaid\"> in this file"
start = m.end()
end = s.index("</script>", start)
old_js = s[start:end]
print("  embedded 11.16.1 %d bytes -> 11.17.1 %d bytes (%+d)"
      % (len(old_js.encode("utf-8")), len(new_js.encode("utf-8")),
         len(new_js.encode("utf-8")) - len(old_js.encode("utf-8"))))
s = s[:start] + new_js + s[end:]
print("  applied: 1. embedded bundle replaced")

# ---- 2. the CDN fallbacks, so a fallback does not land on the older renderer -----------
n = s.count("mermaid@11.16.1")
assert n >= 1, "expected at least one 11.16.1 CDN reference, found %d" % n
s = s.replace("mermaid@11.16.1", "mermaid@11.17.1")
print("  applied: 2. %d CDN fallback URL(s) repointed to 11.17.1" % n)

# ---- 3. anything that prints the version to a person -----------------------------------
for old, new in [("Mermaid 11.16.1", "Mermaid 11.17.1"), ("mermaid 11.16.1", "mermaid 11.17.1")]:
    c = s.count(old)
    if c:
        s = s.replace(old, new)
        print("  applied: 3. %d visible mention(s) of %r updated" % (c, old))

left = s.count("11.16.1")
if left:
    print("  NOTE: %d occurrence(s) of 11.16.1 remain - check they are historical (changelog) and not live" % left)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
