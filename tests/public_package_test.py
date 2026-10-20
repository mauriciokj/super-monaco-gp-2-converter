"""Synthetic packaging checks. No ROM, patch, photo, credentials or network."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / 'personalizador-local' / 'prepare-public.py'
spec = importlib.util.spec_from_file_location('public_package', MODULE_PATH)
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PublicPackageTests(unittest.TestCase):
    def test_exact_allowlist_no_private_package_and_no_network_by_default(self):
        with tempfile.TemporaryDirectory() as folder:
            manifest = package.prepare(folder, 'https://converter.example/tools/smgp2/')
            actual = {p.name for p in Path(folder).iterdir()}
            self.assertEqual(actual, set(package.PUBLIC_FILES) | {'metrics-config.js', 'public-manifest.json'})
            html = (Path(folder) / 'index.html').read_text()
            self.assertNotIn('local-grid2026-data.js', html)
            self.assertIn("connect-src 'none'", html)
            self.assertFalse(manifest['metrics']['enabled'])
            self.assertFalse(manifest['containsSeasonPatch'])
            self.assertIn('patchFile', html)

    def test_metrics_only_allow_provider_path_and_plain_notice(self):
        with tempfile.TemporaryDirectory() as folder:
            manifest = package.prepare(folder, 'https://converter.example/tools/smgp2/', True)
            html = (Path(folder) / 'index.html').read_text()
            self.assertIn('connect-src https://converter.example/_vercel/insights/', html)
            self.assertIn('Enviamos somente métricas de uso', html)
            self.assertFalse(manifest['metrics']['customEvents'])
            self.assertNotIn('local-grid2026', '\n'.join(manifest['files']))

    def test_invalid_urls_source_output_and_nonempty_output_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            for url in ['http://converter.example/', 'https://localhost/', 'https://user:secret@converter.example/', 'https://converter.example/?name=private', 'https://converter.example/not-a-directory']:
                with self.assertRaises(ValueError):
                    package.prepare(folder, url)
            with self.assertRaises(ValueError):
                package.prepare(package.SOURCE / 'public', 'https://converter.example/')
            (Path(folder) / 'private.ips').write_text('synthetic')
            with self.assertRaises(ValueError):
                package.prepare(folder, 'https://converter.example/')

    def test_custom_events_require_metrics_option(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                package.prepare(folder, 'https://converter.example/', False, True)


if __name__ == '__main__':
    unittest.main()
