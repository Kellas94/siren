import io, os, sys, hashlib

# The Docs repair regrouped the block context menu: the two insert rows moved under an
# "Insert" heading and dropped the repeated verb, so "Insert a block above..." now reads
# "+ A block above...". Measured on an Agent spec document, with and without the repair:
#   before  7 rows: comment, Insert a block above/below, Move up/down, Mark as..., Delete
#   after  12 rows: comment, Copy as Markdown, Duplicate, Turn into, Move up/down/top/bottom,
#                   A block above/below (under INSERT), Mark as..., Delete
# Nothing was lost - the role row and both inserts are still there - so the contract is
# "both inserts are reachable from this menu", not the exact wording. This pins the contract
# and stops pinning the sentence.

F = sys.argv[1] if len(sys.argv) > 1 else r'C:\Claude\SIREN\codex\qa_round3\surface_suite_additions.js'
s = io.open(F, encoding='utf-8', newline='').read()
before = len(s)

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

OLD = """        /block 1 of \\d+/i.test(blockMenu.text)
          && ['comment', 'Insert a block above', 'Insert a block below', 'Move down', 'Mark as purpose', 'Delete block']
            .every(label => blockMenu.text.toLowerCase().includes(label.toLowerCase())),
        ['block 1 of N', 'comment', 'insert above/below', 'move', 'role', 'delete'], blockMenu.text,"""

NEW = """        /block 1 of \\d+/i.test(blockMenu.text)
          && /insert/i.test(blockMenu.text)
          && /a block above/i.test(blockMenu.text)
          && /a block below/i.test(blockMenu.text)
          && ['comment', 'Move down', 'Mark as purpose', 'Delete block']
            .every(label => blockMenu.text.toLowerCase().includes(label.toLowerCase())),
        ['block 1 of N', 'comment', 'insert above/below', 'move', 'role', 'delete'], blockMenu.text,"""

rep(OLD, NEW)

tmp = F + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, F)
print('applied %d -> %d' % (before, len(s)))
print('new sha256 %s' % hashlib.sha256(io.open(F, 'rb').read()).hexdigest().upper())
