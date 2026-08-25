import io, os
LF = chr(10)
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (repr(a[:90]), s.count(a))
    s = s.replace(a, b)

# The active diagram's fields are mirrored in state; writing only the stored copy
# lets the next sync overwrite it with the default source.
rep("          diagram.name = entry.name.slice(0, 60);" + LF +
    "          diagram.diagramTitle = diagram.name;" + LF +
    "          diagram.source = entry.source;" + LF +
    "          el.source.value = entry.source;" + LF +
    "          applyStateToActiveDiagramControls();",
    "          diagram.name = entry.name.slice(0, 60);" + LF +
    "          diagram.diagramTitle = diagram.name;" + LF +
    "          diagram.source = entry.source;" + LF +
    "          state.source = entry.source;" + LF +
    "          state.diagramTitle = diagram.name;" + LF +
    "          el.source.value = entry.source;" + LF +
    "          applyStateToActiveDiagramControls();" + LF +
    "          syncStateFromControls();")

rep("            diagram.name = `${model.name.slice(0, 40)} topics`;" + LF +
    "            diagram.diagramTitle = diagram.name;" + LF +
    "            diagram.source = source;" + LF +
    "            el.source.value = source;" + LF +
    "            applyStateToActiveDiagramControls();",
    "            diagram.name = `${model.name.slice(0, 40)} topics`;" + LF +
    "            diagram.diagramTitle = diagram.name;" + LF +
    "            diagram.source = source;" + LF +
    "            state.source = source;" + LF +
    "            state.diagramTitle = diagram.name;" + LF +
    "            el.source.value = source;" + LF +
    "            applyStateToActiveDiagramControls();" + LF +
    "            syncStateFromControls();")

assert s.count("APP_VERSION = '1.13.0'") == 1
s = s.replace("APP_VERSION = '1.13.0'", "APP_VERSION = '1.13.1'")
io.open(P + '.tmp', 'w', encoding='utf-8').write(s)
os.replace(P + '.tmp', P)
print('imported diagram sources now stick')
