-- ==========================================
-- GIAPHA-OS D1 (SQLite) SCHEMA
-- Converted from PostgreSQL/Supabase schema
-- ==========================================

-- USERS (replaces auth.users from Supabase)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SESSIONS (custom auth sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- PROFILES (application user metadata)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'editor', 'member')),
  is_active INTEGER NOT NULL DEFAULT 0,
  person_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_person_id ON profiles(person_id) WHERE person_id IS NOT NULL;

-- USER APPROVAL REQUESTS
CREATE TABLE IF NOT EXISTS user_approval_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  notified_at TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_approval_requests_expires_at ON user_approval_requests(expires_at);

-- PERSONS (core family tree entity)
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female', 'other')),
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  death_year INTEGER,
  death_month INTEGER,
  death_day INTEGER,
  death_lunar_year INTEGER,
  death_lunar_month INTEGER,
  death_lunar_day INTEGER,
  is_deceased INTEGER NOT NULL DEFAULT 0,
  is_in_law INTEGER NOT NULL DEFAULT 0,
  birth_order INTEGER,
  generation INTEGER,
  other_names TEXT,
  dharma_name TEXT,
  age_at_death INTEGER,
  avatar_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_persons_full_name ON persons(full_name);
CREATE INDEX IF NOT EXISTS idx_persons_generation ON persons(generation);
CREATE INDEX IF NOT EXISTS idx_persons_gender ON persons(gender);
CREATE INDEX IF NOT EXISTS idx_persons_is_deceased ON persons(is_deceased);
CREATE INDEX IF NOT EXISTS idx_persons_birth_year ON persons(birth_year);

-- PERSON DETAILS PRIVATE (sensitive data)
CREATE TABLE IF NOT EXISTS person_details_private (
  person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  phone_number TEXT,
  occupation TEXT,
  current_residence TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RELATIONSHIPS (family relationships between persons)
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('marriage', 'biological_child', 'adopted_child')),
  person_a TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person_b TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(person_a != person_b),
  UNIQUE(person_a, person_b, type)
);
CREATE INDEX IF NOT EXISTS idx_relationships_person_a ON relationships(person_a);
CREATE INDEX IF NOT EXISTS idx_relationships_person_b ON relationships(person_b);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

-- CUSTOM EVENTS
CREATE TABLE IF NOT EXISTS custom_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT,
  event_date TEXT NOT NULL,
  location TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_events_date ON custom_events(event_date);

-- GALLERY ITEMS
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  event_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_items_event_date ON gallery_items(event_date);

-- NEWS POSTS
CREATE TABLE IF NOT EXISTS news_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  -- stored as JSON array: ["path1", "path2"]
  image_urls TEXT NOT NULL DEFAULT '[]',
  author_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_posts_created_at ON news_posts(created_at DESC);

-- NEWS COMMENTS
CREATE TABLE IF NOT EXISTS news_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_comments_post ON news_comments(post_id, created_at);
