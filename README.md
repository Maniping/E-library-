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

1. In the Supabase SQL Editor for the `elibtoledo` project, run
   [`my-backend/migrations/001_supabase_app_state.sql`](./my-backend/migrations/001_supabase_app_state.sql).
   The existing `profiles` and `reservations` tables and RLS policies must already exist.
2. Copy [`my-backend/.env.example`](./my-backend/.env.example) to `my-backend/.env`.
   Set `DATABASE_URL` to the **Session Pooler** URI, `SUPABASE_URL` to the project URL,
   `SUPABASE_ANON_KEY` to the publishable/anon key, and
   `SUPABASE_SERVICE_ROLE_KEY` to the server-only service-role secret.
3. Keep `.env` and the service-role secret out of source control and frontend configuration.
   On Render, add all four values as backend Environment Variables. Set the service root
   directory to `my-backend`, build command to `npm install`, and start command to `npm start`.
4. Set `window.UV_API_BASE` in [`api-config.js`](./api-config.js) to the deployed backend's
   public HTTPS URL, then redeploy the Netlify frontend. The URL is public configuration;
   never place a database password or service-role key there.

The backend does not start in a usable database mode until the environment variables and SQL
migration are applied. The application no longer includes demo accounts. Auth users and their
matching `public.profiles` rows are required before they can sign in.

## Project Structure
