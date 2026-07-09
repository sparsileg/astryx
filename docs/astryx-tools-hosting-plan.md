# astryx.tools — Multi-Tool Hosting & Deployment Plan

*Goal: one domain, one landing page, several independently-deployable
tools — and an end to "upload the entire website to change one thing."*

---

## 1. The core architecture: one Pages project per tool

Cloudflare Pages projects are the unit of deployment. The fix for your
update pain is to stop treating astryx.tools as one website and make it
five small ones:

| Pages project       | Custom domain            | Contents                                             |
| ------------------- | ------------------------ | ---------------------------------------------------- |
| `astryx-landing`    | `astryx.tools` (root)    | The landing page (just built)                        |
| `astryx-app`        | `app.astryx.tools`       | Astryx (moved off the root)                          |
| `mindforge`         | `mindforge.astryx.tools` | Mindforge (replaces the `.pages.dev` URL as primary) |
| `scriptum`          | `scriptum.astryx.tools`  | Scriptum web version, when ready                     |
| *(none for Photyx)* | —                        | Desktop-only; GitHub releases                        |

Each project deploys completely independently: pushing a Mindforge fix
never touches the landing page, Astryx, or anything else. The landing
page changes only when you add or reword a tool card — which is exactly
how often you *want* to deploy it.

**Why subdomains and not paths** (`astryx.tools/mindforge`): service
workers and PWA installs are scoped per origin. On one origin, the
tools' service workers, caches, and manifests would fight each other and
the landing page (Mindforge's cache-first SW would be especially bad to
share a scope with). Subdomains are separate origins — every tool keeps
its own SW, its own storage, its own install prompt, zero interference.
This also keeps each tool's `CACHE_VERSION` discipline entirely local to
that tool.

---

## 2. Fixing the deployment workflow itself

### Git-connected projects — push to deploy


**Step 1 — Find the Worker's exact name**  
Dashboard → Workers & Pages → click into the astryx Worker → note the exact name shown at the top (this is what has to match in your config file).

**Step 2 — Add `wrangler.jsonc` to the repo root**, using that exact name:

```jsonc
{
  "name": "<exact-name-from-dashboard>",
  "compatibility_date": "2026-07-08",
  "assets": {
    "directory": "./src"
  }
}
```

Commit and push to `main`.

**Step 3 — Connect Git on the existing Worker**  
Worker's Settings → Builds (or "Build & deployments") → connect to `sparsileg/astryx`, production branch `main`, deploy command `npx wrangler deploy` (default), root directory `/`.

**Step 4 — Watch the first Git-triggered build**  
Check the Deployments tab — confirm it succeeds and doesn't complain about a name mismatch or missing config.

**Step 5 — Verify on the `workers.dev` URL before touching DNS**, same as before.

After that, **deployment is just `git push`** — which you're already
doing via GitHub Desktop as your normal workflow. No upload step exists
at all anymore; committing a one-line fix to Mindforge and pushing *is*
the deploy. You also get:

- A deployment per commit, with one-click **rollback** to any previous
  deployment in the dashboard.
- Free **preview deployments** for non-production branches (push a
  branch, get a throwaway URL to test on a phone before merging).

For no-build-step projects like yours, set the build command to none
and the output directory to the folder containing `index.html` (for
Mindforge that's `src/`, if the repo keeps sources under `src/` — set
"Root directory" or "Build output directory" accordingly per repo).



---

## 3. DNS and custom-domain setup (one-time)

Your domain is already on Cloudflare, which makes this the easy kind of
setup — Pages manages the DNS records for you:

1. In each Pages project → **Custom domains** → Add: enter its domain
   from the table above (`astryx.tools` for the landing project,
   `app.astryx.tools` for Astryx, etc.). Because the zone is on
   Cloudflare, it offers to create the CNAME record itself — accept.
2. For the root (`astryx.tools`), also add `www.astryx.tools` to the
   landing project (or a redirect rule www → root) so both resolve.
3. HTTPS certificates are automatic per hostname; nothing to manage.

The old `mindforge-9ai.pages.dev` URL keeps working (every project keeps
its `.pages.dev` hostname), so nothing breaks for you mid-transition —
the custom domain is additive.

---

## 4. Migration order (each step independently safe)

1. **Create `astryx-landing`**, deploy the new `index.html`, attach
   `astryx.tools`... *after* step 2, if Astryx currently occupies the
   root. If the root is currently free or you can tolerate a brief swap,
   steps 1–2 can be done in either order.
2. **Move Astryx to `app.astryx.tools`**: add the custom domain to the
   existing Astryx project, verify it works there, then detach
   `astryx.tools` from it. If Astryx has any bookmarked deep links, add a
   Pages **redirect** on the landing project (`_redirects` file:
   `/some-astryx-path https://app.astryx.tools/some-astryx-path 301`) —
   only needed if real deep links exist; the root itself now being the
   landing page is the intended change.
3. **Attach `mindforge.astryx.tools`** to the Mindforge project. Note
   for the PWA: users who installed from `mindforge-9ai.pages.dev` have
   an install bound to that origin — it keeps working, but new installs
   should come from the new domain. Their IndexedDB does **not** move
   across origins; the backup-zip export/import is the bridge if you
   want to migrate your own install (this is the same interchange story
   as the Tauri plan, deliberately).
4. **Scriptum**: create the project whenever the web version exists;
   until then the landing card's "coming soon" state stands. Flipping it
   live is a one-line edit to the landing page + one deploy.
5. **Photyx** never gets a Pages project — its card links to GitHub,
   where Tauri release artifacts live under Releases.

---

## 5. Small conventions worth adopting now

- **One repo = one Pages project = one subdomain.** Never let two tools
  share a project again; that's the rule that keeps deploys independent.
- The landing page is deliberately dependency-free (no JS, one file, no
  build) so it can go years between touches.
- When Mindforge's D1 backend arrives, the Worker/Pages Functions live
  with the Mindforge project (its own `/api/*` on its own origin) — the
  landing page and other tools are unaffected, which is exactly why the
  origins are separate.
- Favicon/branding for the landing page: not included yet — a small
  future task if you want the constellation mark as a favicon.
