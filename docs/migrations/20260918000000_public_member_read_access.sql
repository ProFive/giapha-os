-- Public (logged-out) read access for the family tree at /dashboard/members.
--
-- Viewers can browse members and open a member's details without an account,
-- so the anon role needs SELECT on the two tables that page reads: persons
-- and relationships. Writes stay with admins and editors, and every other
-- table keeps its login-only grants from
-- 20260904000000_add_data_api_table_grants.sql.
--
-- person_details_private (phone number, occupation, current residence) is
-- explicitly kept out of anon's reach: contact details are never public.
--
-- Which pages render for a guest is decided in lib/publicRoutes.ts, but this
-- file is the real boundary — keep the two in sync.

DO $$
BEGIN
  IF to_regclass('public.persons') IS NOT NULL THEN
    GRANT SELECT ON public.persons TO anon;

    DROP POLICY IF EXISTS "Guests can view persons" ON public.persons;
    CREATE POLICY "Guests can view persons" ON public.persons
      FOR SELECT TO anon
      USING (true);
  END IF;

  IF to_regclass('public.relationships') IS NOT NULL THEN
    GRANT SELECT ON public.relationships TO anon;

    DROP POLICY IF EXISTS "Guests can view relationships" ON public.relationships;
    CREATE POLICY "Guests can view relationships" ON public.relationships
      FOR SELECT TO anon
      USING (true);
  END IF;

  -- Contact details stay private even though the tree is public.
  IF to_regclass('public.person_details_private') IS NOT NULL THEN
    REVOKE ALL ON public.person_details_private FROM anon;
  END IF;

  -- Avatars stay behind the login wall (/api/avatar rejects guests), so the
  -- storage bucket keeps its authenticated-only read policy.
END;
$$;
