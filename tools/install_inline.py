import io, os
LF = chr(10)
BASE = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
module = io.open(os.path.join(BASE, 'structure_inline.js'), encoding='utf-8').read().rstrip() + LF + LF

# replace the old form-row renderer with the inline code renderer
a = s.index('      function renderStructureEditor() {')
b = s.index('      function setStructureMode(on) {')
s = s[:a] + module + s[b:]

# the old form controls are no longer used anywhere
c = s.index('      function structureSelect(')
d = s.index('      function structureRenameId(')
assert 0 < c < d and d - c < 6000
s = s[:c] + s[d:]

io.open(P + '.tmp', 'w', encoding='utf-8').write(s)
os.replace(P + '.tmp', P)
print('inline renderer installed; form controls removed')
