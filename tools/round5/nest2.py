"""Independent nesting walk of the #settingsSection region (html.parser, not the
builder's checknest.py). Prints the first mismatch and the depth left on the stack.

Usage: python nest2.py <file.html>
"""
import io, re, sys
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}

path = sys.argv[1]
s = io.open(path, encoding='utf-8', newline='').read()
start = s.index('id="settingsSection"')
start = s.rindex('<details', 0, start)

# walk forward counting <details>/<div> until the region's own details closes
class W(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.done_at = None
        self.first_bad = None
        self.max_depth = 0
        self.counts = {}

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        self.stack.append((tag, self.getpos()))
        self.max_depth = max(self.max_depth, len(self.stack))
        self.counts[tag] = self.counts.get(tag, 0) + 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            if not self.first_bad:
                self.first_bad = ('closing %s with empty stack' % tag, self.getpos())
            return
        top, pos = self.stack[-1]
        if top != tag:
            if not self.first_bad:
                self.first_bad = ('expected </%s> (opened at %s) but got </%s>' % (top, pos, tag), self.getpos())
            return
        self.stack.pop()
        if not self.stack and self.done_at is None:
            self.done_at = self.getpos()


w = W()
region = s[start:start + 400000]
w.feed(region)
consumed = None
if w.done_at:
    line, col = w.done_at
    consumed = 'region closes cleanly at relative line %d' % line
print('start offset', start)
print('first mismatch:', w.first_bad)
print('closed cleanly:', bool(w.done_at), consumed)
print('depth left on stack after close:', 0 if w.done_at else len(w.stack))
print('details opened in region:', w.counts.get('details'), 'summary:', w.counts.get('summary'))

# duplicate ids inside the region up to the close
end = start + 400000
if w.done_at:
    # cut at the matching close of the outer <details>
    lines = region.split('\n')
    end = start + sum(len(x) + 1 for x in lines[:w.done_at[0]])
ids = re.findall(r'\sid="([^"]+)"', s[start:end])
dupes = sorted({i for i in ids if ids.count(i) > 1})
print('ids in region:', len(ids), 'duplicates:', dupes)
