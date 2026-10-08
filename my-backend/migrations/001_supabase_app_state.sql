ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS dept text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image text,
  ADD COLUMN IF NOT EXISTS qr_data text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique
  ON public.profiles (lower(student_id))
  WHERE student_id IS NOT NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS reservations_legacy_id_unique
  ON public.reservations (legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_library_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  )
$$;

CREATE TABLE IF NOT EXISTS public.app_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_state FROM anon, authenticated;

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

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rooms_read_authenticated ON public.rooms;
CREATE POLICY rooms_read_authenticated ON public.rooms
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rooms_admin_all ON public.rooms;
CREATE POLICY rooms_admin_all ON public.rooms
  FOR ALL TO authenticated
  USING (public.is_library_admin())
  WITH CHECK (public.is_library_admin());

GRANT SELECT ON public.rooms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated;

INSERT INTO public.rooms (id, name, type, capacity, capacity_min, capacity_max, status, location)
SELECT 'PC-' || pc, 'PC ' || pc, 'pc', 1, 1, 1, 'available',
       CASE WHEN pc <= 10 THEN 'ARC 2F' ELSE 'ARC 3F' END
FROM generate_series(1, 20) AS pc
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_state (id, state)
SELECT 1,
  jsonb_build_object(
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
