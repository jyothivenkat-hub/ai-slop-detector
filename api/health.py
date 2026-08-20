import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from http.server import BaseHTTPRequestHandler
from _base import send_json
from _wm_service import VERSION


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        send_json(self, 200, {"ok": True, "version": VERSION})
