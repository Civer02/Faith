#!/usr/bin/env python3
"""Repository checks that do not print secret values."""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; "
    "img-src 'self'; connect-src https://bible-api.com; object-src 'none'; "
    "base-uri 'self'; form-action 'none'; frame-src 'none'; worker-src 'none'"
)
TEXT_SUFFIXES = {
    ".py", ".js", ".html", ".css", ".md", ".txt", ".yml", ".yaml", ".json", ".gitignore",
}
SKIP_DIRS = {".git", ".venv", "venv", "__pycache__", "node_modules"}
PATTERNS = (
    ("private_key", re.compile("-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----")),
    ("github_token", re.compile("gh" + "p_" + r"[A-Za-z0-9]{20,}")),
    ("github_fine_grained", re.compile("github_pat_" + r"[A-Za-z0-9_]{20,}")),
    ("aws_access_key", re.compile("AKIA" + r"[0-9A-Z]{16}")),
    ("slack_token", re.compile("xox" + r"[baprs]-[A-Za-z0-9-]{10,}")),
    ("assigned_secret", re.compile(
        r"(?i)(?:api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]"
    )),
)
UNSAFE_PAGE = re.compile(
    r"innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function\b"
)
INLINE_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>", re.IGNORECASE)
UNRESTRICTED_ADD = re.compile(
    r"""add["']\s*,\s*["'](?:-A|--all|\.)["']|git\s+add\s+(?:-A|--all|\.)\b"""
)


def fail(message):
    print(f"security check: {message}")
    return 1


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_policy():
    errors = 0
    html = read(ROOT / "docs" / "index.html")
    server = read(ROOT / "docs" / "serve.py")
    compact = " ".join(POLICY.split())
    if compact not in " ".join(html.split()):
        errors += fail("docs/index.html is missing the restrictive Content Security Policy")
    if compact not in " ".join(server.split()):
        errors += fail("docs/serve.py is missing the same Content Security Policy")
    if "unsafe-inline" in html or "unsafe-eval" in html:
        errors += fail("Content Security Policy allows inline or eval script")
    if INLINE_SCRIPT.search(html):
        errors += fail("docs/index.html contains an inline script")
    for name in ("theme-init.js", "guard.js", "app.js"):
        if not re.search(rf'src="{re.escape(name)}(?:\?[^"]*)?"', html):
            errors += fail(f"docs/index.html does not load {name}")
    guard_src = re.search(r'src="guard\.js(?:\?[^"]*)?"', html)
    app_src = re.search(r'src="app\.js(?:\?[^"]*)?"', html)
    if not guard_src or not app_src or guard_src.start() > app_src.start():
        errors += fail("guard.js must load before app.js")
    for path in (ROOT / "docs" / "app.js", ROOT / "docs" / "guard.js"):
        text = read(path)
        if UNSAFE_PAGE.search(text):
            errors += fail(f"{path.relative_to(ROOT)} uses an unsafe DOM or eval API")
    if "textContent" not in read(ROOT / "docs" / "app.js"):
        errors += fail("docs/app.js no longer renders with textContent")
    return errors


def check_git_allowlist():
    script = read(ROOT / "daily_script.py")
    if UNRESTRICTED_ADD.search(script):
        return fail("daily_script.py stages the tree instead of an approved file list")
    if "shell=True" in script:
        return fail("daily_script.py runs a shell command")
    if "approved_repo_path" not in script or '"--only"' not in script:
        return fail("daily_script.py does not limit the commit to approved paths")
    return 0


def check_ignore_and_pins():
    errors = 0
    ignore = read(ROOT / ".gitignore")
    for entry in (".env", ".DS_Store", "*.pem", "*.key", "id_rsa", "__pycache__/"):
        if entry not in ignore:
            errors += fail(f".gitignore is missing {entry}")
    requirements = read(ROOT / "requirements.txt")
    for package in ("requests==", "fpdf2=="):
        if package not in requirements:
            errors += fail(f"requirements.txt does not pin {package[:-2]}")
    if re.search(r"^[A-Za-z0-9_-]+(?:\[[^\]]+\])?\s*$", requirements, re.MULTILINE):
        errors += fail("requirements.txt contains an unpinned requirement")
    workflow = read(ROOT / ".github" / "workflows" / "security.yml")
    if "contents: read" not in workflow:
        errors += fail("security workflow does not stay read-only")
    pins = re.findall(r"uses:\s*([^\s#]+)", workflow)
    if not pins or any(not re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", pin) for pin in pins):
        errors += fail("GitHub Actions are not pinned to a commit SHA")
    if "persist-credentials: false" not in workflow:
        errors += fail("security workflow keeps checkout credentials")
    if not (ROOT / "SECURITY.md").is_file():
        errors += fail("SECURITY.md is missing")
    return errors


def iter_text_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name != ".gitignore":
            continue
        yield path


def check_secrets():
    errors = 0
    for path in iter_text_files():
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeError:
            continue
        rel = path.relative_to(ROOT)
        for number, line in enumerate(lines, start=1):
            for name, pattern in PATTERNS:
                if pattern.search(line):
                    errors += fail(f"{rel}:{number} matched {name}")
    return errors


def main():
    errors = check_policy() + check_git_allowlist() + check_ignore_and_pins() + check_secrets()
    if errors:
        print(f"{errors} security check(s) failed")
        return 1
    print("security checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
