use std::{path::{Path, PathBuf}, fs::{self, File, OpenOptions}, io::Read, collections::{BTreeMap, BTreeSet}};
use serde::Deserialize;
use sha2::{Digest, Sha256};

const MAX_METADATA_BYTES: u64 = 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 2 * 1024 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Pointer {
    schema: u32,
    kind: String,
    release_admitted: bool,
    version: String,
    source_commit: String,
    files: Vec<Asset>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Asset { path: String, bytes: u64, sha256: String }

pub struct Selection {
    pub executable: PathBuf,
    pub version: String,
    pub source_commit: String,
    pub(crate) _guards: Vec<File>,
}

impl Selection {
    pub fn recheck(&self) -> Result<(), String> { Ok(()) }
}

pub fn select(root: &Path) -> Result<Selection, String> {
    if !cfg!(feature = "development-preview") { return Err("PUBLISHER_NOT_CONFIGURED".into()); }
    let text = root.to_str().ok_or("ROOT_ENCODING_REFUSED")?;
    if !root.is_absolute() || normalized(text).split(['/', '\\']).any(|part| part == "." || part == "..") { return Err("ROOT_ALIAS_REFUSED".into()); }
    #[cfg(windows)]
    if normalized(text).starts_with("\\\\") { return Err("NETWORK_ROOT_NOT_QUALIFIED".into()); }
    let mut guards = vec![hold(root, true)?];
    let app = root.join("App"); guards.push(hold(&app, true)?);
    let versions = app.join("versions"); guards.push(hold(&versions, true)?);
    let mut current = hold(&app.join("current.json"), false)?;
    if current.metadata().map_err(|_| "SELECTION_READ_FAILED")?.len() == 0 || current.metadata().map_err(|_| "SELECTION_READ_FAILED")?.len() > MAX_METADATA_BYTES { return Err("SELECTION_SIZE_REFUSED".into()); }
    let mut bytes = Vec::new(); current.by_ref().take(MAX_METADATA_BYTES + 1).read_to_end(&mut bytes).map_err(|_| "SELECTION_READ_FAILED")?;
    if bytes.len() as u64 > MAX_METADATA_BYTES { return Err("SELECTION_SIZE_REFUSED".into()); }
    let pointer: Pointer = serde_json::from_slice(&bytes).map_err(|_| "SELECTION_JSON_REFUSED")?;
    if pointer.schema != 1 || pointer.kind != "development-preview" || pointer.release_admitted || !stable_version(&pointer.version) || !hex(&pointer.source_commit, 40) || pointer.files.is_empty() || pointer.files.len() > 50000 { return Err("SELECTION_FIELDS_REFUSED".into()); }
    let mut expected = BTreeMap::new(); let mut aliases = BTreeSet::new(); let mut total = 0_u64;
    for asset in &pointer.files {
        if !safe_asset_path(&asset.path) || !hex(&asset.sha256, 64) || asset.bytes > MAX_EXTRACTED_BYTES || !aliases.insert(asset.path.to_ascii_lowercase()) { return Err("ASSET_FIELDS_REFUSED".into()); }
        total = total.checked_add(asset.bytes).ok_or("EXTRACTED_LIMIT_REFUSED")?;
        if total > MAX_EXTRACTED_BYTES { return Err("EXTRACTED_LIMIT_REFUSED".into()); }
        expected.insert(asset.path.clone(), asset);
    }
    if !expected.contains_key("SIREN.exe") || !expected.contains_key("resources/app.asar") { return Err("REQUIRED_ASSET_MISSING".into()); }
    let version_root = versions.join(&pointer.version); guards.push(hold(&version_root, true)?); guards.push(current);
    let mut actual = BTreeSet::new();
    inspect_assets(&version_root, "", &expected, &mut actual, &mut guards)?;
    if actual.len() != expected.len() { return Err("ASSET_MISSING".into()); }
    Ok(Selection { executable: version_root.join("SIREN.exe"), version: pointer.version, source_commit: pointer.source_commit, _guards: guards })
}

fn stable_version(value: &str) -> bool {
    let parts: Vec<_> = value.split('.').collect();
    parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()) && !(part.len() > 1 && part.starts_with('0')) && part.parse::<u64>().is_ok_and(|number| number <= 9007199254740991))
}
fn hex(value: &str, length: usize) -> bool { value.len() == length && value.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)) }
fn safe_asset_path(value: &str) -> bool {
    if value.is_empty() || value.len() > 240 || !value.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"._ /-".contains(&byte)) { return false; }
    let first = value.split('/').next().unwrap().to_ascii_lowercase();
    if ["data", "projects", "recovery", "account"].contains(&first.as_str()) { return false; }
    value.split('/').all(|part| {
        if part.is_empty() || part == "." || part == ".." || part.ends_with(['.', ' ']) { return false; }
        let stem = part.split('.').next().unwrap().to_ascii_lowercase();
        !["con", "prn", "aux", "nul"].contains(&stem.as_str()) && !(stem.len() == 4 && (stem.starts_with("com") || stem.starts_with("lpt")) && (b'1'..=b'9').contains(&stem.as_bytes()[3]))
    })
}
fn normalized(value: &str) -> String {
    #[cfg(windows)]
    {
        if let Some(rest) = value.strip_prefix("\\\\?\\UNC\\") { return format!("\\\\{rest}"); }
        return value.strip_prefix("\\\\?\\").unwrap_or(value).replace('/', "\\");
    }
    #[cfg(not(windows))]
    value.to_owned()
}

fn hold(path: &Path, directory: bool) -> Result<File, String> {
    let before = fs::symlink_metadata(path).map_err(|error| format!("ASSET_OPEN_FAILED: {} ({error})", path.display()))?;
    if before.file_type().is_symlink() || (directory && !before.is_dir()) || (!directory && !before.is_file()) { return Err("ASSET_TYPE_REFUSED".into()); }
    let mut options = OpenOptions::new(); options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
        if before.file_attributes() & 0x400 != 0 { return Err("REPARSE_ASSET_REFUSED".into()); }
        options.share_mode(1).custom_flags(0x00200000 | if directory { 0x02000000 } else { 0 });
    }
    let file = options.open(path).map_err(|_| "ASSET_LOCK_FAILED")?;
    let metadata = file.metadata().map_err(|_| "ASSET_IDENTITY_FAILED")?;
    if (directory && !metadata.is_dir()) || (!directory && !metadata.is_file()) { return Err("ASSET_TYPE_REFUSED".into()); }
    #[cfg(windows)]
    windows::verify_handle(&file, path, directory)?;
    #[cfg(not(windows))]
    {
        use std::os::unix::fs::MetadataExt;
        if !directory && metadata.nlink() != 1 { return Err("LINKED_ASSET_REFUSED".into()); }
        if fs::canonicalize(path).map_err(|_| "ASSET_IDENTITY_FAILED")? != path { return Err("ASSET_ALIAS_REFUSED".into()); }
    }
    Ok(file)
}

fn inspect_assets(directory: &Path, prefix: &str, expected: &BTreeMap<String, &Asset>, actual: &mut BTreeSet<String>, guards: &mut Vec<File>) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|_| "ASSET_CENSUS_FAILED")? {
        let entry = entry.map_err(|_| "ASSET_CENSUS_FAILED")?;
        let name = entry.file_name().into_string().map_err(|_| "ASSET_PATH_REFUSED")?;
        let relative = if prefix.is_empty() { name } else { format!("{prefix}/{name}") };
        if !safe_asset_path(&relative) { return Err("ASSET_PATH_REFUSED".into()); }
        let info = fs::symlink_metadata(entry.path()).map_err(|_| "ASSET_IDENTITY_FAILED")?;
        if info.is_dir() {
            let guard = hold(&entry.path(), true)?; guards.push(guard);
            inspect_assets(&entry.path(), &relative, expected, actual, guards)?;
            continue;
        }
        let asset = expected.get(&relative).ok_or("UNLISTED_ASSET_REFUSED")?;
        if !actual.insert(relative) || actual.len() > 50000 { return Err("ASSET_ALIAS_REFUSED".into()); }
        let mut file = hold(&entry.path(), false)?;
        if file.metadata().map_err(|_| "ASSET_IDENTITY_FAILED")?.len() != asset.bytes { return Err("ASSET_SIZE_REFUSED".into()); }
        let mut digest = Sha256::new(); let mut buffer = [0_u8; 65536]; let mut bytes = 0_u64;
        loop {
            let read = file.read(&mut buffer).map_err(|_| "ASSET_READ_FAILED")?;
            if read == 0 { break; }
            bytes += read as u64; if bytes > asset.bytes { return Err("ASSET_SIZE_REFUSED".into()); }
            digest.update(&buffer[..read]);
        }
        let hash: String = digest.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
        if bytes != asset.bytes || hash != asset.sha256 { return Err("ASSET_HASH_REFUSED".into()); }
        guards.push(file);
    }
    Ok(())
}

#[cfg(windows)]
mod windows {
    use std::{ffi::c_void, fs::File, mem::MaybeUninit, os::windows::io::AsRawHandle, path::Path};
    #[repr(C)] struct FileTime { low: u32, high: u32 }
    #[repr(C)] struct Information { attributes: u32, creation: FileTime, access: FileTime, write: FileTime, volume: u32, size_high: u32, size_low: u32, links: u32, index_high: u32, index_low: u32 }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetFileInformationByHandle(handle: *mut c_void, information: *mut Information) -> i32;
        fn GetFinalPathNameByHandleW(handle: *mut c_void, path: *mut u16, length: u32, flags: u32) -> u32;
    }
    pub fn verify_handle(file: &File, expected: &Path, directory: bool) -> Result<(), String> {
        let mut information = MaybeUninit::<Information>::uninit();
        // The handle is owned by File and both API buffers remain valid for the
        // call. Only read the initialized structure after successful Win32 IO.
        if unsafe { GetFileInformationByHandle(file.as_raw_handle(), information.as_mut_ptr()) } == 0 { return Err("ASSET_IDENTITY_FAILED".into()); }
        let information = unsafe { information.assume_init() };
        if information.attributes & 0x400 != 0 || (!directory && information.links != 1) { return Err("LINKED_OR_REPARSE_ASSET_REFUSED".into()); }
        let mut buffer = vec![0_u16; 32768];
        let length = unsafe { GetFinalPathNameByHandleW(file.as_raw_handle(), buffer.as_mut_ptr(), buffer.len() as u32, 0) } as usize;
        if length == 0 || length >= buffer.len() { return Err("ASSET_IDENTITY_FAILED".into()); }
        let actual = String::from_utf16(&buffer[..length]).map_err(|_| "ASSET_ENCODING_REFUSED")?;
        let expected = expected.to_str().ok_or("ASSET_ENCODING_REFUSED")?;
        if !super::normalized(&actual).eq_ignore_ascii_case(&super::normalized(expected)) { return Err("ASSET_ALIAS_REFUSED".into()); }
        Ok(())
    }
}
