// Emit a native source-function DATA harness. Does not compile or execute it.
import {readFileSync,writeFileSync} from 'node:fs';
if(process.argv.length!==4)throw Error('EXACT_UNIT_INPUT_OUTPUT_REQUIRED');
const source=readFileSync(process.argv[2],'utf8'),start='bool HostExactExited(const Member& m,bool& dead){',end='bool HostCaptureCurrentMembers(';
if(source.split(start).length!==2||source.split(end).length!==2)throw Error('UNIT_FUNCTION_BOUNDARY_REFUSED');
const from=source.indexOf(start),to=source.indexOf(end,from);
if(to<=from)throw Error('UNIT_FUNCTION_ORDER_REFUSED');
const template=readFileSync(new URL('../fixtures/terminal-host-exit-unit.cpp',import.meta.url),'utf8'),marker='// ACTUAL_HOST_EXACT_EXITED';
if(template.split(marker).length!==2)throw Error('UNIT_TEMPLATE_REFUSED');
const captureEnd='bool HostDeadline(',captureMarker='// ACTUAL_HOST_CAPTURE_CURRENT',captureTo=source.indexOf(captureEnd,to);
if(source.split(captureEnd).length!==2||captureTo<=to||template.split(captureMarker).length!==2)throw Error('UNIT_CAPTURE_BOUNDARY_REFUSED');
const asyncStart='void HostAsyncExecute(napi_env,void* context){',asyncEnd='bool HostCloseHandleVerified(Handle& value){',asyncMarker='// ACTUAL_HOST_ASYNC_EXECUTE';
const asyncFrom=source.indexOf(asyncStart),asyncTo=source.indexOf(asyncEnd,asyncFrom);
if(source.split(asyncStart).length!==2||source.split(asyncEnd).length!==2||asyncTo<=asyncFrom||template.split(asyncMarker).length!==2)throw Error('UNIT_ASYNC_BOUNDARY_REFUSED');
writeFileSync(process.argv[3],template.replace(marker,source.slice(from,to)).replace(captureMarker,source.slice(to,captureTo)).replace(asyncMarker,source.slice(asyncFrom,asyncTo)),{flag:'wx'});
