#!/usr/bin/env python3
"""Verify the workbench translation files.

Checks every locale under ad_ops_workbench/src/i18n/locales/ against English (en):
  - every file is valid JSON with one top-level key named after the file
  - every locale has the same files and the same keys as en, with no extras
  - no translation is empty
  - {{placeholders}} and <tags> match en, and tags are balanced
  - every locale folder is registered in LANGUAGES in src/i18n/index.ts
  - every key the components look up with t('...') or i18nKey="..." exists in en

Warnings (do not fail): translations identical to English, a likely sign of an
untranslated string.

Usage: python3 scripts/verify_i18n.py   (exits 1 if any error is found)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ad_ops_workbench" / "src"
LOCALES = SRC / "i18n" / "locales"
BASE = "en"

PLACEHOLDER = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")
TAG = re.compile(r"<(/?)(\w+)\s*(/?)>")
STATIC_KEY = re.compile(r"""(?:\bt\(|i18nKey=\{?)\s*['"]([\w.-]+)['"]""")
DYNAMIC_KEY = re.compile(r"""\bt\(\s*`([\w.-]*)\$\{""")

errors: list[str] = []
warnings: list[str] = []


def flatten(value, prefix=""):
    """Map dotted key paths (list items as .0, .1, ...) to leaf values."""
    if isinstance(value, dict):
        items = value.items()
    elif isinstance(value, list):
        items = ((str(i), v) for i, v in enumerate(value))
    else:
        return {prefix: value}
    out = {}
    for k, v in items:
        out.update(flatten(v, f"{prefix}.{k}" if prefix else k))
    return out


def load_locale(code: str) -> dict[str, dict | None]:
    """Return {file name: flattened keys} for one locale; None for a file that failed to load."""
    files: dict[str, dict | None] = {}
    for path in sorted((LOCALES / code).glob("*.json")):
        rel = path.relative_to(ROOT)
        files[path.name] = None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}")
            continue
        if not isinstance(data, dict) or list(data) != [path.stem]:
            errors.append(f"{rel}: must contain exactly one top-level key, \"{path.stem}\"")
            continue
        files[path.name] = flatten(data)
    return files


def check_tags(text: str) -> str | None:
    """Return a problem description if <tags> are unbalanced, else None."""
    stack = []
    for closing, name, self_closing in TAG.findall(text):
        if self_closing:
            continue
        if not closing:
            stack.append(name)
        elif not stack or stack.pop() != name:
            return f"unexpected </{name}>"
    return f"unclosed <{stack[-1]}>" if stack else None


def markup(text: str):
    return sorted(PLACEHOLDER.findall(text)), sorted(name for closing, name, _ in TAG.findall(text) if not closing)


def check_locale(code: str, base: dict[str, dict]):
    files = load_locale(code)
    for name in sorted(set(base) - set(files)):
        errors.append(f"{code}/{name}: file missing")
    for name in sorted(set(files) - set(base)):
        errors.append(f"{code}/{name}: file not in {BASE}/")

    for name in sorted(set(base) & set(files)):
        en, tr = base[name], files[name]
        if en is None or tr is None:
            continue
        for key in sorted(set(en) - set(tr)):
            errors.append(f"{code}/{name}: missing key {key}")
        for key in sorted(set(tr) - set(en)):
            errors.append(f"{code}/{name}: extra key {key} (not in {BASE})")
        for key in sorted(set(en) & set(tr)):
            src, dst = en[key], tr[key]
            if not isinstance(dst, str):
                if type(dst) is not type(src):
                    errors.append(f"{code}/{name}: {key} should be {type(src).__name__}")
                continue
            if not dst.strip():
                errors.append(f"{code}/{name}: {key} is empty")
                continue
            problem = check_tags(dst)
            if problem:
                errors.append(f"{code}/{name}: {key} has {problem}")
            if isinstance(src, str):
                (ep, et), (tp, tt) = markup(src), markup(dst)
                if ep != tp:
                    errors.append(f"{code}/{name}: {key} placeholders {tp} should be {ep}")
                if et != tt:
                    errors.append(f"{code}/{name}: {key} tags {tt} should be {et}")
                if dst == src and re.search(r"[a-z]{3,} [a-z]{3,}", src):
                    warnings.append(f"{code}/{name}: {key} is identical to English")


def check_registered(codes: list[str]):
    index = (SRC / "i18n" / "index.ts").read_text(encoding="utf-8")
    registered = re.findall(r"code:\s*'([\w-]+)'", index)
    for code in sorted(set(codes) - set(registered)):
        errors.append(f"locales/{code}/ exists but is not in LANGUAGES in src/i18n/index.ts")
    for code in sorted(set(registered) - set(codes)):
        errors.append(f"LANGUAGES lists {code} but locales/{code}/ does not exist")


def check_usage(base: dict[str, dict]):
    keys = {k for flat in base.values() if flat for k in flat}
    groups = {".".join(k.split(".")[:i]) for k in keys for i in range(1, k.count(".") + 1)}
    for path in sorted((SRC).rglob("*.tsx")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)
        for key in sorted(set(STATIC_KEY.findall(text))):
            if key not in keys and key not in groups:
                errors.append(f"{rel}: uses missing key {key}")
        for prefix in sorted(set(DYNAMIC_KEY.findall(text))):
            if prefix.rstrip(".") not in groups:
                errors.append(f"{rel}: uses missing key group {prefix}*")


def main() -> int:
    codes = sorted(p.name for p in LOCALES.iterdir() if p.is_dir())
    if BASE not in codes:
        print(f"No {BASE}/ folder in {LOCALES}")
        return 1
    base = load_locale(BASE)
    for code in codes:
        if code != BASE:
            check_locale(code, base)
    check_registered(codes)
    check_usage(base)

    total = sum(len(flat) for flat in base.values() if flat)
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"\nChecked {len(codes)} languages ({', '.join(codes)}), {len(base)} files, {total} keys: "
          f"{len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
