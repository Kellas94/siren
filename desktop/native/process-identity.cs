using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// A fixed read-only query. No shell, executable input, environment input,
// process mutation or renderer bridge. Keep both observations on one handle.
internal static class ProcessIdentity {
    [StructLayout(LayoutKind.Sequential)] private struct FileTime { public uint Low; public uint High; }
    [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenProcess(uint rights, bool inherit, uint pid);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern bool GetProcessTimes(IntPtr process, out FileTime created, out FileTime exited, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool QueryFullProcessImageNameW(IntPtr process, uint flags, StringBuilder path, ref uint length);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr process);

    private static string Quote(string value) {
        var result = new StringBuilder("\"");
        foreach (char c in value) {
            if (c == '\\' || c == '"') result.Append('\\').Append(c);
            else if (c < 32) result.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
            else result.Append(c);
        }
        return result.Append('"').ToString();
    }
    private static string Inspect(uint pid) {
        IntPtr handle = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if (handle == IntPtr.Zero) {
            int error = Marshal.GetLastWin32Error();
            return error == 87 ? "null" : "{\"unknown\":true}";
        }
        try {
            uint exitCode;
            if (!GetExitCodeProcess(handle, out exitCode)) return "{\"unknown\":true}";
            // STILL_ACTIVE can also be an actual exit code. Treat that ambiguous
            // case as live/unknown, never as evidence that a writer is dead.
            if (exitCode != 259) return "null";
            FileTime created, exited, kernel, user;
            var path = new StringBuilder(32768); uint length = 32768;
            if (!GetProcessTimes(handle, out created, out exited, out kernel, out user) ||
                !QueryFullProcessImageNameW(handle, 0, path, ref length) || length == 0 || length >= 32768) return "{\"unknown\":true}";
            long ticks = checked((long)(((ulong)created.High << 32) | created.Low));
            string startedAt = DateTime.FromFileTimeUtc(ticks).ToString("o", CultureInfo.InvariantCulture);
            return "{\"pid\":" + pid.ToString(CultureInfo.InvariantCulture) + ",\"path\":" + Quote(path.ToString()) + ",\"startedAt\":" + Quote(startedAt) + "}";
        } finally { CloseHandle(handle); }
    }
    private static int Main(string[] args) {
        uint pid;
        if (args.Length != 1 || args[0].Length == 0 || args[0].Length > 10 ||
            args[0][0] == '0' || !uint.TryParse(args[0], NumberStyles.None, CultureInfo.InvariantCulture, out pid) || pid == 0) return 2;
        try {
            // A hidden GUI-subsystem helper has redirected pipes, no console.
            // Write UTF-8 directly; Console.OutputEncoding would require a
            // console code-page handle and may throw before any query runs.
            using (var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false, true))) {
                string value;
                try { value = Inspect(pid); } catch { value = "{\"unknown\":true}"; }
                output.WriteLine(value);
            }
            return 0;
        } catch { return 1; }
    }
}
