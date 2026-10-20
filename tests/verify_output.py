"""Independent local check. Requires an external user-owned baseline via TEST_ROM."""
from pathlib import Path
import hashlib
import json
import os
import struct

ROOT = Path(__file__).resolve().parents[1]
if not os.environ.get('TEST_ROM'):
    raise SystemExit('Defina TEST_ROM com o caminho externo da sua ROM Grid 2026 v3.3.')


def decode_portrait(source, start):
    """Separate bounded reader for the format consumed by the original game."""
    cursor, flags, remaining = start, 0, 0
    decoded = bytearray()

    def read():
        nonlocal cursor
        if cursor >= len(source):
            raise ValueError('truncated compressed portrait')
        result = source[cursor]
        cursor += 1
        return result

    def take_flag():
        nonlocal flags, remaining
        if remaining == 0:
            flags, remaining = read() + 256 * read(), 16
        result = flags % 2
        flags //= 2
        remaining -= 1
        if remaining == 0:
            flags, remaining = read() + 256 * read(), 16
        return result

    while cursor - start <= 8192:
        if take_flag():
            chunk = bytes([read()])
        else:
            if take_flag():
                low, high = read(), read()
                delta = ((high & 248) * 32 + low) - 8192
                count = high & 7
                if count:
                    count += 2
                else:
                    count = read()
                    if count == 0:
                        return bytes(decoded), cursor
                    if count == 1:
                        continue
                    count += 1
            else:
                count = 2 * take_flag() + take_flag() + 2
                delta = read() - 256
            assert 0 < -delta <= len(decoded)
            for _ in range(count):
                decoded.append(decoded[len(decoded) + delta])
            chunk = b''
        decoded.extend(chunk)
        assert len(decoded) <= 2048
    raise ValueError('compressed portrait too long')


base = Path(os.environ['TEST_ROM']).read_bytes()
out = (ROOT / 'evidence/synthetic-QA-only.bin').read_bytes()
assert len(base) == len(out) == 0x200000
assert hashlib.sha256(base).hexdigest() == 'b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872'
allowed = [(0x18e, 0x190), (0x7c6a4, 0x7c6ac), (0x115000, 0x11501a), (0x115020, 0x115925)]
diff = [i for i in range(len(base)) if base[i] != out[i]]
assert all(any(a <= i < z for a, z in allowed) for i in diff)
assert struct.unpack_from('>H', out, 0x18e)[0] == sum(struct.unpack_from('>H', out, i)[0] for i in range(0x200, len(out), 2)) & 65535
assert struct.unpack_from('>III', out, 0x7c6a0) == (0x7c73c, 0x115000, 0x115020)
raw, end = decode_portrait(out, 0x115020)
assert len(raw) == 2048 and end == 0x115925
indices = bytearray(4096)
n = 0
for ty in range(8):
    for tx in range(8):
        for y in range(8):
            for x in range(0, 8, 2):
                p = (ty * 8 + y) * 64 + tx * 8 + x
                indices[p] = raw[n] >> 4
                indices[p + 1] = raw[n] & 15
                n += 1
safe = {3, 4, 5, 6, 7, 11, 12, 13, 15}
assert set(indices) <= safe
palette = [0, 0, 174] + list(struct.unpack_from('>13H', out, 0x115000))
for index in (8, 9, 10, 14):
    assert palette[index] == struct.unpack_from('>H', base, 0x7c950 + (index - 3) * 2)[0]
pixels = json.loads((ROOT / 'evidence/synthetic-preview-rgba.json').read_text())
for i, index in enumerate(indices):
    word = palette[index]
    # JS Math.round for the hardware lattice has no ties here.
    expected = [int((word & 14) * 255 / 14 + .5), int(((word >> 4) & 14) * 255 / 14 + .5), int(((word >> 8) & 14) * 255 / 14 + .5), 255]
    assert pixels[i * 4:i * 4 + 4] == expected
for slot in range(24):
    if slot != 11:
        off = 0x7c61c + slot * 12
        assert base[off:off + 12] == out[off:off + 12]
restored = bytearray(out)
for i in diff:
    restored[i] = base[i]
assert restored == base
result = {
    'status': 'passed', 'testOnly': True,
    'output_sha256': hashlib.sha256(out).hexdigest(), 'size': len(out), 'changed_bytes': len(diff),
    'checksum': f'{struct.unpack_from(">H", out, 0x18e)[0]:04X}',
    'all_differences_allowlisted': True, 'independent_decoder': 'separate Python implementation',
    'decoded_preview_pixels_equal': 4096, 'untouched_other_records': 23,
    'reserved_palette_words_unchanged': True, 'exact_baseline_restoration_verified': True,
    'game_emulator_qa': 'pending; static verification only'
}
(ROOT / 'evidence/independent-output-check.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
