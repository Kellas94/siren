#!/usr/bin/env python3
"""Wave-2 consolidated installer for T_Industries_SIREN.

Applies, in order, the three implementer patch scripts plus the one
integration fix found while verifying them together:

  1. fix_header.py           - header/tab-strip rework   (28 guarded edits)
  2. fix_editor.py           - editor-pane rework        (51 guarded edits)
  3. fix_dialogs.py          - dialog rework             (66 guarded edits)
  4. fix_structmenu_away.py  - openStructureMenu leaked its outside-mousedown
                               listener on programmatic close, which made the
                               SECOND consecutive use of the new diagram
                               "..." menu (and any other struct menu) go dead
                               (2 guarded edits)

Every edit asserts its anchor's occurrence count before replacing, so drift
in the target file aborts the run. The whole wave is all-or-nothing: the
scripts run against a private temporary copy and the target is replaced in
one os.replace only after all four succeed - a failure anywhere leaves the
target byte-identical.

usage: python install_wave2.py <target.html>
"""
import io, os, shutil, subprocess, sys, tempfile

SCRIPTS = [
    'fix_header.py',
    'fix_editor.py',
    'fix_dialogs.py',
    'fix_structmenu_away.py',
]

def main():
    if len(sys.argv) != 2:
        sys.exit('usage: python install_wave2.py <target.html>')
    target = os.path.abspath(sys.argv[1])
    here = os.path.dirname(os.path.abspath(__file__))
    missing = [s for s in SCRIPTS if not os.path.exists(os.path.join(here, s))]
    if missing:
        sys.exit('missing sibling script(s): ' + ', '.join(missing))

    # Work on a private copy in the target's directory so the final
    # os.replace stays on one filesystem and is atomic.
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), suffix='.wave2.tmp')
    os.close(fd)
    try:
        shutil.copyfile(target, tmp)
        for script in SCRIPTS:
            proc = subprocess.run(
                [sys.executable, os.path.join(here, script), tmp],
                capture_output=True, text=True, encoding='utf-8', errors='replace')
            if proc.returncode != 0:
                sys.stderr.write(proc.stdout or '')
                sys.stderr.write(proc.stderr or '')
                sys.exit(f'{script} FAILED (exit {proc.returncode}) - '
                         'target left untouched.')
            # Each script lists what it applied, one indented name per line
            # (fix_header/fix_structmenu_away prefix a dash, fix_editor and
            # fix_dialogs do not) - count both shapes.
            applied = [ln for ln in (proc.stdout or '').splitlines()
                       if ln.startswith('  ') and ln.strip()]
            print(f'{script}: {len(applied)} edits applied')
        os.replace(tmp, target)
        tmp = None
        print(f'wave 2 installed into {target}')
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)

if __name__ == '__main__':
    main()
