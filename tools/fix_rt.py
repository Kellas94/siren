import io
p = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad\_chain_test.js'
s = io.open(p, encoding='utf-8').read()
lines = [l for l in s.split('\n') if not l.startswith('function structureEncodeLabel')]
good = "function structureEncodeLabel(v){ return String(v==null?'':v).split(String.fromCharCode(10)).join('<br/>'); }"
out = []
for l in lines:
    out.append(l)
    if l.startswith('function encodeVisualMermaidText2'):
        out.append(good)
io.open(p, 'w', encoding='utf-8').write('\n'.join(out))
print('ok')
