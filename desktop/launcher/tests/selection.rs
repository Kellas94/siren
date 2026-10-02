use std::{fs, path::PathBuf, sync::atomic::{AtomicUsize, Ordering}};
use sha2::{Digest, Sha256};
use serde_json::json;
use siren_launcher::selection::select;

static SEQUENCE: AtomicUsize = AtomicUsize::new(0);
struct Fixture { root: PathBuf }
impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("SIREN launcher test \u{0219} {}-{}", std::process::id(), SEQUENCE.fetch_add(1, Ordering::SeqCst)));
        fs::create_dir_all(&path).unwrap();
        let fixture = Self { root: fs::canonicalize(path).unwrap() };
        fs::create_dir_all(fixture.app().join("resources")).unwrap();
        fs::write(fixture.app().join("SIREN.exe"), b"known runtime").unwrap();
        fs::write(fixture.app().join("resources/app.asar"), b"known renderer").unwrap();
        fixture.write_current("0.1.0");
        fixture
    }
    fn app(&self) -> PathBuf { self.root.join("App/versions/0.1.0") }
    fn pointer(&self) -> PathBuf { self.root.join("App/current.json") }
    fn write_current(&self, version: &str) {
        let hash = |bytes: &[u8]| Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect::<String>();
        fs::write(self.pointer(), serde_json::to_vec(&json!({
            "schema": 1, "kind": "development-preview", "releaseAdmitted": false,
            "version": version, "sourceCommit": "1111111111111111111111111111111111111111",
            "files": [
                {"path": "SIREN.exe", "bytes": 13, "sha256": hash(b"known runtime")},
                {"path": "resources/app.asar", "bytes": 14, "sha256": hash(b"known renderer")}
            ]
        })).unwrap()).unwrap();
    }
    fn edit(&self, change: impl FnOnce(&mut serde_json::Value)) {
        let mut current: serde_json::Value = serde_json::from_slice(&fs::read(self.pointer()).unwrap()).unwrap();
        change(&mut current);
        fs::write(self.pointer(), serde_json::to_vec(&current).unwrap()).unwrap();
    }
    fn refused(&self) { assert!(select(&self.root).is_err(), "unsafe selector must refuse before launch"); }
}
impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.root); } }

#[test]
fn verified_selection_uses_fixed_version_executable_and_preserves_data() {
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.root.join("Data")).unwrap();
    fs::write(fixture.root.join("Data/private.txt"), b"private project").unwrap();
    let selected = select(&fixture.root).expect("complete preview should launch");
    assert_eq!(selected.executable, fixture.app().join("SIREN.exe"));
    assert_eq!(selected.version, "0.1.0");
    assert_eq!(selected.source_commit, "1111111111111111111111111111111111111111");
    assert_eq!(fs::read(fixture.root.join("Data/private.txt")).unwrap(), b"private project");
}

#[test]
fn missing_selector_does_not_fall_back_to_a_directory_or_arbitrary_executable() {
    let fixture = Fixture::new(); fs::remove_file(fixture.pointer()).unwrap(); fixture.refused();
}

#[test]
fn selection_refuses_escaping_and_noncanonical_versions() {
    for version in ["../Data", "C:/evil", "\\\\server\\share", "01.0.0", "0.1.0/../1.0.0", "0.1.0.", "0.1.0 ", "0.1.0-dev", "9007199254740992.0.0"] {
        let fixture = Fixture::new(); fixture.write_current(version); fixture.refused();
    }
}

#[test]
fn schema_kind_unknown_fields_duplicate_json_and_invalid_utf8_refuse() {
    for field in ["schema", "kind", "releaseAdmitted", "sourceCommit", "executable"] {
        let fixture = Fixture::new();
        fixture.edit(|record| record[field] = json!("invalid")); fixture.refused();
    }
    let fixture = Fixture::new();
    let original = fs::read_to_string(fixture.pointer()).unwrap();
    fs::write(fixture.pointer(), original.replacen("\"schema\":1", "\"schema\":1,\"schema\":1", 1)).unwrap(); fixture.refused();
    fs::write(fixture.pointer(), [0xff, 0xfe]).unwrap(); fixture.refused();
    fs::write(fixture.pointer(), vec![b' '; 1048577]).unwrap(); fixture.refused();
}

#[test]
fn corrupt_runtime_renderer_missing_and_extra_files_refuse() {
    let fixture = Fixture::new(); fs::write(fixture.app().join("SIREN.exe"), b"known runtimE").unwrap(); fixture.refused();
    let fixture = Fixture::new(); fs::write(fixture.app().join("resources/app.asar"), b"known rendereR").unwrap(); fixture.refused();
    let fixture = Fixture::new(); fs::remove_file(fixture.app().join("resources/app.asar")).unwrap(); fixture.refused();
    let fixture = Fixture::new(); fs::write(fixture.app().join("injected.dll"), b"unlisted").unwrap(); fixture.refused();
}

#[test]
fn unsafe_file_paths_case_collisions_and_required_assets_refuse() {
    for path in ["../Data/private.txt", "C:/evil.exe", "resources\\app.asar", "/SIREN.exe", "SIREN.exe:stream", "CON", "NUL.txt", "aux/x", "foo.", "foo ", "Data/test", "resources//test", "resources/./app.asar", "resources/../app.asar"] {
        let fixture = Fixture::new(); fixture.edit(|record| record["files"][0]["path"] = json!(path)); fixture.refused();
    }
    let fixture = Fixture::new(); fixture.edit(|record| record["files"][1]["path"] = json!("siren.exe")); fixture.refused();
    let fixture = Fixture::new(); fixture.edit(|record| record["files"] = json!([])); fixture.refused();
    let fixture = Fixture::new(); fixture.edit(|record| record["files"][0]["bytes"] = json!(9007199254740992_u64)); fixture.refused();
}

#[cfg(windows)]
#[test]
fn held_files_deny_write_and_delete_until_launch_guard_released() {
    let fixture = Fixture::new(); let selected = select(&fixture.root).unwrap();
    assert!(fs::write(fixture.app().join("SIREN.exe"), b"changed").is_err());
    assert!(fs::remove_file(fixture.pointer()).is_err());
    assert!(fs::rename(fixture.app(), fixture.root.join("App/versions/moved")).is_err());
    drop(selected);
    fs::write(fixture.app().join("SIREN.exe"), b"changed").unwrap();
}

#[cfg(windows)]
#[test]
fn junction_escape_and_hard_link_runtime_refuse() {
    use std::process::Command;
    let fixture = Fixture::new();
    let outside = fixture.root.join("outside"); fs::rename(fixture.app(), &outside).unwrap();
    let output = Command::new("cmd").args(["/c", "mklink", "/J"]).arg(fixture.app()).arg(&outside).output().unwrap();
    assert!(output.status.success(), "owned test junction creation failed");
    fixture.refused(); fs::remove_dir(fixture.app()).unwrap();
    let fixture = Fixture::new();
    fs::hard_link(fixture.app().join("SIREN.exe"), fixture.root.join("outside.exe")).unwrap(); fixture.refused();
}

#[test]
fn alias_parent_components_refuse_even_when_the_same_file_exists() {
    let fixture = Fixture::new();
    assert!(select(&fixture.root.join("App/..")).is_err());
}
