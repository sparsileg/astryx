# Astryx task runner. `just` lists recipes.

default:
    @just --list

# Run every automated test
test: test-js test-rust

# Algorithm Validation cases under Node (same cases as the in-app view)
test-js:
    node --test tests/*.test.js

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
