#!/usr/bin/env python3
"""Prepare an audited static directory. Never copy a ROM or full private IPS."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit

SOURCE = Path(__file__).resolve().parent
PUBLIC_FILES = ('index.html', 'style.css', 'core.js', 'spec.js', 'pipeline.js',
                'season-assets.js', 'season-recipe.js', 'app.js', 'analytics.js')
SEASON_FILES = ('season-assets.js', 'season-recipe.js')


def canonical_url(value):
    url = urlsplit(value)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment
            or not url.path.endswith('/') or url.hostname in ('localhost', '127.0.0.1', '::1')
            or not re.fullmatch(r'[A-Za-z0-9.-]+', url.netloc)):
        raise ValueError('Informe endereço HTTPS público canônico, sem credenciais/query/fragmento, terminado em /.')
    return value


def vercel_options(environ=None):
    env = os.environ if environ is None else environ
    production = env.get('VERCEL_ENV') == 'production'
    host = env.get('VERCEL_PROJECT_PRODUCTION_URL', '')
    if production and not host:
        raise ValueError('Produção exige VERCEL_PROJECT_PRODUCTION_URL; nenhuma métrica foi habilitada.')
    if not host:
        host = env.get('VERCEL_URL', '')
    if not host or not re.fullmatch(r'[A-Za-z0-9.-]+', host):
        raise ValueError('O build Vercel exige um domínio de sistema válido, sem protocolo ou caminho.')
    return canonical_url('https://' + host + '/'), production


def audit_season(contents):
    """Verify the recipe/authorized art against the separately reviewed provenance."""
    provenance = json.loads((SOURCE / 'season-provenance.json').read_text())
    # Schema is deliberately explicit: these are file digests, not ROM/recipe-contract digests.
    for name in SEASON_FILES:
        expected = provenance.get('publicFiles', {}).get(name, {})
        raw = contents[name].encode('utf-8')
        if (expected.get('sha256') != hashlib.sha256(raw).hexdigest() or expected.get('bytes') != len(raw)):
            raise ValueError('Arquivo da temporada difere da proveniência auditada: ' + name)
    match = re.search(r'const data = (\{.*\});', contents['season-assets.js'])
    if not match:
        raise ValueError('Formato dos retratos autorizados inesperado.')
    assets = json.loads(match.group(1))
    normalized = json.dumps(assets, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    if (assets.get('version') != 1 or assets.get('payloadBytes') != 25685
            or len(assets.get('portraits', [])) != 11
            or hashlib.sha256(normalized).hexdigest() != provenance.get('assetsSha256')):
        raise ValueError('Contrato dos onze retratos autorizados não corresponde à proveniência.')
    total = 0
    for slot, portrait in enumerate(assets['portraits']):
        if portrait.get('slot') != slot or len(portrait.get('blocks', [])) != 2:
            raise ValueError('Slots dos retratos autorizados inesperados.')
        for block, kind, length in zip(portrait['blocks'], ('palette', 'Kosinski graphics'), (26, 2309)):
            if (block.get('kind') != kind or block.get('length') != length
                    or not isinstance(block.get('offset'), int) or not 0 <= block['offset'] <= 2097152 - length
                    or not re.fullmatch('[0-9a-f]{' + str(length * 2) + '}', block.get('hex', ''))
                    or hashlib.sha256(bytes.fromhex(block['hex'])).hexdigest() != block.get('sha256')):
                raise ValueError('Recurso dos retratos autorizados inválido.')
            total += length
    if total != 25685 or provenance.get('authorizedPortraitPayloadBytes') != total:
        raise ValueError('Quantidade de dados de retratos inesperada.')
    return provenance


def prepare(output, canonical, metrics=False, custom_events=False):
    target = Path(output).resolve()
    if target == SOURCE or SOURCE in target.parents:
        raise ValueError('Use uma pasta de saída separada dos fontes e do pacote privado.')
    if target.exists() and any(target.iterdir()):
        raise ValueError('A pasta de saída deve estar vazia para conferir exatamente o pacote publicado.')
    canonical = canonical_url(canonical)
    url = urlsplit(canonical)
    if custom_events:
        raise ValueError('Eventos personalizados estão desativados no plano Hobby confirmado.')
    contents = {name: (SOURCE / name).read_text() for name in PUBLIC_FILES}
    provenance = audit_season(contents)
    html = contents['index.html']
    # Accept old reviewed source HTML only by removing the exact optional private tag.
    html = html.replace('  <script defer src="local-grid2026-data.js"></script>\n', '')
    app_tag = '  <script defer src="app.js"></script>'
    if html.count(app_tag) != 1 or html.count('src="season-assets.js"') != 1 or html.count('src="season-recipe.js"') != 1:
        raise ValueError('Referências dos scripts inesperadas: revise o HTML antes de empacotar.')
    html = html.replace(app_tag, '  <script defer src="metrics-config.js"></script>\n'
                        '  <script defer src="analytics.js"></script>\n' + app_tag)
    html = html.replace('  <meta name="color-scheme"', '  <meta name="referrer" content="no-referrer">\n  <meta name="color-scheme"')
    if metrics:
        html = html.replace("connect-src 'none'", f"connect-src https://{url.netloc}/_vercel/insights/")
        html = html.replace('Tudo acontece no seu navegador. Arquivos não são enviados.',
                            'ROM e foto ficam no navegador. Enviamos somente métricas de uso, sem seus arquivos.')
    contents['index.html'] = html
    config = {'enabled': bool(metrics), 'canonicalUrl': canonical, 'customEvents': False}
    contents['metrics-config.js'] = 'window.CONVERTER_ANALYTICS_CONFIG = ' + json.dumps(config, ensure_ascii=True) + ';\n'
    manifest = {'format': 'smgp2-public-reduced-recipe-v2', 'containsRom': False,
                'containsFullSeasonPatch': False, 'containsAuthorizedPortraits': True,
                'authorizedPortraitCount': 11, 'authorizedPortraitPayloadBytes': 25685,
                'flow': 'original + image', 'composition': 'automatic-reduced-recipe',
                'advancedFlow': 'visitor-provided verified Grid2026 + image',
                'metrics': config, 'files': {}}
    forbidden = re.compile(rb'(?:local-grid2026-data|LOCAL_GRID2026_PATCH|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b)')
    for name, text in contents.items():
        raw = text.encode('utf-8')
        if (b'\0' in raw or len(raw) > 200000 or re.search(rb'/(?:Users|home)/[A-Za-z0-9_.-]+/', raw)
                or forbidden.search(raw) or re.search(rb'(?i)base64\s*[:=]\s*[\'"][A-Za-z0-9+/=]{256,}', raw)
                or name != 'season-assets.js' and re.search(rb'[\'"][0-9a-fA-F]{1024,}[\'"]', raw)):
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
    parser.add_argument('--canonical-url')
    parser.add_argument('--metrics', action='store_true', help='Pageviews somente no endereço HTTPS canônico.')
    parser.add_argument('--vercel', action='store_true', help='Usar domínio e ambiente de sistema Vercel; sem credenciais.')
    args = parser.parse_args()
    if args.vercel:
        if args.canonical_url or args.metrics:
            parser.error('--vercel deriva domínio e métricas do ambiente; não combine opções manuais.')
        canonical, metrics = vercel_options()
    else:
        if not args.canonical_url:
            parser.error('--canonical-url é obrigatório fora de --vercel.')
        canonical, metrics = args.canonical_url, args.metrics
    manifest = prepare(args.out, canonical, metrics)
    print(json.dumps({'fileCount': len(manifest['files']) + 1, 'composition': manifest['composition'],
                      'containsFullSeasonPatch': False, 'metrics': manifest['metrics']}))
