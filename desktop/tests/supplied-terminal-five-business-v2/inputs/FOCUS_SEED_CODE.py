def focus_seed(kind='FOCUS'):
    f = PARENT.fixture()
    admitted_id = '11111111-1111-4111-8111-111111111111'
    for row in (f.ui, f.phase, f.cancelled, f.final):
        row['windowId'] = admitted_id
    f.cancelled['confirmation']['currentContext']['windowId'] = admitted_id
    for row in (f.cancelled['confirmation']['before'], f.cancelled['confirmation']['after']):
        row['url'] = 'siren://app/windows/terminal.html?windowId=' + admitted_id
    f.w = nf['World']()
    _worlds.append(f.w)
    f.facade = f.w.original
    f.raw = guardfixture['RawClock']()
    f.world = guardfixture['World'](f.raw)
    f.world.windows[202] = (10, 12, 'Edit', 0, True, True)
    helpers['install_guards'](f.w, f.world)
    f.identity.update(pid=10, image='C:\\QA\\electron.exe')
    ticks = int(f.identity['createdFileTime'])

    def times(handle, created, *unused):
        created._obj.low = ticks & 4294967295
        created._obj.high = ticks >> 32
        return 1
    f.facade._fn['GetProcessTimes'] = times
    for event in f.session['events']:
        event['processIdentity'].update(pid=10, path=f.identity['image'])
    f.dispatches = 0
    f.focusDispatches = 0

    class DualInput(nf['Fn']):

        def __call__(self, *args):
            if args[0] == 4:
                f.focusDispatches += 1
                f.ledger.append('focus-dispatch')
                return super().__call__(*args)
            assert args[0] == 2 and args[2] == 40
            events = ctypes.cast(args[1], ctypes.POINTER(f.facade._INPUT))
            assert [(events[i].type, events[i].u.ki.wVk, events[i].u.ki.dwFlags) for i in range(2)] == [(1, 27, 0), (1, 27, 2)]
            f.w.calls.append(('SendInput', args))
            f.dispatches += 1
            f.ledger.append('dispatch')
            return 2
    dual = DualInput(f.w, 'SendInput')
    f.w.dll.SendInput = dual
    f.facade._fn['SendInput'] = dual
    f.port = FNATIVE.borrow_focus_port(f.facade)
    f.controller = dict(pid=99, image='C:\\QA\\python.exe', createdFileTime='123')
    f.c.OUT = LOGICAL_ROOT / 'execution'
    f.c.DATA = LOGICAL_ROOT / 'data'
    f.c.RUNTIME = W / 'terminal-operational-four-stage-candidate-v1-20261022-image/runtime'
    f.c.JOURNAL = f.c.RUNTIME.parent / 'picker-parent-observation.jsonl'
    f.c.ENDPOINT_JOURNAL = f.c.RUNTIME.parent / 'terminal-request-endpoint.jsonl'
    f.paths = dict(journal=f.c.JOURNAL, stdout=f.c.OUT / 'electron-stdout.log', stderr=f.c.OUT / 'electron-stderr.log')
    b = dict(mainPid=10, projectId=f.ui['projectId'], windowId=f.ui['windowId'], epoch=f.ui['epoch'], pointerBits=64, parentHwnd=100)
    f.receipt_fixture = CF.fixture('CANCEL', b)
    f.active_rows = f.receipt_fixture['rows'][:3]
    f.encode_rows = lambda rows: b''.join((CF.encode(r) for r in rows))
    journal, stdout, stderr, _ = CF.streams(f.receipt_fixture)
    f.artifacts = dict(journal=journal, stdout=stdout, stderr=stderr)
    f.files = {f.paths[k]: v for k, v in f.artifacts.items()}
    f.files[f.c.ENDPOINT_JOURNAL] = f.encode_rows(f.endpoint)
    receipt = json.loads((OPERATIVE / 'prefocus-fixture.json').read_bytes())
    receipt = json.loads(json.dumps(receipt).replace('11111111-1111-4111-8111-111111111111', f.ui['windowId']).replace('project1', f.ui['projectId']))
    for side in ('Before', 'After'):
        receipt['workspace' + side]['epoch'] = f.ui['epoch']
        receipt['target' + side]['epoch'] = f.ui['epoch']
        receipt['terminal' + side]['context']['epoch'] = f.ui['epoch']
    before = {k: receipt['terminalBefore'][k] for k in ('url', 'roots', 'busy', 'folder', 'status', 'createDisabled', 'folderDisabled')}
    ready = dict(probe=f.c.PROBE, stage='ui-ready', **f.phase, before=before, prefocus=receipt, scope='provider-and-DOM plus existing workspace focus API ACK only; no OS foreground proof')
    f.final['prefocus'] = copy.deepcopy(receipt)
    f.proof = dict(phase=f.phase, uiReady=ready, fullTopology=dict(status='NOT_REQUESTED_BY_CANCEL_ROUTE'))
    return f
