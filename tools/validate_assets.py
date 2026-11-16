#!/usr/bin/env python3
"""Validate the shipped asset manifest and local payloads. No network access.

Usage
    python3 tools/validate_assets.py
Requires Python 3 and Pillow. NumPy is not required.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import math
import struct
import sys
import wave
import xml.etree.ElementTree as ET
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
COMPONENTS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
              5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
ELEMENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
            'MAT2': 4, 'MAT3': 9, 'MAT4': 16}


def check(condition, message):
    if not condition:
        raise ValueError(message)


def validate_glb(path, meta):
    raw = path.read_bytes()
    check(len(raw) >= 28, 'GLB is too short')
    magic, version, total = struct.unpack_from('<4sII', raw)
    check(magic == b'glTF' and version == 2, 'Invalid GLB header')
    check(total == len(raw), 'GLB total length mismatch')
    chunks = []
    offset = 12
    while offset < len(raw):
        check(offset % 4 == 0 and offset + 8 <= len(raw), 'Invalid chunk boundary')
        size, kind = struct.unpack_from('<I4s', raw, offset)
        offset += 8
        check(size % 4 == 0 and offset + size <= len(raw), 'Invalid chunk range')
        chunks.append((kind, raw[offset:offset + size]))
        offset += size
    check(len(chunks) == 2, 'Expected one JSON and one BIN chunk')
    check(chunks[0][0] == b'JSON' and chunks[1][0] == b'BIN\x00', 'Invalid GLB chunks')
    doc = json.loads(chunks[0][1])
    binary = chunks[1][1]
    check(doc['asset']['version'] == '2.0', 'Invalid glTF version')
    check(doc['extras']['forward'] == meta['forward'] == '+Z', 'Model forward must match runtime +Z')
    check(len(doc['buffers']) == 1, 'Expected one embedded buffer')
    check('uri' not in doc['buffers'][0], 'External buffer reference')
    length = doc['buffers'][0]['byteLength']
    check(0 <= len(binary) - length <= 3, 'Buffer length or padding mismatch')
    for img in doc.get('images', []):
        check('uri' not in img, 'External image reference')
    views = doc['bufferViews']
    for view in views:
        start = view.get('byteOffset', 0)
        size = view['byteLength']
        check(view['buffer'] == 0 and start >= 0 and size > 0, 'Invalid buffer view')
        check(start + size <= length, 'Buffer view exceeds embedded data')
        if 'byteStride' in view:
            check(4 <= view['byteStride'] <= 252 and view['byteStride'] % 4 == 0,
                  'Invalid buffer view stride')
    values = []
    for accessor in doc['accessors']:
        check('sparse' not in accessor, 'Unexpected sparse accessor in this pack')
        vi = accessor['bufferView']
        check(0 <= vi < len(views), 'Accessor references missing buffer view')
        view = views[vi]
        fmt, width = COMPONENTS[accessor['componentType']]
        count = accessor['count']
        dims = ELEMENTS[accessor['type']]
        item_size = dims * width
        stride = view.get('byteStride', item_size)
        start = accessor.get('byteOffset', 0)
        check(count > 0 and start >= 0 and start % width == 0, 'Invalid accessor count or offset')
        check(stride >= item_size, 'Accessor element exceeds stride')
        check(start + (count - 1) * stride + item_size <= view['byteLength'],
              'Accessor exceeds buffer view')
        start += view.get('byteOffset', 0)
        rows = [struct.unpack_from('<' + fmt * dims, binary, start + i * stride)
                for i in range(count)]
        check(all(math.isfinite(x) for row in rows for x in row), 'Nonfinite accessor data')
        for key, fn in [('min', min), ('max', max)]:
            if key in accessor:
                bounds = accessor[key]
                actual = [fn(row[c] for row in rows) for c in range(dims)]
                check(len(bounds) == dims and all(abs(a-b) <= 1e-5 * max(1, abs(a))
                      for a, b in zip(actual, bounds)), 'Accessor bounds differ from actual data')
        values.append(rows)
    triangles = 0
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            check(prim.get('mode', 4) == 4, 'Expected TRIANGLES primitive')
            ai = prim['attributes']['POSITION']
            check(0 <= ai < len(values), 'Missing position accessor')
            check(doc['accessors'][ai]['type'] == 'VEC3', 'Position must be VEC3')
            vertices = values[ai]
            if 'indices' in prim:
                indices = [r[0] for r in values[prim['indices']]]
                check(all(isinstance(i, int) and 0 <= i < len(vertices) for i in indices),
                      'Triangle index outside vertex range')
            else:
                indices = list(range(len(vertices)))
            check(len(indices) % 3 == 0, 'Triangle vertex count mismatch')
            triangles += len(indices) // 3
            if 'NORMAL' in prim['attributes']:
                ni = prim['attributes']['NORMAL']
                check(len(values[ni]) == len(vertices), 'Normal count mismatch')
                check(all(abs(sum(x*x for x in n)-1) < .002 for n in values[ni]),
                      'Normal is not a unit vector')
            check(0 <= prim['material'] < len(doc['materials']), 'Missing primitive material')
    check(triangles == meta['triangles'], 'Catalog triangle count mismatch')
    nodes = doc['nodes']
    check(len(nodes) == meta['nodes'], 'Catalog node count mismatch')
    for node in nodes:
        if 'mesh' in node:
            check(0 <= node['mesh'] < len(doc['meshes']), 'Node references missing mesh')
        for child in node.get('children', []):
            check(0 <= child < len(nodes), 'Node references missing child')
    check(0 <= doc.get('scene', 0) < len(doc['scenes']), 'Missing default scene')
    for scene in doc['scenes']:
        check(all(0 <= i < len(nodes) for i in scene['nodes']), 'Missing scene node')
        check(len(scene['nodes']) == 1, 'Expected one orientation root')
        root = nodes[scene['nodes'][0]]
        check(root.get('rotation') == [0, 1, 0, 0], 'Expected 180-degree Y orientation root')
        check(len(root.get('children', [])) == len(nodes) - 1, 'Orientation root omits model parts')


def validate_png(path, meta):
    with Image.open(path) as image:
        check(image.format == 'PNG', 'Expected PNG file')
        image.verify()
    with Image.open(path) as image:
        image.load()
        if meta['kind'] == 'texture':
            check(image.size == (meta['width'], meta['height']), 'Catalog PNG dimensions differ')
            if meta['seamless']:
                w, h = image.size
                check(image.crop((0, 0, 1, h)).tobytes() == image.crop((w-1, 0, w, h)).tobytes(),
                      'Horizontal texture seam does not match')
                check(image.crop((0, 0, w, 1)).tobytes() == image.crop((0, h-1, w, h)).tobytes(),
                      'Vertical texture seam does not match')


def validate_wav(path, meta):
    with wave.open(str(path), 'rb') as sound:
        channels = sound.getnchannels()
        width = sound.getsampwidth()
        rate = sound.getframerate()
        frames = sound.getnframes()
        check(sound.getcomptype() == 'NONE', 'Expected PCM WAV')
        check(channels == meta['channels'] and width * 8 == meta['bits'] and rate == meta['sample_rate'],
              'Catalog WAV format differs')
        check(abs(frames / rate - meta['seconds']) <= .00051, 'Catalog WAV duration differs')
        payload = sound.readframes(frames)
        check(len(payload) == frames * channels * width, 'Truncated WAV sample frames')
        check(frames > 0, 'Empty WAV')


def validate_svg(path):
    root = ET.parse(path).getroot()
    check(root.tag == '{http://www.w3.org/2000/svg}svg', 'Expected SVG root')
    check(root.get('viewBox') == '0 0 64 64', 'Unexpected SVG view box')
    for node in root.iter():
        tag = node.tag.split('}')[-1].lower()
        check(tag not in ('script', 'foreignobject', 'image', 'use'), 'SVG external or executable element')
        check(not any(k.split('}')[-1].lower().startswith('on') for k in node.attrib),
              'SVG event handler')
        check(not any('href' in k.lower() for k in node.attrib), 'SVG external reference')


def main():
    manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))
    seen = set()
    counts = Counter()
    total = 0
    for meta in manifest['files']:
        path = ASSETS / meta['path']
        try:
            check(path.resolve().is_relative_to(ASSETS.resolve()), 'Asset path escapes assets directory')
            check(meta['path'] not in seen, 'Duplicate catalog path')
            seen.add(meta['path'])
            payload = path.read_bytes()
            check(len(payload) == meta['bytes'], 'Catalog file size differs')
            check(hashlib.sha256(payload).hexdigest() == meta['sha256'], 'SHA-256 mismatch')
            kind = meta['kind']
            if kind == 'model': validate_glb(path, meta)
            elif kind in ('texture', 'preview'): validate_png(path, meta)
            elif kind == 'audio': validate_wav(path, meta)
            elif kind == 'icon': validate_svg(path)
            else: raise ValueError('Unknown asset kind')
            counts[kind] += 1
            total += len(payload)
        except Exception as exc:
            print(json.dumps({'ok': False, 'file': meta['path'], 'error': str(exc)}))
            return 1
    check(counts['texture'] == 16 and counts['model'] == 9 and counts['audio'] == 9,
          'Expected 16 PNG textures, 9 GLB models and 9 WAV clips')
    print(json.dumps({'ok': True, 'files': len(seen), 'bytes': total, 'counts': dict(counts)}, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
