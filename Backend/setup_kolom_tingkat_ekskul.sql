-- =====================================================================
-- Migration: Tambah Kolom 'tingkat' pada Tabel 'anggota_ekskul'
-- Deskripsi: Menyimpan tingkat Pramuka / Ekskul (Ramu, Rakit, Terap)
-- =====================================================================

-- 1. Tambah kolom tingkat (jika belum ada)
ALTER TABLE IF EXISTS public.anggota_ekskul 
ADD COLUMN IF NOT EXISTS tingkat TEXT DEFAULT '';

-- 2. Beri komentar pada kolom
COMMENT ON COLUMN public.anggota_ekskul.tingkat IS 'Tingkat Ekskul/Pramuka: Ramu, Rakit, Terap (dipisahkan koma jika lebih dari satu)';

-- 3. Pastikan schema cache di-refresh
DO $$ 
BEGIN
    NOTIFY pgrst, 'reload schema';
END $$;
