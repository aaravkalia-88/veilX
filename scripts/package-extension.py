"""Package the explicit runtime asset set, never stray development files."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
source = root / "dist/extension"
files = [
    "manifest.json",
    "panel.html",
    "background.js",
    "panel.js",
    "content.js",
    "styles.css",
    "icon.svg",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png",
    "THIRD_PARTY_LICENSES.txt",
    "LICENSE.txt",
]
with ZipFile(
    root / "dist/veilx-extension.zip", "w", compression=ZIP_DEFLATED, compresslevel=9
) as archive:
    for name in files:
        archive.write(source / name, name)
