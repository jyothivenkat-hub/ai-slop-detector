"""Shared watermark logic for the Vercel Python functions.

On Vercel there is no long-running service or subprocess. Each serverless
function imports this module and calls the vendored watermark logic directly,
which is pure standard library. Locally, server.py still proxies to the fork's
own HTTP service; this module is the serverless equivalent of that proxy.
"""

from __future__ import annotations

import base64
import binascii
import os
import sys
from pathlib import Path
from typing import Any

# Make the bundled fork modules importable by their bare names, exactly the way
# they import each other (``from common import ...``).
_WM_DIR = os.path.join(os.path.dirname(__file__), "_wm")
if _WM_DIR not in sys.path:
    sys.path.insert(0, _WM_DIR)

from common import looks_binary  # noqa: E402
from container_meta import clean_container, inspect_container  # noqa: E402
from format_dispatch import classify_bytes  # noqa: E402
from image_meta import clean_image, inspect_image  # noqa: E402
from score_stylometry import score_text_stylometry  # noqa: E402
from text_unicode import clean_text, inspect_text  # noqa: E402

VERSION = os.environ.get("WATERMARKS_SERVER_VERSION", "vercel")

ALLOWED_CLEAN_OPTIONS = {
    "nfkc",
    "aggressive_homoglyphs",
    "keep_non_ai_metadata",
    "also_layer_a_text",
    "remove_pixel",
    "strip_all_metadata",
}


class RequestError(ValueError):
    """A user-fixable problem with the request."""


def capabilities() -> dict[str, Any]:
    """Report what the deployment can do. On Vercel the optional external tools
    (exiftool, qpdf, c2patool) and ML backends are absent, so this is honest
    about running the stdlib layers only."""
    from shutil import which

    return {
        "ok": True,
        "version": VERSION,
        "tools": {
            "c2patool": which("c2patool") is not None,
            "exiftool": which("exiftool") is not None,
            "qpdf": which("qpdf") is not None,
        },
        "pixel_backends": {"ctrlregen": False, "diffusion": False},
        "scorers": {"synthid": False, "stylometry": True},
        "harnesses": {"markllm": False},
    }


def _safe_name(name: str) -> str:
    base = Path(name.replace("\\", "/")).name
    if base in ("", ".", ".."):
        return "input"
    return base


def decode_input(body: dict[str, Any]) -> tuple[bytes, str]:
    raw = body.get("file")
    if not isinstance(raw, str):
        raise RequestError("missing string field 'file' (base64-encoded bytes)")
    name = body.get("name")
    if name is not None and not isinstance(name, str):
        raise RequestError("'name' must be a string")
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise RequestError("'file' is not valid base64")
    return data, _safe_name(name or "")


def run_inspect(body: dict[str, Any]) -> dict[str, Any]:
    data, name = decode_input(body)
    kind = classify_bytes(data, Path(name).suffix)
    if kind == "text":
        if looks_binary(data):
            raise RequestError("refusing to inspect bytes that look like a binary container as text")
        raw_text = data.decode("utf-8", errors="surrogateescape")
        report = inspect_text(raw_text).to_dict()
        report["stylometry"] = score_text_stylometry(raw_text, path=name or "<text>").to_dict()
    elif kind == "image":
        report = _with_tmp(data, name, inspect_image)
    else:
        report = _with_tmp(data, name, inspect_container)

    suspicious = (
        bool(report.get("suspicious_total"))
        or bool(report.get("has_c2pa") or report.get("has_ai_metadata"))
        or bool(report.get("stylometry", {}).get("score", 0.0) >= 0.65)
    )
    return {"ok": True, "kind": kind, "report": report, "suspicious": suspicious}


def run_clean(body: dict[str, Any]) -> dict[str, Any]:
    data, name = decode_input(body)
    options = body.get("options") or {}
    if not isinstance(options, dict):
        raise RequestError("'options' must be an object")
    for key in options:
        if key not in ALLOWED_CLEAN_OPTIONS:
            raise RequestError(f"unknown option: {key}")

    kind = classify_bytes(data, Path(name).suffix)

    if kind == "text":
        if looks_binary(data):
            raise RequestError("refusing to clean bytes that look like a binary container as text")
        text = data.decode("utf-8", errors="surrogateescape")
        cleaned, stats = clean_text(
            text,
            nfkc=bool(options.get("nfkc")),
            aggressive_homoglyphs=bool(options.get("aggressive_homoglyphs")),
        )
        cleaned_bytes = cleaned.encode("utf-8", errors="surrogateescape")
        report: dict[str, Any] = {"kind": "text", "stats": stats, "length": len(cleaned)}
    else:
        import tempfile

        with tempfile.TemporaryDirectory(prefix="wm-clean-") as tmp:
            tmpdir = Path(tmp)
            src = tmpdir / (name or "input")
            src.write_bytes(data)
            if kind == "image":
                dest = tmpdir / "out.png"
                strip_all = not bool(options.get("keep_non_ai_metadata"))
                if "strip_all_metadata" in options:
                    strip_all = bool(options["strip_all_metadata"])
                result = clean_image(src, dest, strip_all_metadata=strip_all, remove_pixel=None)
                cleaned_bytes = dest.read_bytes()
                report = {"kind": "image", **result}
            else:
                dest = tmpdir / f"out{Path(name).suffix}"
                result = clean_container(src, dest, also_layer_a_text=bool(options.get("also_layer_a_text", True)))
                cleaned_bytes = dest.read_bytes()
                report = {"kind": "container", **result}
            report.pop("input", None)
            report.pop("output", None)

    return {
        "ok": True,
        "kind": kind,
        "cleaned": base64.b64encode(cleaned_bytes).decode("ascii"),
        "report": report,
    }


def _with_tmp(data: bytes, name: str, fn):
    import tempfile

    with tempfile.TemporaryDirectory(prefix="wm-inspect-") as tmp:
        path = Path(tmp) / (name or "input")
        path.write_bytes(data)
        return fn(path).to_dict()
