import io, difflib, os

F = os.path.dirname(os.path.abspath(__file__))
a = io.open(os.path.join(F, 'before.html'), encoding='utf-8', newline='').read()
b = io.open(os.path.join(F, 'app.html'), encoding='utf-8', newline='').read()
tag = "APP_VERSION = '1.63.6'"
print('APP_VERSION occurrences:', a.count(tag), b.count(tag))
print('CHANGELOG occurrences:', a.count('CHANGELOG'), b.count('CHANGELOG'))
la = a.split(chr(10)); lb = b.split(chr(10))
print('lines', len(la), '->', len(lb))
sm = difflib.SequenceMatcher(None, la, lb, autojunk=False)
for t, i1, i2, j1, j2 in sm.get_opcodes():
    if t != 'equal':
        print(t, i1, i2, '->', j1, j2)
        for ln in lb[j1:j2][:3]:
            print('   +', ln[:110])
print('bytes', len(a.encode('utf-8')), '->', len(b.encode('utf-8')), 'delta', len(b.encode('utf-8')) - len(a.encode('utf-8')))
print('chars delta', len(b) - len(a))
