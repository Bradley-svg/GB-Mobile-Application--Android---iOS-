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
- Status: Pass (1 test, 20s)
- /auth/me: intercepted and returned 401 as expected

Manual auth proof (unauthenticated):
- Dev server: `npm run dev` -> Next.js 16.0.8 ready on http://localhost:3000
- Request: GET http://localhost:3000/app (curl -I -> 200 OK)
- Final URL: http://localhost:3000/login?returnTo=%2Fapp
- /auth/me: requested and returned 401 from backend
- Page state: Redirected to login; no overlay/errors observed

Embed route sanity (unauthenticated):
- GET http://localhost:3000/embed -> 307 to /app?embed=true
- Final URL after load: http://localhost:3000/login?returnTo=%2Fapp%3Fembed%3Dtrue
- Behavior: /auth/me 401 observed; redirected to login with embed returnTo preserved; no overlay/errors

## Passed
- npm run lint (web)
- npm run typecheck (web)
- npm test (web)
- npx playwright test auth-redirect.spec.ts
- Manual /app unauthenticated redirect (401 -> /login)
- Manual /embed unauthenticated redirect (401 -> /login with returnTo=/app?embed=true)

## Failed
- None observed after fixes

## Fixes
- Dev-only CSP relaxation applied: web/next.config.mjs now adds `'unsafe-inline'` to script-src when NODE_ENV is not production, allowing Next dev bootstrap scripts (prod CSP unchanged).
- useOrgSwitcher stabilized: selects primitives/arrays without creating new objects and uses shallow equality to avoid React 19 getServerSnapshot churn.
- Backend running and reachable at http://localhost:4000.

## Next Steps
- If backend goes down locally, expect redirect to `/login?returnTo=%2Fapp&reason=api_unreachable`; otherwise current flow is green.
- Keep dev CSP change dev-only; no action needed for prod.
