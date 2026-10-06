# Astryx task runner. `just` lists recipes.

default:
    @just --list

# Run every automated test
test: test-js

# Algorithm Validation cases under Node (same cases as the in-app view)
test-js:
    node --test tests/*.test.js

# Serve the web build on port 1420 (also the Tauri devUrl)
serve:
    npx serve src --listen 1420

# Run the desktop app in dev mode (starts the web server itself)
dev:
    cargo tauri dev

# Fast Rust compile check
check:
    cd src-tauri && cargo check
