"""Create a portable ZIP with relative member paths and verify its CRCs."""
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

source, destination = map(Path, sys.argv[1:])
with ZipFile(destination, 'x', compression=ZIP_DEFLATED, compresslevel=1) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(source).as_posix())
with ZipFile(destination) as archive:
    invalid = archive.testzip()
    if invalid:
        raise ValueError(f'ZIP integrity check failed: {invalid}')
