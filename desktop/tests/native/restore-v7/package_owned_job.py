"""Actual owned Windows job membership/closure, separate from normal application Quit."""
import ctypes,time,os
from ctypes import wintypes as t
class BasicLimits(ctypes.Structure):
 _fields_=[('perProcess',ctypes.c_int64),('perJob',ctypes.c_int64),('flags',t.DWORD),('minimum',ctypes.c_size_t),('maximum',ctypes.c_size_t),('activeLimit',t.DWORD),('affinity',ctypes.c_size_t),('priority',t.DWORD),('scheduling',t.DWORD)]
class IoCounters(ctypes.Structure):
 _fields_=[(name,ctypes.c_uint64)for name in['readOps','writeOps','otherOps','readBytes','writeBytes','otherBytes']]
class ExtendedLimits(ctypes.Structure):
 _fields_=[('basic',BasicLimits),('io',IoCounters),('processMemory',ctypes.c_size_t),('jobMemory',ctypes.c_size_t),('peakProcessMemory',ctypes.c_size_t),('peakJobMemory',ctypes.c_size_t)]
class Accounting(ctypes.Structure):
 _fields_=[(name,ctypes.c_int64)for name in['user','kernel','periodUser','periodKernel']]+[(name,t.DWORD)for name in['pageFaults','totalProcesses','activeProcesses','terminatedProcesses']]
class OwnedJob:
 def __init__(self):
  assert os.name=='nt';self.api=ctypes.WinDLL('kernel32',use_last_error=True);self.handle=None;self.assignedPID=None
  declarations={'CreateJobObjectW':([ctypes.c_void_p,t.LPCWSTR],t.HANDLE),'SetInformationJobObject':([t.HANDLE,ctypes.c_int,ctypes.c_void_p,t.DWORD],t.BOOL),'AssignProcessToJobObject':([t.HANDLE,t.HANDLE],t.BOOL),'QueryInformationJobObject':([t.HANDLE,ctypes.c_int,ctypes.c_void_p,t.DWORD,ctypes.c_void_p],t.BOOL),'TerminateJobObject':([t.HANDLE,t.UINT],t.BOOL),'CloseHandle':([t.HANDLE],t.BOOL),'GetProcessId':([t.HANDLE],t.DWORD)}
  for name,(args,result)in declarations.items():fn=getattr(self.api,name);fn.argtypes=args;fn.restype=result
  self.handle=self.api.CreateJobObjectW(None,None);self.check(bool(self.handle));limits=ExtendedLimits();limits.basic.flags=0x2000
  try:self.check(self.api.SetInformationJobObject(self.handle,9,ctypes.byref(limits),ctypes.sizeof(limits)))
  except BaseException:self.api.CloseHandle(self.handle);self.handle=None;raise
 def check(self,result):
  if not result:raise ctypes.WinError(ctypes.get_last_error())
 def assign(self,child):
  assert self.handle and self.assignedPID is None;self.check(self.api.GetProcessId(t.HANDLE(int(child._handle)))==child.pid);self.check(self.api.AssignProcessToJobObject(self.handle,t.HANDLE(int(child._handle))));self.assignedPID=child.pid
  return {'assignedActualHeldHandlePID':child.pid,'accounting':self.accounting(),'limitKillOnJobClose':True,'assignmentBoundary':'Immediate after Popen; not atomic with process creation. Scoped CIM independently checks possible escapes.'}
 def accounting(self):
  assert self.handle;value=Accounting();self.check(self.api.QueryInformationJobObject(self.handle,1,ctypes.byref(value),ctypes.sizeof(value),None));return {'totalProcesses':value.totalProcesses,'activeProcesses':value.activeProcesses,'terminatedProcesses':value.terminatedProcesses}
 def wait_empty(self,seconds=5):
  deadline=time.monotonic()+seconds;observations=[]
  while True:
   row=self.accounting();observations.append(row)
   if row['activeProcesses']==0:return {'closed':True,'observations':observations}
   if time.monotonic()>=deadline:return {'closed':False,'observations':observations}
   time.sleep(.1)
 def terminate_owned(self):
  assert self.handle and self.assignedPID is not None;before=self.accounting();self.check(self.api.TerminateJobObject(self.handle,1));after=self.wait_empty();return {'scope':'Only actual members of this held owned job. Adverse cleanup, not normal Quit.','before':before,'after':after}
 def close(self):
  if self.handle:self.check(self.api.CloseHandle(self.handle));self.handle=None
