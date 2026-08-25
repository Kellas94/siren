"""
Renumber the one continuous rank sequence that runs Parked -> Ideas -> Cheap -> Watching.

Closing five items left it reading 03, 07, 09, 10, 11, 13, 14, 15. Gaps in a numbered list read as
a mistake rather than as history, and the history is recorded in the panel at the foot of Ideas.

"Working on now" and "From the outside audit" each start their own 01 and are left alone.
"""
import io, os, re

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()

start = s.find("Parked &#8212; placement")
assert start > 0
start = s.rfind("<section", 0, start)

ranks = re.findall(r'<div class="rank">(\d+)</div>', s[start:])
print("  before: " + ", ".join(ranks))

n = [int(ranks[0]) - 1]


def bump(m):
    n[0] += 1
    return '<div class="rank">%02d</div>' % n[0]


head, tail = s[:start], s[start:]
tail = re.sub(r'<div class="rank">\d+</div>', bump, tail)
s = head + tail

print("  after:  " + ", ".join(re.findall(r'<div class="rank">(\d+)</div>', s[start:])))

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
