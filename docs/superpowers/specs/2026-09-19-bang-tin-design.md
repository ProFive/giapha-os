# Thiết kế: Bảng Tin (news board)

Ngày: 2026-09-19
Trạng thái: đã được duyệt, chờ lập kế hoạch triển khai

## 1. Mục tiêu

Thêm mục "Bảng Tin" trong dashboard: ban quản trị đăng bài (thông báo họp họ,
giỗ chạp, tin dòng họ), thành viên đã kích hoạt đọc và bình luận.

Quyết định phạm vi đã chốt:

- Bài đăng: chỉ `admin` và `editor`. Bình luận: mọi thành viên đã kích hoạt.
- Không công khai: khách chưa đăng nhập không xem được (khác với cây gia phả).
- Bài gồm tiêu đề, nội dung văn bản thuần nhiều dòng, và ảnh đính kèm.
- Tên tác giả lấy từ người tương ứng trong gia phả (`profiles.person_id`).

Ngoài phạm vi: rich text, thả cảm xúc, thông báo đẩy, chỉnh sửa bình luận,
duyệt bài, tin tự sinh từ dữ liệu giỗ/sinh nhật.

## 2. Ràng buộc đã khảo sát trong repo

- `profiles` chỉ có `id, role, is_active, created_at, updated_at`. Hệ thống
  không lưu tên người dùng ở đâu; tên duy nhất là `auth.users.email`.
- RLS của `profiles`: thành viên **chỉ đọc được profile của chính mình**
  (`docs/schema.sql:229`), admin đọc được tất cả. Vì vậy **không thể** join
  `news_comments → profiles` để lấy tên tác giả.
- Mọi thao tác ghi `profiles` của admin đi qua RPC SECURITY DEFINER
  (`set_user_role`, `set_user_active_status`… trong `app/actions/user.ts`).
- `persons` đã cho `authenticated` và `anon` đọc
  (`20260918000000_public_member_read_access.sql`).
- Khuôn mẫu module sẵn có để bám theo: `gallery_items` (bảng + RLS + bucket
  private + signed URL 1 giờ) và `custom_events`.
- Repo không có test runner: `package.json` chỉ có `dev/build/start/lint/format`.

Hệ quả thiết kế: **ghi thẳng `author_person_id` vào bài và bình luận bằng
trigger**, rồi join sang `persons`. Không nới lỏng RLS của `profiles` (tránh
lộ `role`/`is_active` của mọi người).

## 3. Dữ liệu

### 3.1 Migration `docs/migrations/20260919000000_link_profile_to_person.sql`

- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS person_id uuid
  REFERENCES public.persons(id) ON DELETE SET NULL;`
- Unique một phần: `CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_person_id
  ON public.profiles(person_id) WHERE person_id IS NOT NULL;` — một người
  trong gia phả chỉ gắn với một tài khoản.
- RPC `public.set_user_person(target_user_id uuid, target_person_id uuid)`,
  SECURITY DEFINER, chỉ `is_admin()` được gọi, theo đúng khuôn
  `set_user_role`. `REVOKE ALL FROM public/anon`, `GRANT EXECUTE TO authenticated`.
- Hàm `public.current_person_id()` SECURITY DEFINER, STABLE: trả `person_id`
  của `auth.uid()`, `GRANT EXECUTE TO authenticated`.

### 3.2 Migration `docs/migrations/20260919010000_add_news_board.sql`

```
news_posts
  id               uuid pk default gen_random_uuid()
  title            text not null
  content          text not null
  image_urls       text[] not null default '{}'
  author_person_id uuid references persons(id) on delete set null
  created_by       uuid references auth.users(id)
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()

news_comments
  id               uuid pk default gen_random_uuid()
  post_id          uuid not null references news_posts(id) on delete cascade
  content          text not null
  author_person_id uuid references persons(id) on delete set null
  created_by       uuid references auth.users(id)
  created_at       timestamptz not null default now()
```

Chỉ mục: `news_posts(created_at desc)`, `news_comments(post_id, created_at)`.

Trigger `public.set_news_author()` (BEFORE INSERT trên cả hai bảng):
ghi đè `created_by := auth.uid()` và `author_person_id := current_person_id()`.
Client không tự đặt được hai cột này, nên không mạo danh được.

Trigger `handle_updated_at` có sẵn gắn cho `news_posts`.

RLS (bật trên cả hai bảng, mọi policy `TO authenticated`):

| Bảng | Thao tác | Điều kiện |
|---|---|---|
| news_posts | SELECT | `is_active_user()` |
| news_posts | INSERT | `(is_admin() OR is_editor()) AND auth.uid() = created_by` |
| news_posts | UPDATE | `is_admin() OR is_editor()` |
| news_posts | DELETE | `is_admin() OR is_editor()` |
| news_comments | SELECT | `is_active_user()` |
| news_comments | INSERT | `is_active_user() AND auth.uid() = created_by` |
| news_comments | DELETE | `auth.uid() = created_by OR is_admin()` |

Không có policy UPDATE cho `news_comments`: bình luận không sửa được.

Grants theo khuôn `20260904000000_add_data_api_table_grants.sql`:
`REVOKE ALL ... FROM anon`, `GRANT SELECT, INSERT, UPDATE, DELETE` (bài) và
`GRANT SELECT, INSERT, DELETE` (bình luận) cho `authenticated`, `GRANT ALL`
cho `service_role`.

Storage: bucket `news`, private, giới hạn 10MB, chỉ `image/jpeg|png|gif|webp`.
Policy trên `storage.objects`: đọc = `is_active_user()`, ghi/sửa/xoá =
`is_admin() OR is_editor()`, tất cả kèm `bucket_id = 'news'`.

Cả hai file phải được thêm vào `MIGRATION_FILES` trong `app/actions/migrations.ts`.

## 4. Trang và component

### 4.1 `app/dashboard/news/page.tsx` (server component)

- `generateMetadata` dùng `getServerTranslations` như `app/dashboard/gallery/page.tsx`.
- Lấy bài kèm tác giả: `select('*, author:persons!author_person_id(id, full_name, gender, avatar_url)')`,
  sắp xếp `created_at` giảm dần.
- Đếm bình luận mỗi bài bằng `select('post_id')` trên `news_comments` rồi gom
  nhóm phía server (tránh N+1 query).
- Ký signed URL 1 giờ cho từng ảnh qua `supabase.storage.from('news')`, theo
  đúng `app/dashboard/gallery/page.tsx`. `utils/supabase/storage-path.ts` hiện
  chỉ có `getGalleryStoragePath`; thêm `getNewsStoragePath` cùng khuôn (tách
  đường dẫn trong bucket từ URL đã lưu) thay vì sửa hàm cũ.
- Truyền `canPost = profile.is_active && role ∈ {admin, editor}` xuống client.

Layout dashboard đã tự chặn khách (`app/dashboard/layout.tsx` +
`lib/publicRoutes.ts`), không cần thêm gì để giữ trang ở chế độ riêng tư.

### 4.2 Component

- `components/NewsClient.tsx` — tiêu đề trang, nút "Đăng bài" (chỉ khi
  `canPost`), danh sách `NewsPostCard`, trạng thái rỗng.
- `components/NewsPostCard.tsx` — tiêu đề, nội dung (giữ xuống dòng bằng
  `whitespace-pre-wrap`), lưới ảnh, tên + ảnh tác giả, thời gian tương đối,
  nút sửa/xoá khi `canPost`, nút "Bình luận (n)".
- `components/NewsComments.tsx` — mở ra mới tải bình luận qua supabase client
  (`useUser().supabase`), ô nhập, nút gửi, xoá bình luận của mình (admin xoá
  được mọi bình luận).
- `components/modal/NewsPostModal.tsx` — soạn/sửa bài, chọn nhiều ảnh, tải lên
  bucket `news`, theo khuôn `components/modal/UploadModal.tsx`.

### 4.3 `app/actions/news.ts`

`createPost`, `updatePost`, `deletePost`, `deleteComment` — đều kiểm tra
quyền qua `getProfile()` trước khi gọi Supabase (khuôn `app/actions/member.ts`:
kiểm tra UUID, trả `{ error: t(...) }`), kết thúc bằng
`revalidatePath('/dashboard/news')`. Xoá bài phải xoá kèm ảnh trong bucket.

Bình luận được tạo trực tiếp từ client qua supabase client (RLS là lớp chặn),
giống cách `MemberDetailModal` đọc dữ liệu; chỉ thao tác xoá và thao tác trên
bài mới đi qua server action.

## 5. Gán tài khoản ↔ người trong gia phả

- `app/dashboard/users/page.tsx` nạp thêm danh sách `persons` và truyền xuống.
- `components/AdminUserList.tsx`: mỗi tài khoản thêm một `PersonSelector`
  (component đã có, nhận `persons`, `selectedId`, `onSelect`), gọi action mới
  `setUserPerson` trong `app/actions/user.ts` → RPC `set_user_person`.
- Tài khoản chưa gán vẫn bình luận được; `author_person_id` là null và giao
  diện hiển thị nhãn chung `t('newsAnonymousAuthor')` ("Thành viên").

## 6. Điều hướng, i18n, types

- `components/HeaderMenu.tsx`: thêm mục `/dashboard/news`, icon `Newspaper`
  (lucide-react), nhãn `t('news')`, đặt ngay sau "Cây gia phả".
- `app/dashboard/page.tsx`: thêm card dẫn tới Bảng Tin trong danh sách tính năng.
- `lib/i18n/messages.ts`: bổ sung song song cho `vi` và `en` các khoá
  `news`, `newsTitle`, `newsDescription`, `newsCreate`, `newsEdit`,
  `newsDelete`, `newsDeleteConfirm`, `newsEmpty`, `newsTitleLabel`,
  `newsContentLabel`, `newsImagesLabel`, `newsComments`, `newsCommentPlaceholder`,
  `newsCommentSend`, `newsCommentEmpty`, `newsCommentDeleteConfirm`,
  `newsAnonymousAuthor`, `newsAccessDenied`.
- `types/index.ts`: `NewsPost`, `NewsComment`; thêm `person_id` vào `Profile`.

## 7. Kiểm thử

Repo không có test runner, nên kiểm thử là QA thủ công theo checklist:

1. Chạy 2 migration qua trang `/dashboard/upgrade`, xác nhận không lỗi.
2. Admin gán tài khoản của mình vào một người trong gia phả.
3. Admin đăng bài có 2 ảnh → bài hiện đúng tên tác giả và ảnh mở được.
4. Tài khoản `member` bình luận được, tên hiện đúng.
5. Tài khoản `member` gọi insert vào `news_posts` bằng supabase client phải bị
   RLS từ chối (42501) — xác nhận quyền nằm ở database chứ không chỉ ở giao diện.
6. `member` xoá được bình luận của mình, không xoá được của người khác.
7. Khách chưa đăng nhập vào `/dashboard/news` bị chuyển về `/login`.
8. Xoá bài → bình luận bị xoá theo, ảnh trong bucket cũng bị xoá.
9. `npx tsc --noEmit` và `npx eslint` sạch.

## 8. Thứ tự triển khai

1. Migration 1 (`person_id` + RPC + `current_person_id`) và giao diện gán
   tài khoản ↔ thành viên.
2. Migration 2 (bảng, RLS, bucket) + đăng ký vào `MIGRATION_FILES`.
3. types + i18n + điều hướng.
4. Trang và component đọc (danh sách bài, ảnh, tác giả).
5. Đăng/sửa/xoá bài (modal + server action).
6. Bình luận.
7. QA theo mục 7.
