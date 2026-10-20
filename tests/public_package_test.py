"""Packaging checks use audited code/assets only. No ROM, IPS, photo or network."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / 'personalizador-local' / 'prepare-public.py'
spec = importlib.util.spec_from_file_location('public_package', MODULE_PATH)
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PublicPackageTests(unittest.TestCase):
    def test_exact_allowlist_automatic_two_input_flow_and_offline_default(self):
        with tempfile.TemporaryDirectory() as folder:
            manifest = package.prepare(folder, 'https://converter.example/tools/smgp2/')
            actual = {p.name for p in Path(folder).iterdir()}
            self.assertEqual(actual, set(package.PUBLIC_FILES) | {'metrics-config.js', 'public-manifest.json'})
            html = (Path(folder) / 'index.html').read_text()
            self.assertNotIn('local-grid2026-data.js', html)
            self.assertNotIn('patchFile', html)
            self.assertEqual(html.count('type="file"'), 2)
            self.assertIn('season-assets.js', html)
            self.assertIn('season-recipe.js', html)
            self.assertIn("connect-src 'none'", html)
            self.assertFalse(manifest['metrics']['enabled'])
            self.assertFalse(manifest['containsFullSeasonPatch'])
            self.assertTrue(manifest['containsAuthorizedPortraits'])
            self.assertEqual(manifest['authorizedPortraitCount'], 11)
            self.assertEqual(manifest['authorizedPortraitPayloadBytes'], 25685)
            self.assertEqual(manifest['composition'], 'automatic-reduced-recipe')
            self.assertEqual(manifest['flow'], 'original + image')
            for name, expected in manifest['files'].items():
                raw = (Path(folder) / name).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), expected['sha256'])
                self.assertEqual(len(raw), expected['bytes'])

    def test_metrics_only_allow_provider_path_and_plain_notice(self):
        with tempfile.TemporaryDirectory() as folder:
            manifest = package.prepare(folder, 'https://converter.example/tools/smgp2/', True)
            html = (Path(folder) / 'index.html').read_text()
            self.assertIn('connect-src https://converter.example/_vercel/insights/', html)
            self.assertIn('Enviamos somente métricas de uso', html)
            self.assertNotIn('ROM, IPS', html)
            self.assertFalse(manifest['metrics']['customEvents'])
            self.assertNotIn('local-grid2026', '\n'.join(manifest['files']))

    def test_invalid_urls_source_output_and_nonempty_output_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            for url in ['http://converter.example/', 'https://localhost/', 'https://user:secret@converter.example/', 'https://converter.example/?name=private', 'https://converter.example/not-a-directory']:
                with self.assertRaises(ValueError):
                    package.prepare(folder, url)
            with self.assertRaises(ValueError):
                package.prepare(package.SOURCE / 'public', 'https://converter.example/')
            (Path(folder) / 'unexpected.txt').write_text('synthetic')
            with self.assertRaises(ValueError):
                package.prepare(folder, 'https://converter.example/')

    def test_hobby_custom_events_always_disabled(self):
        with tempfile.TemporaryDirectory() as folder:
            for metrics in (False, True):
                with self.assertRaises(ValueError):
                    package.prepare(folder, 'https://converter.example/', metrics, True)

    def test_vercel_system_environment_production_preview_and_failure(self):
        self.assertEqual(package.vercel_options({'VERCEL_ENV': 'production', 'VERCEL_PROJECT_PRODUCTION_URL': 'converter.example'}), ('https://converter.example/', True))
        self.assertEqual(package.vercel_options({'VERCEL_ENV': 'preview', 'VERCEL_PROJECT_PRODUCTION_URL': 'converter.example', 'VERCEL_URL': 'preview.example'}), ('https://converter.example/', False))
        self.assertEqual(package.vercel_options({'VERCEL_ENV': 'preview', 'VERCEL_URL': 'preview.example'}), ('https://preview.example/', False))
        for env in ({}, {'VERCEL_ENV': 'production', 'VERCEL_URL': 'preview.example'},
                    {'VERCEL_ENV': 'production', 'VERCEL_PROJECT_PRODUCTION_URL': 'https://bad.example/'},
                    {'VERCEL_ENV': 'preview', 'VERCEL_URL': 'host.example/private'}):
            with self.assertRaises(ValueError):
                package.vercel_options(env)

    def test_modified_authorized_resources_and_unsafe_source_fail_closed(self):
        with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as output:
            source = Path(source)
            for name in package.PUBLIC_FILES + ('season-provenance.json',):
                shutil.copyfile(package.SOURCE / name, source / name)
            with patch.object(package, 'SOURCE', source):
                assets = source / 'season-assets.js'
                assets.write_text(assets.read_text() + '\n// altered\n')
                with self.assertRaisesRegex(ValueError, 'proveniência'):
                    package.prepare(output, 'https://converter.example/')
                shutil.copyfile(ROOT / 'personalizador-local/season-assets.js', assets)
                app = source / 'app.js'
                app.write_text(app.read_text() + '\nwindow.LOCAL_GRID2026_PATCH = {};\n')
                with self.assertRaisesRegex(ValueError, 'inesperado'):
                    package.prepare(output, 'https://converter.example/')
                self.assertEqual(list(Path(output).iterdir()), [])

    def test_server_and_vercel_allow_only_reviewed_files_and_flow_framing(self):
        server_spec = importlib.util.spec_from_file_location('local_server', ROOT / 'personalizador-local/serve.py')
        server = importlib.util.module_from_spec(server_spec)
        server_spec.loader.exec_module(server)
        self.assertIn('/season-assets.js', server.FILES)
        self.assertIn('/season-recipe.js', server.FILES)
        self.assertNotIn('/local-grid2026-data.js', server.FILES)
        config = json.loads((ROOT / 'vercel.json').read_text())
        self.assertIsNone(config['framework'])
        self.assertEqual(config['outputDirectory'], 'public-site')
        self.assertEqual(config['installCommand'], '')
        self.assertIn('prepare-public.py --out public-site --vercel', config['buildCommand'])
        headers = {header['key']: header['value'] for rule in config['headers'] for header in rule['headers']}
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertIn('https://flowofdevelopment.com', headers['Content-Security-Policy'])
        self.assertNotIn('X-Frame-Options', headers)


if __name__ == '__main__':
    unittest.main()
