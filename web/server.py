"""
web/server.py
--------------
Lightweight HTTP server for the DHARA web application.

    /              public site (home.html)
    /dashboard     officer dashboard + field app (index.html)
    /report        driver photo report (report.html + ui/, built from web-ui/)
    /api/data      pipeline data from data_adapter.py
    /api/ai/...    offline AI: field-note classifier + local llama briefings

Run it from the project root (python web/server.py) or from web/; model
paths are resolved relative to the project root either way.
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent
ROOT_DIR = WEB_DIR.parent
sys.path.insert(0, str(ROOT_DIR / "routing"))
sys.path.insert(0, str(WEB_DIR))

# model/closure_prediction.py loads "models/closure_model.pkl" relative to the
# working directory, so pin it to the project root.
os.chdir(ROOT_DIR)

from data_adapter import get_command_center_data  # noqa: E402

import field_report_nlp  # noqa: E402
import llm_backend  # noqa: E402
import reasoning  # noqa: E402
import config as routing_config  # noqa: E402

PORT = 8080
MAX_BODY_BYTES = 20_000
MAX_TEXT_CHARS = 2_000

PAGE_ROUTES = {
    "/": "/home.html",
    "/dashboard": "/index.html",
    "/report": "/report.html",   # driver photo report (React, built from web-ui/)
}

# index.html uses relative asset paths (so it also works opened as a file);
# served from "/dashboard/" they would resolve under /dashboard/ and 404.
REDIRECTS = {
    "/dashboard/": "/dashboard",
}


class DharaHandler(http.server.SimpleHTTPRequestHandler):
    # Windows registry settings can map .js to text/plain, and browsers refuse
    # to run module scripts served that way (report.html, ui/assets/*.js).
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    # ---------- helpers ----------
    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_text_field(self):
        """Return (text, error_message) from a JSON body like {"text": "..."}."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None, "Invalid Content-Length"
        if length <= 0:
            return None, "Request body is empty; send JSON like {\"text\": \"...\"}"
        if length > MAX_BODY_BYTES:
            return None, f"Request body too large (limit {MAX_BODY_BYTES} bytes)"
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "Body must be valid JSON"
        text = data.get("text") if isinstance(data, dict) else None
        if not isinstance(text, str) or not text.strip():
            return None, "Field \"text\" is required"
        return text.strip()[:MAX_TEXT_CHARS], None

    # ---------- routes ----------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if path == "/api/data":
            try:
                self._send_json(200, get_command_center_data())
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if path == "/api/ai/status":
            self._send_json(200, {
                "note_classifier": field_report_nlp.MODEL_PATH.exists(),
                "local_llm": llm_backend.is_available(),
                "llm_model": routing_config.OLLAMA_MODEL,
            })
            return

        if path in REDIRECTS:
            self.send_response(301)
            self.send_header("Location", REDIRECTS[path] + self.path[len(path):])
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if path in PAGE_ROUTES:
            query = self.path[len(path):]
            self.path = PAGE_ROUTES[path] + query
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]

        if path == "/api/ai/classify-note":
            text, err = self._read_text_field()
            if err:
                self._send_json(400, {"error": err})
                return
            self._send_json(200, field_report_nlp.classify_note(text))
            return

        if path == "/api/ai/explain":
            text, err = self._read_text_field()
            if err:
                self._send_json(400, {"error": err})
                return
            self._send_json(200, reasoning.explain_for_officer(text))
            return

        self._send_json(404, {"error": f"No POST route for {path}"})

    def log_message(self, format, *args):
        sys.stderr.write(f"[DHARA Server] {self.address_string()} - {format % args}\n")


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # A local-LLM briefing can take several seconds; threads keep pages and
    # other requests responsive while one is running.
    daemon_threads = True
    allow_reuse_address = True


def _warm_up_llm():
    ok = llm_backend.warm_up()
    print(f"[DHARA Server] Local LLM {'loaded and ready' if ok else 'not available; briefings will fall back to templates'}")


def start_server(port=PORT):
    threading.Thread(target=_warm_up_llm, daemon=True).start()
    with ThreadingServer(("", port), DharaHandler) as httpd:
        print("\n=======================================================")
        print("  DHARA Web Server Running")
        print(f"  Public site : http://localhost:{port}/")
        print(f"  Dashboard   : http://localhost:{port}/dashboard")
        print(f"  Data API    : http://localhost:{port}/api/data")
        print(f"  AI status   : http://localhost:{port}/api/ai/status")
        print("=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    start_server(port)
