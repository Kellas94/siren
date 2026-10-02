use std::{env, fs};
fn main() {
    let executable = env::current_exe().unwrap();
    let root = executable.parent().unwrap().parent().unwrap().parent().unwrap().parent().unwrap();
    let record = format!("{}\n{}\n{}\n{}\n{}", executable.display(), env::current_dir().unwrap().display(), env::args().skip(1).count(), env::var("ELECTRON_RUN_AS_NODE").unwrap_or_default(), env::var("NODE_OPTIONS").unwrap_or_default());
    fs::write(root.join("Data/launcher-probe.txt"), record).unwrap();
}

