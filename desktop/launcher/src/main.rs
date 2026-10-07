#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]
use std::{env, process::{Command, Stdio}};
use siren_launcher::selection::select;

fn run() -> Result<i32, String> {
    let arguments: Vec<_> = env::args_os().skip(1).collect();
    let verify = arguments.len() == 1 && arguments[0] == "--verify";
    if !arguments.is_empty() && !verify { return Err("LAUNCHER_ARGUMENTS_REFUSED".into()); }
    let own_path = env::current_exe().map_err(|_| "LAUNCHER_IDENTITY_FAILED")?;
    let root = own_path.parent().ok_or("LAUNCHER_IDENTITY_FAILED")?;
    let selected = select(root)?;
    if verify {
        selected.recheck()?;
        println!("{}", serde_json::json!({ "schema": 1, "kind": "development-preview", "releaseAdmitted": false, "launcherQualified": false, "version": selected.version, "sourceCommit": selected.source_commit, "executable": selected.executable }));
        return Ok(0);
    }
    // No shell, user-provided executable/root, forwarded switches, or Node
    // environment injection. Retain every selection guard for the child lifetime.
    let mut command = Command::new(&selected.executable);
    command.current_dir(root)
        .env_remove("ELECTRON_RUN_AS_NODE").env_remove("NODE_OPTIONS")
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    selected.recheck()?;
    let mut child = command.spawn().map_err(|_| "APP_START_FAILED")?;
    let status = child.wait().map_err(|_| "APP_WAIT_FAILED")?;
    drop(selected);
    Ok(status.code().unwrap_or(1))
}

fn main() {
    let code = match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("SIREN: {error}");
            #[cfg(windows)]
            if env::args_os().len() == 1 { show_error(&error); }
            1
        }
    };
    std::process::exit(code);
}

#[cfg(windows)]
fn show_error(code: &str) {
    use std::{ffi::c_void, iter::once};
    #[link(name = "user32")]
    unsafe extern "system" { fn MessageBoxW(owner: *mut c_void, text: *const u16, title: *const u16, flags: u32) -> i32; }
    let text: Vec<u16> = format!("SIREN nu a putut porni.\n\nPachetul poate fi incomplet sau modificat. P\u{0103}streaz\u{0103} \u{00ee}ntregul folder portabil. Launcherul nu \u{0219}terge \u{0219}i nu rescrie proiectele.\n\nCod: {code}").encode_utf16().chain(once(0)).collect();
    let title: Vec<u16> = "SIREN".encode_utf16().chain(once(0)).collect();
    // These null-terminated UTF-16 buffers live throughout the synchronous call.
    unsafe { MessageBoxW(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10); }
}
