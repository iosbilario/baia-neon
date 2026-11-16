#!/usr/bin/env python3
"""Build the standalone HTML with stdlib only. No network, npm or minification."""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def build_offline(root: Path, output: Path, build_info=None) -> Path:
    html = (root / 'index.html').read_text(encoding='utf-8')
    if build_info and 'src/build-info.js' not in html:
        html = html.replace('<script src="src/config.js"></script>', '<script src="src/config.js"></script>\n  <script src="src/build-info.js"></script>')
    hashes = []
    def inline_script(match):
        source = root / match.group(1)
        if source.name == 'build-info.js' and build_info:
            code = '/* generated release metadata */\nwindow.BN=window.BN||{};BN.BUILD_INFO=Object.freeze(' + json.dumps(build_info, ensure_ascii=False, separators=(',', ':')) + ');'
        else:
            code = source.read_text(encoding='utf-8')
        content = '\n' + code.replace('</script', '<\\/script') + '\n'
        digest = base64.b64encode(hashlib.sha256(content.encode('utf-8')).digest()).decode('ascii')
        hashes.append("'sha256-" + digest + "'")
        return '<script>' + content + '</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    css = (root / 'styles.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    icon = base64.b64encode((root / 'assets/textures/icon.svg').read_bytes()).decode('ascii')
    html = html.replace('href="assets/textures/icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
    html = html.replace("script-src 'self'", 'script-src ' + ' '.join(hashes))
    if build_info:
        html = html.replace('<title>Baía Neon</title>', '<title>Baía Neon ' + build_info['version'] + '</title>')
        download = 'https://github.com/iosbilario/baia-neon/releases/download/' + build_info['tag'] + '/baia-neon-' + build_info['version'] + '-offline.html'
        html = html.replace('href="JOGAR_OFFLINE.html" download', 'href="' + download + '" download')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    return output

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'JOGAR_OFFLINE.html')
    parser.add_argument('--version')
    parser.add_argument('--tag')
    parser.add_argument('--sha')
    args = parser.parse_args()
    info = None
    if any((args.version, args.tag, args.sha)):
        if not all((args.version, args.tag, args.sha)): parser.error('--version, --tag and --sha must be used together')
        info = {'version':args.version, 'tag':args.tag, 'sha':args.sha, 'channel':'candidate' if '-rc.' in args.version else 'stable'}
    output = build_offline(ROOT, args.output, info)
    print(output.name, output.stat().st_size, 'bytes')

if __name__ == '__main__': main()
