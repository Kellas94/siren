"""Independent nesting check for the Style card region: walk #settingsSection with
Python's own html.parser and report the first mismatch and the depth left over."""
import io, sys
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'}

path = sys.argv[1]
s = io.open(path, encoding='utf-8', newline='').read()
start = s.index('<details class="card"', s.index('id="settingsSection"') - 400)
# walk forward from start counting <details ...> / </details> to find the region end
i, depth, end = start, 0, -1
while i < len(s):
    o = s.find('<details', i)
    c = s.find('</details>', i)
    if c == -1:
        break
    if o != -1 and o < c:
        depth += 1
        i = o + 8
    else:
        depth -= 1
        i = c + 10
        if depth == 0:
            end = i
            break
region = s[start:end]
print('region chars', len(region))


class Walk(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.bad = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.bad.append(('extra close', tag, self.getpos()))
            return
        top = self.stack[-1]
        if top[0] != tag:
            self.bad.append(('mismatch: open %s at %s, close %s' % (top[0], top[1], tag), tag, self.getpos()))
        self.stack.pop()


w = Walk()
w.feed(region)
print('stack left', [t for t, _ in w.stack])
print('mismatches', w.bad[:5])

ids = []
j = 0
while True:
    j = region.find(' id="', j)
    if j == -1:
        break
    k = region.index('"', j + 5)
    ids.append(region[j + 5:k])
    j = k
dupes = sorted({x for x in ids if ids.count(x) > 1})
print('ids', len(ids), 'dupes', dupes)
print('OK' if not w.bad and not w.stack and not dupes else 'PROBLEM')
