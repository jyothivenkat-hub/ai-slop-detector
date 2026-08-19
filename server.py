#!/usr/bin/env python3
"""Local frontend and proxy for the cloned watermarks-remover service."""

from __future__ import annotations

import argparse
import http.client
import json
import subprocess
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parent
UPSTREAM_ROOT = ROOT / "vendor" / "watermarks-remover"
UPSTREAM_SERVER = UPSTREAM_ROOT / "service" / "scripts" / "server.py"
UPSTREAM_HOST = "127.0.0.1"
DEFAULT_UPSTREAM_PORT = 8767
UPSTREAM_PORT = DEFAULT_UPSTREAM_PORT
PROXY_PATHS = {"/api/health": "/health", "/api/capabilities": "/capabilities", "/api/inspect": "/inspect", "/api/clean": "/clean"}
MAX_REWRITE_CHARS = 12000
MAX_JSON_BODY_BYTES = 250000


class RewriteError(Exception):
    """User-fixable model settings or request problem."""


def service_python() -> str:
    candidates = [Path("/opt/homebrew/bin/python3"), Path(sys.executable)]
    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            output = subprocess.check_output(
                [str(candidate), "-c", "import sys; print('.'.join(map(str, sys.version_info[:2])))"],
                text=True,
                timeout=5,
            ).strip()
            major, minor = (int(part) for part in output.split(".", 1))
        except Exception:
            continue
        if (major, minor) >= (3, 10):
            return str(candidate)
    return sys.executable


def upstream_request(method: str, path: str, body: bytes | None = None) -> tuple[int, bytes, str]:
    conn = http.client.HTTPConnection(UPSTREAM_HOST, UPSTREAM_PORT, timeout=30)
    headers = {"Content-Type": "application/json"} if body else {}
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    data = response.read()
    content_type = response.getheader("Content-Type", "application/json; charset=utf-8")
    conn.close()
    return response.status, data, content_type


def upstream_ready() -> bool:
    try:
      status, data, _ = upstream_request("GET", "/health")
      payload = json.loads(data.decode("utf-8"))
      return status == HTTPStatus.OK and payload.get("ok") is True
    except Exception:
      return False


def start_upstream() -> subprocess.Popen[bytes] | None:
    if upstream_ready():
        return None
    if not UPSTREAM_SERVER.exists():
        raise FileNotFoundError(f"Missing upstream service: {UPSTREAM_SERVER}")
    proc = subprocess.Popen(
        [service_python(), str(UPSTREAM_SERVER), "--host", UPSTREAM_HOST, "--port", str(UPSTREAM_PORT)],
        cwd=str(UPSTREAM_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(40):
        if upstream_ready():
            return proc
        if proc.poll() is not None:
            raise RuntimeError("watermarks-remover service exited during startup")
        time.sleep(0.15)
    proc.terminate()
    raise TimeoutError("watermarks-remover service did not become ready")


def required_setting(settings: dict, key: str, message: str) -> str:
    value = str(settings.get(key) or "").strip()
    if not value:
        raise RewriteError(message)
    return value


def rewrite_messages(text: str, mode: str) -> tuple[str, str]:
    if mode == "code":
        system = (
            "You revise code or code-adjacent text to remove AI slop. Preserve APIs, facts, and intent. "
            "Do not invent missing dependencies. Remove placeholder naming, hollow comments, and unfinished scaffolding. "
            "Return only the revised code or a concise repair plan if there is not enough context to safely rewrite it."
        )
        user = f"Clean this code or repair plan. Return only the cleaned result:\n\n{text}"
        return system, user

    system = (
        "You rewrite text to remove AI slop. Preserve the user's meaning and facts. "
        "Do not invent sources, metrics, names, features, or outcomes. "
        "Remove generic hype, bracket placeholders, empty quotes, excessive hyphens, and em-dash-heavy rhythm. "
        "If the original is missing a specific detail, write a plain sentence that names the gap instead of using brackets. "
        "Return only the cleaner replacement text."
    )
    user = f"Rewrite this text so it sounds specific, plain, and usable:\n\n{text}"
    return system, user


def request_json(url: str, payload: dict, headers: dict | None = None, timeout: int = 60) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RewriteError("Enter a valid http or https endpoint URL.")

    body = json.dumps(payload).encode("utf-8")
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    request_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": str(len(body)),
        **(headers or {})
    }
    conn_cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    conn = conn_cls(parsed.hostname, parsed.port, timeout=timeout)
    try:
        conn.request("POST", path, body=body, headers=request_headers)
        response = conn.getresponse()
        raw = response.read()
    finally:
        conn.close()

    text = raw.decode("utf-8", errors="replace")
    if response.status >= 400:
        raise RewriteError(f"Model provider returned HTTP {response.status}: {text[:300]}")

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RewriteError("Model provider returned a response that was not JSON.") from exc


def text_from_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or ""))
        return "\n".join(part for part in parts if part)
    return ""


def extract_openai_compatible_text(payload: dict) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise RewriteError("Model provider did not return any choices.")
    first = choices[0] or {}
    message = first.get("message") or {}
    text = text_from_content(message.get("content")) or str(first.get("text") or "")
    return strip_model_wrapping(text)


def extract_anthropic_text(payload: dict) -> str:
    content = payload.get("content") or []
    text = text_from_content(content)
    if not text:
        raise RewriteError("Anthropic did not return text content.")
    return strip_model_wrapping(text)


def extract_google_text(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        raise RewriteError("Google did not return any candidates.")
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text = text_from_content(parts)
    if not text:
        raise RewriteError("Google did not return text content.")
    return strip_model_wrapping(text)


def extract_ollama_text(payload: dict) -> str:
    message = payload.get("message") or {}
    text = text_from_content(message.get("content")) or str(payload.get("response") or "")
    if not text:
        raise RewriteError("Ollama did not return text content.")
    return strip_model_wrapping(text)


def strip_model_wrapping(text: str) -> str:
    cleaned = text.strip()
    lines = cleaned.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def openai_payload(model: str, text: str, mode: str) -> dict:
    system, user = rewrite_messages(text, mode)
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "temperature": 0.25
    }


def rewrite_with_openai_compatible(endpoint: str, api_key: str, model: str, text: str, mode: str, provider: str) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    payload = request_json(endpoint, openai_payload(model, text, mode), headers=headers)
    return {"ok": True, "text": extract_openai_compatible_text(payload), "provider": provider}


def rewrite_with_anthropic(api_key: str, model: str, text: str, mode: str) -> dict:
    system, user = rewrite_messages(text, mode)
    payload = request_json(
        "https://api.anthropic.com/v1/messages",
        {
            "model": model,
            "max_tokens": 1800,
            "temperature": 0.25,
            "system": system,
            "messages": [{"role": "user", "content": user}]
        },
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    )
    return {"ok": True, "text": extract_anthropic_text(payload), "provider": "Anthropic"}


def rewrite_with_google(api_key: str, model: str, text: str, mode: str) -> dict:
    system, user = rewrite_messages(text, mode)
    payload = request_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent?key={quote(api_key, safe='')}",
        {
            "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{user}"}]}],
            "generationConfig": {"temperature": 0.25}
        }
    )
    return {"ok": True, "text": extract_google_text(payload), "provider": "Google"}


def rewrite_with_ollama(settings: dict, text: str, mode: str) -> dict:
    base_url = str(settings.get("ollamaUrl") or "http://localhost:11434").rstrip("/")
    model = required_setting(settings, "ollamaModel", "Enter an Ollama model name.")
    payload = request_json(f"{base_url}/api/chat", {**openai_payload(model, text, mode), "stream": False})
    return {"ok": True, "text": extract_ollama_text(payload), "provider": "Ollama"}


def rewrite_with_provider(settings: dict, text: str, mode: str) -> dict:
    provider = str(settings.get("provider") or "openai").strip().lower()
    api_key = required_setting(settings, "providerApiKey", "Enter a provider API key.")
    model = required_setting(settings, "providerModel", "Enter a model name.")

    compatible = {
        "openai": ("https://api.openai.com/v1/chat/completions", "OpenAI"),
        "groq": ("https://api.groq.com/openai/v1/chat/completions", "Groq"),
        "mistral": ("https://api.mistral.ai/v1/chat/completions", "Mistral")
    }
    if provider in compatible:
        endpoint, label = compatible[provider]
        return rewrite_with_openai_compatible(endpoint, api_key, model, text, mode, label)
    if provider == "anthropic":
        return rewrite_with_anthropic(api_key, model, text, mode)
    if provider == "google":
        return rewrite_with_google(api_key, model, text, mode)
    raise RewriteError("Choose a supported provider or use a custom OpenAI-compatible endpoint.")


def perform_rewrite(payload: dict) -> dict:
    text = str(payload.get("text") or "").strip()
    mode = str(payload.get("mode") or "text").strip().lower()
    settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    source = str(settings.get("source") or "local").strip().lower()

    if not text:
        raise RewriteError("Paste text before generating a cleaner draft.")
    if len(text) > MAX_REWRITE_CHARS:
        raise RewriteError(f"Keep model rewrite requests under {MAX_REWRITE_CHARS:,} characters.")
    if mode not in {"text", "code"}:
        mode = "text"

    if source == "local":
        raise RewriteError("Local rules are already applied in the browser. Choose an API source to call a model.")
    if source == "provider":
        return rewrite_with_provider(settings, text, mode)
    if source == "ollama":
        return rewrite_with_ollama(settings, text, mode)
    if source == "custom":
        endpoint = required_setting(settings, "customEndpoint", "Enter a custom endpoint URL.")
        model = required_setting(settings, "customModel", "Enter a model name.")
        api_key = str(settings.get("customApiKey") or "").strip()
        return rewrite_with_openai_compatible(endpoint, api_key, model, text, mode, "Custom endpoint")

    raise RewriteError("Choose a model source in Model settings.")


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        if parsed.path == "/":
            return str(ROOT / "index.html")
        return super().translate_path(path)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._handle_proxy_or_static()

    def do_POST(self) -> None:  # noqa: N802
        self._handle_proxy_or_static()

    def _send_json(self, status: HTTPStatus, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict | None:
        raw_len = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_len)
        except ValueError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid content length"})
            return None
        if length > MAX_JSON_BODY_BYTES:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "request is too large"})
            return None
        raw_body = self.rfile.read(length)
        try:
            return json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "request body must be JSON"})
            return None

    def _handle_rewrite(self) -> None:
        if self.command != "POST":
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "POST required"})
            return
        payload = self._read_json_body()
        if payload is None:
            return
        try:
            self._send_json(HTTPStatus.OK, perform_rewrite(payload))
        except RewriteError as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self._send_json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": f"model request failed: {exc}"})

    def _handle_proxy_or_static(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/rewrite":
            self._handle_rewrite()
            return

        upstream_path = PROXY_PATHS.get(parsed.path)
        if upstream_path is None:
            if self.command == "POST":
                self.send_error(HTTPStatus.NOT_FOUND, "not found")
                return
            return super().do_GET()

        body = None
        if self.command == "POST":
            raw_len = self.headers.get("Content-Length", "0")
            try:
                length = int(raw_len)
            except ValueError:
                self.send_error(HTTPStatus.BAD_REQUEST, "invalid content length")
                return
            body = self.rfile.read(length)

        try:
            status, data, content_type = upstream_request(self.command, upstream_path, body)
        except Exception as exc:
            payload = json.dumps({"ok": False, "error": f"upstream unavailable: {exc}"}).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    global UPSTREAM_PORT  # noqa: PLW0603
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8020)
    parser.add_argument("--upstream-port", type=int, default=DEFAULT_UPSTREAM_PORT)
    args = parser.parse_args()

    UPSTREAM_PORT = args.upstream_port
    upstream = start_upstream()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"frontend on http://{args.host}:{args.port}")
    print(f"watermarks-remover service on http://{UPSTREAM_HOST}:{UPSTREAM_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        if upstream is not None and upstream.poll() is None:
            upstream.terminate()
            try:
                upstream.wait(timeout=3)
            except subprocess.TimeoutExpired:
                upstream.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
