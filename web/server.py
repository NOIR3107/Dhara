"""
web/server.py
--------------
Lightweight HTTP server for DHARA Command Center web application.
Serves static assets and provides /api/data endpoint.
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import sys
from pathlib import Path

# Ensure web dir is in sys.path
WEB_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(WEB_DIR))

from data_adapter import get_command_center_data

PORT = 8080


class DharaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/data":
            try:
                data = get_command_center_data()
                payload = json.dumps(data, indent=2, default=str).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except Exception as e:
                err_msg = json.dumps({"error": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(err_msg)
        else:
            super().do_GET()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[DHARA Server] {self.address_string()} - {format % args}\n")


def start_server(port=PORT):
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), DharaHandler) as httpd:
        print(f"\n=======================================================")
        print(f"  DHARA Command Center Web Server Running")
        print(f"  URL: http://localhost:{port}")
        print(f"  API: http://localhost:{port}/api/data")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    start_server(port)
