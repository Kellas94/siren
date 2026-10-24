"""Fixed original-handle file operations; native exports are injected, not loaded.

The integrated cohort supplies Python fakes only. This source does not qualify
filesystem custody, CRT compatibility, native quiescence or operational use.
"""
import ordinary_direct_resource_base as B0
_ROLES = ('stdout','stderr','archive','index')

def _need(ok, code):
    if ok is not True:
        raise ValueError('CAPTURE_FILE_BACKEND:' + code)

class _Backend(B0._Backend):
    def __init__(self, *args):
        super().__init__(*args)
        for role in ('archive','index'):
            self.handles[role] = B0._Handle(self.c, self.t)
        self.file_identities = {}
        self.final_roots = []
        self.final_issued = False
        # Allocation precedes callback construction and every possible dispatch.
        self.reader_attempts={ch:dict(state='NOT_ATTEMPTED', slot=self.handles[ch+'.readerThread'],
            call=None, roots=None, error=None) for ch in ('stdout','stderr')}
        self.reader_creation_barred=False
        self.reader_absence_sealed=False

    def _name(self, role):
        _need(role in _ROLES, 'FIXED_ROLE')
        return role + '.sink' if role in ('stdout','stderr') else role

    def inspect_file(self, role, *, initial=False):
        name = self._name(role)
        handle = self._h(name)
        info = self.t['BY_HANDLE_FILE_INFORMATION']()
        size = self.t['LARGE_INTEGER']()
        # Root out cells before either call; no interpretation on failed BOOL.
        root = dict(role=role, resource=self.handles[name], info=info, size=size,
                    calls=[], metadata=None)
        self.final_roots.append(root)
        a = self._call('FILE_INFO:' + role, self.k['GetFileInformationByHandle'],
                       handle, self.c.byref(info))
        root['calls'].append(a)
        _need(a.state == 'RETURNED' and bool(a.raw), 'FILE_INFO_RETURNED')
        b = self._call('FILE_SIZE:' + role, self.k['GetFileSizeEx'],
                       handle, self.c.byref(size))
        root['calls'].append(b)
        _need(b.state == 'RETURNED' and bool(b.raw), 'FILE_SIZE_RETURNED')
        values = (info.dwFileAttributes, info.nNumberOfLinks, info.dwVolumeSerialNumber,
                  info.nFileIndexHigh, info.nFileIndexLow, size.value)
        _need(all(type(v) is int and v >= 0 for v in values), 'METADATA_INTEGERS')
        attributes, links, volume, high, low, n = values
        _need(not attributes & (0x10 | 0x400) and links == 1 and
              n == (info.nFileSizeHigh << 32 | info.nFileSizeLow), 'REGULAR_SINGLE_LINK')
        identity = (volume, high, low)
        if initial:
            _need(role not in self.file_identities and n == 0, 'EMPTY_EXCLUSIVE_LEAF')
            _need(identity not in self.file_identities.values(), 'DISTINCT_FILE_IDENTITIES')
            self.file_identities[role] = identity
        else:
            _need(self.file_identities.get(role) == identity, 'ORIGINAL_FILE_IDENTITY')
        root['metadata'] = dict(size=n, identity=identity, attributes=attributes, links=links)
        return root['metadata']

    def acquire_fixed_file(self, role, path):
        name = self._name(role)
        slot = self._returned_handle(name, 'CreateFileW', path, 0xc0000000,
                                     0, None, 1, 0x80 | 0x00200000, None)
        if slot.state == 'OPEN':
            self.inspect_file(role, initial=True)
        return slot

    def write_role(self, role, payload):
        _need(type(payload) is bytes, 'WRITE_BYTES')
        buffer = self.c.create_string_buffer(payload)
        count = self.t['DWORD']()
        call = self._call('FILE_WRITE:' + role, self.k['WriteFile'],
                          self._h(self._name(role)), buffer, len(payload),
                          self.c.byref(count), None)
        # Failed BOOL does not prove that its output count is usable.
        if call.state != 'RETURNED' or not call.raw:
            return call, None
        n = count.value
        _need(type(n) is int and 0 <= n <= len(payload), 'WRITE_COUNT')
        return call, n

    def final_sizes(self, electron):
        roles = _ROLES if electron else _ROLES[:2]
        result = tuple(self.inspect_file(role)['size'] for role in roles)
        return result if electron else result + (0,0)

    def final_read(self, maxima, resources):
        _need(not self.final_issued and type(maxima) is tuple and len(maxima) == 4,
              'FINAL_READ_ONCE')
        self.final_issued = True
        rows = []
        for role, maximum, resource in zip(_ROLES, maxima, resources):
            row = dict(role=role, resource=resource, body=b'', consumed=0,
                       complete=True, quiescent=True, calls=[])
            rows.append(row)
            if resource is None:
                continue
            _need(resource is self.handles[self._name(role)], 'ORIGINAL_ROLE_CAPABILITY')
            h = self._h(self._name(role))
            position = self.t['LARGE_INTEGER']()
            root = dict(row=row, position=position, buffers=[])
            self.final_roots.append(root)
            for label, function, args in (
                ('FILE_FLUSH:', self.k['FlushFileBuffers'], (h,)),
                ('FILE_POSITION:', self.k['SetFilePointerEx'], (h, position, None, 0))):
                call = self._call(label + role, function, *args)
                row['calls'].append(call)
                if call.state != 'RETURNED' or not call.raw:
                    row.update(complete=False, quiescent=call.state == 'RETURNED',
                               consumed=0 if call.state == 'RETURNED' else None)
                    break
            if not row['complete']:
                continue
            remaining = maximum
            while remaining:
                n = min(65536, remaining)
                buffer = self.c.create_string_buffer(n)
                count = self.t['DWORD']()
                root['buffers'].append((buffer,count))
                call = self._call('FINAL_BODY:' + role, self.k['ReadFile'],
                                  h, buffer, n, self.c.byref(count), None)
                row['calls'].append(call)
                if call.state != 'RETURNED' or not call.raw:
                    row.update(complete=False, quiescent=call.state == 'RETURNED',
                               consumed=None)
                    break
                got = count.value
                _need(type(got) is int and 0 <= got <= n, 'FINAL_READ_COUNT')
                row['body'] += bytes(buffer.raw[:got])
                row['consumed'] += got
                remaining -= got
                if got != n:
                    row['complete'] = False
                    break
            # No uncharged EOF probe or second readback of a retained body.
        return tuple(dict(r, calls=tuple(r['calls'])) for r in rows)

    def account_detached(self):
        call, raw = self.account_job()
        active = None
        if call.state == 'RETURNED' and call.raw:
            active = raw.ActiveProcesses
            _need(type(active) is int and 0 <= active <= 0xffffffff, 'ACTIVE_COUNT')
        return call, active

    def require_file_quiescence(self, role):
        self.require_resource_quiescence(self._name(role))

    def require_resource_quiescence(self, name):
        _need(name in self.handles, 'FIXED_ORIGINAL_RESOURCE')
        slot = self.handles[name]
        for call in self.calls:
            if call.state in ('PENDING','UNKNOWN') and call.arguments is not None:
                _need(not any(argument is slot.cell for argument in call.arguments),
                      'ACTIVE_ORIGINAL_FILE_EFFECT')

    def close_handle(self, name):
        # All original HANDLE cells, including Job configuration/retirement,
        # remain rooted until their pending/unknown calls are quiescent.
        self.require_resource_quiescence(name)
        return super().close_handle(name)

    def _call(self, label, function, *arguments, last_error=True):
        if label.startswith('CREATE_READER:'):
            channel=label.split(':',1)[1]
            _need(channel in self.reader_attempts and not self.reader_creation_barred,
                  'READER_DISPATCH_BARRED')
            attempt=self.reader_attempts[channel]
            _need(attempt['state']=='PRECALL' and attempt['call'] is None,
                  'ORIGINAL_READER_PRECALL')
            def rooted_dispatch(*args):
                matches=[c for c in self.calls if c.label==label]
                _need(len(matches)==1 and matches[0].state=='PENDING' and
                      matches[0].arguments is not None, 'ORIGINAL_PENDING_READER_CALL')
                attempt['call']=matches[0]
                attempt['roots']=self.reader_roots[channel]
                attempt['state']='PENDING'
                return function(*args)
            return super()._call(label,rooted_dispatch,*arguments,last_error=last_error)
        if label.startswith(('READ:','APPEND:','RESUME:')):
            _need(not self.reader_absence_sealed,'NO_EFFECT_AFTER_ABSENCE_SEAL')
        return super()._call(label,function,*arguments,last_error=last_error)

    def create_reader_suspended(self, channel, callback, state):
        _need(channel in self.reader_attempts and not self.reader_creation_barred,
              'READER_CREATION_BARRED')
        attempt=self.reader_attempts[channel]
        _need(attempt['state']=='NOT_ATTEMPTED' and
              attempt['slot'] is self.handles[channel+'.readerThread'], 'ONE_ORIGINAL_READER_ATTEMPT')
        attempt['state']='PRECALL'
        try:
            slot,call,tid=super().create_reader_suspended(channel,callback,state)
            _need(attempt['call'] is call and attempt['roots'] is self.reader_roots[channel],
                  'ORIGINAL_READER_DELIVERY')
            attempt['state']=call.state
            return slot,call,tid
        except BaseException as error:
            attempt['error']=error
            if attempt['state']=='PRECALL':attempt['state']='PRECALL_UNRESOLVED'
            raise

    def require_reader_absence(self, owner):
        _need(self.reader_creation_barred,'PERMANENT_READER_CREATION_BAR')
        for ch,attempt in self.reader_attempts.items():
            name=ch+'.readerThread';slot=self.handles[name];held=owner._slots[name]
            _need(attempt['slot'] is slot and not any(name in t.names for t in owner._pending),
                  'ORIGINAL_READER_SLOT_AND_ACK')
            if attempt['state']=='NOT_ATTEMPTED':
                _need(attempt['call'] is None and slot.original_call is None and
                      slot.state==held.state=='NOT_ACQUIRED' and held.value is None and
                      ch not in self.reader_roots, 'NEVER_DISPATCHED_READER')
            else:
                call=attempt['call']
                _need(attempt['state']=='RETURNED' and call is not None and
                      call is slot.original_call and call in self.calls and
                      call.state=='RETURNED' and type(call.raw) is int and call.raw==0 and
                      slot.state==held.state=='FAILED' and slot.cell.value in (None,0) and
                      held.value is None and attempt['roots'] is self.reader_roots.get(ch),
                      'EXACT_RETURNED_ZERO_READER')
        return tuple(self.reader_attempts[ch] for ch in ('stdout','stderr'))
