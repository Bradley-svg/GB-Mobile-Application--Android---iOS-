# Local Web Auth Proof

Environment snapshot:
- Node v22.20.0, npm 11.6.2
- web/.env.local -> NEXT_PUBLIC_API_URL=http://localhost:4000, NEXT_PUBLIC_EMBEDDED=false
- Backend health: `curl -I http://localhost:4000/health-plus` -> 200 OK

Step 1 command results:

| Command | Status | Notes |
| --- | --- | --- |
| npm run lint | Pass | Completed in web/ (eslint --max-warnings=0) |
| npm run typecheck | Pass | Completed in web/ (tsc --noEmit) |
| npm test | Pass | Completed in web/ (vitest; 15 files, 35 tests) |

Playwright auth redirect e2e:
- Command: `npx playwright test auth-redirect.spec.ts`
- Status: Fail (timeout) because client error overlay appears: "The result of getServerSnapshot should be cached to avoid an infinite loop" followed by "Maximum update depth exceeded"
- /auth/me: requested once, 401 from backend
- Trace: web/test-results/auth-redirect-unauthentica-65e93-h-me-and-redirects-to-login/trace.zip

Manual auth proof (unauthenticated):
- Dev server: `npm run dev` -> Next.js 16.0.8 ready on http://localhost:3000
- Request: GET http://localhost:3000/app (curl -I -> 200 OK)
- Final URL: http://localhost:3000/app (no redirect)
- /auth/me: requested and returned 401 from backend
- Page state: client error overlay with "The result of getServerSnapshot should be cached to avoid an infinite loop" and "Maximum update depth exceeded" (stack points at lib/useOrgSwitcher.ts), so router.replace to /login never completes

Embed route sanity (unauthenticated):
- GET http://localhost:3000/embed -> 307 to /app?embed=true
- Final URL after load: http://localhost:3000/app?embed=true
- Behavior: /auth/me 401 observed, but same client error overlay prevents redirect/login view; embed chrome not verified

## Passed
- npm run lint (web)
- npm run typecheck (web)
- npm test (web)

## Failed
- Playwright auth redirect spec: timed out waiting for /login because of client runtime error; /auth/me 401 did fire
- Manual /app check: stayed on /app with error overlay; /auth/me 401 fired; no login redirect
- Manual /embed check: redirected to /app?embed=true then hit the same error overlay; no login view

## Fixes
- Dev-only CSP relaxation applied: web/next.config.mjs now adds `'unsafe-inline'` to script-src when NODE_ENV is not production, allowing Next dev bootstrap scripts.
- Backend is running and reachable at http://localhost:4000.
- Remaining blocker: client runtime loop in lib/useOrgSwitcher.ts triggers the getServerSnapshot/infinite loop error, preventing the auth guard redirect despite /auth/me returning 401.

## Next Steps
- Investigate lib/useOrgSwitcher.ts (and the associated zustand store) to eliminate the getServerSnapshot/infinite loop error in dev; once fixed, rerun `npx playwright test auth-redirect.spec.ts`.
- Re-test unauthenticated /app and /embed (incognito/headless) verifying: /auth/me 401 occurs, redirect lands on /login with returnTo preserved and embed param retained.
- If the backend becomes unreachable, expect redirect to include `reason=api_unreachable`.
