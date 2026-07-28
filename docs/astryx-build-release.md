# Astryx — Build & Release Reference

Living reference for building Astryx locally, producing installers for
Linux/Windows/macOS, and shipping releases (manually or via CI). Update
this doc whenever the build setup changes.

Grounded in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` as of
this writing — not carried over from Photyx's doc by find-and-replace.
Astryx doesn't process FITS frames (it reads ASIAir/PHD2 logs, not image
data), has no Cargo workspace, and has no native C library dependency
comparable to Photyx's `cfitsio`, so none of that machinery appears
here.

---

## 0. Project layout that matters for builds

```
astryx/                     <- repo root
    src/                     <- vanilla JS/HTML/CSS frontend — no bundler,
                                 no build step, served as-is
    src-tauri/                <- single crate (no [workspace] in Cargo.toml)
        Cargo.toml            <- [package] version — THE version (1.4.0)
        tauri.conf.json        <- no "version" field — falls back to
                                   Cargo.toml, same pattern Photyx uses
        src/
        icons/
```

**Icon Generation:**  ```cargo tauri icon path/to/source.png```

**No Cargo workspace.** `Cargo.toml` has no `[workspace]` section — it's
a single crate. `cargo build`/`cargo tauri build` output lands at
**`astryx/src-tauri/target/release/astryx`**, not the repo root (that's
where Photyx's output lands, because Photyx *is* a workspace — don't
carry that assumption over).

**No `package.json`, and none needed.** `tauri.conf.json`'s `build`
block has no `beforeBuildCommand`/`beforeDevCommand` — there's no
frontend build step to run. `frontendDist` points straight at `../src`
(i.e. the repo's `src/` directory, served as static files), and `devUrl`
is `http://localhost:1420`, matching the existing dev workflow of
serving `src/` directly (`npx serve src --listen 1420`) with no
compilation step in between. Every command below uses `cargo tauri`
directly rather than an `npm run tauri` wrapper, because there is no
`npm` layer to wrap.

**One version number, one place.** Unlike Photyx (which needed Issue
161 to stop `tauri.conf.json` and `Cargo.toml` disagreeing),
`tauri.conf.json` here simply has no `version` field at all, so there's
only one number to keep in sync: `src-tauri/Cargo.toml`'s `[package]
version`, currently `1.4.0`. This is already valid SemVer — no
letter-suffix cleanup needed before wiring up tag-based releases.

**MSRV:** `Cargo.toml` pins `rust-version = "1.77.2"`. Any Rust
toolchain at or above that works; `stable` channel is well above it as
of this writing.

**Product identity, for reference:**

| Field                            | Value                                                                   |
| -------------------------------- | ----------------------------------------------------------------------- |
| Package name (`Cargo.toml`)      | `astryx`                                                                |
| Product name (`tauri.conf.json`) | `Astryx`                                                                |
| Bundle identifier                | `com.sparsile.astryx`                                                   |
| Default binary name              | `astryx` (no `mainBinaryName` override, so it follows the package name) |

---

## 1. Local development builds (no bundling)

For day-to-day iteration you almost never need a bundled installer.

**Serve the frontend** (static, no watch/rebuild needed — matches
`tauri.conf.json`'s `devUrl`):

```bash
npx serve src --listen 1420
```

**Hot-reload dev mode** (Tauri backend, picks up the frontend served
above):

```bash
cargo tauri dev
```

**Rust-only correctness check** (fastest signal, no codegen/link, no
bundling):

```bash
cd src-tauri && cargo check
```

**Run the test suite**, if/when Rust-side tests exist:

```bash
cd src-tauri && cargo test
```

**Full compiled binary, no installer:**

```bash
cargo tauri build --no-bundle
./src-tauri/target/release/astryx
```

This runs the real `tauri build` pipeline (Rust release compile) but
skips the platform-packaging step (`.deb`/`.exe`/`.dmg`/etc.), so you
get a runnable binary fast without producing installers you don't need
yet.

---

## 2. Platform-specific bundled builds

`tauri.conf.json`'s `bundle.targets` is `"all"` — a plain `cargo tauri
build` produces every installer type Tauri supports for the host
platform, with no extra flags:

- **Linux:** `.deb`, `.rpm`, `.AppImage`
- **Windows:** both `.msi` and NSIS `.exe` — see the version caveat
  below, since this differs from Photyx (which dropped `.msi` entirely)
- **macOS:** `.app` and `.dmg`

**Cross-compilation:** Tauri bundles are platform-native installers —
build Windows on a Windows machine (or `windows-latest` CI runner) and
macOS on a Mac or a native-arch CI runner. Stan has no local Mac for
Astryx, so macOS builds are CI-only in practice — see §4's matrix,
adapted from Photyx's already-proven `macos-latest` (Apple Silicon) /
`macos-15-intel` (Intel) split.

### No native C library dependency

`rusqlite` is configured with the `bundled` feature:

```toml
rusqlite = { version = "0.32", features = ["backup", "bundled"] }
```

That compiles SQLite from source as part of the Rust build on every
platform — no system SQLite package, no vcpkg, no dynamic-linking
DLL-staging steps anywhere in this doc. All it needs is a C compiler,
which every platform's standard Tauri toolchain already provides
(`build-essential` on Linux, MSVC on Windows, Xcode Command Line Tools
on macOS). This is the whole reason Photyx's doc has an entire section
on `cfitsio` linking strategy and this one doesn't — Astryx has nothing
comparable to link.

### Windows MSI and prerelease version strings

WiX (Tauri's MSI bundler) only accepts a *numeric-only* prerelease
identifier in the version string. A stable tag like `1.4.0` is fine.
But if a beta/RC tag uses a label like `1.4.0-beta.1` — the natural
convention, and the one used later in this doc — **the MSI bundle will
fail to build** on that tag, since `"beta"` isn't numeric. The NSIS
`.exe` bundle has no such restriction and will build fine regardless.

Since `bundle.targets` is `"all"` today, this will surface the first
time a `-beta`/`-rc` tag is pushed and the Windows job hits the MSI
step. Options, not yet decided:

- Accept that MSI only builds successfully for stable tags, and either
  let that job step fail harmlessly on betas or explicitly exclude
  `msi` from `bundle.targets` for beta builds (not straightforward,
  since `bundle.targets` isn't currently conditional).
- Switch to a numeric-only prerelease scheme (`1.4.0-1` instead of
  `1.4.0-beta.1`) — loses the readable label.
- Drop `msi` from `bundle.targets` entirely and ship NSIS-only, same
  choice Photyx made — but for Astryx that would be a deliberate
  simplification, not a forced one, since there's no native-linking
  reason behind it.

### Linux (primary dev platform)

Standard Tauri v2 system packages (Ubuntu/Debian; adjust for your
distro):

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf xdg-utils build-essential
```

Note: some newer Debian/Ubuntu releases have renamed
`libappindicator3-dev` to `libayatana-appindicator3-dev` — if the
package isn't found, try that name instead.

```bash
cargo tauri build
```

Produces `.deb`, `.rpm`, and `.AppImage` under
`src-tauri/target/release/bundle/`.

### Windows

Needs: Visual Studio Build Tools (MSVC toolchain). Nothing beyond that
— no vcpkg, no `pkg-config` — since `rusqlite`'s `bundled` feature needs
only a C compiler, which MSVC already provides.

```powershell
cargo tauri build
```

Produces both `.msi` and an NSIS `.exe` under
`src-tauri/target/release/bundle/` — see the MSI/prerelease caveat
above for beta/RC tags specifically.

### macOS

CI-only today (no local Mac). For reference, if that changes:

Needs: Xcode Command Line Tools. No other install step — same reasoning
as Linux/Windows above.

```bash
cargo tauri build
```

Produces a `.app` bundle and `.dmg` under
`src-tauri/target/release/bundle/`.

**Apple Silicon vs Intel:** by default this builds for the host
architecture only:

```bash
cargo tauri build --target aarch64-apple-darwin   # Apple Silicon
cargo tauri build --target x86_64-apple-darwin     # Intel — only works
                                                     # if actually run on
                                                     # Intel hardware/VM
```

There's no universal-binary flag built into `tauri build` — the two
targets always ship as separate `.dmg` files. This is why the CI matrix
in §4 uses two separate macOS runners.

Since the macOS package is not signed, Gatekeeper will reject it. To
strip the quarantine attribute after installing to `/Applications`:

```bash
xattr -cr /Applications/Astryx.app
```

---

## 3. Delivering releases on GitHub

Releases are built on **git tags**, using `gh`.

### Tag/version conventions

- Stable: `v1.4.0` (tag) ↔ `1.4.0` (`Cargo.toml`)
- Beta: `v1.4.0-beta.1` ↔ `1.4.0-beta.1`
- Release candidate: `v1.4.0-rc.1` ↔ `1.4.0-rc.1`

Keep the tag and `src-tauri/Cargo.toml`'s version in agreement — bump
`Cargo.toml` first, commit, *then* tag. (See §2 for why a `-beta`/`-rc`
tag specifically affects the Windows MSI build.)

### Creating a release manually

```bash
cd ~/github/astryx

# Bump the version first
#   edit src-tauri/Cargo.toml -> version = "1.4.0-beta.1"
git add src-tauri/Cargo.toml
git commit -m "Bump version to 1.4.0-beta.1"
git push

# Tag + release in one step (gh creates the tag if it doesn't exist)
gh release create v1.4.0-beta.1 \
  --title "v1.4.0-beta.1" \
  --generate-notes \
  --prerelease
```

`--prerelease` marks it as beta/RC rather than a stable "Latest
release" — do this for every beta and RC build. Drop the flag only for
an actual stable release (see §5).

**Attaching built installers** so testers can download and run
directly:

```bash
gh release create v1.4.0-beta.1 \
  --title "v1.4.0-beta.1" \
  --notes "Beta build for external testing" \
  --prerelease \
  src-tauri/target/release/bundle/deb/astryx_1.4.0-beta.1_amd64.deb \
  src-tauri/target/release/bundle/appimage/astryx_1.4.0-beta.1_amd64.AppImage
```

**Auto-generated notes** (summarizes merged PRs/commits since the last
tag):

```bash
gh release create v1.4.0-beta.1 --prerelease --generate-notes
```

**Draft first, publish later:**

```bash
gh release create v1.4.0-beta.1 --prerelease --draft --notes "..."
# later, once ready:
gh release edit v1.4.0-beta.1 --draft=false
```

**Web UI equivalent:** repo → **Releases** → **Draft a new release** →
pick/create the tag → title/notes → check **"Set as a pre-release"**
for beta/RC → drag installer files into the assets area → **Publish
release**.

---

## 4. Automating builds with GitHub Actions

The standard way to build + release a Tauri app is
[`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action)
— it runs `tauri build` on each platform in a matrix, creates the
GitHub release, and uploads all the platform installers automatically.

### Workflow file

Save as `.github/workflows/release.yml`. Triggers on pushing a version
tag, matching §3's convention:

```yaml
name: 'release'

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'   # Apple Silicon
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-15-intel'   # Intel — native Intel hardware,
                                          # not a cross-compile. GitHub
                                          # retired macos-13 (Dec 2025);
                                          # macos-15-intel is the current
                                          # Intel runner, planned for
                                          # retirement around Aug 2027.
            args: ''
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v7

      - name: install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
            patchelf xdg-utils
        # Standard Tauri v2 Linux deps only — rusqlite's "bundled"
        # feature needs nothing beyond the C compiler this image
        # already has.

      # No Windows vcpkg / pkg-config / DLL-staging steps, and no
      # setup-node / npm install step — there's no native library to
      # link beyond rusqlite's bundled, self-contained SQLite, and no
      # package.json or frontend build step to run (see §0).

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          # Single crate at src-tauri/, not repo root — see §0.
          workspaces: 'src-tauri -> target'

      - uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Astryx v__VERSION__'
          releaseBody: 'See the assets below to download and install this version.'
          releaseDraft: true
          prerelease: ${{ contains(github.ref_name, '-beta') || contains(github.ref_name, '-rc') }}
          args: ${{ matrix.args }}
```

Notes specific to this workflow:

- **No `package.json` needed for the build itself.** Modern
  `tauri-action` reads the app name/version from `Cargo.toml`/
  `tauri.conf.json` directly rather than requiring one. If a run ever
  fails with `No artifacts were found` and mentions expecting a
  `package.json` with `name`/`version` fields, that's the known symptom
  from older `tauri-action` versions expecting one — check the pinned
  action version first before adding a `package.json` as a workaround.
- **`__VERSION__` substitution** reads from `src-tauri/Cargo.toml`,
  since `tauri.conf.json` has no `version` field to conflict with it.
- **`prerelease` is computed from the tag name** — pushing
  `v1.4.0-beta.1` or `v1.4.0-rc.1` automatically marks the release as a
  pre-release; a plain `v1.4.0` doesn't.
- **`releaseDraft: true`** — creates a draft, not a published release
  (`gh release edit <tag> --draft=false` to publish).
- **The Windows job will attempt an MSI build on every tag**, including
  betas — see §2's caveat; expect that step to fail on a `-beta`/`-rc`
  tag until one of the options there is decided on.
- **Linux runner pinned to `ubuntu-22.04`**, not `ubuntu-latest`, to
  avoid surprises when GitHub rolls the default image forward.
- `github.ref_name` on a manual `workflow_dispatch` run falls back to
  the branch name, so the `prerelease` check silently never matches on
  manual runs — trigger real releases via tag push, and use
  `workflow_dispatch` only for build-testing.

### Triggering it

```bash
# Bump src-tauri/Cargo.toml's version and commit first, then:
git tag v1.4.0-beta.1
git push origin v1.4.0-beta.1
```

Or manually, if the tag already exists:

```bash
gh workflow run release.yml
```

### Iterating using the same tag

To delete and re-cut a release under the same tag after a workflow
error:

```bash
gh release list
# note the tag name

gh release delete v1.4.0-beta.1 --yes --cleanup-tag
git tag -d v1.4.0-beta.1

# verify
gh release list
```

If that doesn't work, go one level deeper by ID:

```bash
gh api repos/sparsileg/astryx/releases --jq '.[] | select(.tag_name=="v1.4.0-beta.1") | {id, name, tag_name, draft, prerelease}'
# there can be more than one release sharing a tag_name — delete every id

gh api -X DELETE repos/sparsileg/astryx/releases/<id_1>
gh api -X DELETE repos/sparsileg/astryx/releases/<id_2>

git push origin :refs/tags/v1.4.0-beta.1
git tag -d v1.4.0-beta.1

# verify BEFORE re-tagging — both must come back empty
gh release list
git ls-remote --tags origin | grep v1.4.0-beta.1

# re-tag from the current, correct commit and push for a fresh run
git tag v1.4.0-beta.1
git push origin v1.4.0-beta.1

# confirm the tag actually points where you think before waiting on the run
git rev-parse v1.4.0-beta.1
git rev-parse main
```

Confirm the hashes actually match before assuming a re-run will use
your latest fix — a tag can silently point at a stale commit if any
delete/recreate step ran out of order.

### First-time setup gotcha

The workflow's `GITHUB_TOKEN` only has **read** permissions by default
— you'll get `Resource not accessible by integration` otherwise. Fix
once, repo-wide: **Settings → Actions → General → Workflow permissions
→ Read and write permissions**. A `GITHUB_TOKEN` is issued fresh per
run using whatever this setting was *at the moment the run started* —
if a failure looks like this error despite the setting already being
correct, check whether that run started before you saved the setting.

### If you outgrow this later

- **Arm Linux builds**: GitHub's `ubuntu-22.04-arm`/`ubuntu-24.04-arm`
  public runners slot directly into the same matrix.
- **Code signing** (removes "unidentified developer"/SmartScreen
  warnings): Tauri has dedicated guides for
  [macOS](https://v2.tauri.app/distribute/sign/macos/) and
  [Windows](https://v2.tauri.app/distribute/sign/windows/) signing.

### Downloading a release

```bash
gh release download v1.4.0-beta.1
```

Or one file, by pattern:

```bash
gh release download v1.4.0-beta.1 --pattern "*.deb"
```

**Via a direct link:**

```bash
curl -LO https://github.com/sparsileg/astryx/releases/download/v1.4.0-beta.1/astryx_1.4.0-beta.1_amd64.deb
```

**Installing what you downloaded** (Linux `.deb` example):

```bash
sudo apt install ./astryx_1.4.0-beta.1_amd64.deb
```

---

## 5. Promoting a pre-release to a full release

### 5a. Beta/RC → stable

Cut a **new** release under a stable version number rather than
relabeling an existing beta build — the beta's binaries stay traceable
to a specific beta tag, and SemVer tools correctly keep treating
`1.4.0-beta.3` as a prerelease regardless of any flag flipped on
GitHub's side.

```bash
cd ~/github/astryx

# 1. Bump the version, dropping the prerelease suffix entirely
#    edit src-tauri/Cargo.toml -> version = "1.4.0"
git add src-tauri/Cargo.toml
git commit -m "Bump version to 1.4.0"
git push

# 2. Tag and push — no "-beta"/"-rc" in the tag this time
git tag v1.4.0
git push origin v1.4.0
```

The `release.yml` workflow handles the rest: `prerelease: ${{
contains(github.ref_name, '-beta') || contains(github.ref_name, '-rc')
}}` evaluates to `false` for a plain `v1.4.0` tag, so the release is
created as stable (still a draft, per `releaseDraft: true`). This is
also the point at which the Windows MSI build stops being an issue —
see §2 — since a bare `1.4.0` has no non-numeric prerelease identifier.

**Publish it:**

```bash
gh release edit v1.4.0 --draft=false
```

Once published, non-draft, and non-prerelease, this automatically
becomes GitHub's "Latest release" (unless a more recent non-draft/
non-prerelease release already exists).

**Discouraged shortcut:** flipping an existing beta release to
non-prerelease directly, without cutting a new version, leaves the
`-beta.N` string baked into both the tag and the shipped binaries'
version metadata — confusing for anyone downloading it later:

```bash
gh release edit v1.4.0-beta.3 --prerelease=false --draft=false --latest
```

Not recommended as a normal workflow.

### 5b. Stable "Latest version" download URLs per OS

GitHub's stable URL pattern:

```
https://github.com/sparsileg/astryx/releases/latest/download/<exact-filename>
```

This resolves to the most recent published release that is **not** a
draft and **not** prerelease — betas/RCs are permanently excluded from
this URL, by design.

**The catch:** this needs an *exact* filename match, but Tauri's
bundlers bake the version into every artifact's filename, which changes
every release. To get a genuinely fixed per-OS URL, publish a second
copy of each artifact under a version-less filename.

Add these as additional steps at the end of the `publish-tauri` job,
after the `tauri-apps/tauri-action@v1` step:

```yaml
      - name: publish fixed-name "latest" asset (Linux)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          find src-tauri/target -path "*bundle/deb/*.deb" -exec cp {} astryx-linux-x86_64.deb \;
          find src-tauri/target -path "*bundle/rpm/*.rpm" -exec cp {} astryx-linux-x86_64.rpm \;
          find src-tauri/target -path "*bundle/appimage/*.AppImage" -exec cp {} astryx-linux-x86_64.AppImage \;
          gh release upload ${{ github.ref_name }} \
            astryx-linux-x86_64.deb astryx-linux-x86_64.rpm astryx-linux-x86_64.AppImage \
            --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: publish fixed-name "latest" asset (Windows)
        if: matrix.platform == 'windows-latest'
        shell: pwsh
        run: |
          $exe = Get-ChildItem -Path src-tauri\target -Recurse -Filter *.exe |
            Where-Object { $_.FullName -like "*bundle*nsis*" } |
            Select-Object -First 1
          Copy-Item $exe.FullName astryx-windows-x86_64.exe
          gh release upload ${{ github.ref_name }} astryx-windows-x86_64.exe --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: publish fixed-name "latest" asset (macOS)
        if: matrix.platform == 'macos-latest' || matrix.platform == 'macos-15-intel'
        run: |
          ARCH_NAME="${{ matrix.platform == 'macos-latest' && 'arm64' || 'x86_64' }}"
          find src-tauri/target -path "*bundle/dmg/*.dmg" -exec cp {} "astryx-macos-${ARCH_NAME}.dmg" \;
          gh release upload ${{ github.ref_name }} "astryx-macos-${ARCH_NAME}.dmg" --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Notes on this addition:

- Uses `find`/`Get-ChildItem` with a pattern match rather than
  hardcoded version-specific filenames, since the exact filename
  changes every release and the aarch64/Intel macOS build paths differ.
- `--clobber` is required — without it, `gh release upload` refuses to
  overwrite an asset that already has that filename, which every
  release after the first would hit.
- `gh` is pre-installed on GitHub-hosted runners; `GH_TOKEN` (not
  `GITHUB_TOKEN` — that's the variable name `gh` itself looks for) is
  set the same way as `tauri-action`'s own auth.
- Windows step deliberately picks only the NSIS `.exe`, not the `.msi`
  — the fixed-name "latest" URL is meant to be one unambiguous download
  per OS, and NSIS is the one guaranteed to build on every tag (see
  §2's MSI/prerelease caveat). If you want a fixed-name MSI URL too,
  add it as a separate named asset once the MSI-on-beta question in §2
  is resolved.
- **The Windows NSIS output path/filename pattern here is inferred from
  Tauri's documented bundle layout, not directly confirmed against a
  successful Astryx Windows CI run as of this writing** — verify
  against the first real run and adjust the `Where-Object` filter if
  needed.
- This runs unconditionally on every tagged push, betas included —
  harmless, since a beta's fixed-name assets just sit inertly on a
  draft/prerelease release that `/releases/latest` will never resolve
  to anyway.

Once a real stable release is published, these become permanent,
never-changing per-OS download links:

```
https://github.com/sparsileg/astryx/releases/latest/download/astryx-linux-x86_64.deb
https://github.com/sparsileg/astryx/releases/latest/download/astryx-linux-x86_64.rpm
https://github.com/sparsileg/astryx/releases/latest/download/astryx-linux-x86_64.AppImage
https://github.com/sparsileg/astryx/releases/latest/download/astryx-windows-x86_64.exe
https://github.com/sparsileg/astryx/releases/latest/download/astryx-macos-arm64.dmg
https://github.com/sparsileg/astryx/releases/latest/download/astryx-macos-x86_64.dmg
```

Link to these from a website, README, or documentation, and they'll
always serve whatever the most recent stable release actually is — no
link updates needed on future releases.

---

## Quick reference

| Task                                  | Command                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Serve frontend                        | `npx serve src --listen 1420`                                                                 |
| Hot-reload dev (Tauri)                | `cargo tauri dev`                                                                             |
| Fast Rust check                       | `cd src-tauri && cargo check`                                                                 |
| Run tests                             | `cd src-tauri && cargo test`                                                                  |
| Local build, no installer             | `cargo tauri build --no-bundle`                                                               |
| Full bundled build (current platform) | `cargo tauri build`                                                                           |
| macOS: specific arch (CI-only today)  | `cargo tauri build --target aarch64-apple-darwin`                                             |
| Cut a beta/RC release (manual)        | `gh release create vX.Y.Z-beta.N --prerelease --generate-notes`                               |
| Cut a beta/RC release (CI)            | `git tag vX.Y.Z-beta.N && git push origin vX.Y.Z-beta.N`                                      |
| Promote beta → stable                 | Bump Cargo.toml, drop suffix, tag `vX.Y.Z`, push, then `gh release edit vX.Y.Z --draft=false` |
| Publish a draft release               | `gh release edit vTAG --draft=false`                                                          |
