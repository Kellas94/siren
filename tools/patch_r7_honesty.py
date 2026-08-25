"""
Round 7 kept two promises it could not keep. This closes both.

Independent verification of Codex's round 7 found the new work correct on the fixtures it was written
for and wrong one step sideways. Measured on the real build, not asserted:

  sequence, no `participant` lines   ->  "0 participants  3 messages"   (drawing shows three people)
  sequence, one declared of three    ->  "1 participant  2 messages"
  sequence, a %% comment above       ->  "0 participants  2 messages"
  mindmap with an ::icon() line      ->  "4 nodes  3 links"             (three nodes exist)

Several other accusations did NOT reproduce and are deliberately not "fixed" here: a %% comment
counted as a gantt task, an @{} metadata suffix counted as an extra kanban card, and a mindmap
comment line - all three measured correct already. Patching them would have been churn against a
claim rather than a defect.

Why this matters more than the numbers suggest: the counter it replaced said "0 blocks  0
connections" for every code-first family. That was uniformly, visibly absurd. "0 participants  3
messages" is specific, and a specific number reads as authoritative - so on this project's standing
rule, a confidently wrong count is a regression from an obviously wrong one, even though the fixtures
improved.

Three patches:

  1. Sequence participants are harvested from the MESSAGES as well as the declarations. Mermaid
     draws a lifeline for every name it meets, and most people never write a `participant` line.
  2. A mindmap `::icon()` line decorates a node, it is not one. The existing filter excluded `:::`
     (three colons, a class assignment) and missed `::` (two colons, an icon).
  3. The code-only chip re-writes its sentence when the diagram family changes. It was composed once
     inside `if (!chip)`, behind an early return, so switching from a git graph to a pie left
     "right-click for fit, size, export and branch colours" floating over a pie chart whose menu has
     no colour row - the exact defect job AH existed to remove.

Anchor-guarded, not SHA-pinned. Apply AFTER Codex's AE and AH.

Usage: python patch_r7_honesty.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


# ------------------------------------------------------------------ 1. implicit participants
patch(
    "1. sequence participants counted from messages, not only declarations",
    "          const participants = new Set();\n"
    "          lines.forEach(line => {\n"
    "            const declared = /^\\s*(?:participant|actor)\\s+(?:\"([^\"]+)\"|(\\S+))/i.exec(line);\n"
    "            if (declared) participants.add(declared[1] || declared[2]);\n"
    "          });",

    "          const participants = new Set();\n"
    "          lines.forEach(line => {\n"
    "            const declared = /^\\s*(?:participant|actor)\\s+(?:\"([^\"]+)\"|(\\S+))/i.exec(line);\n"
    "            if (declared) participants.add(declared[1] || declared[2]);\n"
    "          });\n"
    "          // Most people never write a `participant` line at all - they simply send messages, and\n"
    "          // Mermaid gives a lifeline to every name it meets. Counting only declarations printed\n"
    "          // \"0 participants\" beside a picture of Alice, Bob and Carol.\n"
    "          lines.forEach(line => {\n"
    "            const body = line.replace(/%%.*$/, '');\n"
    "            const colon = body.indexOf(':');\n"
    "            if (colon < 0) return;\n"
    "            // Split on the arrow rather than on whitespace: names carry hyphens (Front-end),\n"
    "            // activation markers (+Bob, -Alice) and quotes, and a Note line has no arrow at all,\n"
    "            // which is what keeps notes and blocks out of the count.\n"
    "            const sides = /^(.*?)\\s*(?:<<)?-{1,2}(?:>>|>|x|\\))\\s*(.*)$/.exec(body.slice(0, colon));\n"
    "            if (!sides) return;\n"
    "            [sides[1], sides[2]].forEach(side => {\n"
    "              const name = /^[+-]?\\s*(?:\"([^\"]+)\"|([^\\s,:]+))/.exec(String(side).trim());\n"
    "              if (name) participants.add(name[1] || name[2]);\n"
    "            });\n"
    "          });",
)

# ------------------------------------------------------------------ 2. ::icon is not a node
patch(
    "2. a mindmap ::icon() line is a decoration, not a node",
    "            .filter(line => line.trim() && !/^\\s*%%/.test(line) && !/^\\s*:::/i.test(line));",
    "            // Two colons, not three: `:::class` was already excluded, `::icon(fa fa-book)` was\n"
    "            // being counted as a node of its own. Both are decorations on the node above them.\n"
    "            .filter(line => line.trim() && !/^\\s*%%/.test(line) && !/^\\s*::/.test(line));",
)

# ------------------------------------------------------------------ 3. the chip stops going stale
patch(
    "3. the code-only chip re-words itself when the family changes",
    "        if (state.codeOnlyHintSeen) return;\n",
    "        // The sentence below is composed inside `if (!chip)`, so it was written once for\n"
    "        // whatever family happened to be on screen at that instant and never revised. Switching\n"
    "        // from a git graph to a pie chart within the chip's nine seconds left it promising\n"
    "        // branch colours over a diagram whose menu has no colour row - the exact over-promise\n"
    "        // this chip was rewritten to remove.\n"
    "        if (codeOnlyHintEl) {\n"
    "          const said = codeOnlyHintEl.querySelector('span');\n"
    "          if (said) said.textContent = codeOnlyHintSentence(type);\n"
    "        }\n"
    "        if (state.codeOnlyHintSeen) return;\n",
)

patch(
    "4. the sentence becomes one function, so it cannot be written two ways",
    "          const text = document.createElement('span');\n"
    "          text.textContent = type === 'gitgraph'\n"
    "            ? 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size, export and branch colours'\n"
    "            : 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size and export';",
    "          const text = document.createElement('span');\n"
    "          text.textContent = codeOnlyHintSentence(type);",
)

patch(
    "5. define that function next to the one that uses it",
    "      function codeOnlyMaybeShowHint() {",
    "      /* One sentence, one place. Branch colours are named only for the family whose right-click\n"
    "         menu actually offers them, and because both the first write and every later revision go\n"
    "         through here, the two can never disagree. */\n"
    "      function codeOnlyHintSentence(type) {\n"
    "        return type === 'gitgraph'\n"
    "          ? 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size, export and branch colours'\n"
    "          : 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size and export';\n"
    "      }\n"
    "\n"
    "      function codeOnlyMaybeShowHint() {",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
