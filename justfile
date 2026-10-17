# Astryx task runner. `just` lists recipes.

default:
    @just --list

# Run every automated test
test: test-js test-rust

# Astronomy and planner tests under Node, once per timezone: the app must
# give the same answers wherever the computer running it is. The four zones
# run at once (Issue #275); each zone's output is printed in turn.
test-js:
    #!/usr/bin/env bash
    zones=(America/New_York UTC Australia/Sydney Asia/Kolkata)
    out=$(mktemp -d)
    trap 'rm -rf "$out"' EXIT
    for i in "${!zones[@]}"; do
        TZ=${zones[$i]} node --test --test-reporter=dot tests/*.test.js > "$out/$i" 2>&1 &
        pids[$i]=$!
    done
    failed=0
    for i in "${!zones[@]}"; do
        wait "${pids[$i]}" || failed=1
        echo "TZ=${zones[$i]}"
        cat "$out/$i"
    done
    exit $failed

# Re-record tests/snapshots/ after a deliberate change to a calculation
update-snapshots:
    UPDATE_SNAPSHOTS=1 node --test tests/*.test.js

# Rust tests: migrations, every command's database code, backup restore
test-rust:
    cd src-tauri && cargo test --lib

# Formatting, lints, and tests
check: fmt-check clippy test

# Format all Rust code
fmt:
    cd src-tauri && cargo fmt

# Fail if Rust code is not formatted
fmt-check:
    cd src-tauri && cargo fmt --check

# Lint; warnings are errors
clippy:
    cd src-tauri && cargo clippy --all-targets -- -D warnings

# Serve the web build on port 1420 (also the Tauri devUrl)
serve:
    npx serve src --listen 1420

# Run the desktop app in dev mode (starts the web server itself)
dev:
    cargo tauri dev

# Release exe only, no installers (src-tauri/target/release/)
build-exe:
    cargo tauri build --no-bundle

# Build the User Guide PDF into src/help/ (needs pandoc and typst)
guide:
    guide/build-guide.sh

# Headless-browser smoke test (Playwright is installed outside the repo)
ui-test:
    PLAYWRIGHT_DIR=$HOME/.local/share/astryx-playwright node tests/ui/smoke.mjs

# Behavior checks in headless Chromium, each in a fresh profile (optionally one issue's: just ui-checks 326)
ui-checks issue="":
    PLAYWRIGHT_DIR=$HOME/.local/share/astryx-playwright node tests/ui/checks.mjs {{issue}}

# Step through every tutorial in headless Chromium (optionally one: just ui-tutorials sidebar)
ui-tutorials id="":
    PLAYWRIGHT_DIR=$HOME/.local/share/astryx-playwright node tests/ui/tutorials.mjs {{id}}

# Capture the Guide's screenshots into guide/images (optionally some: just ui-guide-shots todo-list-chart)
ui-guide-shots *ids:
    PLAYWRIGHT_DIR=$HOME/.local/share/astryx-playwright node tests/ui/guide-shots.mjs {{ids}}
