"""
Close the tab-icon item - every one of its three claims is false on the shipped build - and give the
air-gapped item today's numbers.

The icon item said three things. I extracted the icon out of the shipped file and looked at it:

  "the icon is the wrong mark"        FALSE. The 256px image is three rules ending in a square, a
                                      circle and a diamond - exactly the brand guide's symbol.
  "the app embeds none of the         FALSE. A five-size .ico data URI is embedded: 16, 32, 48, 64
   brand files"                       and 256, PNG at every size, 12,489 bytes.
  "a theme-color... there is none"    FALSE. <meta name="theme-color" content="#071B33">.

That is my own item, written from a reading rather than from the file, and it has been sitting on
the list telling us to fix something already correct.

The air-gapped item stands, and is now measured rather than reasoned: through boot, typing a
diagram, changing theme, opening Docs and opening the export dialog, the app makes ZERO external
requests. Only ELK reaches out, and only when chosen - three requests to jsdelivr. unpkg.com is
granted in the policy and never used at all, because the Mermaid it exists to fetch is embedded.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch(
    "1. the icon item was wrong three times over",

    "        <div class=\"body\"><b>The tab icon is not the brand mark</b>\n"
    "          <p><b>The title half of this is done</b> &#8212; the window carries the diagram you are "
    "in, and since 1.70.0 it prefers the name you typed over the one the app generates, keeping up "
    "while you are still typing it. What is left is the icon.</p>\n"
    "          <p><b>The icon is the wrong mark:</b> your brand guide says the symbol is three rules "
    "ending in a <i>square, a circle and a diamond</i>; the one in the tab has three rules all ending "
    "in squares, on a white tile, in a dark tab strip. The pack already contains "
    "<code>ico/favicon.ico</code> for 16&#8211;48 px and <code>06_siren_app_icon_dark.svg</code> made "
    "for exactly this &#8212; and the app embeds <b>none</b> of the brand files. A "
    "<code>theme-color</code> would tint the browser chrome to match; there is none.</p></div>\n"
    "        <div class=\"effort\">next</div>",

    "        <div class=\"body\"><b>The tab icon &#8212; closed, and it was wrong three times over</b>\n"
    "          <p><b>This item was mine, and none of it was true.</b> I wrote it from a reading rather "
    "than from the file. Extracted the icon out of the shipped build and looked at it: the mark is "
    "three rules ending in a <i>square, a circle and a diamond</i> &#8212; the brand guide's symbol, "
    "not three squares. It is embedded, as a five-size <code>.ico</code> data URI at 16, 32, 48, 64 "
    "and 256px, PNG at every size, 12,489 bytes. And <code>&lt;meta name=&quot;theme-color&quot; "
    "content=&quot;#071B33&quot;&gt;</code> is there.</p>\n"
    "          <p>The title half closed in 1.70.0. Nothing is left. The lesson is the item itself: "
    "look at the thing before writing down what is wrong with it.</p></div>\n"
    "        <div class=\"effort\">closed</div>",
)

patch(
    "2. the air-gapped item carries today's measurement",

    "          <p>Verified in the shipped 1.67.0: the Content-Security-Policy allows "
    "<code>cdn.jsdelivr.net</code> and <code>unpkg.com</code> for both <code>script-src</code> and "
    "<code>connect-src</code>. Nothing reaches for them unless you choose the ELK layout engine "
    "&#8212; but the permission is there, in a file you open with client material in it.",

    "          <p>Still true on 1.70.0: the Content-Security-Policy allows "
    "<code>cdn.jsdelivr.net</code> and <code>unpkg.com</code> for both <code>script-src</code> and "
    "<code>connect-src</code>. <b>Measured today rather than reasoned about</b> &#8212; through boot, "
    "typing a diagram, changing theme, opening Docs and opening the export dialog, the app makes "
    "<b>zero</b> external requests. Only ELK reaches out, and only when you choose it: three GETs to "
    "jsdelivr. <b><code>unpkg.com</code> is granted and never used at all</b>, because the Mermaid it "
    "exists to fetch has been embedded since 1.51.0 &#8212; a permission with no purpose. But the "
    "permission is there, in a file you open with client material in it.",
)

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
