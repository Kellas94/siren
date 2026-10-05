import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {win32} from 'node:path';
const run = promisify(execFile);

const invalidReply=reason=>Object.assign(new Error('Windows process identity response refused'),{code:'PROCESS_RESULT_INVALID',reason});
/** A native query is evidence only for its requested PID, exact path and creation time. */
export function decodeWindowsProcessResult(stdout,pid){
  if(typeof stdout!=='string'||Buffer.byteLength(stdout)>16384)throw invalidReply('RESPONSE_LIMIT');
  const text=stdout.trim();if(!text)throw invalidReply('EMPTY_RESPONSE');
  let value;try{value=JSON.parse(text);}catch{throw invalidReply('INVALID_JSON');}
  if(value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalidReply('INVALID_SHAPE');
  const keys=Object.keys(value);
  if(keys.length===1&&keys[0]==='unknown'&&value.unknown===true)return undefined;
  if(keys.length!==3||!['pid','path','startedAt'].every(key=>Object.hasOwn(value,key)))throw invalidReply('INVALID_SHAPE');
  if(!Number.isSafeInteger(pid)||pid<1||!Number.isSafeInteger(value.pid)||value.pid!==pid)throw invalidReply('PID_MISMATCH');
  if(typeof value.path!=='string'||!value.path||value.path.length>32768||!value.path.isWellFormed()||/[\u0000-\u001f\u007f]/.test(value.path)||!win32.isAbsolute(value.path)||win32.parse(value.path).root.length<3)throw invalidReply('INVALID_PATH');
  if(typeof value.startedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value.startedAt)||!Number.isFinite(Date.parse(value.startedAt))||new Date(value.startedAt).toISOString().slice(0,19)!==value.startedAt.slice(0,19))throw invalidReply('INVALID_START_TIME');
  return {pid:value.pid,path:value.path,startedAt:value.startedAt};
}

// Read process identity only. No kill-by-name or imported executable/path input.
export async function inspectWindowsProcess(pid, { onFailure } = {}) {
  if (!Number.isSafeInteger(pid) || pid < 1) return undefined;
  if (process.platform !== 'win32') return undefined;
  // Windows PowerShell otherwise emits lossy ASCII into a redirected pipe.
  // Process ownership and recovery must compare the actual Unicode path.
  const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { 'null' } elseif (!$p.Path) { '{"unknown":true}' } else { @{pid=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`;
  let phase='query',stdout='',stderr='';
  const byteCount=value=>typeof value==='string'?Math.min(65536,Buffer.byteLength(value)):0;
  try {
    // Cold/native startup may take longer than five seconds under host load.
    // Still cancel at a finite deadline and treat every failure as unknown.
    ({stdout,stderr}=await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000, maxBuffer: 16384 }));
    phase='decode';const observed=decodeWindowsProcessResult(stdout,pid);
    // A cmdlet/query error may still leave valid-looking `null` on stdout.
    // That is unknown identity, never proof of death or writable ownership.
    if(stderr)throw Object.assign(new Error('Windows process query diagnostics refused'),{code:'PROCESS_RESULT_INVALID',reason:'NATIVE_STDERR'});
    return observed;
  } catch (error) {
    // Optional trusted diagnostic hook; normal startup never logs process paths.
    const reason=['EMPTY_RESPONSE','INVALID_JSON','INVALID_SHAPE','PID_MISMATCH','INVALID_PATH','INVALID_START_TIME','RESPONSE_LIMIT','NATIVE_STDERR'].includes(error.reason)?error.reason:'QUERY_FAILED';
    try { onFailure?.({ name: error.name, code: error.code ?? null, killed: error.killed === true, signal: error.signal ?? null,phase,reason,stdoutBytes:byteCount(phase==='query'?error.stdout:stdout),stderrBytes:byteCount(phase==='query'?error.stderr:stderr) }); } catch { /* diagnostics cannot grant identity */ }
    return undefined;
  }
}
