import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
before = len(s)

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

OLD = """          input.value = block.text;
          input.addEventListener('input', () => { block.text = input.value.slice(0, 300); touchWorkpaper(doc); });
"""

NEW = """          input.value = block.text;
          // A heading holds a fixed number of characters. The field used to accept more and
          // quietly keep only the first 300, so the tail disappeared at the next repaint with
          // nothing said. Now the field itself stops at the cap - what is on screen is what is
          // stored - and anything that did not fit is named out loud rather than dropped.
          const headingCap = workpaperHeadingLimit();
          input.maxLength = headingCap;
          let headingFullSaidAt = 0;
          input.addEventListener('paste', event => {
            const source = event.clipboardData;
            const pasted = source ? String(source.getData('text') || '') : '';
            if (!pasted) return;
            const selected = Math.abs((input.selectionEnd || 0) - (input.selectionStart || 0));
            const room = Math.max(headingCap - (input.value.length - selected), 0);
            if (pasted.length <= room) return;
            const lost = pasted.length - room;
            showToast('A heading holds ' + headingCap + ' characters, so the last ' + lost + ' of what you pasted did not fit. Nothing already in the heading was replaced.', 'warning');
          });
          input.addEventListener('keydown', event => {
            if (!event.key || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
            if (input.value.length < headingCap) return;
            if ((input.selectionEnd || 0) !== (input.selectionStart || 0)) return;
            const now = performance.now();
            if (now - headingFullSaidAt < 4000) return;
            headingFullSaidAt = now;
            showToast('This heading is full at ' + headingCap + ' characters. Longer wording belongs in a paragraph under it.', 'info');
          });
          input.addEventListener('input', () => { block.text = input.value.slice(0, headingCap); touchWorkpaper(doc); });
"""

rep(OLD, NEW)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied %d -> %d delta %d' % (before, len(s), len(s) - before))
