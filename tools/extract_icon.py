"""Pull the embedded favicon out of the shipped file so it can be looked at, not assumed."""
import io, re, base64, struct, os

OUT = os.path.dirname(os.path.abspath(__file__))
s = io.open(r"C:\Claude\SIREN\releases\SIREN_v1.70.0.html", encoding="utf-8").read()

m = re.search(r'href="data:image/x-icon;base64,([A-Za-z0-9+/=]+)"', s)
assert m, "no embedded icon"
raw = base64.b64decode(m.group(1))
print("icon bytes: %d" % len(raw))

# ICO header: reserved(2) type(2) count(2), then count x 16-byte directory entries.
reserved, kind, count = struct.unpack_from("<HHH", raw, 0)
print("ico type=%d images=%d" % (kind, count))
best = None
for i in range(count):
    w, h, colors, r1, planes, bpp, size, offset = struct.unpack_from("<BBBBHHII", raw, 6 + i * 16)
    w = w or 256
    h = h or 256
    blob = raw[offset:offset + size]
    fmt = "png" if blob[:8] == b"\x89PNG\r\n\x1a\n" else "bmp"
    print("  %3dx%-3d %-4s %6d bytes" % (w, h, fmt, size))
    if fmt == "png" and (best is None or w > best[0]):
        best = (w, blob)

if best:
    p = os.path.join(OUT, "siren_favicon_%d.png" % best[0])
    io.open(p, "wb").write(best[1])
    print("wrote %s" % p)
else:
    print("no PNG image inside; largest entry is a BMP")

tc = re.search(r'<meta[^>]*name="theme-color"[^>]*>', s)
print("theme-color: %s" % (tc.group(0) if tc else "ABSENT"))
