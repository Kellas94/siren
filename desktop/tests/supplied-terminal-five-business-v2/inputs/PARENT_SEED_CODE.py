def parent_seed(fail=None):
    ledger = []
    identity = dict(pid=41, image='fixed', createdFileTime=k.iso_filetime('2026-10-19T10:00:00Z'))
    ui = dict(projectId='project', windowId='window', epoch=2)
    phase = dict(sourceSha256='a' * 64, identity=identity, **ui)
    before = dict(url='siren://app/windows/terminal.html?windowId=window', roots=1, busy=False, folder='No folder selected.', status='', createDisabled=True, folderDisabled=False)
    cancelled = dict(probe=e.PROBE, stage='ui-cancelled', **phase, confirmation=dict(before=before, after=dict(before, status='(CANCELLED)'), currentContext=dict(ui, role='terminal', mode='normal', access='write', available=True), rawIpcReplyCaptured=False))
    final = dict(probe=e.PROBE, stage='final-ui-result', **phase, ok=True, phase='quit', primaryPresent=False, primary=None, secondary=[], quitPointerConfirmed=True, normalQuitProved=False, physicalDriverProved=False)
    rows = [dict(version=1, sequence=1, stage='resolver-selected', failed=False, ordinal=1, branch='detached', **ui, role='terminal', webContentsId=22), dict(version=1, sequence=2, stage='api-call-boundary', failed=False, ordinal=1, matched=True, mainPid=41, branch='detached', senderWebContentsId=22, parentWebContentsId=22, parentWebContentsStatus='VALUE', handleBytes=8, handleHex='0a00000000000000'), dict(version=1, sequence=3, stage='fulfilled-projection', failed=False, ordinal=1, matched=True, apiCount=1, selectionCount=1, canceled=True, fileCount=0)]
    entry = dict(schema=1, sequence=1, stage='MAIN_ENDPOINT_ENTRY', method='terminalPickCwd', operationId='pick', epoch=2, entrySequence=1, replyKind=None, ok=None, code=None)
    endpoint = [entry, dict(entry, sequence=2, stage='MAIN_ENDPOINT_REPLY', replyKind='object', ok=False, code='CANCELLED')]
    source = (R / 'runtime/desktop/src/terminal/private-picker-close-observer.mjs').as_uri()
    stages = [dict(stage=n, elapsedMs=i, pendingWrites=0, hasProcessIdentity=True) for i, n in enumerate(['prepare', 'write-join', 'retire-views', 'journal', 'window-close'])]
    status = dict(failed=False, code=None, selectionCount=1, apiCount=1, matched=True, pending=False, settled=True, unmatched=False, records=3, ioBroken=False)
    stdout = ''.join(('SIREN_CLOSE_STAGE ' + json.dumps(r) + '\n' for r in stages)) + json.dumps(dict(probe='siren-picker-final-close-v1', version=1, stage='MAIN_WINDOW_CLOSED', source=source, mainPid=41, armed=True, closed=True, captureFailurePresent=False, status=status), separators=(',', ':')) + '\n'
    session = dict(schema=1, events=[dict(event=n, sessionId='s', version='v', processIdentity=dict(pid=41, path='fixed', startedAt='2026-10-19T10:00:00Z'), at='2026-10-19T10:00:00Z') for n in ['opened', 'ready', 'clean-close']])
    c = types.SimpleNamespace(PROBE=e.PROBE)
    secondary = []
    return types.SimpleNamespace(**locals())
