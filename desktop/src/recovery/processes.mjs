import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

// Read process identity only. No kill-by-name or imported executable/path input.
export async function inspectWindowsProcess(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return undefined;
  if (process.platform !== 'win32') return undefined;
  // Windows PowerShell otherwise emits lossy ASCII into a redirected pipe.
  // Process ownership and recovery must compare the actual Unicode path.
  const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { 'null' } elseif (!$p.Path) { '{"unknown":true}' } else { @{pid=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`;
  try {
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000, maxBuffer: 16384 });
    const value = JSON.parse(stdout.trim());
    return value?.unknown ? undefined : value;
  } catch { return undefined; }
}
