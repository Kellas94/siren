import io, os, shutil

SC = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'

shutil.copyfile(P, os.path.join(os.environ.get('TEMP', SC), 'siren_backup_cup6.html'))

s = io.open(P, encoding='utf-8').read()
orig = s


def bounds(key):
    """The scene entry plus the comment block that introduces it. The last entry in
    AMBIENT_SCENES closes without a comma, so both terminators are allowed."""
    marker = '\n        %s: {\n          settleFrames:' % key
    i = s.index(marker)
    head = s.rindex('/* ', 0, i)
    start = s.rindex('\n', 0, head) + 1
    pos = i + 1
    while True:
        eol = s.index('\n', pos)
        if s[pos:eol] in ('        },', '        }'):
            return start, eol + 1
        pos = eol + 1


a, b = bounds('cupertino')
body = io.open(os.path.join(SC, 'scene_v7_cupertino.js'), encoding='utf-8').read().rstrip('\n')
assert '\n        cupertino: {' in body or body.lstrip().startswith('/*'), 'scene body missing its key'
if not body.rstrip().endswith(','):
    body += ','
s = s[:a] + body + '\n' + s[b:]

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('cupertino v6 installed: %d -> %d bytes' % (len(orig), len(s)))
