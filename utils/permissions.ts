import { Profile } from '@/types'

// Admin sửa được mọi thành viên; editor chỉ sửa được thành viên do chính họ
// tạo. Khớp với RLS ở docs/migrations/20261005000000_editor_owns_persons.sql.
export function canManagePerson(
  profile: Pick<Profile, 'id' | 'role' | 'is_active'> | null | undefined,
  person: { created_by?: string | null } | null | undefined
) {
  if (!profile?.is_active || !person) return false
  if (profile.role === 'admin') return true
  return profile.role === 'editor' && person.created_by === profile.id
}
