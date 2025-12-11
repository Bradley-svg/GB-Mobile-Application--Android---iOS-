# Release version

- Current release candidate: `0.7.0`
- Synced across:
  - `package.json`
  - `backend/package.json` and `APP_VERSION` (surfaced on `/health-plus`)
  - `backend/src/config/version.ts` fallback version
  - Mobile config (`mobile/app.config.ts`, `mobile/app.json`, Android `versionCode`/`versionName`)
- Tag suggestion: `v0.7.0` (see `scripts/create-release-tag.js`).

Update this file when bumping the release to keep humans aligned with the codebase metadata.
