"""Independent Win32 probe using the exact production directory hold flags."""
import ctypes
import pathlib
import tempfile

base = pathlib.Path(__file__).resolve().parent
root = pathlib.Path(tempfile.mkdtemp(prefix="native-directory-probe-", dir=base))
kernel = ctypes.WinDLL("kernel32", use_last_error=True)
kernel.CreateFileW.restype = ctypes.c_void_p
kernel.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
kernel.CloseHandle.argtypes = [ctypes.c_void_p]
handle = kernel.CreateFileW(str(root), 0x80000000, 1, None, 3, 0x00200000 | 0x02000000, None)
try:
    assert handle != ctypes.c_void_p(-1).value, ctypes.get_last_error()
    child = root / "injected.dll"
    child.write_bytes(b"unlisted child")
    print("directory_handle_valid=True; unlisted_child_created_while_held=" + str(child.exists()))
    child.unlink()
finally:
    kernel.CloseHandle(handle)
    assert root.parent == base
    root.rmdir()
