-- Admin password reset.
-- Adds an admin-only RPC that overwrites a user's password with a new one.
-- Follows the pattern established in
-- 20260901000000_security_definer_and_rls_hardening.sql: the SECURITY DEFINER
-- implementation lives in the private schema and PostgREST only sees a
-- SECURITY INVOKER wrapper in public.

CREATE OR REPLACE FUNCTION private.admin_reset_user_password (
  target_user_id uuid,
  new_password text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  auth,
  extensions AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_reset_user_password (uuid, text)
FROM
  PUBLIC,
  anon,
  authenticated;

GRANT
EXECUTE ON FUNCTION private.admin_reset_user_password (uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password (
  target_user_id uuid,
  new_password text
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET
  search_path = '' AS $$
BEGIN
  PERFORM private.admin_reset_user_password(target_user_id, new_password);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password (uuid, text)
FROM
  PUBLIC,
  anon;

GRANT
EXECUTE ON FUNCTION public.admin_reset_user_password (uuid, text) TO authenticated;
