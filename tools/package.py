#!/usr/bin/env python3
"""Build the offline HTML with stdlib only. No network, npm or minification."""
from pathlib import Path
import base64
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text(encoding='utf-8')
hashes = []

def inline_script(match):
    source = ROOT / match.group(1)
    code = source.read_text(encoding='utf-8').replace('</script', '<\\/script')
    content = '\n' + code + '\n'
    digest = base64.b64encode(hashlib.sha256(content.encode('utf-8')).digest()).decode('ascii')
    hashes.append("'sha256-" + digest + "'")
    return '<script>' + content + '</script>'

html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
css = (ROOT / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
icon = base64.b64encode((ROOT / 'assets/textures/icon.svg').read_bytes()).decode('ascii')
html = html.replace('href="assets/textures/icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
html = html.replace("script-src 'self'", 'script-src ' + ' '.join(hashes))
output = ROOT / 'JOGAR_OFFLINE.html'
output.write_text(html, encoding='utf-8')
print(output.name, output.stat().st_size, 'bytes')
