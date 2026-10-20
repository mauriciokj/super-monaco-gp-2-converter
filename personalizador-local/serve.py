#!/usr/bin/env python3
"""Serve only the app files, on loopback. Never accept uploads or serve ROMs."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse

ROOT = Path(__file__).resolve().parent
FILES = {
    '/': ('index.html', 'text/html; charset=utf-8'),
    '/index.html': ('index.html', 'text/html; charset=utf-8'),
    '/core.js': ('core.js', 'text/javascript; charset=utf-8'),
    '/spec.js': ('spec.js', 'text/javascript; charset=utf-8'),
    '/pipeline.js': ('pipeline.js', 'text/javascript; charset=utf-8'),
    '/season-assets.js': ('season-assets.js', 'text/javascript; charset=utf-8'),
    '/season-recipe.js': ('season-recipe.js', 'text/javascript; charset=utf-8'),
    '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
    '/style.css': ('style.css', 'text/css; charset=utf-8'),
}


class LocalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        requested = urlsplit(self.path).path
        item = FILES.get(requested)
        if item is None:
            self.send_error(404)
            return
        path, mime = item
        payload = ROOT / path
        if not payload.is_file():
            self.send_error(404)
            return
        data = payload.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = HTTPServer(('127.0.0.1', args.port), LocalHandler)
    print(f'Prévia local: http://127.0.0.1:{server.server_port}', flush=True)
    print('Interface e receita reduzida2026; nenhum upload, ROM ou IPS privado servido. Ctrl+C encerra.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
