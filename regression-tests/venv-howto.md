# Python Virtual Environment (venv) — Setup & Usage

For a regression test harness.

## What a venv is

A self-contained copy of Python plus its own private package folder,
isolated from your system Python and from any other venv. `pip install`
inside an activated venv only affects that venv — nothing system-wide,
nothing that conflicts with what `apt` manages. You can have as many as you
want, one per project, and delete one anytime by just removing its folder.

## One-time setup

Run these once, from inside this folder.

```bash
cd ~/github/regression-tests
python3 -m venv .venv
source .venv/bin/activate
pip install mini-racer
```

Verify it installed correctly:

```bash
python3 -c "from py_mini_racer import MiniRacer; ctx = MiniRacer(); print(ctx.eval('1+1'))"
```

Should print `2`.

## Every time you come back to this

New terminal session, before running the harness:

```bash
cd ~/github/regression-tests
source .venv/bin/activate
python3 run_regression.py
```

Your prompt should show `(.venv)` at the start of the line once activated —
that's confirmation it's active. Everything installed via `pip` and every
`python3` command in that shell now uses the venv, not the system Python.

When you're done for the session:

```bash
deactivate
```

This returns the shell to the normal system Python. It's optional — closing
the terminal has the same effect — but good habit if you're switching to
other work in the same shell session.

## Notes

- You only need to *create* the venv once. Every session after that is just
  activate → run → (optionally) deactivate.
- If this folder ever becomes a git repo, add `.venv/` to `.gitignore` —
  it's a local build artifact (a few hundred MB with mini-racer's bundled
  V8), not something to commit. A `requirements.txt` is enough for anyone
  else (including future-you on another machine) to recreate it with
  `pip install -r requirements.txt` after their own `python3 -m venv .venv`.
- Deleting a venv is just deleting the folder: `rm -rf .venv`. Nothing
  outside the folder is affected. Recreate with the setup steps above if
  needed.
