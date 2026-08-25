import io
import re

P = r'C:\Users\tsinc\Downloads\t_industries_siren_v24.html'
s = io.open(P, encoding='utf-8').read()

pattern = re.compile(r'id="nodeDocNewButton" type="button">.*? Write a workpaper')
m = pattern.search(s)
print('found:', repr(m.group(0)) if m else None)
s = pattern.sub('id="nodeDocNewButton" type="button">\uff0b Write a workpaper', s)
io.open(P, 'w', encoding='utf-8').write(s)
m2 = re.search(r'nodeDocNewButton" type="button">(.{1,8}) Write', io.open(P, encoding='utf-8').read())
print('now:', repr(m2.group(1)))
