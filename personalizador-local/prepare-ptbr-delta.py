#!/usr/bin/env python3
"""Build a bounded incremental recipe from two privately supplied, verified ROMs.

Only changed ranges are emitted. Long sequences already in v3.3 are references
into the visitor's ROM; repeated bytes are fills. No complete ROM is packaged.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path

BASE = 'b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872'
TARGET = '83ff290cfca22a52f97c18134d86af012848c7e591627c6d96dba4e893aff3a9'
digest = lambda b: hashlib.sha256(b).hexdigest()

def generate(source, target):
    assert len(source) == len(target) == 2097152
    assert digest(source) == BASE and digest(target) == TARGET
    assert source[0x7c6a0:0x7c6ac] == target[0x7c6a0:0x7c6ac]
    assert target[0x115000:0x116000] == bytes([255]) * 4096
    index = defaultdict(list)
    for i in range(len(source)-15):
        key = source[i:i+16]
        if len(index[key]) < 4:
            index[key].append(i)
    ranges = []
    start = None
    last = None
    for i, (a, b) in enumerate(zip(source, target)):
        if a != b:
            if start is None: start = i
            elif i-last > 8:
                ranges.append((start, last+1)); start = i
            last = i
    if start is not None: ranges.append((start, last+1))
    ops = []
    for start, end in ranges:
        i = start
        literal = bytearray()
        def flush(at):
            if literal:
                ops.append(['w', at-len(literal), literal.hex()]); literal.clear()
        while i < end:
            run = i+1
            while run < end and target[run] == target[i]: run += 1
            best, where = 0, 0
            if run-i < 16 and i+16 <= end:
                for pos in index.get(target[i:i+16], []):
                    n = 16
                    while i+n < end and pos+n < len(source) and target[i+n] == source[pos+n]: n += 1
                    if n > best: best, where = n, pos
            if run-i >= 16:
                flush(i); ops.append(['f', i, run-i, target[i]]); i = run
            elif best >= 16:
                flush(i); ops.append(['c', i, best, where]); i += best
            else:
                literal.append(target[i]); i += 1
                if len(literal) == 256: flush(i)
        flush(i)
    data = {'version': 1, 'sourceSha256': BASE, 'targetSha256': TARGET,
            'size': len(target), 'checksum': 0xf687, 'ops': ops}
    check = bytearray(source)
    for op in ops:
        kind, at = op[:2]
        if kind == 'w': check[at:at+len(op[2])//2] = bytes.fromhex(op[2])
        elif kind == 'f': check[at:at+op[2]] = bytes([op[3]]) * op[2]
        else: check[at:at+op[2]] = source[op[3]:op[3]+op[2]]
    assert check == target
    return data

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--target', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    data = generate(args.baseline.read_bytes(), args.target.read_bytes())
    serialized = json.dumps(data, separators=(',', ':'))
    body = ('/* Incremental PT-BR/audio/Kimi patch; requires the visitor-provided verified v3.3. */\n'
            '(function(root){\n  const data = ' + serialized + ';\n'
            '  if(typeof module === "object" && module.exports) module.exports = data;\n'
            '  root.Grid2026PtbrDelta = data;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n')
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out/'ptbr-delta.js').write_text(body)
    metadata = {'format': 'incremental-ptbr-source-copy-v1', 'sourceSha256': BASE,
                'targetSha256': TARGET, 'dataSha256': digest(serialized.encode()),
                'publicFiles': {'ptbr-delta.js': {'sha256': digest(body.encode()), 'bytes': len(body.encode())}},
                'operations': len(data['ops']),
                'literalBytes': sum(len(o[2])//2 for o in data['ops'] if o[0] == 'w'),
                'sourceCopyBytes': sum(o[2] for o in data['ops'] if o[0] == 'c'),
                'fillBytes': sum(o[2] for o in data['ops'] if o[0] == 'f'),
                'scope': ['PT-BR text and graphical translation differences', 'seven authorized ElevenLabs narrator samples',
                          'Kimi portrait and three-slot grid rearrangement'],
                'notIncluded': ['complete ROM', 'original ROM audio files', 'reference photos', 'API credentials'],
                'playerSlot': 11, 'preservedPlayerRecord': '0007c73c0007c9500007fd44',
                'freePlayerBank': [0x115000, 0x116000]}
    (args.out/'ptbr-provenance.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(json.dumps(metadata))
