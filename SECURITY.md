# Security policy

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository.
Do not open a public issue for a security report, and do not include secret
values in the report.

## What this repository is

Faith is a static reading page and a local Python script.

- The page in `docs/` is published with GitHub Pages from the `main` branch
  folder `/docs`. It runs in the browser, saves highlights in `localStorage`,
  and reads the passage from `https://bible-api.com`.
- `daily_script.py` builds the daily PDF, updates `bible_state.json`, and
  commits only an approved list of generated files.
- `docs/serve.py` serves that same folder on the local network so a phone on
  the same Wi-Fi can open it. There is no application backend.

## Controls

- The page sets a restrictive Content Security Policy. Scripts, styles, and
  fonts come only from this site. The only network call allowed is
  `https://bible-api.com`. Inline scripts and `eval` are not allowed.
- Bible API JSON is checked before use: the reference must be the requested
  book and chapter, verse numbers must be integers, the text must agree with
  the verse list, and control characters, bidirectional overrides, and angle
  brackets are removed. Verse text is rendered with `textContent`.
- Saved highlights and the theme are accepted only when they match an
  expected shape. Unknown keys and colors are ignored.
- `daily_script.py` stages `bible_state.json`, `daily_bible_YYYY-MM-DD.pdf`,
  and `old/daily_bible_YYYY-MM-DD.pdf` only. It will not stage a symlink, and
  the commit is limited to those paths. Git command output is redacted before
  it is printed.
- Python dependencies are pinned in `requirements.txt`. GitHub Actions runs
  `pip-audit`, Bandit, the repository checks in `scripts/security_check.py`,
  and the guard tests. Actions are pinned to commit SHAs and the workflow
  token cannot write to the repository.
- `.gitignore` excludes environment files, private keys, and local caches.
  `docs/.nojekyll` keeps GitHub Pages from running Jekyll over the site.

## Accepted risks

- `bible-api.com` is a third party. A wrong or hostile passage can still be
  shown if it matches the expected book, chapter, and verse shape. The page
  does not add a backend to proxy or sign that response.
- Text copied into a chat can still contain words inside a verse. Those words
  stay on one scripture line. A chat assistant can misread them. Review the
  paste before sending it.
- GitHub Pages cannot set HTTP headers. `frame-ancestors` and
  `X-Frame-Options` are therefore not available on the public site. The local
  server does send `X-Frame-Options: DENY`.
- The local server listens on all interfaces so a phone on the same network
  can connect. Use it only on a network you trust. It serves the `docs/`
  folder and does not serve the rest of the repository.
- The daily script still pulls and pushes when you run it. Run it from a
  clone you trust. It no longer commits unrelated files that happen to be in
  the folder.
- Secret scanning with push protection is enabled on the GitHub repository.
  This tree does not contain API keys or private keys. History was not
  rewritten.

## Credentials

Do not commit tokens, passwords, or private keys. The daily script refuses
paths outside its generated-file list, and the security check fails if a
tracked text file contains a credential-shaped string. The check prints the
file, line, and pattern name only.
