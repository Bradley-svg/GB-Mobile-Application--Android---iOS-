# Build Progress Report 0.5.0

## Highlights
- Backend: added file storage config (`FILE_STORAGE_ROOT`/`FILE_STORAGE_BASE_URL`), dev static `/files` mount, multer upload middleware, and attachment metadata columns. Work order attachments can now be uploaded/listed/deleted via `/work-orders/:id/attachments`, and a document vault is exposed via `/sites/:id/documents` and `/devices/:id/documents`.
- Mobile: Work Order Detail now shows an attachments card with upload (photo/document picker, online-only). New Documents screen lists site/device documents with cached offline banner; entry points added on Site and Device screens.
- Health-plus now reports storage root/writable state alongside existing signals.

## Tests
- Backend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (all under `backend/` with TEST_DATABASE_URL configured).
- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (under `mobile/`). Snapshots updated where required.

## Known Limitations
- Storage is local-only in dev; no CDN or signed URLs yet.
- Uploads require connectivity; offline shows read-only states without retries.
- No annotation/editing on attachments or documents; no lifecycle policies/virus scanning.
