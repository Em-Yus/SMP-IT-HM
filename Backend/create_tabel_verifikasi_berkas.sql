-- File: create_tabel_verifikasi_berkas.sql
-- Keterangan: Silakan jalankan script SQL ini di SQL Editor Supabase Anda.

CREATE TABLE public.verifikasi_berkas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_siswa bigint NOT NULL,
    ceklis_formulir text DEFAULT 'Tidak'::text,
    ceklis_ijazah text DEFAULT 'Tidak'::text,
    ceklis_pindah text DEFAULT 'Tidak'::text,
    ceklis_kk text DEFAULT 'Tidak'::text,
    ceklis_ktp text DEFAULT 'Tidak'::text,
    ceklis_akta text DEFAULT 'Tidak'::text,
    ceklis_foto text DEFAULT 'Tidak'::text,
    ceklis_pip text DEFAULT 'Tidak'::text,
    ceklis_rapor text DEFAULT 'Tidak'::text,
    kesimpulan_status text DEFAULT 'Belum Verifikasi'::text,
    created_at timestamp with time zone DEFAULT now(),
    
    -- Foreign Key Relasi ke tabel data_siswa
    -- ON DELETE CASCADE memastikan jika data_siswa dihapus, maka row verifikasi ini ikut terhapus
    CONSTRAINT fk_id_siswa 
      FOREIGN KEY (id_siswa) 
      REFERENCES public.data_siswa (id) 
      ON DELETE CASCADE
);

-- MENGAKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.verifikasi_berkas ENABLE ROW LEVEL SECURITY;

-- MEMBUAT POLICY CRUD (Akses Publik / Anonim)
-- Karena sistem saat ini menggunakan localStorage untuk login, bukan Supabase Auth bawaan,
-- maka policy diset public (true) agar aplikasi bisa melakukan operasi baca-tulis dari browser.

-- 1. Policy untuk READ (SELECT)
CREATE POLICY "Izinkan baca semua data verifikasi" 
ON public.verifikasi_berkas 
FOR SELECT 
USING (true);

-- 2. Policy untuk CREATE (INSERT)
CREATE POLICY "Izinkan tambah data verifikasi" 
ON public.verifikasi_berkas 
FOR INSERT 
WITH CHECK (true);

-- 3. Policy untuk UPDATE
CREATE POLICY "Izinkan update data verifikasi" 
ON public.verifikasi_berkas 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- 4. Policy untuk DELETE
CREATE POLICY "Izinkan hapus data verifikasi" 
ON public.verifikasi_berkas 
FOR DELETE 
USING (true);
