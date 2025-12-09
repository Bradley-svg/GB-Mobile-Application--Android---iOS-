# Greenbro Mobile

## Environment variables
- Copy `.env.example` to `.env` for local development.
- `EXPO_PUBLIC_API_URL` is used by the app to talk to the backend.
- Different builds (staging/prod) will use different `EXPO_PUBLIC_API_URL` values via EAS.

## Local development (Android emulator)
- Start Metro/dev client on `localhost:8082` with cache clear: `npm run start:devclient` (or `npx expo start --dev-client --localhost -c --port 8082`).
- Point the emulator at your host: `adb reverse tcp:8082 tcp:8082` and `adb reverse tcp:4000 tcp:4000` (the root `dev.sh` / `dev.ps1` scripts try to run these automatically).

## API URL tips
- Android emulator: `http://10.0.2.2:4000`
- iOS simulator: `http://127.0.0.1:4000`
- Physical device: `http://<your-LAN-IP>:4000`
- Staging/production EAS profiles override `EXPO_PUBLIC_API_URL` via `eas.json`; set the right value per profile.

## Builds and profiles
- Development client: `npm run start:devclient` for the Android dev client on `localhost:8082` (Expo Go can still use `npm run start`), or `eas build --profile development --platform android|ios` for a dev client that points at your local backend URL. `EXPO_PUBLIC_API_URL` is read in `app.config.ts` and exposed as `extra.apiUrl`.
- Staging build: `eas build --profile staging --platform android|ios` bakes `EXPO_PUBLIC_API_URL=https://staging.api.greenbro.co.za` so the app talks to the staging backend.
- Production build: `eas build --profile production --platform android|ios` bakes `EXPO_PUBLIC_API_URL=https://api.greenbro.co.za` for the production backend.

## Android E2E (Detox)
- Start Metro in its own terminal on the Detox port: `cd mobile && npx expo start --dev-client --localhost --port 8081 --clear --non-interactive`.
- Run the tests from another terminal: `cd mobile && npm run e2e:test:android` (uses a 180s Jest timeout and warns-only Detox logs).
- Detox auto-reverses `8081` for the emulator via `reversePorts` in `detox.config.js`; no manual `adb reverse` needed.
- Clean up after runs: stop Metro and kill the emulator when you’re done, e.g. `adb -s emulator-5554 emu kill`.
- CI E2E workflow boots Postgres, runs backend migrations + `seed:e2e`, starts the API (waits on `/health-plus`), disables vendor heat-pump history via `HEATPUMP_HISTORY_DISABLED=true`, then runs Metro/Detox. Local runs should mirror this: ensure backend is up/seeded before `npm run e2e:test:android`.
