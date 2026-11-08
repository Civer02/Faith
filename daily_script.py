#!/usr/bin/env python3
"""
Daily Proverbs + Psalm PDF generator with Git sync.
"""

import json
import os
import shutil
import subprocess
import sys
import unicodedata
from datetime import date
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing 'requests'. Install it first.")

try:
    from fpdf import FPDF
except ImportError:
    sys.exit("Missing 'fpdf'. Install it first.")

BASE_DIR = Path(__file__).parent.resolve()
STATE_FILE = BASE_DIR / "bible_state.json"
OLD_DIR = BASE_DIR / "old"
OLD_DIR.mkdir(exist_ok=True)

# Printed on every page so a chat assistant can read the highlight meanings.
HIGHLIGHT_KEY = (
    ((46, 160, 67), "Green", "Understand"),
    ((240, 196, 25), "Yellow", "Look up"),
    ((198, 40, 40), "Red", "Deep dive"),
)


class DailyBiblePDF(FPDF):
    """Scripture PDF with a color key for later study-report prompts."""

    def header(self):
        self.set_text_color(20, 20, 20)
        self.set_font("Arial", "B", 11)
        col_w = (self.w - self.l_margin - self.r_margin) / 3
        y = self.get_y()
        for i, (rgb, color_name, meaning) in enumerate(HIGHLIGHT_KEY):
            x = self.l_margin + i * col_w
            self.set_fill_color(*rgb)
            self.set_draw_color(60, 60, 60)
            self.rect(x, y + 1.2, 7, 4.6, "DF")
            self.set_xy(x + 9, y)
            self.cell(col_w - 10, 7, f"{color_name} = {meaning}", ln=0)
        self.ln(8)
        self.set_font("Arial", size=9)
        self.set_text_color(50, 50, 50)
        self.multi_cell(
            0,
            4.4,
            "Highlight verses in these colors, then add this PDF to a chat assistant "
            "and ask it to generate a study report. Understand: already clear. "
            "Look up: explain briefly. Deep dive: study in depth.",
        )
        self.ln(1.5)
        rule_y = self.get_y()
        self.set_draw_color(190, 190, 190)
        self.line(self.l_margin, rule_y, self.w - self.r_margin, rule_y)
        self.ln(4)
        self.set_text_color(0, 0, 0)
        self.set_font("Arial", size=12)


def write_daily_pdf(path, content: str) -> None:
    content = unicodedata.normalize("NFKD", content).encode("ascii", "ignore").decode("ascii")
    pdf = DailyBiblePDF()
    pdf.set_title("Daily Bible")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 10, content)
    pdf.output(str(path))


def fetch(ref: str) -> str:
    url = f"https://bible-api.com/{ref}"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.json()["text"].strip()


def run_git(*args, check=False, capture=True):
    cmd = ["git", *args]
    try:
        result = subprocess.run(
            cmd,
            cwd=BASE_DIR,
            capture_output=capture,
            text=True,
            timeout=60,
        )
        ok = result.returncode == 0
        out = (result.stdout or "") + (result.stderr or "")
        if check and not ok:
            print(f"git {' '.join(args)} failed:\n{out}")
        return ok, out.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
        return False, str(e)

def git_available():
    ok, _ = run_git("--version")
    return ok

def ensure_latest():
    if not git_available():
        print("Git not available — skipping pull.")
        return
    print("Pulling latest…")
    ok, out = run_git("pull", "--rebase", "--autostash")
    if ok:
        print("Pull complete.")
    else:
        print(f"Pull failed (continuing anyway):\n{out}")

def commit_and_push(message: str):
    if not git_available():
        print("\nGit not available — files are ready in the directory.")
        return
    print("\nStaging changes…")
    run_git("add", "-A")
    ok, status = run_git("status", "--porcelain")
    if not ok or not status.strip():
        print("Nothing to commit.")
        return
    print(f"Committing: {message}")
    ok, out = run_git("commit", "-m", message)
    if not ok:
        print(f"Commit failed:\n{out}")
        return
    print("Pushing…")
    ok, out = run_git("push")
    if ok:
        print("Push complete.")
    else:
        print(f"Push failed:\n{out}")

def main():
    ensure_latest()

    if STATE_FILE.exists():
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
    else:
        state = {
            "prov_start": 4,
            "prov_offset": 0,
            "psalm_start": 134,
            "psalm_offset": 0,
        }

    prov_chapter = (state["prov_start"] + state["prov_offset"] - 1) % 31 + 1
    psalm_num = (state["psalm_start"] + state["psalm_offset"] - 1) % 150 + 1

    try:
        prov_text = fetch(f"proverbs+{prov_chapter}")
        psalm_text = fetch(f"psalms+{psalm_num}")
    except Exception as e:
        sys.exit(f"Failed to fetch Bible text: {e}")

    content = (
        f"Proverbs {prov_chapter}\n\n{prov_text}\n\n"
        f"Psalm {psalm_num}\n\n{psalm_text}"
    )

    today = date.today()
    filename = BASE_DIR / f"daily_bible_{today.isoformat()}.pdf"
    write_daily_pdf(filename, content)

    state["prov_offset"] += 1
    state["psalm_offset"] += 1
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

    for pdf_path in BASE_DIR.glob("daily_bible_*.pdf"):
        try:
            date_str = pdf_path.stem.replace("daily_bible_", "")
            file_date = date.fromisoformat(date_str)
            if file_date < today:
                shutil.move(str(pdf_path), OLD_DIR / pdf_path.name)
        except (ValueError, OSError):
            pass

    print(f"Saved: {filename}")

    commit_msg = f"Daily Bible {today.isoformat()} — Proverbs {prov_chapter}, Psalm {psalm_num}"
    commit_and_push(commit_msg)

    next_prov = (prov_chapter % 31) + 1
    next_psalm = (psalm_num % 150) + 1
    print(f"Next run → Proverbs {next_prov}, Psalm {next_psalm}")


if __name__ == "__main__":
    main()

