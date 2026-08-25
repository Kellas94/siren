import io, os
BS, LF = chr(92), chr(10)
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
bad1 = ".replace(/[|" + LF + "]/g, ' ')"
good1 = ".replace(/[|" + BS + "n]/g, ' ')"
bad2 = ".replace(/<br" + BS + "s*" + BS + "/?>/gi"
n1 = s.count(bad1)
s = s.replace(bad1, good1)
# the <br> regex: rebuild it correctly whatever arrived
import re
m = re.search(r"\.replace\(/<br[^/]{0,6}/\?>/gi", s)
print('br regex found:', bool(m), 'newline-in-class fixed:', n1)
io.open(P + '.tmp', 'w', encoding='utf-8').write(s)
os.replace(P + '.tmp', P)
