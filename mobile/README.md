# MI Chits Collect — route collection app

Expo (SDK 57) app for collection on a route. It signs in with a **route's own
login** (Admin → Settings → Routes → username/password) and only ever sees
that route's members.

Built from the design prototype: Home · Customers · Records · Groups · Reports,
plus member detail, collect, receipt, day statement, cash denomination and
profile.

## Run it on your phone (development)

1. Install **Expo Go** from the Play Store / App Store.
2. On the Mac:

   ```bash
   cd admin/mobile
   npm install            # first time only
   npx expo start
   ```

3. Scan the QR code with the phone (same Wi-Fi as the Mac).

By default the app talks to the live server, **https://michits.in**.
To use the admin running on your Mac instead (`npm run dev` in `admin/`):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.34:3000 npx expo start
```

(Use your Mac's current Wi-Fi IP: `ipconfig getifaddr en0`.)

## What it does with the server

All calls go to `/api/v1/route/*` on the admin server:

| Screen | Endpoint |
|---|---|
| Login | `POST /api/v1/auth/token` (`app: "route"` — only route logins accepted) |
| Home | `GET /overview` |
| Customers, Records | `GET /members`, `GET /members/{ticketId}` |
| Collect | `POST /collections` — credits the oldest unpaid month first, writes the receipt |
| Receipt | `GET /collections/{id}` |
| Day statement | `GET /collections?date=` |
| Cash denomination | `GET` / `PUT /denomination` — **the only place counts are entered**; the admin site shows them read-only |
| Groups | `GET /groups`, `GET /groups/{id}` |
| Reports | `GET /report?period=today\|week\|month` |

Tokens are kept in the phone's secure storage; the 15-minute access token is
refreshed automatically with the 30-day refresh token.

## Printing

Receipts and the day statement print through the phone's print service, or
are shared as a PDF (e.g. WhatsApp). Bluetooth thermal printers work when
their maker's Android print plugin is installed (e.g. RawBT).

## Build an installable APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

The first run asks to create the EAS project and an `eas.json`; choose an
APK for the `preview` profile so it installs directly on phones.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

## Notes

- `.npmrc` sets `legacy-peer-deps`: Expo pins an exact React version while an
  optional peer wants a newer one, and npm otherwise refuses to add packages.
- SDK 57 matches the Expo Go app in the stores used for testing.
- `metro.config.js` keeps Metro out of the admin's `node_modules`.
