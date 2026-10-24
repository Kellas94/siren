"""Exact retained supplied fake closure; no tests or native ports."""
import ordinary_direct_fake_resources as K
class FileInfo:
    def __init__(self):
        for name in ('dwFileAttributes','nNumberOfLinks','dwVolumeSerialNumber',
                     'nFileIndexHigh','nFileIndexLow','nFileSizeHigh','nFileSizeLow'):
            setattr(self,name,0)

class Exports(K.Exports):
    def __init__(self, *args):
        self.positions={};self.closed=set();self.before_body=None
        super().__init__(*args)
        for name in ('GetFileInformationByHandle','GetFileSizeEx','FlushFileBuffers','SetFilePointerEx'):
            self.kernel[name]=self.wrap(name)

    def wrap(self,name):
        inherited=super().wrap(name)
        def call(*args):
            special = name in ('GetFileInformationByHandle','GetFileSizeEx',
                'FlushFileBuffers','SetFilePointerEx') or (
                name=='ReadFile' and args[0].value in self.files)
            if not special:
                result=inherited(*args)
                if name=='CloseHandle' and result:self.closed.add(args[0].value)
                return result
            if self.lock.depth:raise RuntimeError('EFFECT_INSIDE_LOCK')
            self.events.append(name)
            if self.override.get(name):
                value=self.override[name].pop(0)
                if isinstance(value,BaseException):raise value
                return value(*args) if callable(value) else value
            handle=args[0].value
            if handle in self.closed:raise RuntimeError('IO_AFTER_CLOSE')
            n=len(self.files[handle])
            if name=='GetFileInformationByHandle':
                info=args[1];info.dwFileAttributes=0x80;info.nNumberOfLinks=1
                info.dwVolumeSerialNumber=13;info.nFileIndexLow=handle
                info.nFileSizeLow=n;return 1
            if name=='GetFileSizeEx':args[1].value=n;return 1
            if name=='FlushFileBuffers':return 1
            if name=='SetFilePointerEx':self.positions[handle]=args[1].value;return 1
            if name=='ReadFile':
                if self.before_body:self.before_body()
                position=self.positions.get(handle,0)
                payload=self.files[handle][position:position+args[2]]
                args[1].data[:len(payload)]=payload;args[3].value=len(payload)
                self.positions[handle]=position+len(payload);return 1
            raise RuntimeError('UNHANDLED_FAKE_EXPORT')
        return call
