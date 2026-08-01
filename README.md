# MessMate Backend

Production backend for MessMate — Express + PostgreSQL, built to work directly
with the existing `register.html` / `register.css` / `register.js` frontend
with **zero frontend changes**.

---

## 1. Folder structure

```
backend/
  server.js                 Express app entry point
  package.json
  .env.example
  .gitignore
  README.md

  config/
    database.js              PostgreSQL pool
    mail.js                  Nodemailer transporter (Gmail SMTP)

  routes/
    auth.routes.js            /api/auth/*
    user.routes.js            /api/user/*
    mess.routes.js            /api/mess/*

  controllers/
    auth.controller.js
    user.controller.js
    mess.controller.js

  middleware/
    auth.js                   authenticateJWT, authorizeUser/MessOwner/Admin
    upload.js                 Multer config, file-type/size/count enforcement
    validation.js              express-validator chains
    errorHandler.js           centralized error → JSON response mapping

  services/
    otp.service.js            OTP generate/hash/store/verify/rate-limit
    jwt.service.js             sign/verify access tokens
    mail.service.js           OTP email template + send

  utils/
    password.js                bcrypt hash/compare
    response.js                 successResponse / errorResponse helpers

  scripts/
    migrate.js                 applies database/schema.sql

  database/
    schema.sql
    seed.sql                   optional dev sample data

  uploads/
    users/  owners/  mess/  kitchen/  dining/
```

---

## 2. Local setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in real values
npm run migrate           # creates all tables in DATABASE_URL
npm run dev                # nodemon, http://localhost:5000
```

Health check: `GET /health` → `{ "success": true, "message": "MessMate API is running." }`

### Gmail SMTP setup
`EMAIL_USER` / `EMAIL_PASS` need a Gmail **App Password**, not your normal
login password: Google Account → Security → 2-Step Verification → App
Passwords → generate a 16-character password for "Mail".

---

## 3. Database

Run `database/schema.sql` (via `npm run migrate`, or `psql $DATABASE_URL -f database/schema.sql`).

| Table               | Purpose                                                        |
|---------------------|------------------------------------------------------------------|
| `users`              | Student/mess-user accounts                                       |
| `messes`             | Mess-owner accounts + their mess listing (1:1 by design)          |
| `mess_photos`        | Multiple gallery photos per mess (`messPhotos[]` upload)          |
| `weekly_menu`        | One row per (mess, day) — matches `menu-<day>-<meal>` form fields |
| `otp_verifications`  | OTP hashes + expiry + attempt count (never plaintext OTP)          |
| `refresh_tokens`     | Optional — ready if you add refresh-token rotation later          |
| `admins`             | Minimal table backing `authorizeAdmin` middleware                 |

`database/seed.sql` has optional sample rows for local testing — never run it
against production.

---

## 4. API Reference

All responses are JSON: `{ "success": boolean, "message": string, "data"?/"errors"? }`.

### `POST /api/auth/send-otp`
```json
// Request
{ "email": "user@example.com" }
// 200
{ "success": true, "message": "OTP sent to your email." }
// 429 — over 5 requests/hour for this email
{ "success": false, "message": "Too many OTP requests. Please wait a while and try again." }
```

### `POST /api/auth/verify-otp`
```json
// Request
{ "email": "user@example.com", "otp": "123456" }
// 200
{ "success": true, "message": "Email verified successfully." }
// 401 — wrong/expired code
{ "success": false, "message": "That OTP is invalid or has expired. Please try again." }
```
A verified OTP is valid for **30 minutes** — the registration endpoints
consume it and will reject registration without a recent verification.

### `POST /api/auth/login`
```json
// Request
{ "email": "user@example.com", "password": "..." }
// 200
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "eyJ...",
    "userId": "uuid",
    "role": "user" | "mess" | "admin",
    "profile": { "...": "role-specific fields" }
  }
}
```
Also sets an httpOnly `accessToken` cookie — the frontend can use either the
cookie or the `Authorization: Bearer <token>` header for subsequent requests.

### `POST /api/auth/logout`
Clears the auth cookie. `200 { success: true, message: "Logged out successfully." }`

### `GET /api/auth/me` (protected)
Requires `Authorization: Bearer <token>` or the `accessToken` cookie.
Returns the logged-in account's profile.

### `POST /api/user/register`
`multipart/form-data`, field names exactly as the frontend sends them:
`fullName, collegeName, rollNumber, mobile, email, password, userPhoto, collegeId`

Requires a **verified OTP for `email`** within the last 30 minutes, or
responds `401`.

`201`:
```json
{ "success": true, "message": "Registration successful.", "data": { "user": { "...": "..." } } }
```

### `POST /api/mess/register`
`multipart/form-data`: `ownerName, mobile, email, password, messName, address,
city, pincode, mapLink, vegType, meals[], monthlyFees, dailyFoodPrice,
securityDeposit, capacity, availableSeats, menu-<day>-<meal>, ownerPhoto,
messPhotos[] (up to 6), kitchenPhoto, diningPhoto`

Same OTP-verification requirement as user registration. Inserts the mess
row, all `messPhotos`, and any filled-in weekly-menu days in one transaction.

### Status codes used throughout
`200` `201` `400` `401` `403` `404` `409` `413` `415` `429` `500` — all as JSON,
never HTML, matching exactly what `register.js`'s `messageForResponse()`
already expects.

---

## 5. Security notes

- **Passwords**: bcrypt, 12 salt rounds, never logged, never returned in any response.
- **OTPs**: bcrypt-hashed at rest, 10-minute expiry, deleted immediately on
  successful verification, max 5 requests/hour/email, max 5 wrong attempts
  before the code is invalidated.
- **SQL injection**: every query is parameterized (`$1, $2, ...`) — no string
  concatenation of user input anywhere.
- **Rate limiting**: global limiter (300 req/15min) plus stricter limiters on
  `/api/auth/send-otp` + `/api/auth/verify-otp` (10/hour) and `/api/auth/login`
  (20/15min).
- **Helmet + CORS**: CORS is locked to `CLIENT_URL` with credentials enabled
  for the cookie-based flow.
- **JWT**: short-lived, signed with `JWT_SECRET`, carries only `id/role/email`.
- **File uploads**: type-checked (JPG/PNG/WEBP, +PDF for `collegeId` only),
  size-checked per type, count-checked (`messPhotos` max 6), renamed to random
  UUIDs on disk (original filenames are never trusted or exposed).
- **Logging**: Morgan logs request lines only — method/path/status/timing —
  never bodies, so passwords and OTPs never reach the logs.

---

## 6. Deploying to Railway

1. Push this `backend/` folder to a GitHub repo (or `railway up` from the CLI).
2. In Railway: **New Project → Deploy from GitHub repo**, select it.
3. **Add a PostgreSQL plugin** to the project — Railway sets `DATABASE_URL`
   automatically; you don't need to set it by hand.
4. Under your service's **Variables**, add:
   - `JWT_SECRET` — a long random string
   - `JWT_EXPIRES_IN` — e.g. `7d`
   - `EMAIL_USER`, `EMAIL_PASS` — Gmail address + App Password
   - `CLIENT_URL` — the deployed frontend's origin (exact scheme+host, no trailing slash)
   - `NODE_ENV=production`
   - `MAX_IMAGE_MB`, `MAX_PDF_MB`, `MAX_MESS_PHOTOS` (optional — defaults are 5/8/6)
5. Railway supplies `PORT` automatically — `server.js` already reads
   `process.env.PORT`, no change needed.
6. After the first deploy, run the migration once, either:
   - Railway's **Run Command** on the service: `npm run migrate`, or
   - Locally: `DATABASE_URL="<railway-postgres-url>" npm run migrate`
7. **Persistent uploads**: Railway's filesystem is ephemeral on redeploy — for
   a real production launch, mount a [Railway Volume](https://docs.railway.app/reference/volumes)
   at `/app/uploads`, or switch `middleware/upload.js` to stream to S3/Cloudinary
   instead of local disk. The current disk-based setup works out of the box for
   an MVP/demo deploy but uploaded files will not survive a redeploy without a
   volume attached.

---

## 7. Connecting to your existing frontend

Your `register.js` already has everything wired to call this API — **no
frontend changes are required** as long as:

1. `API_BASE_URL` in `register.js` stays `""` if you serve the frontend from
   the same Railway service as the backend (e.g. via `express.static`), **or**
   set it to your deployed backend's full origin, e.g.
   `const API_BASE_URL = "https://messmate-backend.up.railway.app";`
   if the frontend is hosted separately (Vercel/Netlify/GitHub Pages).
2. Whichever origin the frontend is served from, set that exact origin as
   `CLIENT_URL` in the backend's environment variables — CORS will reject
   requests from any other origin.
3. Field names already match exactly: `register.js` builds its `FormData`
   straight from each form's `name` attributes, and every endpoint here reads
   those same names (`fullName`, `ownerName`, `messPhotos`, `menu-monday-lunch`,
   etc.) — nothing to rename on either side.
4. The frontend's `LOGIN_PAGE` redirect (`/login.html`) after a successful
   `201` registration is unaffected by anything in this backend — build that
   page whenever you're ready; this API doesn't require it to exist yet.

No other frontend file needs to change.
