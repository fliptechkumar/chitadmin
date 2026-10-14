# Mobile API v1

Base URL: `https://<host>/api/v1`

Built for the field-collection app: sign in, look up a customer, record a
payment, print the receipt. The browser admin keeps using the unversioned
`/api/*` routes with cookie auth; those are internal and not a contract.

## Conventions

Every response uses one of two shapes.

```jsonc
// success
{ "data": { ... }, "meta": { ... } }   // meta only on paginated endpoints

// failure
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": { "amount": "…" } } }
```

| code | HTTP | what the app should do |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Send the user to the sign-in screen |
| `TOKEN_EXPIRED` | 401 | Refresh, then retry the request once |
| `FORBIDDEN` | 403 | Show the message; do not retry |
| `NOT_FOUND` | 404 | Show the message |
| `CONFLICT` | 409 | Show the message |
| `VALIDATION_FAILED` | 422 | Map `fields` onto the form |
| `RATE_LIMITED` | 429 | Wait for `Retry-After` seconds |
| `INTERNAL` | 500 | Generic retry |

`TOKEN_EXPIRED` is deliberately distinct from `UNAUTHENTICATED`: it is the only
signal that a silent refresh will work.

### Pagination

List endpoints take `?page` (default 1) and `?limit` (default 25, max 100).

```jsonc
"meta": { "page": 1, "limit": 25, "total": 84, "totalPages": 4, "hasMore": true }
```

## Authentication

Access tokens live 15 minutes; refresh tokens live 30 days and **rotate on
every use**. Store the refresh token in the device keychain, never in plain
preferences. If a refresh fails, the session is gone — sign in again.

Both token types resolve to the same `Session` row as the web cookie, so an
admin disabling an account cuts off the phone immediately, even mid-token.

### POST /auth/token

```jsonc
// request
{ "username": "chitadmin", "password": "…" }

// response
{ "data": {
  "accessToken": "eyJ…", "refreshToken": "9f3…",
  "tokenType": "Bearer", "expiresIn": 900, "refreshExpiresIn": 2592000,
  "user": { "id": 2, "username": "chitadmin", "name": "Branch Manager",
            "email": "…", "role": "CHIT_ADMIN", "branches": ["KovilPatti"] }
} }
```

Throttled at 8 failed attempts per IP + username per 15 minutes.

### POST /auth/refresh

`{ "refreshToken": "…" }` → a new pair. **The old refresh token stops working**,
so persist the new one before the next request.

### POST /auth/logout

`{ "refreshToken": "…" }` → `{ "data": { "revoked": true } }`. Deletes the
session; any outstanding access token dies with it. Signing out twice is not an
error.

### GET /me

Confirms a stored token still works and returns current role and branches.
Available to every role.

## Authorisation

Send `Authorization: Bearer <accessToken>` on everything except the auth routes.

Collection endpoints require `SUPER_ADMIN` or `CHIT_ADMIN`. A `CHIT_ADMIN` sees
and writes only their assigned branches — that scoping *is* the field-agent
model today. `USER` reaches `/me` and nothing else.

Collections carry a group name rather than a branch, so scope is resolved
through `ChitGroup.branchName`.

## Endpoints

### GET /customers

Lookup for the collection screen. Active customers in the caller's branches.

Query: `?q` (name or phone), `?page`, `?limit`

```jsonc
{ "data": [ { "id": 8, "name": "Kavitha Rajan", "phone": "9234567812",
              "groups": ["MDRA10", "MIKEE18"], "pendingDue": 12000, "totalPaid": 48000 } ],
  "meta": { … } }
```

### GET /collections

Query: `?q` (receipt no or customer name), `?status` (`paid`/`pending`/`overdue`),
`?customerId`, `?group`, `?page`, `?limit`. Newest first.

### POST /collections

```jsonc
// request — penalty defaults to 0, status to "paid"
{ "customerId": 8, "group": "MIKEE18", "installment": 4,
  "amount": 5000, "mode": "cash", "penalty": 250 }

// 201 — collection plus a ready-to-print receipt, no second round trip
{ "data": { "collection": { "id": 11, "receiptNo": "RCP-2026-0011", … },
            "receipt": { … } } }
```

`mode` is `cash` | `online` | `cheque`. A `paid` collection increments the
customer's `totalPaid` and reduces `pendingDue` in the same transaction;
`pending` and `overdue` records leave the ledger untouched.

Receipt numbers are `RCP-<year>-<zero-padded id>`, assigned inside the
transaction so two agents collecting simultaneously cannot collide.

### GET /collections/{id}/receipt

Reprints an earlier receipt. Same payload as the `receipt` field above, so the
app needs one rendering path.

```jsonc
{ "data": {
  "receiptNo": "RCP-2026-0011", "date": "15/08/2026",
  "company": { "name": "…", "shortName": "…", "regNo": "…", "gst": "…",
                "phone": "…", "address": "…", "logo": "data:image/png;base64,…" },
  "branch": "KovilPatti",
  "customer": { "id": 8, "name": "Kavitha Rajan", "phone": "9234567812" },
  "group": "MIKEE18", "installment": 4,
  "amount": 5000, "penalty": 250, "total": 5250,
  "mode": "cash", "status": "paid", "collectedBy": "Branch Manager"
} }
```

Amounts are whole rupees; the app formats for its own locale. The `company`
block comes from Settings → Company, so changing the name or logo there
changes what prints — no app release needed. `logo` is a data URI, or `""`.

## Not built yet

- **Offline queueing.** No idempotency key on `POST /collections`, so a retry
  after a flaky response creates a second receipt. Add one before shipping
  offline capture.
- **Device-level revocation UI.** Sessions record `userAgent`, `ip` and
  `lastUsedAt`, but nothing surfaces or revokes them per device.
- **A dedicated collector role.** Field agents currently need a `CHIT_ADMIN`
  account scoped to their branch, which also grants web admin access. A
  `COLLECTOR` role, and a link between `Employee` and `User`, is the natural fix.
