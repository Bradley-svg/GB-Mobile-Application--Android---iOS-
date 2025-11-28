# Greenbro Mobile

## Environment variables
- Copy `.env.example` to `.env` for local development.
- `EXPO_PUBLIC_API_URL` is used by the app to talk to the backend.
- Different builds (staging/prod) will use different `EXPO_PUBLIC_API_URL` values via EAS.

## API URL tips
- Android emulator: `http://10.0.2.2:4000`
- iOS simulator: `http://127.0.0.1:4000`
- Physical device: `http://<your-LAN-IP>:4000`
- Staging/production EAS profiles override `EXPO_PUBLIC_API_URL` via `eas.json`; set the right value per profile.

## Builds and profiles
- Development client: `npm run start` to use Expo Go locally, or `eas build --profile development --platform android|ios` for a dev client that points at your local backend URL. `EXPO_PUBLIC_API_URL` is read in `app.config.ts` and exposed as `extra.apiUrl`.
- Staging build: `eas build --profile staging --platform android|ios` bakes `EXPO_PUBLIC_API_URL=https://staging.api.greenbro.co.za` so the app talks to the staging backend.
- Production build: `eas build --profile production --platform android|ios` bakes `EXPO_PUBLIC_API_URL=https://api.greenbro.co.za` for the production backend.
