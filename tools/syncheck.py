r"""Syntax gate for the single-file app: extract every inline <script> and run node --check.

    python syncheck.py                 # checks the live file
    python syncheck.py <path.html>     # checks THAT file

Two bugs lived here until 2026-08-23 and both silently invalidated verification:
  * the path was hardcoded to the live file and argv[1] was ignored, so every
    "syncheck on my working copy" was really re-checking live and always passed;
  * the extracted JavaScript went to one shared temp path, so two agents checking
    at the same time overwrote each other's file and checked each other's code.
The target is now the argument, and the temp file is named after it.
"""
import io, re, subprocess, sys, os, hashlib, tempfile

LIVE = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else LIVE
    target = os.path.abspath(target)
    if not os.path.exists(target):
        print('syncheck: no such file:', target)
        return 2
    s = io.open(target, encoding='utf-8').read()
    blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', s, re.S)
    print('file:', target)
    print('script blocks:', len(blocks), 'chars:', sum(len(b) for b in blocks))
    if not blocks:
        print('syncheck: no inline script found - is this the app file?')
        return 2
    # Named after the target so two checks running at once cannot overwrite each other.
    stamp = hashlib.sha1(target.encode('utf-8')).hexdigest()[:12]
    out = os.path.join(tempfile.gettempdir(), 'siren_syncheck_%s.js' % stamp)
    io.open(out, 'w', encoding='utf-8').write('\n;\n'.join(blocks))
    r = subprocess.run(['node', '--check', out], capture_output=True, text=True)
    print('node --check exit', r.returncode)
    if r.stdout.strip():
        print(r.stdout[-3000:])
    if r.stderr.strip():
        print(r.stderr[-3000:])
    try:
        os.remove(out)
    except OSError:
        pass
    return r.returncode

if __name__ == '__main__':
    sys.exit(main())
