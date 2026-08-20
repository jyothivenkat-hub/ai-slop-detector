"""Optional model-backed rewrite, ported from the local server.

The browser sends the user's own model settings (provider, key, model) with
each request; nothing is stored server-side. Only http(s) endpoints are called
and the user's key is only ever sent to the endpoint they configured.
"""

from __future__ import annotations

import http.client
import json
from urllib.parse import quote, urlparse

MAX_REWRITE_CHARS = 12000


class RewriteError(Exception):
    """A user-fixable model settings or request problem."""


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
        **(headers or {}),
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
        parts = [str(item.get("text") or "") for item in content if isinstance(item, dict)]
        return "\n".join(p for p in parts if p)
    return ""


def strip_model_wrapping(text: str) -> str:
    cleaned = text.strip()
    lines = cleaned.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def extract_openai_compatible_text(payload: dict) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise RewriteError("Model provider did not return any choices.")
    first = choices[0] or {}
    message = first.get("message") or {}
    text = text_from_content(message.get("content")) or str(first.get("text") or "")
    return strip_model_wrapping(text)


def extract_anthropic_text(payload: dict) -> str:
    text = text_from_content(payload.get("content") or [])
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


def openai_payload(model: str, text: str, mode: str) -> dict:
    system, user = rewrite_messages(text, mode)
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.25,
    }


def rewrite_with_openai_compatible(endpoint, api_key, model, text, mode, provider) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    payload = request_json(endpoint, openai_payload(model, text, mode), headers=headers)
    return {"ok": True, "text": extract_openai_compatible_text(payload), "provider": provider}


def rewrite_with_anthropic(api_key, model, text, mode) -> dict:
    system, user = rewrite_messages(text, mode)
    payload = request_json(
        "https://api.anthropic.com/v1/messages",
        {
            "model": model,
            "max_tokens": 1800,
            "temperature": 0.25,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        },
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )
    return {"ok": True, "text": extract_anthropic_text(payload), "provider": "Anthropic"}


def rewrite_with_google(api_key, model, text, mode) -> dict:
    system, user = rewrite_messages(text, mode)
    payload = request_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent?key={quote(api_key, safe='')}",
        {
            "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{user}"}]}],
            "generationConfig": {"temperature": 0.25},
        },
    )
    return {"ok": True, "text": extract_google_text(payload), "provider": "Google"}


def rewrite_with_ollama(settings, text, mode) -> dict:
    base_url = str(settings.get("ollamaUrl") or "http://localhost:11434").rstrip("/")
    model = required_setting(settings, "ollamaModel", "Enter an Ollama model name.")
    payload = request_json(f"{base_url}/api/chat", {**openai_payload(model, text, mode), "stream": False})
    return {"ok": True, "text": extract_ollama_text(payload), "provider": "Ollama"}


def rewrite_with_provider(settings, text, mode) -> dict:
    provider = str(settings.get("provider") or "openai").strip().lower()
    api_key = required_setting(settings, "providerApiKey", "Enter a provider API key.")
    model = required_setting(settings, "providerModel", "Enter a model name.")

    compatible = {
        "openai": ("https://api.openai.com/v1/chat/completions", "OpenAI"),
        "groq": ("https://api.groq.com/openai/v1/chat/completions", "Groq"),
        "mistral": ("https://api.mistral.ai/v1/chat/completions", "Mistral"),
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
