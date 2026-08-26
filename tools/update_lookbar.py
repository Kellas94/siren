"""The owner answered the open question: three, personally. That fires the condition and settles it."""
import io, os

P = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad\the_list.html'
s = io.open(P, encoding='utf-8').read()

OLD = (
    '<b class="t">The Look bar, and delete the depth it replaces</b>\n'
    '          <p>One visible row above the preview; each chip shows its <i>current value</i> and expands in\n'
    '          place. Prototype measured: 47px at rest, 193px open, never covers the drawing. Removes a\n'
    '          nested fold level, the hidden <code>\u2699 Style</code> button, the Inspect row and the duplicate\n'
    '          direction control. <b>One question first:</b> if what you touch most is three controls rather\n'
    '          than nine, put those three flat with no expansion \u2014 40px, zero clicks, and it wins outright.</p>'
)

NEW = (
    '<b class="t">A flat Look bar \u2014 three controls, nothing to open</b>\n'
    '          <p><b>Answered on 26 August: three, personally.</b> That fires the condition the\n'
    '          investigation set, and settles it \u2014 a flat row wins outright at three, so the expandable\n'
    '          chip bar is out. About 40px, zero clicks, no tray, nothing to learn. The prototype at\n'
    '          <code>prototypes/look_bar.html</code> stays as evidence of what was compared, not as the\n'
    '          thing to build.</p>\n'
    '          <p>Still removes what it was going to remove: a nested fold level, the hidden\n'
    '          <code>\u2699 Style</code> button and the rule that hides it, the Inspect menu row, and the\n'
    '          duplicate flow-direction control. <b>One thing still open:</b> WHICH three. That is now\n'
    '          the only question between here and building it.</p>'
)

assert s.count(OLD) == 1, 'anchor'
io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW))
print('plan updated: the chip bar is out, the flat bar is in')
