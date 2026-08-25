import io, re, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8', newline='').read()
start = s.index('<details class="card" id="settingsSection">')
# walk forward counting details/div
i = start
depth = {'div': 0, 'details': 0}
stack = []
tag_re = re.compile(r'<(/?)(div|details|summary)\b[^>]*?(/?)>', re.I)
end = None
for m in tag_re.finditer(s, start):
    closing, name, self_closing = m.group(1), m.group(2).lower(), m.group(3)
    if self_closing:
        continue
    if name == 'summary':
        continue
    if not closing:
        stack.append((name, m.start()))
    else:
        if not stack:
            print('UNBALANCED close', name, 'at', m.start()); break
        top = stack.pop()
        if top[0] != name:
            print('MISMATCH: opened', top[0], 'closed', name, 'near', s[m.start()-120:m.start()+40].replace('\n', '\\n'))
            break
        if not stack:
            end = m.end()
            break
if end:
    print('settingsSection balanced. length', end - start)
    print('closing text:', repr(s[end-60:end]))
else:
    print('did not close cleanly; stack depth', len(stack))
    for n, pos in stack[:10]:
        print('  open', n, repr(s[pos:pos+70]))
