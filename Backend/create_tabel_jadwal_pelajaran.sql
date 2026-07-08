-- File: create_tabel_jadwal_pelajaran.sql
-- Keterangan: Silakan jalankan script SQL ini di SQL Editor Supabase Anda.

CREATE TABLE public.jadwal_pelajaran (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hari text NOT NULL,
    kelas text,
    jam_ke text,
    waktu text,
    ruang text,
    mapel text,
    guru text,
    is_istirahat boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- MENGAKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.jadwal_pelajaran ENABLE ROW LEVEL SECURITY;

-- MEMBUAT POLICY CRUD (Akses Publik / Anonim)
-- Karena sistem saat ini menggunakan localStorage untuk login, 
-- policy diset public (true) agar aplikasi bisa melakukan operasi baca-tulis dari browser.

-- 1. Policy untuk READ (SELECT)
CREATE POLICY "Izinkan baca semua jadwal pelajaran" 
ON public.jadwal_pelajaran 
FOR SELECT 
USING (true);

-- 2. Policy untuk CREATE (INSERT)
CREATE POLICY "Izinkan tambah jadwal pelajaran" 
ON public.jadwal_pelajaran 
FOR INSERT 
WITH CHECK (true);

-- 3. Policy untuk UPDATE
CREATE POLICY "Izinkan update jadwal pelajaran" 
ON public.jadwal_pelajaran 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- 4. Policy untuk DELETE
CREATE POLICY "Izinkan hapus jadwal pelajaran" 
ON public.jadwal_pelajaran 
FOR DELETE 
USING (true);
