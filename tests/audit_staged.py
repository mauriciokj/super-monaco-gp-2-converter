"""Fail closed on unexpected staged files, binary data and obvious private material."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

allowed = {
    '.gitignore', 'README.md', 'docs/TECHNICAL.md', 'docs/VALIDATION.md',
    'personalizador-local/index.html', 'personalizador-local/app.js',
    'personalizador-local/core.js', 'personalizador-local/core.test.cjs',
    'personalizador-local/spec.js', 'personalizador-local/style.css',
    'personalizador-local/serve.py', 'tests/browser.cjs',
    'personalizador-local/pipeline.js', 'personalizador-local/pipeline.test.cjs',
    'personalizador-local/prepare-local-data.py',
    'tests/verify_output.py', 'tests/audit_staged.py',
    'personalizador-local/app.test.cjs', 'personalizador-local/analytics.js',
    'personalizador-local/analytics.test.cjs', 'personalizador-local/prepare-public.py',
    'tests/metrics-browser.cjs', 'tests/public_package_test.py', 'docs/PUBLISHING.md',
    'vercel.json', 'personalizador-local/season-assets.js',
    'personalizador-local/season-recipe.js', 'personalizador-local/season-provenance.json',
    'personalizador-local/season.test.cjs', 'personalizador-local/prepare-season-recipe.py',
}
names = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z']).decode().split('\0')
files, failures = [], []
patterns = [
    ('private path', re.compile(r'/(?:Users|home)/[A-Za-z0-9_.-]+/')),
    ('private key', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('credential token', re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b')),
]
for name in filter(None, names):
    if name not in allowed:
        failures.append({'file': name, 'reason': 'not in reviewed file allowlist'})
        continue
    data = subprocess.check_output(['git', 'show', ':' + name])
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        failures.append({'file': name, 'reason': 'binary or non-UTF8 data'})
        continue
    if b'\0' in data or len(data) > 200_000:
        failures.append({'file': name, 'reason': 'NUL bytes or unexpected file size'})
    for kind, pattern in patterns:
        if pattern.search(text):
            failures.append({'file': name, 'reason': kind})
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
result = {'status': 'failed' if failures or not files else 'passed', 'fileCount': len(files), 'files': files, 'failures': failures,
          'scope': 'staged UTF8 source/docs allowlist plus private-material scan; independent manual review also required'}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['status'] == 'passed' else 1)
