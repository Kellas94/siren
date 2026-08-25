"""
Put the ELK layout engine inside the file, and close the door behind it.

Today ELK is fetched when chosen: three files, 1,639,241 bytes decoded, from cdn.jsdelivr.net.
Measured, that is the ONLY external traffic this application ever makes - a normal boot fetches
nothing at all, because Mermaid is embedded and the renderer chip reads "Full Mermaid" with the
network blocked entirely.

So this patch does two things that belong together:

  1. Inlines the bundle (tools/bundle_elk.py, three ESM modules in one) as INERT text, and loads it
     at selection time from a Blob URL. Inert matters: an inline <script type="module"> would parse
     and evaluate 1.6 MB at every boot, for everyone, including the people who never touch ELK.
     This keeps it lazy - the cost is paid by the person who picks it.

  2. Removes both CDN hosts from the Content-Security-Policy and adds blob:. A blob: URL is not a
     network permission - it is built from bytes already in the file and can reach nothing. So the
     policy goes from "two external hosts permitted" to NO external host permitted at all. That is
     a tightening, and it is the air-gapped item on the worklist.

And it corrects the labels, which would otherwise become false in the other direction: the option
reads "ELK - online", the hint promises a 500 KB fetch from jsDelivr, and the failure toast blames
the internet. None of those survive the change.

Known and deliberately out of scope: the Mermaid CDN fallback URLs further down become unreachable
once the policy drops those hosts. They already never run - the embedded copy wins - and the app was
measured working with all external requests blocked. Removing them is a separate, tidier change.

Anchor-guarded, not SHA-pinned.

Usage: python embed_elk_offline.py <path-to-siren.html> [<path-to-elk.bundle.mjs>]
"""
import io, os, sys, hashlib

path = sys.argv[1]
bundle_path = sys.argv[2] if len(sys.argv) > 2 else r"C:\Claude\SIREN\pending\deps\elk.bundle.mjs"

s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("input  bytes   %d" % len(s.encode("utf-8")))

bundle = io.open(bundle_path, encoding="utf-8").read()
assert "</script" not in bundle, "the bundle contains a closing script tag"
assert len(bundle) > 1_000_000, "bundle looks too small: %d bytes" % len(bundle)


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


# ---------------------------------------------------------------- 1. the bundle, inert
patch(
    "1. inline the ELK bundle as inert text",
    '<script id="embedded-mermaid"',
    '<script type="text/plain" id="embedded-elk">' + bundle + '</script>\n'
    '<script id="embedded-mermaid"',
)

# ---------------------------------------------------------------- 2. load it from a blob
patch(
    "2. load ELK from the embedded copy instead of the CDN",
    "          const module = await import('https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs');",
    "          // The bundle rides inside this file as inert text. A Blob URL is the only way to\n"
    "          // import() it without eval, which the policy forbids, and without parsing 1.6 MB at\n"
    "          // boot for people who never choose ELK.\n"
    "          const embedded = document.getElementById('embedded-elk');\n"
    "          if (!embedded || !embedded.textContent) throw new Error('The embedded ELK bundle is missing.');\n"
    "          const blobUrl = URL.createObjectURL(new Blob([embedded.textContent], { type: 'text/javascript' }));\n"
    "          let module;\n"
    "          try { module = await import(blobUrl); }\n"
    "          finally { URL.revokeObjectURL(blobUrl); }",
)

# ---------------------------------------------------------------- 3. the policy
patch(
    "3. no external host permitted at all",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;",
    "script-src 'self' 'unsafe-inline' blob:;",
)
patch(
    "3b. same for connect-src",
    "connect-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;",
    "connect-src 'self' blob:;",
)

# ---------------------------------------------------------------- 4. the labels that would lie
patch(
    "4a. the option no longer says online",
    '<option value="elk">ELK \u00b7 online \u00b7 dense diagrams</option>',
    '<option value="elk">ELK \u00b7 dense diagrams</option>',
)
patch(
    "4b. the hint no longer promises a download",
    "Online option. ELK fetches about 500 KB from jsDelivr when first selected. It cannot load "
    "offline; SIREN falls back to Standard, so the same diagram may be arranged differently on "
    "another machine without a connection.",
    "A second layout engine for dense diagrams, carried inside this file. It loads on first use "
    "and needs no connection. It arranges a diagram differently from Standard, so a drawing laid "
    "out with ELK looks the same on any machine - including one that has never been online.",
)
patch(
    "4c. the failure message no longer blames the internet",
    "'The ELK layout engine could not be loaded (it needs internet on first use). Staying on the standard engine.'",
    "'The ELK layout engine could not be loaded from this file. Staying on the standard engine.'",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
