-- Adds Dharma name (Pháp danh) and age at death (Hưởng thọ) to persons.

ALTER TABLE public.persons
ADD COLUMN IF NOT EXISTS dharma_name TEXT;

ALTER TABLE public.persons
ADD COLUMN IF NOT EXISTS age_at_death INT;
