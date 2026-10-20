#!/usr/bin/env python3
"""Prepare an audited static directory. Never copy a private package or ROM."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

SOURCE = Path(__file__).resolve().parent
PUBLIC_FILES = ('index.html', 'style.css', 'core.js', 'spec.js', 'pipeline.js', 'app.js', 'analytics.js')


def prepare(output, canonical_url, metrics=False, custom_events=False):
    target = Path(output).resolve()
    if target == SOURCE or SOURCE in target.parents:
        raise ValueError('Use uma pasta de saída separada dos fontes e do pacote privado.')
    if target.exists() and any(target.iterdir()):
        raise ValueError('A pasta de saída deve estar vazia para conferir exatamente o pacote publicado.')
    url = urlsplit(canonical_url)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment
            or not url.path.endswith('/') or url.hostname in ('localhost', '127.0.0.1', '::1')):
        raise ValueError('Informe endereço HTTPS público canônico, sem credenciais/query/fragmento, terminado em /.')
    if custom_events and not metrics:
        raise ValueError('Eventos personalizados exigem métricas habilitadas e plano confirmado.')
    contents = {name: (SOURCE / name).read_text() for name in PUBLIC_FILES}
    html = contents['index.html']
    private_tag = '  <script defer src="local-grid2026-data.js"></script>\n'
    if html.count(private_tag) != 1:
        raise ValueError('Referência privada inesperada: revise o HTML antes de empacotar.')
    html = html.replace(private_tag, '')
    html = html.replace('  <script defer src="app.js"></script>',
                        '  <script defer src="metrics-config.js"></script>\n'
                        '  <script defer src="analytics.js"></script>\n'
                        '  <script defer src="app.js"></script>')
    html = html.replace('  <meta name="color-scheme"', '  <meta name="referrer" content="no-referrer">\n  <meta name="color-scheme"')
    if metrics:
        html = html.replace("connect-src 'none'", f"connect-src https://{url.netloc}/_vercel/insights/")
        html = html.replace('Tudo acontece no seu navegador. Arquivos não são enviados.',
                            'ROM, IPS e foto ficam no navegador. Enviamos somente métricas de uso, sem seus arquivos.')
    if 'local-grid2026-data.js' in html or 'LOCAL_GRID2026_PATCH = {' in html:
        raise ValueError('O pacote público não pode conter dados privados.')
    contents['index.html'] = html
    config = {'enabled': bool(metrics), 'canonicalUrl': canonical_url, 'customEvents': bool(custom_events)}
    contents['metrics-config.js'] = 'window.CONVERTER_ANALYTICS_CONFIG = ' + json.dumps(config, ensure_ascii=True) + ';\n'
    # No source paths or private data are written into the served manifest.
    manifest = {'format': 'smgp2-public-source-only-v1', 'containsRom': False, 'containsSeasonPatch': False,
                'flow': 'original + visitor-provided verified IPS + image, or visitor-provided verified Grid2026 + image',
                'metrics': config, 'files': {}}
    for name, text in contents.items():
        raw = text.encode('utf-8')
        if b'\0' in raw or len(raw) > 200000 or re.search(rb'/(?:Users|home)/[A-Za-z0-9_.-]+/', raw):
            raise ValueError('Arquivo inesperado no pacote: ' + name)
        manifest['files'][name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    target.mkdir(parents=True, exist_ok=True)
    for name, text in contents.items():
        (target / name).write_text(text)
    (target / 'public-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True)
    parser.add_argument('--canonical-url', required=True)
    parser.add_argument('--metrics', action='store_true', help='Pageviews somente no endereço HTTPS canônico.')
    parser.add_argument('--custom-events-confirmed', action='store_true', help='Usar somente após confirmar Pro/Enterprise existente.')
    args = parser.parse_args()
    manifest = prepare(args.out, args.canonical_url, args.metrics, args.custom_events_confirmed)
    print(json.dumps({'fileCount': len(manifest['files']) + 1, 'containsSeasonPatch': False, 'metrics': manifest['metrics']}))
