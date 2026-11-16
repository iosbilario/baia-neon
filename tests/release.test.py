#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SHA = 'a' * 40
EXPECTED = {
    'baia-neon-0.3.0-rc.1-web.zip',
    'baia-neon-0.3.0-rc.1-offline.html',
    'baia-neon-0.3.0-rc.1-offline.zip',
    'SHA256SUMS.txt',
    'build-info.json'
}
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def build(out):
    subprocess.run(['python3', str(ROOT/'tools/release.py'), '--version','0.3.0-rc.1','--tag','v0.3.0-rc.1','--sha',SHA,'--root',str(ROOT),'--out',str(out)], check=True, capture_output=True, text=True)
with tempfile.TemporaryDirectory() as tmp:
    first, second = Path(tmp)/'one', Path(tmp)/'two'; build(first); build(second)
    assert EXPECTED <= {item.name for item in first.iterdir()}
    info = json.loads((first/'build-info.json').read_text())
    assert info == {'version':'0.3.0-rc.1','tag':'v0.3.0-rc.1','sha':SHA,'channel':'candidate'}
    sums = dict(line.split('  ',1)[::-1] for line in (first/'SHA256SUMS.txt').read_text().splitlines())
    for name in EXPECTED - {'SHA256SUMS.txt'}: assert sums[name] == digest(first/name)
    assert digest(first/'baia-neon-0.3.0-rc.1-web.zip') == digest(second/'baia-neon-0.3.0-rc.1-web.zip')
    assert digest(first/'baia-neon-0.3.0-rc.1-offline.zip') == digest(second/'baia-neon-0.3.0-rc.1-offline.zip')
    with zipfile.ZipFile(first/'baia-neon-0.3.0-rc.1-web.zip') as archive:
        names = archive.namelist(); assert 'index.html' in names and 'build-info.json' in names and 'src/build-info.js' in names
        assert all(not name.startswith('/') and '..' not in Path(name).parts for name in names)
    offline = (first/'baia-neon-0.3.0-rc.1-offline.html').read_text()
    assert 'v0.3.0-rc.1' in offline and SHA in offline and 'https://github.com/iosbilario/baia-neon/releases/download/v0.3.0-rc.1/' in offline
print('OK deterministic release packages, metadata, hashes and paths')
