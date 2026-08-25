r"""Board: overlapping renders duplicated sections and cards.

renderWorkspacePreviews is async and starts with replaceChildren(). When three renders were
kicked off in one tick (collapse three projects at once, create folders quickly), each
stale render resumed after its first await and kept appending the NEXT group's section and
cards to the live grid - the guard lived only inside mountWorkspacePreviewCard. Measured:
three collapses in one tick -> three Unfiled sections and 15 cards for 6 diagrams.
Now every loop iteration re-checks the request id after the await and stops when stale.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

rep("""            for (const group of groups) {
              const mounted = createWorkspacePreviewGroup(group, columns);
              if (group.collapsed) { shelf.appendChild(mounted.section); continue; }
              el.multiPreviewGrid.appendChild(mounted.section);
              for (const diagram of group.diagrams) {
                await mountWorkspacePreviewCard(mounted.grid, diagram, requestId, renderIndex++);
              }
            }""",
    """            for (const group of groups) {
              // A newer render has replaced the grid: this one must not keep appending to it.
              if (requestId !== workspacePreviewRequestId) return;
              const mounted = createWorkspacePreviewGroup(group, columns);
              if (group.collapsed) { shelf.appendChild(mounted.section); continue; }
              el.multiPreviewGrid.appendChild(mounted.section);
              for (const diagram of group.diagrams) {
                await mountWorkspacePreviewCard(mounted.grid, diagram, requestId, renderIndex++);
                if (requestId !== workspacePreviewRequestId) return;
              }
            }""")

rep("""          for (const diagram of diagrams) {
            await mountWorkspacePreviewCard(el.multiPreviewGrid, diagram, requestId, renderIndex++);
          }
        }
        syncWorkspaceSelectionBar();""",
    """          for (const diagram of diagrams) {
            await mountWorkspacePreviewCard(el.multiPreviewGrid, diagram, requestId, renderIndex++);
            if (requestId !== workspacePreviewRequestId) return;
          }
        }
        syncWorkspaceSelectionBar();""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_board_stale.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('board stale-render fix applied: %d -> %d chars' % (len(orig), len(s)))
