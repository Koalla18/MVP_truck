from __future__ import annotations

import re


_slug_re = re.compile(r"[^a-z0-9-]+")


def slugify(value: str) -> str:
    raw = (value or "").strip().lower()
    raw = raw.replace("_", "-")
    raw = re.sub(r"\s+", "-", raw)
    raw = _slug_re.sub("-", raw)
    raw = re.sub(r"-+", "-", raw).strip("-")
    return raw or "company"
