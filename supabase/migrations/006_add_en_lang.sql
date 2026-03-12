-- Add 'en' to lang CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_lang_check;
ALTER TABLE users ADD CONSTRAINT users_lang_check CHECK (lang IN ('kz', 'ru', 'en'));
