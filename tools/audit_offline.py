#!/usr/bin/env python3
"""Static dependency and packaging checks. Does not replace a browser test."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]

class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.policy = ''
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img', 'audio', 'video', 'source', 'iframe') and 'src' in attrs:
            self.refs.append(attrs['src'])
        if tag == 'link' and 'href' in attrs:
            self.refs.append(attrs['href'])
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'content-security-policy':
            self.policy = attrs.get('content', '')

for name in ['index.html', 'JOGAR_OFFLINE.html']:
    html = (ROOT / name).read_text(encoding='utf-8')
    parser = ResourceParser()
    parser.feed(html)
    assert "connect-src 'none'" in parser.policy, 'external connection policy missing'
    for ref in parser.refs:
        assert not re.match(r'(https?:)?//', ref), (name, ref)
        assert ref.startswith('data:') or (ROOT / ref).is_file(), (name, 'missing', ref)
    if name == 'JOGAR_OFFLINE.html':
        assert all(ref.startswith('data:') for ref in parser.refs), 'standalone file has resource dependency'
        scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
        assert len(scripts) == 6, len(scripts)
        for script in scripts:
            digest = base64.b64encode(hashlib.sha256(script.encode('utf-8')).digest()).decode('ascii')
            assert "'sha256-" + digest + "'" in parser.policy, 'inline script CSP hash mismatch'
    print('OK', name, 'local resources and CSP')

for source in (ROOT / 'src').glob('*.js'):
    code = source.read_text(encoding='utf-8')
    for pattern in [r'\bfetch\s*\(', r'\bXMLHttpRequest\b', r'\bWebSocket\b', r'\bsendBeacon\b', r'\bimport\s*\(']:
        assert not re.search(pattern, code), (source.name, pattern)
print('OK own game code has no network APIs or dynamic imports')
print('Static offline audit passed. Browser network and GPU checks remain separate.')
