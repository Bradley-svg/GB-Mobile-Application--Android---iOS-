# Local Web Auth Proof

Environment snapshot:
- Node v22.20.0, npm 11.6.2
- web/.env.local -> NEXT_PUBLIC_API_URL=http://localhost:4000, NEXT_PUBLIC_EMBEDDED=false
- Backend health: `curl -I http://localhost:4000/health-plus` -> connection refused (curl exit 7)

Step 1 command results:

| Command | Status | Notes |
| --- | --- | --- |
| npm run lint | ✅ | Completed in web/ (eslint --max-warnings=0) |
| npm run typecheck | ✅ | Completed in web/ (tsc --noEmit) |
| npm test | ✅ | Completed in web/ (vitest; 15 files, 35 tests) |

Playwright auth redirect e2e:
- Command: `npx playwright test auth-redirect.spec.ts --timeout=60000`
- Status: ❌ timeout waiting for `/login`; `page.waitForURL("**/login**")` exceeded 60s
- /auth/me calls: none observed (route handler never triggered)
- Trace artifacts: web/test-results/auth-redirect-unauthentica-65e93-h-me-and-redirects-to-login/trace.zip (retry trace also available)

Manual auth proof (unauthenticated):
- Dev server: `npm run dev` -> Next.js 16.0.8 ready on http://localhost:3000 (see web/devserver.log)
- Request: GET http://localhost:3000/app (curl -I -> 200 OK)
- Final URL: http://localhost:3000/app (no redirect)
- /auth/me presence: none (no network request fired)
- Page state: stuck on "Loading your workspace..."; console shows CSP blocks for inline scripts and page error `Invariant: Expected a request ID to be defined for the document via self.__next_r`
- Expected returnTo/reason params: not present (no navigation to /login)

Embed route sanity (unauthenticated):
- GET http://localhost:3000/embed -> 307 to /app?embed=true (curl -I)
- Final URL after load: http://localhost:3000/app?embed=true
- Behavior: identical to /app (no /auth/me call, loading screen only, CSP inline script blocks), embed chrome not verifiable because auth guard never runs

## ✅Passed
- npm run lint (web)
- npm run typecheck (web)
- npm test (web)

## ❌Failed
- Backend unreachable at http://localhost:4000/health-plus (connection refused)
- Playwright auth redirect spec: timed out waiting for /login, /auth/me never called (trace in web/test-results/.../trace.zip)
- Manual /app check: remained on /app with loading screen; no /auth/me; CSP blocked inline scripts and threw `self.__next_r` invariant
- Manual /embed check: redirected to /app?embed=true then stalled with same CSP/hydration failure; no login shown

## 🔧Fixes
- Relax dev CSP so Next.js inline bootstrap scripts can run (e.g., in web/next.config.mjs add a dev-only allowance such as `'unsafe-inline'` or include the Next-provided nonce/strict-dynamic token in script-src). Current script-src is `'self' 'unsafe-eval'`, which blocks inline scripts and prevents hydration, so auth guard never executes.
- Start or stub the backend at http://localhost:4000; once CSP is fixed, a down backend should drive `/login?returnTo=%2Fapp&reason=api_unreachable` after /auth/me fails.

## 📌Next Steps
- Apply the dev CSP tweak above and restart `npm run dev`, then rerun `npx playwright test auth-redirect.spec.ts`.
- Re-test unauthenticated /app and /embed (incognito/headless) verifying: /auth/me 401 occurs, redirect lands on /login with returnTo preserved and embed param retained.
- If backend stays offline, confirm /login carries `reason=api_unreachable`; once backend is up, repeat to ensure normal 401 -> login redirect flow.
