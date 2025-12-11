# Web dashboard deploy (app.greenbro.co.za)

## Hosting + pipeline
- Hosting: Vercel (staging = preview deploy on `main`, production = `--prod` deploy on tags `v*`).
- CI/CD: `.github/workflows/web-deploy.yml` runs `npm ci --prefix web`, `npm run web:test`, `npm run web:test:coverage`, `cd web && next build`, then `vercel build` + `vercel deploy --prebuilt`.
- Secrets required (repo/org level): `VERCEL_TOKEN` (deploy token), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PROD`.
- Sanity build (staging API + embedded mode): `npm run web:build:prod`.

## Environment matrix (enforced in `next.config.mjs`)
- Local dev: `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_EMBEDDED=false`.
- Staging: `NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`.
- Production: `NEXT_PUBLIC_API_URL=https://api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`.
- Backend CORS: keep `WEB_ALLOWED_ORIGINS` aligned (local `http://localhost:3000`, staging host, production `https://app.greenbro.co.za,https://www.greenbro.co.za`).
- Framing headers (new): with `NEXT_PUBLIC_EMBEDDED=true`, Next.js emits `Content-Security-Policy: frame-ancestors 'self' https://www.greenbro.co.za https://greenbro.co.za;` plus `X-Frame-Options: ALLOW-FROM https://www.greenbro.co.za`. Override the allowlist with `FRAME_ANCESTORS` (comma-separated) for staging if the marketing site lives elsewhere; when embeds are off the headers fall back to `SAMEORIGIN`.
- Session/auth knobs: `NEXT_PUBLIC_SESSION_IDLE_MINUTES` (default 30) and `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS` (default 8) control idle/absolute timeouts; `NEXT_PUBLIC_AUTH_STORAGE_MODE=local-storage|cookie` reserves room for a future httpOnly-cookie mode; `NEXT_PUBLIC_AUTH_2FA_ENABLED` should mirror backend `AUTH_2FA_ENABLED`.

## Security headers and CSP
- Frame ancestors: default allow list is `'self' https://www.greenbro.co.za https://greenbro.co.za` (plus localhost in dev). Set `FRAME_ANCESTORS`/`NEXT_FRAME_ANCESTORS` to a comma-separated list in staging when testing embeds from other hosts. When `NEXT_PUBLIC_EMBEDDED=false`, `frame-ancestors` collapses to `'self'` and `X-Frame-Options` is `SAMEORIGIN`.
- Content Security Policy: `default-src 'self'; script-src 'self' ('unsafe-eval' in dev); style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' <API origin> (plus localhost/ws in dev); frame-ancestors ...; object-src 'none'; base-uri 'self'; form-action 'self'; X-Frame-Options mirrors the frame-ancestors allow list.
- Extending CSP: when adding new vendors (analytics, fonts, embeds), update the source lists in `next.config.mjs` and note the change in this doc; staging overrides should stay narrow. Keep API origin in `connect-src` and ensure any new frame hosts are also added to backend `WEB_ALLOWED_ORIGINS`.

## Deploy flow
- Staging: push to `main` → workflow builds/tests with staging API + embeds enabled, deploys to the staging Vercel project.
- Production: create a tag `vX.Y.Z` → workflow builds/tests with production API + embeds enabled, deploys to the production Vercel project using `--prod`.
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
