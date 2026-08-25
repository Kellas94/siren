import io, os
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8', newline='').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:70])
    s = s.replace(old, new)
# Touch pointers are implicitly captured by the element under the finger; moving the
# capture to the card/host makes that child's lostpointercapture bubble up, which read
# as "the drag was taken away". Only the card's (host's) own loss counts.
rep("""        card.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        card.addEventListener('lostpointercapture', () => { if (dragging) { pointer = null; teardown(); } });
      }
""", """        card.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        // A touch is implicitly captured by the element under the finger; taking the
        // capture for the card makes that child's lostpointercapture bubble through
        // here. Only the card's own loss means the drag was taken away.
        card.addEventListener('lostpointercapture', event => {
          if (event.target === card && dragging) { pointer = null; teardown(); }
        });
      }
""")
rep("""        host.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        host.addEventListener('lostpointercapture', () => { if (dragging) { pointer = null; teardown(); } });
      }
""", """        host.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        host.addEventListener('lostpointercapture', event => {
          if (event.target === host && dragging) { pointer = null; teardown(); }
        });
      }
""")
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('patched 2 edits')
