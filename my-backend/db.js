const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        ca: fs.readFileSync(path.join(__dirname, "certs", "supabase-root-ca.crt"), "utf8"),
        rejectUnauthorized: true,
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

function requirePool() {
  if (!pool) {
    const error = new Error("Supabase database is not configured. Set DATABASE_URL.");
    error.status = 503;
    throw error;
  }
  return pool;
}

async function query(text, params) {
  return requirePool().query(text, params);
}

async function ensureDatabaseReady() {
  if (!pool) {
    return {
      configured: false,
      ready: false,
      message: "DATABASE_URL is not configured.",
    };
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_state (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        state jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.rooms (
        id text PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        capacity integer NOT NULL DEFAULT 1,
        capacity_min integer NOT NULL DEFAULT 1,
        capacity_max integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'available',
        location text NOT NULL DEFAULT ''
      );

      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS section text,
        ADD COLUMN IF NOT EXISTS dept text,
        ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS image text,
        ADD COLUMN IF NOT EXISTS qr_data text;

      ALTER TABLE public.reservations
        ADD COLUMN IF NOT EXISTS legacy_id text,
        ADD COLUMN IF NOT EXISTS room_id text,
        ADD COLUMN IF NOT EXISTS room_name text,
        ADD COLUMN IF NOT EXISTS room_type text,
        ADD COLUMN IF NOT EXISTS date_filed date,
        ADD COLUMN IF NOT EXISTS use_date date,
        ADD COLUMN IF NOT EXISTS use_time text,
        ADD COLUMN IF NOT EXISTS participants integer,
        ADD COLUMN IF NOT EXISTS contact text,
        ADD COLUMN IF NOT EXISTS purpose text,
        ADD COLUMN IF NOT EXISTS members jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS remarks text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS qr_data text,
        ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

      CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique
        ON public.profiles (lower(student_id))
        WHERE student_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS reservations_legacy_id_unique
        ON public.reservations (legacy_id)
        WHERE legacy_id IS NOT NULL;

      DO $do$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'is_library_admin' AND pronamespace = 'public'::regnamespace
        ) THEN
          CREATE FUNCTION public.is_library_admin()
          RETURNS boolean
          LANGUAGE sql
          STABLE
          SECURITY DEFINER
          SET search_path = public
          AS $function$
            SELECT EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role = 'Admin'
            )
          $function$;
        END IF;
      END $do$;
    `);

    await client.query("ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY");
    await client.query("ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY");
    await client.query("DROP POLICY IF EXISTS rooms_read_authenticated ON public.rooms");
    await client.query("DROP POLICY IF EXISTS rooms_admin_all ON public.rooms");
    await client.query(`
      CREATE POLICY rooms_read_authenticated ON public.rooms
      FOR SELECT TO authenticated USING (true);

      CREATE POLICY rooms_admin_all ON public.rooms
      FOR ALL TO authenticated
      USING (public.is_library_admin())
      WITH CHECK (public.is_library_admin());
    `);

    await client.query("GRANT SELECT ON public.rooms TO authenticated");
    await client.query("GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated");
    await client.query(`
      INSERT INTO public.rooms (id, name, type, capacity, capacity_min, capacity_max, status, location)
      SELECT 'PC-' || pc, 'PC ' || pc, 'pc', 1, 1, 1, 'available',
             CASE WHEN pc <= 10 THEN 'ARC 2F' ELSE 'ARC 3F' END
      FROM generate_series(1, 20) AS pc
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO public.app_state (id, state)
      SELECT 1, jsonb_build_object(
        'users', '[]'::jsonb,
        'rooms', jsonb_agg(jsonb_build_object(
          'id', id, 'name', name, 'type', type, 'capacity', capacity,
          'capacityMin', capacity_min, 'capacityMax', capacity_max,
          'status', status, 'location', location
        ) ORDER BY id),
        'reservations', '[]'::jsonb,
        'registry', '{}'::jsonb,
        'checkins', '[]'::jsonb,
        'sessions', '[]'::jsonb,
        'nextResId', 1,
        'nextSessionId', 1,
        'draft', null
      )
      FROM public.rooms
      ON CONFLICT (id) DO NOTHING;
    `);

    return { configured: true, ready: true, message: "Database schema is ready." };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      message: error.message,
      error,
    };
  } finally {
    client.release();
  }
}

module.exports = { pool, query, requirePool, ensureDatabaseReady };
