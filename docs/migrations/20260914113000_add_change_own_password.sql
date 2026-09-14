-- Self-service password change.
-- Lets a signed-in user change their own password after proving the current
-- one. Follows the pattern from
-- 20260901000000_security_definer_and_rls_hardening.sql: the SECURITY DEFINER
-- implementation lives in the private schema and PostgREST only sees a
-- SECURITY INVOKER wrapper in public.
--
-- The old password is verified by re-hashing it with the stored hash as the
-- salt, so the plaintext is never compared outside pgcrypto.

CREATE OR REPLACE FUNCTION private.change_own_password (
  old_password text,
  new_password text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  auth,
  extensions AS $$
DECLARE
  uid uuid := auth.uid();
  current_hash text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters.';
  END IF;

  SELECT encrypted_password INTO current_hash
  FROM auth.users
  WHERE id = uid;

  IF current_hash IS NULL
     OR extensions.crypt(coalesce(old_password, ''), current_hash) <> current_hash THEN
    RAISE EXCEPTION 'Current password is incorrect.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION private.change_own_password (text, text)
FROM
  PUBLIC,
  anon,
  authenticated;

GRANT
EXECUTE ON FUNCTION private.change_own_password (text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.change_own_password (
  old_password text,
  new_password text
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET
  search_path = '' AS $$
BEGIN
  PERFORM private.change_own_password(old_password, new_password);
END;
$$;

REVOKE ALL ON FUNCTION public.change_own_password (text, text)
FROM
  PUBLIC,
  anon;

GRANT
EXECUTE ON FUNCTION public.change_own_password (text, text) TO authenticated;
