# Partner content editor (CMS) — setup guide

A standalone editor lives at **`/admin`** on the deployed site. Approved people
sign in with just their email address (they get a 6-digit code), edit the
site's text, and hit **save & publish**. Every save becomes a git commit to
`content.json` on `main`, and the site redeploys automatically — so you keep
full history and keep maintaining the site here with Claude Code.

## How it works

```
partner → /admin → email + 6-digit code → edit fields → save
                                                    │
                                     serverless fn commits content.json
                                            to GitHub (as a normal commit)
                                                    │
                                     Vercel auto-redeploys → site updated
```

- `content.json` — single source of truth for all editable copy (hero,
  services, case-study names, about, bios, client list, contact & footer).
- `js/content.js` — hydrates the homepage from `content.json` at load. The
  HTML keeps its baked-in copy as a fallback, so the site works even if the
  file can't be fetched.
- `admin/` — the standalone editor UI (static page).
- `api/` — Vercel serverless functions: `request-code`, `verify-code`,
  `session`, and `content` (GET latest / POST save-and-commit).

Sign-in codes are stateless (HMAC of email + 10-minute time window), so no
database is required. Sessions are signed, HttpOnly, 7-day cookies. A session
stops working immediately if you remove the email from the allowlist.

## One-time setup (~15 minutes)

### 1. Deploy the repo to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import `suzycho/agency`.
2. Framework preset: **Other**. No build command, no output directory —
   accept the defaults and deploy.

Because the project is linked to the GitHub repo, every commit to `main`
(including CMS saves) redeploys the site automatically.

### 2. Create a GitHub token (lets the CMS commit content)

1. GitHub → Settings → Developer settings → **Fine-grained personal access
   tokens** → Generate new token.
2. Repository access: **only `suzycho/agency`**.
3. Permissions: **Contents → Read and write**. Nothing else.
4. Copy the token for the next step.

### 3. Set environment variables on the Vercel project

In the Vercel project → Settings → Environment Variables, add:

| Variable | Required | Value |
|---|---|---|
| `ALLOWED_EMAILS` | yes | Comma-separated approved emails, e.g. `you@example.com,partner@example.com` |
| `SESSION_SECRET` | yes | A long random string — run `openssl rand -hex 32` |
| `GITHUB_TOKEN` | yes | The fine-grained token from step 2 |
| `RESEND_API_KEY` | recommended | API key from [resend.com](https://resend.com) (free tier) so codes are emailed |
| `EMAIL_FROM` | optional | e.g. `Skeptical <cms@skeptical.digital>` — requires verifying the domain in Resend; without it the Resend test sender is used |
| `GITHUB_REPO` | optional | Defaults to `suzycho/agency` |
| `GITHUB_BRANCH` | optional | Defaults to `main` |

Redeploy once after adding the variables.

**No Resend yet?** The flow still works for testing: request a code from
`/admin`, then read it from the Vercel function logs (Project → Logs, look for
`[cms] sign-in code for …`) and pass it to the partner. Set up Resend when you
want codes delivered automatically.

### 4. Try it

1. Open `https://<your-domain>/admin`.
2. Enter an approved email → enter the emailed code.
3. Change some text → **save & publish**.
4. You'll see a commit like *“Update site content via CMS (partner@…)”* on
   `main`, and the live site updates when the redeploy finishes (~1 min).

## Day-to-day

- **Approve/remove an editor:** edit `ALLOWED_EMAILS` in Vercel and redeploy.
  Removing an email also kills their existing session.
- **Review or revert an edit:** it's just a git commit touching
  `content.json` — revert it like any other commit.
- **Editing content from Claude Code:** edit `content.json` directly (keep
  the HTML fallback copy in `index.html` roughly in sync when convenient).

## Adding new editable fields later

1. Add the field to `content.json`.
2. Apply it in `js/content.js` (and add markup to `index.html` if new).
3. Add an input for it in `admin/index.html` (a `data-path="section.key"`
   attribute is enough for simple text fields) — lists follow the pattern of
   services/bios in `admin/admin.js`.
4. If it's a new top-level key, no server change is needed; the API validates
   only the core shape.

## Security notes (right-sized for a brochure site)

- The email allowlist is the gate: codes are only generated for approved
  addresses, and the response never reveals whether an address is approved.
- Codes are 6 digits, valid 10–20 minutes, with per-instance attempt
  throttling; sessions are HMAC-signed HttpOnly cookies (`SameSite=Lax`).
- The GitHub token only ever lives in a server environment variable and can
  only touch this one repo's contents.
- Everything the editor saves is rendered with `textContent` (never
  `innerHTML`), so saved content can't inject script into the site.
