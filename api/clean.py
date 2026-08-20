import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from http.server import BaseHTTPRequestHandler
from _base import read_json, send_json
from _wm_service import RequestError, run_clean


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json(self)
            send_json(self, 200, run_clean(body))
        except RequestError as exc:
            send_json(self, 400, {"ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            send_json(self, 500, {"ok": False, "error": f"clean failed: {exc}"})
