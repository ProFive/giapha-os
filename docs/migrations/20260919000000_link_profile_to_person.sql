-- Gắn một tài khoản đăng nhập với một người trong gia phả.
--
-- Bảng Tin cần hiển thị tên người đăng bài và người bình luận, nhưng RLS của
-- profiles chỉ cho mỗi người đọc profile của chính mình (docs/schema.sql:229),
-- nên không thể join profiles để lấy tên. Thay vào đó mỗi tài khoản trỏ tới
-- một người trong persons; bài và bình luận lưu sẵn person đó (xem
-- 20260919010000_add_news_board.sql) rồi join sang persons - bảng mà mọi
-- thành viên đều đọc được.
--
-- Các hàm SECURITY DEFINER mới theo đúng khuôn của
-- 20260901000000_security_definer_and_rls_hardening.sql (và các migration sau
-- nó như 20260914110000, 20260914113000): cài đặt SECURITY DEFINER nằm trong
-- schema private, PostgREST/public chỉ thấy wrapper SECURITY INVOKER. Đây là
-- khuôn hiện hành của toàn bộ RPC admin trong codebase (khác với ví dụ cũ,
-- SECURITY DEFINER thẳng trong public, còn thấy ở phần đầu docs/schema.sql
-- trước khi bị hardening thay thế).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons (id) ON DELETE SET NULL;

-- Một người trong gia phả chỉ gắn với tối đa một tài khoản.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_person_id
  ON public.profiles (person_id)
  WHERE person_id IS NOT NULL;

-- Người đang đăng nhập trỏ tới ai trong gia phả. SECURITY DEFINER để vượt qua
-- RLS của profiles, STABLE để gọi được nhiều lần trong một câu lệnh.
CREATE OR REPLACE FUNCTION private.current_person_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT person_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.current_person_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_person_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_person_id()
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
  SELECT private.current_person_id();
$$;

REVOKE ALL ON FUNCTION public.current_person_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated;

-- Chỉ admin được gán tài khoản với người trong gia phả, theo đúng khuôn
-- set_user_role: client không bao giờ UPDATE thẳng vào profiles.
CREATE OR REPLACE FUNCTION private.set_user_person(target_user_id uuid, target_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT private.is_admin() THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    IF target_person_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.persons WHERE id = target_person_id) THEN
        RAISE EXCEPTION 'Person not found.';
    END IF;

    IF target_person_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.profiles
         WHERE person_id = target_person_id AND id <> target_user_id
       ) THEN
        RAISE EXCEPTION 'Person already linked to another account.';
    END IF;

    UPDATE public.profiles
    SET person_id = target_person_id
    WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION private.set_user_person(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_user_person(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_person(target_user_id uuid, target_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.set_user_person(target_user_id, target_person_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_person(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_person(uuid, uuid) TO authenticated;

-- get_admin_users trả thêm person_id để màn hình quản trị hiện lựa chọn hiện
-- tại. Kiểu composite đang được private.get_admin_users dùng làm kiểu trả về;
-- ALTER TYPE ... ADD ATTRIBUTE vẫn chạy được trong khi hàm còn tồn tại (đã
-- thử trong transaction), nên không cần DROP FUNCTION trước.
--
-- Chạy lại lần hai: ADD ATTRIBUTE sẽ lỗi
-- "column \"person_id\" of relation \"admin_user_data\" already exists".
-- Bọc trong DO để idempotent.
DO $$
BEGIN
  ALTER TYPE public.admin_user_data ADD ATTRIBUTE person_id uuid CASCADE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_admin_users()
RETURNS SETOF public.admin_user_data
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT private.is_admin() THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    RETURN QUERY
    SELECT au.id, au.email::text, p.role, au.created_at, p.is_active, p.person_id
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    ORDER BY au.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION private.get_admin_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_admin_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS SETOF public.admin_user_data
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.get_admin_users(); $$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
