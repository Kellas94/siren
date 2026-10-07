#![cfg(not(feature = "development-preview"))]
#[test]
fn production_without_a_trusted_publisher_cannot_launch_a_development_selector() {
    let path = std::env::temp_dir().join("SIREN no publisher root");
    let error = siren_launcher::selection::select(&path).err().expect("unconfigured production launcher must refuse");
    assert_eq!(error, "PUBLISHER_NOT_CONFIGURED");
}
