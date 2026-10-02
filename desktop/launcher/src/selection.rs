use std::{path::{Path, PathBuf}, fs::File};

pub struct Selection {
    pub executable: PathBuf,
    pub version: String,
    pub source_commit: String,
    pub(crate) _guards: Vec<File>,
}

pub fn select(_root: &Path) -> Result<Selection, String> {
    Err("Launcher selection is not implemented".into())
}

