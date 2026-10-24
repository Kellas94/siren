"""Private zero-only readiness observation. No OS imports or input capability."""
from context.reference import folder_dialog_driver as model

class OwnedDialogReadiness:
    def __init__(self,api,binding,clock,remaining,wait):
        if type(binding) is not model.Binding or not all(model._positive(v) for v in [binding.original_handle,binding.pid,binding.parent_hwnd,binding.parent_tid]) or not model._canonical(binding.image) or not binding.created_filetime or not model._decimal(binding.created_filetime) or type(binding.parent_class) is not str or not binding.parent_class:raise model.Refused('READINESS_BINDING_REFUSED')
        self._binding=binding;self._api={name:getattr(api,name) for name in ['process_identity','enum_windows','window']}
        if not all(callable(f) for f in [*self._api.values(),clock,remaining,wait]):raise model.Refused('READINESS_CALLABLES_REFUSED')
        self._clock=clock;self._remaining=remaining;self._wait=wait;self._busy=False;self._used=False;self._blocked=False;self._first_present=False;self._first=None
        self._phase='readiness-new';self._start=None;self._last=None;self._samples=0;self._rows=[];self._active=None;self._truncated=False;self._errors=[];self._error_count=0
    @property
    def blocked(self):return self._blocked
    @property
    def first_error(self):return self._first if self._first_present else None
    def _remember(self,error):
        if not self._first_present:self._first_present=True;self._first=error
        self._blocked=True
    def _fail(self,code):raise model.Refused(code)
    def _checked(self,fn,*args):
        value=fn(*args)
        if self._blocked:raise self._first
        return value
    def _call(self,name,*args):return self._checked(self._api[name],*args)
    def _time(self):
        now=self._checked(self._clock)
        if type(now) not in [float,int] or not -float('inf')<now<float('inf') or self._last is not None and now<self._last:self._fail('READINESS_CLOCK_REFUSED')
        if self._start is None:self._start=now
        self._last=now;left=self._checked(self._remaining)
        if type(left) not in [float,int] or not 0<left<=5:self._fail('READINESS_PUBLIC_REMAINDER_REFUSED')
        return now,left
    def _process(self):
        actual=self._call('process_identity',self._binding.original_handle)
        expected=model.ProcessIdentity(self._binding.pid,self._binding.image,self._binding.created_filetime,True)
        if type(actual) is not model.ProcessIdentity or actual!=expected:self._fail('ORIGINAL_PROCESS_IDENTITY_REFUSED')
    def _window(self,hwnd,*,allow_absent=False):
        w=self._call('window',hwnd)
        if w is None and allow_absent:return None
        if type(w) is not model.Window or w.hwnd!=hwnd or not all(model._positive(v) for v in [w.hwnd,w.pid,w.tid]) or type(w.owner) is not int or w.owner<0 or type(w.class_name) is not str or not w.class_name or type(w.visible) is not bool or type(w.enabled) is not bool:self._fail('WINDOW_DISAPPEARED_OR_MALFORMED')
        return w
    def _parent(self):
        p=self._window(self._binding.parent_hwnd)
        if p.pid!=self._binding.pid or p.tid!=self._binding.parent_tid or p.class_name!=self._binding.parent_class or not p.visible:self._fail('DESIGNATED_PARENT_CHANGED')
        return p
    def _chain(self,dialog,parent):
        chain=[];seen=set();next_hwnd=dialog.hwnd
        for _ in range(32):
            if next_hwnd in seen:self._fail('OWNER_CYCLE')
            seen.add(next_hwnd);w=self._window(next_hwnd)
            if w.pid!=self._binding.pid:self._fail('FOREIGN_OWNER')
            chain.append(w)
            if next_hwnd==parent.hwnd:return tuple(chain)
            if not w.owner:self._fail('DESIGNATED_OWNER_CHAIN_MISSING')
            next_hwnd=w.owner
        self._fail('OWNER_CHAIN_TOO_DEEP')
    def _diagnostic_try(self,stage,*values):
        try:self._diagnostic_update(stage,*values)
        except BaseException as error:
            self._error_count+=1
            if len(self._errors)<8:self._errors.append(error)
    def _diagnostic_update(self,stage,*values):
        if stage=='begin':
            row=dict(ordinal=self._samples,elapsed=None,enumeratedCount=None,scannedCount=0,candidateCount=None,cardinalityEvaluated=False,ownedWindows=[],rowsTruncated=False,policyCompleted=False,status='PARTIAL')
            if len(self._rows)<4:self._rows.append(row)
            else:self._rows[3]=row;self._truncated=True
            self._active=row;return
        row=self._active
        if row is None:return
        if stage=='time':row['elapsed']=values[0]-self._start
        elif stage=='enumerated':row['enumeratedCount']=len(values[0])
        elif stage=='window':
            row['scannedCount']+=1;w=values[0]
            if w.pid==self._binding.pid:
                if len(row['ownedWindows'])>=16:row['rowsTruncated']=True
                else:row['ownedWindows'].append(dict(hwnd=w.hwnd,pid=w.pid,tid=w.tid,className=w.class_name[:128],classNameTruncated=len(w.class_name)>128,dialogClassMatch=w.class_name=='#32770',owner=w.owner,visible=w.visible,enabled=w.enabled))
        elif stage=='cardinality':row['candidateCount']=values[0];row['cardinalityEvaluated']=True
        elif stage=='finish':row['policyCompleted']=values[0];row['status']='COMPLETE' if values[0] else 'PARTIAL'
    def discovery_snapshot(self):
        rows=[dict(row,ownedWindows=[dict(w) for w in row['ownedWindows']]) for row in self._rows]
        return dict(schema=1,phase=self._phase,samples=self._samples,observations=rows,truncated=self._truncated,diagnosticErrorCount=self._error_count)
    @property
    def discovery_secondary_errors(self):return tuple(self._errors)+tuple(self.__dict__.get('_absence_evidence',{}).get('errors',()))
    def _absence_try(self,stage,hwnd=None):
        try:
            if '_absence_evidence' not in self.__dict__:self._absence_evidence=dict(ordinal=0,totalCount=0,rows=[],truncated=False,errorCount=0,errors=[])
            if stage=='begin':self._absence_evidence['ordinal']+=1
            else:self._absence_evidence['totalCount']+=1
            self._absence_update(stage,hwnd)
        except BaseException as error:
            try:
                state=self._absence_evidence;state['errorCount']+=1
                if len(state['errors'])<8:state['errors'].append(error)
            except BaseException:pass
    def _absence_update(self,stage,hwnd):
        state=self._absence_evidence
        if stage=='begin':return
        if len(state['rows'])>=8:state['truncated']=True;return
        if type(hwnd) is not int or not 0<hwnd<2**64:raise ValueError('ABSENCE_AUDIT_HANDLE_REFUSED')
        state['rows'].append(dict(hwndDecimal=str(hwnd),ordinal=state['ordinal']))
    def enumeration_absence_snapshot(self):
        state=self.__dict__.get('_absence_evidence')
        if state is None:return dict(schema=1,totalCount=0,retainedCount=0,truncated=False,diagnosticErrorCount=0,rows=[])
        return dict(schema=1,totalCount=state['totalCount'],retainedCount=len(state['rows']),truncated=state['truncated'],diagnosticErrorCount=state['errorCount'],rows=[dict(row) for row in state['rows']])
    def _sample(self):
        self._samples+=1;self._diagnostic_try('begin');self._absence_try('begin');complete=False
        try:
            now,left=self._time();self._diagnostic_try('time',now);self._process();parent=self._parent();handles=self._call('enum_windows')
            if type(handles) is not tuple or len(handles)>4096 or len(set(handles))!=len(handles) or any(not model._positive(h) for h in handles):self._fail('ENUMERATION_REFUSED')
            self._diagnostic_try('enumerated',handles);candidates=[];protected={parent.hwnd}
            for hwnd in handles:
                w=self._window(hwnd,allow_absent=hwnd not in protected)
                if w is None:
                    self._absence_try('absent',hwnd)
                    if self._blocked:raise self._first
                    continue
                self._diagnostic_try('window',w)
                if w.class_name=='#32770' and w.pid==self._binding.pid and w.visible and w.enabled:
                    chain=self._chain(w,parent);candidates.append((w,chain));protected.update(window.hwnd for window in chain)
            self._diagnostic_try('cardinality',len(candidates))
            if len(candidates)>1:self._fail('READINESS_AMBIGUOUS_DIALOGS')
            self._process();now,left=self._time();self._diagnostic_try('time',now);complete=True
            return (None if not candidates else candidates[0][0]),left
        finally:self._diagnostic_try('finish',complete)
    def wait_ready(self):
        if self._blocked:raise self._first
        if self._busy or self._used:
            error=model.Refused('READINESS_ONE_USE_NO_REENTRY');self._remember(error);raise error
        self._busy=True;self._used=True;self._phase='readiness-waiting'
        try:
            for index in range(128):
                dialog,left=self._sample()
                if dialog is not None:self._phase='readiness-ready';return dict(ready=True,candidateHwnd=dialog.hwnd,samples=self._samples)
                if index==127:self._fail('READINESS_SAMPLE_CAP')
                self._checked(self._wait,min(.05,left))
            self._fail('READINESS_SAMPLE_CAP')
        except BaseException as error:
            self._remember(error);self._phase='readiness-failed';raise self._first
        finally:self._busy=False
