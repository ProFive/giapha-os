-- ==========================================
-- 🚨 DANGER ZONE: DROP GIAPHA-OS DATABASE SCHEMA 🚨
-- ==========================================
-- WARNING: DO NOT RUN THIS SCRIPT UNLESS YOU KNOW EXACTLY WHAT YOU ARE DOING.
-- This script PERMANENTLY removes all tables, functions, triggers, and types created by schema.sql.
-- All data will be LOST irreversibly. Files in Vercel Blob are NOT removed.
-- ==========================================

-- 1. DROP TABLES
-- CASCADE also drops the triggers and indexes attached to these tables
DROP TABLE IF EXISTS public.news_comments CASCADE;
DROP TABLE IF EXISTS public.news_posts CASCADE;
DROP TABLE IF EXISTS public.gallery_items CASCADE;
DROP TABLE IF EXISTS public.custom_events CASCADE;
DROP TABLE IF EXISTS public.relationships CASCADE;
DROP TABLE IF EXISTS public.person_details_private CASCADE;
DROP TABLE IF EXISTS public.user_approval_requests CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.persons CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.app_migrations CASCADE;

-- 2. DROP FUNCTIONS
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- 3. DROP ENUMS
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
DROP TYPE IF EXISTS public.relationship_type_enum CASCADE;
DROP TYPE IF EXISTS public.gender_enum CASCADE;
