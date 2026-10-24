"""Retain exact runner streams and status, including failures before RESULT exists."""
from pathlib import Path
import datetime,hashlib,json,os,stat,subprocess,sys
BASE=Path(__file__).resolve().parent
PY=Path(sys.executable)
RUNNER_FLAG='--portable-five-business-v2'
TIMEOUT_SECONDS=180
def occupied(path):
    try:path.lstat();return True
    except FileNotFoundError:return False
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(path,body):return dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
def exclusive(path,body):
    with path.open('xb') as stream:stream.write(body)
def json_body(value):return (json.dumps(value,indent=2,ensure_ascii=True)+'\n').encode('ascii')
def error_data(error):return dict(type=type(error).__name__,message=str(error))
def stream_bytes(value):
    if value is None:return b''
    if type(value) is not bytes:raise TypeError('EXACT_CAPTURED_STREAM_BYTES')
    return value
def forward(fd,body):
    offset=0
    while offset<len(body):offset+=os.write(fd,body[offset:])

if occupied(BASE/'CONSUMED') or occupied(BASE/'evidence'):
    raise SystemExit('FRESH_PORTABLE_ROOT_REQUIRED: preserve existing evidence and use a fresh checked copy')
command=[str(PY),'-B','-I','-S','-X','utf8',str(BASE/'runner.py'),RUNNER_FLAG]
attempt=dict(kind='PORTABLE_RUNNER_INVOCATION_ATTEMPT_V1',started=stamp(),invokerArgv=list(sys.orig_argv),invokerCwd=str(Path.cwd()),childArgv=command,childCwd=str(BASE),timeoutSeconds=TIMEOUT_SECONDS)
exclusive(BASE/'INVOCATION-ATTEMPTED',json_body(attempt))
stdout=b'';stderr=b'';child_exit=None;forwarded_exit=125;failure=None;status='NOT_DISPATCHED'
try:
    expected=[str(PY),'-B','-I','-S','-X','utf8',str(BASE/'invoke.py')]
    if sys.orig_argv!=expected or Path.cwd().resolve()!=BASE or sys.flags.optimize or not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode or sys.flags.utf8_mode!=1:
        raise ValueError('FIXED_OUTER_INVOCATION_REQUIRED')
    status='DISPATCHED'
    completed=subprocess.run(command,cwd=BASE,capture_output=True,timeout=TIMEOUT_SECONDS)
    stdout=stream_bytes(completed.stdout);stderr=stream_bytes(completed.stderr)
    child_exit=completed.returncode;forwarded_exit=child_exit;status='EXITED'
except subprocess.TimeoutExpired as error:
    stdout=stream_bytes(error.stdout);stderr=stream_bytes(error.stderr)
    failure=error_data(error);status='TIMEOUT';forwarded_exit=124
except OSError as error:
    stdout=stream_bytes(getattr(error,'stdout',getattr(error,'output',None)));stderr=stream_bytes(getattr(error,'stderr',None))
    failure=error_data(error);status='OS_ERROR';forwarded_exit=125
except ValueError as error:
    failure=error_data(error);status='INVOKER_REFUSED';forwarded_exit=125
ended=stamp();out=BASE/'evidence'
if not occupied(out):out.mkdir()
info=out.lstat()
if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or getattr(info,'st_file_attributes',0)&0x400:
    raise RuntimeError('OWNED_REGULAR_EVIDENCE_DIRECTORY_REQUIRED')
stdout_path=out/'runner-stdout.bin';stderr_path=out/'runner-stderr.bin'
exclusive(stdout_path,stdout);exclusive(stderr_path,stderr)
invocation=dict(kind='PORTABLE_RUNNER_INVOCATION_V1',status=status,started=attempt['started'],ended=ended,
    invokerArgv=attempt['invokerArgv'],invokerCwd=attempt['invokerCwd'],childArgv=command,childCwd=str(BASE),timeoutSeconds=TIMEOUT_SECONDS,
    childExitCode=child_exit,forwardedExitCode=forwarded_exit,failure=failure,
    stdout=pin(stdout_path,stdout),stderr=pin(stderr_path,stderr),
    invoker=pin(BASE/'invoke.py',(BASE/'invoke.py').read_bytes()),
    createsRunnerResult=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)
exclusive(out/'INVOCATION.json',json_body(invocation))
forward(1,stdout);forward(2,stderr)
if failure is not None:forward(2,('INVOKER_'+status+': '+json.dumps(failure,ensure_ascii=True)+'\n').encode('ascii'))
raise SystemExit(forwarded_exit)
