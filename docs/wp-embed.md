# WordPress embed for the Greenbro dashboard

## Iframe snippet
- Use the dedicated embed alias to force the slim shell:
  ```html
  <iframe src="https://app.greenbro.co.za/embed" width="100%" height="900" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  ```
- Keep the iframe on its own block (no nested containers that add scrollbars) and prefer a full-width template so the dashboard can use the full viewport.
- Increase height to ~1000-1200px on longer pages to avoid double scrollbars; WordPress full-width/no-sidebar templates work best.

## UX and login flow
- `/embed` redirects to `/app?embed=true` and hides the sidebar/top bar; "Open in full window" links to `/app`.
- `/login` and `/login/2fa` preserve `embed=true` so users stay in the frame after authenticating; tokens stay scoped to `app.greenbro.co.za`.
- Org switching and device drill-down stay inside the iframe; the slim header leaves more room for content.

## Preview deploys
- Branch previews land at `https://<preview>.vercel.app/embed` (staging API, embed mode on). Full app lives at `https://<preview>.vercel.app/app`.
- `FRAME_ANCESTORS` defaults to `https://www.greenbro.co.za,https://greenbro.co.za`; add the staging WordPress host in the Vercel env if framing from another domain.
- Backend must allow the preview origin in `WEB_ALLOWED_ORIGINS` while testing embeds.
- Grab the preview URL from the Web Deploy workflow summary ("Vercel deployment") or Vercel > Deployments.

## Security and headers
- With `NEXT_PUBLIC_EMBEDDED=true`, the web build sends `Content-Security-Policy: frame-ancestors 'self' https://www.greenbro.co.za https://greenbro.co.za;` (or the list in `FRAME_ANCESTORS`) and `X-Frame-Options: ALLOW-FROM <primary allowed host>`. With embeds off, headers fall back to self-only (`SAMEORIGIN`).
- Backend CORS (`WEB_ALLOWED_ORIGINS`) must include the app host and any marketing/WordPress host that will frame it; cookies/localStorage stay on the app origin even when framed.

## What to test on the WordPress page
- Load the iframe and confirm the login form is visible without excess top padding.
- Log in with a test account, verify the fleet overview renders without the sidebar, and confirm org switching/device drill-down work inside the frame.
- Click "Open in full window" to confirm it opens the full app in a new tab.
