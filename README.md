# E-LIBRARY

A digital library management system for the **University of the Visayas**.

## Features

- 🖥️ **PC Reservation** — Book a PC in under 30 seconds
- 📱 **QR Code Check-In/Out** — Scan QR codes at the ARC counter
- 🌙 **Dark Mode** — Toggle between light and dark themes
- 📊 **Dashboard** — Real-time PC availability & session tracking
- 👥 **Role-Based Access** — Student, Faculty, and Admin roles
- 📷 **Camera Scanner** — Built-in QR scanner using jsQR
- 🖨️ **Print Support** — Print reservation slips and QR codes
- 💾 **Persistent data** — Supabase PostgreSQL stores profiles, reservations, rooms, and library state
- 🔐 **Authentication** — Supabase Auth with university-ID sign-in

## Tech Stack

- **Vanilla JavaScript** (ES Modules) — No framework overhead
- **CSS** — Custom properties (variables), Flexbox, Grid
- **QRCode.js** — QR code generation
- **jsQR** — QR code scanning from camera
- **Font Awesome** — Icons

## Run the full stack

```bash
npm install
npm run dev
```

This starts:
- the frontend on http://localhost:3000
- the backend API on http://localhost:5000

## Connect Supabase

1. Copy [`my-backend/.env.example`](./my-backend/.env.example) to `my-backend/.env`.
   Set `DATABASE_URL` to the **Session Pooler** URI, `SUPABASE_URL` to the project URL,
   `SUPABASE_ANON_KEY` to the publishable/anon key, and
   `SUPABASE_SERVICE_ROLE_KEY` to the server-only service-role secret.
2. In the Supabase SQL Editor for the project, run
   [`my-backend/migrations/001_supabase_app_state.sql`](./my-backend/migrations/001_supabase_app_state.sql).
   The existing `profiles` and `reservations` tables and RLS policies must already exist.
3. Verify the backend can initialize its schema with:
   ```bash
   cd my-backend
   npm run db:init
   npm run db:check
   ```
   PostgreSQL connections validate TLS using the Supabase root CA in
   [`my-backend/certs/supabase-root-ca.crt`](./my-backend/certs/supabase-root-ca.crt).
4. Keep `.env` and the service-role secret out of source control and frontend configuration.
   On Render, add all four values as backend Environment Variables. Set the service root
   directory to `my-backend`, build command to `npm install`, and start command to `npm start`.
   Set `NODE_ENV=production` and `FRONTEND_ORIGINS` to any additional exact comma-separated
   HTTPS origins serving the app. The `elibuv.netlify.app` and `elibuvtoledo.netlify.app`
   Netlify sites are already allowed.
5. Deploy the frontend to Netlify using the included [`netlify.toml`](./netlify.toml).
   It builds with `npm run build:netlify` and publishes only `dist` (the frontend files),
   excluding backend code and environment files. [`api-config.js`](./api-config.js) routes
   hosted sites to the Render backend URL. The URL is public configuration; never put database
   passwords or service-role keys in frontend files.

The backend does not start in a usable database mode until the environment variables and SQL
migration are applied. Auth users and their matching `public.profiles` rows are required before
they can sign in. Local demo sign-ins are enabled only in development on loopback; set their IDs
and shared password only in the ignored backend `.env`. Focusing a login field reveals the local
demo selector. Production builds contain no demo credentials or demo Admin account.
After signing in as an administrator, use **Create Account** to add Student or Faculty accounts.
Public self-registration and creating additional Admin accounts are intentionally disabled.

## Project Structure
