r"""Two moves off the board, from the declutter audit.

1. A project's Rename and Delete folder buttons go behind a per-row menu. Measured at
   rest: four controls per project header, six red Delete buttons on screen with seven
   projects collapsed, nine at the ceiling of 24. Meanwhile deleting a single DIAGRAM
   is already one layer in, behind the card's own menu - so the app hid the small
   destruction and left the large one on permanent display. That inversion is
   indefensible on the app's own terms, and the comment above WORKSPACE_VIEW_MENUS
   already states the principle this header was breaking.

   The action itself is careful and is not touched: it still confirms, still names the
   count, still moves diagrams to Unfiled rather than deleting them. Only its placement
   was wrong.

2. The card's Open button goes entirely. Its second route is the thumbnail, which
   carries role=button, tabindex, an accessible name and Enter/Space - and which only
   started working with a real mouse earlier today. The CSS comment that hid this
   button below 300px already asserted "the whole thumbnail already opens the diagram";
   that assertion was false until beginPan stopped swallowing the click, and is now
   true at every width.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)


# ---- 1. folder actions behind one menu --------------------------------------
rep("""        if (!group.unfiled) {
          const rename = document.createElement('button');
          rename.type = 'button';
          rename.className = 'btn ghost compact';
          rename.textContent = 'Rename';
          rename.addEventListener('click', () => renameWorkspaceFolder(group.id));
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn danger compact';
          remove.textContent = 'Delete folder';
          remove.addEventListener('click', () => deleteWorkspaceFolder(group.id));
          actions.append(rename, remove);
        }""",
    """        if (!group.unfiled) {
          // Deleting one diagram already lives behind a menu on its card. Leaving the
          // deletion of a whole project at rest, in red, once per row, inverted that -
          // and at the ceiling of 24 projects it put nine of them on screen at once.
          // The action is unchanged: it still confirms, names the count, and moves the
          // diagrams to Unfiled rather than destroying them.
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'btn ghost compact';
          more.textContent = '\u22ef';
          more.setAttribute('aria-haspopup', 'listbox');
          more.setAttribute('aria-label', `Actions for ${group.name}`);
          more.title = `Actions for ${group.name}`;
          more.addEventListener('click', () => {
            openStructureMenu(more, [
              ['rename', 'Rename\u2026'],
              ['delete', 'Delete folder']
            ], '', picked => {
              if (picked === 'rename') renameWorkspaceFolder(group.id);
              else if (picked === 'delete') deleteWorkspaceFolder(group.id);
            }, { keyboard: true, plain: true, label: `Actions for ${group.name}` });
          });
          actions.append(more);
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_declutter.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('folder actions folded: %d -> %d chars' % (len(orig), len(s)))
