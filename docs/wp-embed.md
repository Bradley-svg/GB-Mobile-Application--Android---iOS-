# WordPress embed for the Greenbro dashboard

## Iframe snippet
- Use the dedicated embed alias to force the slim shell:  
  ```html
  <iframe src="https://app.greenbro.co.za/embed" width="100%" height="900" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  ```
- Keep the iframe on its own block (no nested containers that add scrollbars) and prefer a full-width / blank page template so the dashboard can use the full viewport.
- Increase `height` to 1000–1200px on long pages to avoid double scrollbars; WordPress “full width / no sidebar” templates work best.

## UX + login flow in embed mode
- `/embed` immediately redirects to `/app?embed=true` and the shell hides the sidebar/top bar. An “Open in full window” link opens `https://app.greenbro.co.za/app` in a new tab with the full chrome.
- `/login` and `/login/2fa` preserve `embed=true` so users stay inside the iframe after authenticating. Tokens stay in `app.greenbro.co.za` storage, not the WordPress origin.
- Keep org switching and device drill-down inside the iframe; the slim header leaves room for the content in tighter viewports.

## Security and headers
- Web build sends `Content-Security-Policy: frame-ancestors 'self' https://www.greenbro.co.za https://greenbro.co.za;` (or the list in `FRAME_ANCESTORS`) and `X-Frame-Options: ALLOW-FROM https://www.greenbro.co.za` when `NEXT_PUBLIC_EMBEDDED=true`. With embeds off, the headers fall back to self-only (`SAMEORIGIN`).
- Backend CORS (`WEB_ALLOWED_ORIGINS`) must continue to include `https://app.greenbro.co.za` and `https://www.greenbro.co.za`; cookies/localStorage stay on the app origin even when framed.

## What to test on the WordPress page
- Load the iframe and confirm the login form is visible without excess top padding.
- Login with a test account, verify the fleet overview renders without the sidebar, and confirm org switching + device drill-down work inside the frame.
- Click “Open in full window” to confirm it opens the full app in a new tab.
