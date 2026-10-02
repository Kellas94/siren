#![cfg(all(windows, feature = "development-preview"))]
use std::{fs, path::PathBuf, process::Command, sync::atomic::{AtomicUsize, Ordering}};
use sha2::{Digest, Sha256};
use serde_json::json;

static SEQUENCE: AtomicUsize = AtomicUsize::new(0);
struct Fixture { root: PathBuf }
impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("SIREN launch test \u{0219} {}-{}", std::process::id(), SEQUENCE.fetch_add(1, Ordering::SeqCst)));
        fs::create_dir_all(path.join("App/versions/0.1.0/resources")).unwrap(); fs::create_dir(path.join("Data")).unwrap();
        let root = fs::canonicalize(&path).unwrap();
        let app = root.join("App/versions/0.1.0/SIREN.exe");
        let compilation = Command::new("rustc").arg("--edition=2024").arg(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/app-probe.rs")).arg("-o").arg(&app).output().unwrap();
        assert!(compilation.status.success(), "owned fixture executable compilation failed: {}", String::from_utf8_lossy(&compilation.stderr));
        fs::write(root.join("App/versions/0.1.0/resources/app.asar"), b"fixture renderer").unwrap();
        fs::copy(env!("CARGO_BIN_EXE_SIREN"), root.join("SIREN.exe")).unwrap();
        let hash = |bytes: &[u8]| Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect::<String>();
        let exe = fs::read(&app).unwrap();
        fs::write(root.join("App/current.json"), serde_json::to_vec(&json!({
            "schema":1,"kind":"development-preview","releaseAdmitted":false,"version":"0.1.0","sourceCommit":"1111111111111111111111111111111111111111",
            "files":[{"path":"SIREN.exe","bytes":exe.len(),"sha256":hash(&exe)},{"path":"resources/app.asar","bytes":16,"sha256":hash(b"fixture renderer")}]
        })).unwrap()).unwrap();
        Self { root }
    }
    fn launcher(&self) -> PathBuf { self.root.join("SIREN.exe") }
}
impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.root); } }

#[test]
fn real_launcher_finds_its_root_and_launches_only_the_selected_native_app_without_shell() {
    let fixture = Fixture::new();
    let verified = Command::new(fixture.launcher()).arg("--verify").output().unwrap();
    assert!(verified.status.success(), "valid native launcher verification refused: stdout={} stderr={}", String::from_utf8_lossy(&verified.stdout), String::from_utf8_lossy(&verified.stderr));
    let status = Command::new(fixture.launcher()).env("ELECTRON_RUN_AS_NODE", "1").env("NODE_OPTIONS", "--bad-option").status().unwrap();
    assert!(status.success(), "actual owned app launch failed");
    let record = fs::read_to_string(fixture.root.join("Data/launcher-probe.txt")).unwrap();
    let lines: Vec<_> = record.split('\n').collect();
    assert_eq!(fs::canonicalize(lines[0]).unwrap(), fixture.root.join("App/versions/0.1.0/SIREN.exe"));
    assert_eq!(fs::canonicalize(lines[1]).unwrap(), fixture.root);
    assert_eq!(&lines[2..], &["0", "", ""]);
}

#[test]
fn real_launcher_missing_pointer_or_mutated_app_does_not_execute_a_fallback() {
    let fixture = Fixture::new();
    fs::remove_file(fixture.root.join("App/current.json")).unwrap();
    assert!(!Command::new(fixture.launcher()).arg("--verify").status().unwrap().success());
    assert!(!fixture.root.join("Data/launcher-probe.txt").exists());
    let fixture = Fixture::new();
    fs::write(fixture.root.join("App/versions/0.1.0/SIREN.exe"), b"changed").unwrap();
    assert!(!Command::new(fixture.launcher()).arg("--verify").status().unwrap().success());
    assert!(!fixture.root.join("Data/launcher-probe.txt").exists());
}
