use std::io::Cursor;
use std::path::Path;
use std::path::PathBuf;

pub fn extract_zip_file(zip_path: &PathBuf,extract_dir: &Path,strip_top_dir: bool) -> Result<(), zip_extract::ZipExtractError> {
    let archive: Vec<u8> = std::fs::read(zip_path)?;
    zip_extract::extract(Cursor::new(archive), extract_dir, strip_top_dir)?;
    Ok(())
}

pub fn extract_and_delete_zip_file(zip_path: &PathBuf,extract_dir: &Path,strip_top_dir: bool) -> Result<(), zip_extract::ZipExtractError> {
    extract_zip_file(zip_path, extract_dir, strip_top_dir)?;
    std::fs::remove_file(zip_path)?;
    Ok(())
}
