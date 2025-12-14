# Web dashboard deploy (app.greenbro.co.za)

## Option 2 - Vercel Preview URL (Best Overall)
- Push any branch (e.g. `web-preview`) or open a PR touching `web/**` to trigger `.github/workflows/web-deploy.yml`; it builds/tests against the staging API and deploys a Vercel Preview even if Git integration is off.
- Preview URL surfaces in the workflow summary under "Vercel deployment" and in Vercel > Deployments (named by branch). Run `npm run web:print-preview-help` for a quick reminder.
- URLs: full app `https://<preview>.vercel.app/app`, embed shell `https://<preview>.vercel.app/embed`.
- Required preview env (in the Vercel project): `NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`, `FRAME_ANCESTORS=https://www.greenbro.co.za,https://greenbro.co.za` (add the staging WP host if framing from a different domain).
- Use this for client demos, stakeholder review, and QA signoff so you get HTTPS + real staging behavior without local setup. Main still deploys staging; tags `v*` ship production with `--prod`.
- If Vercel Git Integration is enabled, you will get native preview links as well; the workflow path stays authoritative so tests/envs stay aligned even without the integration.
- Troubleshooting: `401/403` -> staging CORS/WEB_ALLOWED_ORIGINS/JWT; white screen -> missing `NEXT_PUBLIC_API_URL`; embed blocked -> CSP frame-ancestors mismatch; app loads but no data -> staging demo seed/migrations missing; QA embeds still failing -> align backend WEB_ALLOWED_ORIGINS with the WordPress host.

## Hosting + pipeline
- Hosting: Vercel (branch-based previews + `main` staging preview, production = `--prod` deploy on tags `v*`).
- CI/CD: `.github/workflows/web-deploy.yml` runs `npm ci --prefix web`, `npm run web:test:coverage`, `cd web && next build`, then `vercel build` + `vercel deploy --prebuilt` (preview for branches/main, `--prod` for `v*` tags). Concurrency is keyed per ref so stale deploys cancel per branch.
- Secrets required (repo/org level): `VERCEL_TOKEN` (deploy token), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PROD`, optional `VERCEL_PROJECT_ID_PREVIEW` if you want a dedicated preview project.
- Sanity build (staging API + embedded mode): `npm run web:build:prod`.

### Vercel envs (Option A - recommended)
- Preview/Development: `NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`, `FRAME_ANCESTORS=https://www.greenbro.co.za,https://greenbro.co.za` (plus the staging WP host if different).
- Production: `NEXT_PUBLIC_API_URL=https://api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`, `FRAME_ANCESTORS=https://www.greenbro.co.za,https://greenbro.co.za`.
- `vercel pull --environment=<preview|production>` in CI reads these so embed headers stay aligned (`frame-ancestors` + `X-Frame-Options`). Keep secrets out of the repo.
- Backend must allow the same hosts via `WEB_ALLOWED_ORIGINS` so API calls succeed when framed.

### CI/CLI path (Option B - fallback)
- Workflow injects preview/staging envs for tests and builds and deploys via Vercel CLI using `VERCEL_TOKEN` + `VERCEL_PROJECT_ID_*`. `VERCEL_PROJECT_ID_PREVIEW` falls back to `VERCEL_PROJECT_ID_STAGING` when unset.
- Preview deploys never add `--prod`; tags `v*` set `--prod` for production.

## Environment matrix (enforced in `next.config.mjs`)
- Local dev: `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_EMBEDDED=false`.
- Staging: `NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`, `NEXT_PUBLIC_AUTH_2FA_ENABLED=true`, `NEXT_PUBLIC_AUTH_2FA_ENFORCE_ROLES=owner,admin`, `NEXT_PUBLIC_SESSION_IDLE_MINUTES=30`, `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS=8`; set `FRAME_ANCESTORS` to include the staging web host and the WordPress staging domain.
- Production: `NEXT_PUBLIC_API_URL=https://api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`.
- Backend CORS: keep `WEB_ALLOWED_ORIGINS` aligned (local `http://localhost:3000`, staging host, production `https://app.greenbro.co.za,https://www.greenbro.co.za`).
- Framing headers (new): with `NEXT_PUBLIC_EMBEDDED=true`, Next.js emits `Content-Security-Policy: frame-ancestors 'self' https://www.greenbro.co.za https://greenbro.co.za;` plus `X-Frame-Options: ALLOW-FROM https://www.greenbro.co.za`. Override the allowlist with `FRAME_ANCESTORS` (comma-separated) for staging if the marketing site lives elsewhere; when embeds are off the headers fall back to `SAMEORIGIN`.
- Session/auth knobs: `NEXT_PUBLIC_SESSION_IDLE_MINUTES` (default 30) and `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS` (default 8) control idle/absolute timeouts; `NEXT_PUBLIC_AUTH_STORAGE_MODE=local-storage|cookie` reserves room for a future httpOnly-cookie mode; `NEXT_PUBLIC_AUTH_2FA_ENABLED` should mirror backend `AUTH_2FA_ENABLED`.

## Security headers and CSP
- Frame ancestors: default allow list is `'self' https://www.greenbro.co.za https://greenbro.co.za` (plus localhost in dev). Set `FRAME_ANCESTORS`/`NEXT_FRAME_ANCESTORS` to a comma-separated list in staging when testing embeds from other hosts. When `NEXT_PUBLIC_EMBEDDED=false`, `frame-ancestors` collapses to `'self'` and `X-Frame-Options` is `SAMEORIGIN`.
- Content Security Policy: `default-src 'self'; script-src 'self' ('unsafe-eval' in dev); style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' <API origin> (plus localhost/ws in dev); frame-ancestors ...; object-src 'none'; base-uri 'self'; form-action 'self'; X-Frame-Options mirrors the frame-ancestors allow list.
- Extending CSP: when adding new vendors (analytics, fonts, embeds), update the source lists in `next.config.mjs` and note the change in this doc; staging overrides should stay narrow. Keep API origin in `connect-src` and ensure any new frame hosts are also added to backend `WEB_ALLOWED_ORIGINS`.

## Deploy flow
- Preview: push any branch or open a PR touching `web/**` to get a Preview deployment URL in the workflow summary.
- Staging: push to `main` to build/test with the staging API + embeds enabled and deploy a Preview to the staging/preview Vercel project (or a dedicated preview project if configured).
- Production: create a tag `vX.Y.Z` to build/test with the production API + embeds enabled, then deploy to the production Vercel project using `--prod`.
- Manual retry: rerun the `Web Deploy` workflow with the same ref; no secrets are baked into the repo.

## DNS + HTTPS
- Point `app.greenbro.co.za` to Vercel: CNAME to `cname.vercel-dns.com` (or A record `76.76.21.21` if the DNS host requires apex/ALIAS flattening).
- If a `www` alias is used for embedding, CNAME `www.greenbro.co.za` to `cname.vercel-dns.com` as well.
- TLS: Vercel issues managed certificates automatically once the domain is verified; enforce HTTPS redirect via the Vercel dashboard (on by default for custom domains).
- Embed docs/snippet: see `docs/wp-embed.md` for the WordPress iframe markup (`https://app.greenbro.co.za/embed`) and template guidance; ensure the marketing host is present in both `FRAME_ANCESTORS` and backend `WEB_ALLOWED_ORIGINS`.

## Post-deploy smoke
- Hit `https://app.greenbro.co.za/app` and confirm it renders and calls the correct API origin (Network tab shows `api.greenbro.co.za` or `staging.api.greenbro.co.za`).
- Check `https://app.greenbro.co.za/app/diagnostics` for authenticated health UX.
- Playwright smoke: `WEB_E2E_BASE_URL=https://app.greenbro.co.za WEB_E2E_EMAIL=<user> WEB_E2E_PASSWORD=<pass> npm run web:e2e` (or point at the staging hostname before production tags). Review the HTML report in `web/playwright-report`.
- Embed check: load the dashboard iframe from WordPress with `NEXT_PUBLIC_EMBEDDED=true` set (staging/prod envs) and verify login + navigation inside the iframe.
