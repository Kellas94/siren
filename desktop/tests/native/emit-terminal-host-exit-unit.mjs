// Emit a native source-function DATA harness. Does not compile or execute it.
import {readFileSync,writeFileSync} from 'node:fs';
if(process.argv.length!==4)throw Error('EXACT_UNIT_INPUT_OUTPUT_REQUIRED');
const source=readFileSync(process.argv[2],'utf8'),start='bool HostExactExited(const Member& m,bool& dead){',end='bool HostCaptureCurrentMembers(';
if(source.split(start).length!==2||source.split(end).length!==2)throw Error('UNIT_FUNCTION_BOUNDARY_REFUSED');
const from=source.indexOf(start),to=source.indexOf(end,from);
if(to<=from)throw Error('UNIT_FUNCTION_ORDER_REFUSED');
const template=readFileSync(new URL('../fixtures/terminal-host-exit-unit.cpp',import.meta.url),'utf8'),marker='// ACTUAL_HOST_EXACT_EXITED';
if(template.split(marker).length!==2)throw Error('UNIT_TEMPLATE_REFUSED');
writeFileSync(process.argv[3],template.replace(marker,source.slice(from,to)),{flag:'wx'});
