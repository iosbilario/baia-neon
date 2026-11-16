#!/usr/bin/env python3
"""Create deterministic web and offline release artifacts from a checked-out SHA."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from package import build_offline

DEFAULT_ROOT = Path(__file__).resolve().parents[1]
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
SITE_ENTRIES = ['index.html', 'styles.css', '.nojekyll', 'assets', 'src', 'vendor', 'licenses', 'LICENSE', 'LEIA_PRIMEIRO.md']

def write_zip(output: Path, files):
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source, name in sorted(files, key=lambda item: item[1]):
            info = zipfile.ZipInfo(name.replace('\\', '/'), FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())

def tree_files(root: Path):
    return [(item, item.relative_to(root).as_posix()) for item in root.rglob('*') if item.is_file()]

def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): digest.update(chunk)
    return digest.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--out', type=Path, default=DEFAULT_ROOT / 'dist')
    args = parser.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-rc\.\d+)?', args.version): parser.error('invalid version')
    if args.tag != 'v' + args.version: parser.error('tag must be vVERSION')
    if not re.fullmatch(r'[0-9a-f]{40}', args.sha): parser.error('sha must have 40 lowercase hexadecimal characters')
    root, out = args.root.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    web = out / 'web'
    if web.exists(): shutil.rmtree(web)
    web.mkdir()
    for entry in SITE_ENTRIES:
        source = root / entry
        if not source.exists(): raise SystemExit('missing release entry: ' + entry)
        destination = web / entry
        if source.is_dir(): shutil.copytree(source, destination)
        else: shutil.copy2(source, destination)
    info = {'version':args.version, 'tag':args.tag, 'sha':args.sha, 'channel':'candidate' if '-rc.' in args.version else 'stable'}
    web_index = web / 'index.html'
    index_text = web_index.read_text(encoding='utf-8')
    if 'src/build-info.js' not in index_text:
        index_text = index_text.replace('<script src="src/config.js"></script>', '<script src="src/config.js"></script>\n  <script src="src/build-info.js"></script>')
    index_text = index_text.replace('<title>Baía Neon</title>', '<title>Baía Neon ' + args.version + '</title>')
    download = f'https://github.com/iosbilario/baia-neon/releases/download/{args.tag}/baia-neon-{args.version}-offline.html'
    index_text = index_text.replace('href="JOGAR_OFFLINE.html" download', f'href="{download}" download')
    web_index.write_text(index_text, encoding='utf-8')
    (web / 'src/build-info.js').write_text('/* generated release metadata */\nwindow.BN=window.BN||{};BN.BUILD_INFO=Object.freeze(' + json.dumps(info, ensure_ascii=False, separators=(',', ':')) + ');\n', encoding='utf-8')
    build_info = out / 'build-info.json'; build_info.write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copy2(build_info, web / 'build-info.json')
    offline_html = out / f'baia-neon-{args.version}-offline.html'
    build_offline(root, offline_html, info)
    web_zip = out / f'baia-neon-{args.version}-web.zip'; write_zip(web_zip, tree_files(web))
    offline_root = out / 'offline'; offline_root.mkdir(exist_ok=True)
    offline_named = offline_root / offline_html.name; shutil.copy2(offline_html, offline_named)
    for name in ['LEIA_PRIMEIRO.md', 'LICENSE']:
        shutil.copy2(root / name, offline_root / name)
    if (offline_root / 'licenses').exists(): shutil.rmtree(offline_root / 'licenses')
    shutil.copytree(root / 'licenses', offline_root / 'licenses')
    shutil.copy2(build_info, offline_root / 'build-info.json')
    offline_zip = out / f'baia-neon-{args.version}-offline.zip'; write_zip(offline_zip, tree_files(offline_root))
    hashes = out / 'SHA256SUMS.txt'
    hashed = [web_zip, offline_html, offline_zip, build_info]
    hashes.write_text(''.join(f'{sha256(path)}  {path.name}\n' for path in hashed), encoding='utf-8')
    print(json.dumps({'version':args.version, 'tag':args.tag, 'sha':args.sha, 'artifacts':[p.name for p in [web_zip, offline_html, offline_zip, hashes, build_info]]}, ensure_ascii=False))

if __name__ == '__main__': main()
