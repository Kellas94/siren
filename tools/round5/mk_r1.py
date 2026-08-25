import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, setw, SMALL

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 10000})
S.append({"js": BOOT, "name": "R01_boot"})
S.append({"js": seed(SMALL), "name": "R02_seed"})
S.append({"js": OPEN, "name": "R03_open"})
S.append({"js": TB, "name": "R04_first_open_tb"})
S.append({"js": GUIDED, "name": "R05_guided"})
S.append({"js": TB, "name": "R06_guided_tb"})
S.append({"js": OPEN, "name": "R07_recentre"})
S.append({"js": TB, "name": "R08_after_recentre_guided"})
S.append({"shot": "r08_recentre_guided_1200.png"})
S.append({"js": TEXT, "name": "R09_text"})
S.append({"js": TB, "name": "R10_after_recentre_text"})
S.append({"shot": "r10_recentre_text_1200.png"})
S.append({"js": GUIDED, "name": "R11_guided_again"})
# width sweep in Guided across the reported 562-663 band and either side of it
for w in (700, 670, 663, 660, 640, 624, 600, 570, 563, 561, 560, 520, 470, 430):
    S.append({"js": setw(w), "name": "R12_guided_w%d" % w})
S.append({"js": TEXT, "name": "R13_text"})
for w in (663, 624, 561):
    S.append({"js": setw(w), "name": "R14_text_w%d" % w})
S.append({"js": STATE, "name": "R15_state"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_r1.json', 'w'), indent=1)
print(len(S))
