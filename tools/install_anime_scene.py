#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Replace the AMBIENT_SCENES anime entry with THE TWILIGHT CITY scene.

Usage: python install_anime_scene.py <target.html>

Anchors are located structurally in the CURRENT file content (never line
numbers). On any anchor mismatch the script aborts WITHOUT writing. After a
successful write every inline <script> is syntax-checked with node --check;
a failure restores the original bytes.
"""
import io, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

def fail(msg):
    print("ABORT: " + msg)
    sys.exit(2)

def main():
    if len(sys.argv) != 2:
        fail("usage: install_anime_scene.py <target.html>")
    target = sys.argv[1]
    with io.open(target, "r", encoding="utf-8", newline="") as f:
        html = f.read()
    with io.open(os.path.join(HERE, "scene_anime_v2.js"), "r", encoding="utf-8", newline="") as f:
        payload = f.read().rstrip("\n") + "\n"

    if "THE TWILIGHT CITY v2" in html:
        print("SKIP: scene already installed")
        return

    # 1. locate AMBIENT_SCENES object bounds
    a = html.find("const AMBIENT_SCENES = {")
    if a < 0:
        fail("AMBIENT_SCENES literal not found")
    engine = html.find("/* ---------------- engine ---------------- */", a)
    if engine < 0:
        fail("engine marker not found after AMBIENT_SCENES")

    # 2. locate the anime entry inside it (exactly one)
    hits = [m.start() for m in re.finditer(r"\n        anime: \{", html[a:engine])]
    if len(hits) != 1:
        fail("expected exactly 1 anime entry inside AMBIENT_SCENES, found %d" % len(hits))
    start = a + hits[0] + 1          # first char of "        anime: {"
    open_brace = html.index("{", start)

    # 3. brace-match (the entry contains no strings with braces that unbalance;
    #    still, walk strings/comments defensively)
    i, depth, n = open_brace, 0, len(html)
    mode = None  # None | "'" | '"' | '`' | '//' | '/*'
    while i < n:
        ch = html[i]
        if mode is None:
            if ch in "'\"`":
                mode = ch
            elif ch == "/" and html[i+1:i+2] == "/":
                mode = "//"
            elif ch == "/" and html[i+1:i+2] == "*":
                mode = "/*"
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
        elif mode in ("'", '"', "`"):
            if ch == "\\":
                i += 1
            elif ch == mode:
                mode = None
        elif mode == "//":
            if ch == "\n":
                mode = None
        elif mode == "/*":
            if ch == "*" and html[i+1:i+2] == "/":
                mode = None
                i += 1
        i += 1
    if depth != 0:
        fail("brace matching failed for anime entry")
    end = i + 1
    if html[end:end+1] == ",":
        end += 1
    # keep the newline after the trailing comma out of the replacement
    old = html[start:end]
    if "settleFrames" not in old[:200]:
        fail("anime entry does not look like a scene entry: %r" % old[:80])

    body = payload.rstrip("\n")
    if not body.endswith("},"):
        fail("payload must end with '},'")
    out = html[:start] + body + html[end:]

    backup = html
    with io.open(target, "w", encoding="utf-8", newline="") as f:
        f.write(out)

    # 4. syntax-check every inline script with node --check
    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", out, re.S | re.I)
    ok = True
    for k, s in enumerate(scripts):
        if not s.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tf:
            tf.write(s)
            tmp = tf.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, shell=False)
        os.unlink(tmp)
        if r.returncode != 0:
            print("node --check failed on inline script %d:\n%s" % (k, r.stderr[:2000]))
            ok = False
            break
    if not ok:
        with io.open(target, "w", encoding="utf-8", newline="") as f:
            f.write(backup)
        fail("syntax check failed; original restored")
    print("OK: anime scene replaced (%d -> %d chars), %d inline scripts checked"
          % (len(old), len(body), len(scripts)))

if __name__ == "__main__":
    main()
