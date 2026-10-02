import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

// Read process identity only. No kill-by-name or imported executable/path input.
export async function inspectWindowsProcess(pid, { onFailure } = {}) {
  if (!Number.isSafeInteger(pid) || pid < 1) return undefined;
  if (process.platform !== 'win32') return undefined;
  // Windows PowerShell otherwise emits lossy ASCII into a redirected pipe.
  // Process ownership and recovery must compare the actual Unicode path.
  const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { 'null' } elseif (!$p.Path) { '{"unknown":true}' } else { @{pid=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`;
  try {
    // Cold/native startup may take longer than five seconds under host load.
    // Still cancel at a finite deadline and treat every failure as unknown.
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000, maxBuffer: 16384 });
    const value = JSON.parse(stdout.trim());
    return value?.unknown ? undefined : value;
  } catch (error) {
    // Optional trusted diagnostic hook; normal startup never logs process paths.
    try { onFailure?.({ name: error.name, code: error.code ?? null, killed: error.killed === true, signal: error.signal ?? null }); } catch { /* diagnostics cannot grant identity */ }
    return undefined;
  }
}
