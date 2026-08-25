r"""integrate.py - apply agent patch scripts to a copy, in order, with the syntax gate after each.

    python C:\Claude\SIREN\tools\integrate.py <base.html> <out.html> <patch1.py> [<patch2.py> ...]

Each patch script must take the target file path as its only argument (the convention in
AGENT_CONVENTIONS.md). After every patch: node --check via syncheck.py. On the first failure
the run stops, the failing patch is named, and out.html holds the last GOOD state (the failed
patch's output is discarded). Prints size deltas so a suspiciously large or zero delta stands out.
"""
import io, os, shutil, subprocess, sys

def main():
    if len(sys.argv) < 4:
        print(__doc__); return 2
    base, out = sys.argv[1], sys.argv[2]
    patches = sys.argv[3:]
    tools = os.path.dirname(os.path.abspath(__file__))
    syncheck = os.path.join(tools, 'syncheck.py')
    shutil.copyfile(base, out)
    good = out + '.good'
    shutil.copyfile(out, good)
    for p in patches:
        before = os.path.getsize(out)
        r = subprocess.run([sys.executable, p, out], capture_output=True, text=True)
        print('--- %s' % os.path.basename(p))
        print((r.stdout or '').strip()[-400:])
        if r.returncode != 0:
            print((r.stderr or '').strip()[-800:])
            shutil.copyfile(good, out)
            print('FAILED to apply: %s (out restored to last good)' % p); return 1
        c = subprocess.run([sys.executable, syncheck, out], capture_output=True, text=True)
        # The return code, not the text: a gate that can pass on a substring is not a gate.
        ok = c.returncode == 0
        print('syncheck:', 'ok' if ok else 'FAIL', '| bytes %d -> %d (%+d)' % (before, os.path.getsize(out), os.path.getsize(out) - before))
        if not ok:
            print((c.stdout + c.stderr).strip()[-800:])
            shutil.copyfile(good, out)
            print('SYNTAX FAIL after: %s (out restored to last good)' % p); return 1
        shutil.copyfile(out, good)
    os.remove(good)
    print('ALL APPLIED: %d patches -> %s (%d bytes)' % (len(patches), out, os.path.getsize(out)))
    return 0

if __name__ == '__main__':
    sys.exit(main())
