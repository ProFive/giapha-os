export type Gender = 'male' | 'female' | 'other'
export type RelationshipType = 'marriage' | 'biological_child' | 'adopted_child'
export type UserRole = 'admin' | 'editor' | 'member'

export interface Profile {
  id: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
  person_id: string | null
}

export interface AdminUserData {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
  person_id: string | null
}

export interface Person {
  id: string
  full_name: string
  gender: Gender
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  death_year: number | null
  death_month: number | null
  death_day: number | null
  avatar_url: string | null
  note: string | null
  created_at: string
  updated_at: string

  // Private fields (optional, as they might not be returned for members)
  phone_number?: string | null
  occupation?: string | null
  current_residence?: string | null

  // Lunar Date
  death_lunar_year: number | null
  death_lunar_month: number | null
  death_lunar_day: number | null

  // New fields
  is_deceased: boolean
  is_in_law: boolean
  birth_order: number | null
  generation: number | null
  other_names: string | null
  dharma_name: string | null
  age_at_death: number | null
}

export interface Relationship {
  id: string
  type: RelationshipType
  person_a: string // UUID
  person_b: string // UUID
  note?: string | null
  created_at: string
  updated_at: string
}

// Helper types for UI
export interface PersonWithDetails extends Person {
  spouses?: Person[]
  children?: Person[]
  parents?: Person[]
}

export interface GalleryItem {
  id: string
  title: string
  description: string | null
  image_url: string
  event_date: string | null // ISO string or date string
  created_at: string
  created_by: string | null
  // Storage path used to create signed URLs and delete the object.
  storage_path?: string
}

/** Người trong gia phả đứng tên một bài hoặc một bình luận. */
export interface NewsAuthor {
  id: string
  full_name: string
  gender: Gender
  avatar_url: string | null
}

export interface NewsPost {
  id: string
  title: string
  content: string
  /** Đường dẫn trong bucket `news`; trang server đổi thành signed URL khi render. */
  image_urls: string[]
  author_person_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  author?: NewsAuthor | null
  comment_count?: number
}

export interface NewsComment {
  id: string
  post_id: string
  content: string
  author_person_id: string | null
  created_by: string | null
  created_at: string
  author?: NewsAuthor | null
}
