-- Bảng Tin: admin/editor đăng bài, thành viên đã kích hoạt đọc và bình luận.
-- Khách chưa đăng nhập không đọc được (khác với cây gia phả), nên anon không
-- được cấp quyền gì ở đây.
--
-- Các hàm dùng trong policy và trigger gọi private.is_admin() / is_editor() /
-- is_active_user() / handle_updated_at() chứ không phải các wrapper
-- SECURITY INVOKER trong public: kể từ
-- 20260901000000_security_definer_and_rls_hardening.sql, mọi cài đặt
-- SECURITY DEFINER nằm trong schema private, còn public chỉ giữ wrapper cho
-- những gì PostgREST cần gọi trực tiếp. Đã xác nhận trên database thật là RLS
-- của gallery_items, persons và storage.objects đều gọi private.* - đây là
-- khuôn hiện hành, không phải bản public.* trong bản nháp ban đầu.
-- public.handle_updated_at() không tồn tại, chỉ có private.handle_updated_at().

CREATE TABLE IF NOT EXISTS public.news_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  author_person_id uuid REFERENCES public.persons (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.news_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.news_posts (id) ON DELETE CASCADE,
  content text NOT NULL,
  author_person_id uuid REFERENCES public.persons (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_posts_created_at
  ON public.news_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_comments_post
  ON public.news_comments (post_id, created_at);

-- Tác giả do database quyết định, không phải client: chặn mạo danh. Hàm nằm
-- trong private theo đúng khuôn SECURITY DEFINER hiện hành
-- (private.current_person_id, private.set_user_person ở
-- 20260919000000_link_profile_to_person.sql). Trigger không cần wrapper
-- public: trigger luôn được Postgres gọi nội bộ, không qua PostgREST.
CREATE OR REPLACE FUNCTION private.set_news_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    NEW.created_by := auth.uid();
    NEW.author_person_id := private.current_person_id();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_news_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_news_author() TO authenticated;

DROP TRIGGER IF EXISTS tr_news_posts_author ON public.news_posts;
CREATE TRIGGER tr_news_posts_author
  BEFORE INSERT ON public.news_posts
  FOR EACH ROW EXECUTE PROCEDURE private.set_news_author();

DROP TRIGGER IF EXISTS tr_news_comments_author ON public.news_comments;
CREATE TRIGGER tr_news_comments_author
  BEFORE INSERT ON public.news_comments
  FOR EACH ROW EXECUTE PROCEDURE private.set_news_author();

DROP TRIGGER IF EXISTS tr_news_posts_updated_at ON public.news_posts;
CREATE TRIGGER tr_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE PROCEDURE private.handle_updated_at();

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view news posts" ON public.news_posts;
CREATE POLICY "Active users can view news posts" ON public.news_posts
  FOR SELECT TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "Editors can insert news posts" ON public.news_posts;
CREATE POLICY "Editors can insert news posts" ON public.news_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    (private.is_admin() OR private.is_editor())
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS "Editors can update news posts" ON public.news_posts;
CREATE POLICY "Editors can update news posts" ON public.news_posts
  FOR UPDATE TO authenticated
  USING (private.is_admin() OR private.is_editor())
  WITH CHECK (private.is_admin() OR private.is_editor());

DROP POLICY IF EXISTS "Editors can delete news posts" ON public.news_posts;
CREATE POLICY "Editors can delete news posts" ON public.news_posts
  FOR DELETE TO authenticated
  USING (private.is_admin() OR private.is_editor());

DROP POLICY IF EXISTS "Active users can view news comments" ON public.news_comments;
CREATE POLICY "Active users can view news comments" ON public.news_comments
  FOR SELECT TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "Active users can insert news comments" ON public.news_comments;
CREATE POLICY "Active users can insert news comments" ON public.news_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_active_user()
    AND auth.uid() = created_by
  );

-- Bình luận không sửa được: cố ý không có policy UPDATE.
DROP POLICY IF EXISTS "Authors and admins can delete news comments" ON public.news_comments;
CREATE POLICY "Authors and admins can delete news comments" ON public.news_comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR private.is_admin()
  );

-- REVOKE ALL cả authenticated (không chỉ anon): schema public có default ACL
-- cấp ALL cho authenticated ngay khi CREATE TABLE (đã xác nhận qua
-- pg_default_acl trên database thật), gồm cả TRUNCATE - lệnh không bị RLS lọc.
-- Nếu chỉ GRANT thêm mà không REVOKE ALL trước, authenticated vẫn còn
-- TRUNCATE/REFERENCES/TRIGGER thừa từ default ACL, và TRUNCATE trên
-- news_posts sẽ xóa sạch cả news_comments qua ON DELETE CASCADE, bất kể policy
-- viết gì.
REVOKE ALL ON public.news_posts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;

REVOKE ALL ON public.news_comments FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.news_comments TO authenticated;
GRANT ALL ON public.news_comments TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'news', 'news', FALSE, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

DROP POLICY IF EXISTS "Active users can view news files" ON storage.objects;
CREATE POLICY "Active users can view news files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'news'
    AND private.is_active_user()
  );

DROP POLICY IF EXISTS "Editors can upload news files" ON storage.objects;
CREATE POLICY "Editors can upload news files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'news'
    AND (private.is_admin() OR private.is_editor())
  );

DROP POLICY IF EXISTS "Editors can update news files" ON storage.objects;
CREATE POLICY "Editors can update news files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'news'
    AND (private.is_admin() OR private.is_editor())
  )
  WITH CHECK (
    bucket_id = 'news'
    AND (private.is_admin() OR private.is_editor())
  );

DROP POLICY IF EXISTS "Editors can delete news files" ON storage.objects;
CREATE POLICY "Editors can delete news files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'news'
    AND (private.is_admin() OR private.is_editor())
  );
