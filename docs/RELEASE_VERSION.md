# Release version

- Current release candidate: `0.8.0`
- Synced across:
  - `package.json`
  - `backend/package.json` and `APP_VERSION` (surfaced on `/health-plus`)
  - `backend/src/config/version.ts` fallback version
  - Mobile config (`mobile/app.config.ts`, `mobile/app.json`, Android `versionCode`/`versionName`)
- Tag suggestion: `v0.8.0` (see `scripts/create-release-tag.js`).

Update this file when bumping the release to keep humans aligned with the codebase metadata.

- 2025-12-11 08:25 local: `npm run release:check` ran (lint/type/tests all green; Detox e2e:android timed out on emulator startup). Ready for v0.8.0 tag and GitHub Release using `docs/release-notes/0.8.0.github.md`.
