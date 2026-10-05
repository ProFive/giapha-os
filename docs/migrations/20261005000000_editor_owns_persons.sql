-- Editor chỉ được sửa/xóa những thành viên do chính họ tạo ra. Admin vẫn toàn
-- quyền. Thành viên tạo trước migration này có created_by = NULL nên chỉ admin
-- sửa được.
--
-- Quan hệ: editor chỉ được thêm/sửa/xóa khi CẢ HAI người trong quan hệ đều do
-- họ tạo. Avatar: editor chỉ được ghi file của người do họ tạo (tên file có
-- dạng "<person_id>_<slug>.<ext>", xem components/MemberForm.tsx).
--
-- Hàm SECURITY DEFINER đặt trong schema private theo khuôn của
-- 20260901000000_security_definer_and_rls_hardening.sql.

ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_persons_created_by ON public.persons (created_by);

-- Người tạo do database quyết định, không phải client: chặn mạo danh. Khi
-- UPDATE, chỉ admin được đổi created_by (ví dụ chuyển quyền cho editor khác).
-- auth.uid() IS NULL là service role hoặc ON DELETE SET NULL khi xóa tài
-- khoản từ phía server: để nguyên giá trị mới, nếu không sẽ vi phạm FK.
CREATE OR REPLACE FUNCTION private.set_person_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := auth.uid();
    ELSIF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
        NEW.created_by := OLD.created_by;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_person_creator() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_person_creator() TO authenticated;

DROP TRIGGER IF EXISTS tr_persons_creator ON public.persons;
CREATE TRIGGER tr_persons_creator
  BEFORE INSERT OR UPDATE ON public.persons
  FOR EACH ROW EXECUTE PROCEDURE private.set_person_creator();

-- Người đang đăng nhập có phải là người tạo ra person này không.
CREATE OR REPLACE FUNCTION private.created_person(target_person_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.persons
    WHERE id = target_person_id AND created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.created_person(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.created_person(uuid) TO authenticated;

-- Avatar "<uuid>_<slug>.<ext>": 36 ký tự đầu là person_id.
CREATE OR REPLACE FUNCTION private.created_person_avatar(object_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.persons
    WHERE id::text = left(object_name, 36) AND created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.created_person_avatar(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.created_person_avatar(text) TO authenticated;

-- PERSONS
DROP POLICY IF EXISTS "Admins and Editors can update persons" ON public.persons;
CREATE POLICY "Admins and Editors can update persons" ON public.persons
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_editor() AND created_by = auth.uid())
  )
  WITH CHECK (
    private.is_admin()
    OR (private.is_editor() AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins and Editors can delete persons" ON public.persons;
CREATE POLICY "Admins and Editors can delete persons" ON public.persons
  FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_editor() AND created_by = auth.uid())
  );

-- RELATIONSHIPS
DROP POLICY IF EXISTS "Admins and Editors can insert relationships" ON public.relationships;
CREATE POLICY "Admins and Editors can insert relationships" ON public.relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (
      private.is_editor()
      AND private.created_person(person_a)
      AND private.created_person(person_b)
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can update relationships" ON public.relationships;
CREATE POLICY "Admins and Editors can update relationships" ON public.relationships
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (
      private.is_editor()
      AND private.created_person(person_a)
      AND private.created_person(person_b)
    )
  )
  WITH CHECK (
    private.is_admin()
    OR (
      private.is_editor()
      AND private.created_person(person_a)
      AND private.created_person(person_b)
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete relationships" ON public.relationships;
CREATE POLICY "Admins and Editors can delete relationships" ON public.relationships
  FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (
      private.is_editor()
      AND private.created_person(person_a)
      AND private.created_person(person_b)
    )
  );

-- AVATARS
DROP POLICY IF EXISTS "Admins and editors can upload avatars" ON storage.objects;
CREATE POLICY "Admins and editors can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      private.is_admin()
      OR (private.is_editor() AND private.created_person_avatar(name))
    )
  );

DROP POLICY IF EXISTS "Admins and editors can update avatars" ON storage.objects;
CREATE POLICY "Admins and editors can update avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      private.is_admin()
      OR (private.is_editor() AND private.created_person_avatar(name))
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      private.is_admin()
      OR (private.is_editor() AND private.created_person_avatar(name))
    )
  );

DROP POLICY IF EXISTS "Admins and editors can delete avatars" ON storage.objects;
CREATE POLICY "Admins and editors can delete avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      private.is_admin()
      OR (private.is_editor() AND private.created_person_avatar(name))
    )
  );
