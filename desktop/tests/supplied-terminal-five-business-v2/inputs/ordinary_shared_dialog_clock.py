"""One private controller dialog budget. No native import or clock sample on import.

Pass the SAME object to T1 and C1 only when ready for actual dialog discovery.
Construction/startup do not seed it; its first call does. No reset/extension API.
"""
from time import monotonic as _TRUSTED_MONOTONIC
from math import isfinite as _finite

class DialogClockRefused(RuntimeError):pass

class _Fuse:
    """Private injection seam for inert tests; public factory accepts no clock."""
    def __init__(self,raw):
        if not callable(raw):raise DialogClockRefused('TRUSTED_CLOCK_REQUIRED')
        self._raw=raw;self._start=None;self._deadline=None;self._last=None
        self._busy=False;self._failed=False;self._first=None
    @property
    def first_error(self):return self._first if self._failed else None
    def snapshot(self):
        return dict(start=self._start,deadline=self._deadline,last=self._last,failed=self._failed)
    def _remember(self,error):
        if not self._failed:self._failed=True;self._first=error
    def __call__(self):
        if self._failed:raise self._first
        if self._busy:
            error=DialogClockRefused('SHARED_DIALOG_CLOCK_REENTRY');self._remember(error);raise self._first
        self._busy=True  # Before the only external clock callout.
        try:
            now=self._raw()
            if self._failed:raise self._first
            if type(now) not in [int,float] or not _finite(now):raise DialogClockRefused('FINITE_MONOTONIC_SAMPLE_REQUIRED')
            if self._last is not None and now<self._last:raise DialogClockRefused('MONOTONIC_REGRESSION')
            if self._start is None:
                end=now+10.0
                startNum,startDen=(now,1) if type(now) is int else now.as_integer_ratio()
                endNum,endDen=end.as_integer_ratio()
                if not _finite(end) or end<=now or endNum*startDen-startNum*endDen!=10*endDen*startDen:raise DialogClockRefused('REPRESENTABLE_TEN_SECOND_LIMIT_REQUIRED')
                self._start=now;self._deadline=end
            self._last=now
            if now>=self._deadline:raise DialogClockRefused('SHARED_DIALOG_TEN_SECOND_LIMIT')
            return now
        except BaseException as error:
            self._remember(error);raise self._first
        finally:self._busy=False

def create_dialog_clock():
    """Trusted early-import capture; caller supplies no env/CLI/renderer clock."""
    return _Fuse(_TRUSTED_MONOTONIC)
