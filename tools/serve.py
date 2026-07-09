#!/usr/bin/env python3
"""Static server that sets COOP/COEP so SharedArrayBuffer (threads) works.
Usage: python3 tools/serve.py [directory] [port]  (defaults: dist 8080)"""
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

DIRECTORY = sys.argv[1] if len(sys.argv) > 1 else "dist"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8080

class COIHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet

if __name__ == "__main__":
    if not os.path.isdir(DIRECTORY):
        print(f"[serve.py] directory not found: {DIRECTORY}", file=sys.stderr)
        sys.exit(1)
    handler = partial(COIHandler, directory=os.path.abspath(DIRECTORY))
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"[serve.py] COOP/COEP server on http://localhost:{PORT} serving {DIRECTORY}/")
    httpd.serve_forever()
