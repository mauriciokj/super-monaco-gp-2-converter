#!/usr/bin/env python3
"""Configure an external, known 2026 IPS delta for the private local prototype.

This program contains no game payload. Its generated JS is ignored by Git.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import tempfile

EXPECTED_SIZE = 131783
EXPECTED_SHA = '0fbc5cd9f26ddced20f1b7cd27a61d5869dc19d2539854d109672e0f49c20830'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--patch', required=True, type=Path, help='External original-to-Grid2026-v3.3 IPS file')
    args = parser.parse_args()
    raw = args.patch.read_bytes()
    if len(raw) != EXPECTED_SIZE or hashlib.sha256(raw).hexdigest() != EXPECTED_SHA:
        raise SystemExit('Patch recusado: use o delta completo original → Grid2026 v3.3 verificado.')
    if raw[:5] != b'PATCH' or raw[-6:-3] != b'EOF' or int.from_bytes(raw[-3:], 'big') != 2097152:
        raise SystemExit('Patch recusado: estrutura ou tamanho final inesperado.')
    destination = Path(__file__).resolve().parent / 'local-grid2026-data.js'
    if destination.resolve() == args.patch.resolve():
        raise SystemExit('Destino não pode substituir a fonte.')
    package = {'format': 'IPS', 'size': len(raw), 'sha256': EXPECTED_SHA,
               'base64': base64.b64encode(raw).decode('ascii')}
    code = ('/* PRIVATE LOCAL DATA: game delta; do not commit, distribute or publish. */\n'
            'window.LOCAL_GRID2026_PATCH = ' + json.dumps(package, separators=(',', ':')) + ';\n')
    descriptor, temp_name = tempfile.mkstemp(prefix='.grid2026-', dir=destination.parent)
    try:
        with os.fdopen(descriptor, 'w') as output:
            output.write(code)
        os.replace(temp_name, destination)
    finally:
        Path(temp_name).unlink(missing_ok=True)
    print('Pacote privado local2026 configurado. Este arquivo gerado deve permanecer fora do Git.')


if __name__ == '__main__':
    main()
