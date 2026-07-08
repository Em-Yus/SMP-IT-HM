-- ============================================================
-- File  : create_tabel_presensi_siswa.sql
-- Tabel : presensi_siswa
-- Desc  : Menyimpan catatan presensi harian setiap murid.
--         Digunakan oleh halaman presensi-guru.html (Tab Murid).
-- ============================================================

CREATE TABLE public.presensi_siswa (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nipd         text NOT NULL,     -- NIPD murid (nomor induk peserta didik)
    nama         text NOT NULL,     -- Nama lengkap murid
    kelas        text,              -- Kelas murid saat presensi dicatat
    tanggal      text NOT NULL,     -- Tanggal presensi (format: "Senin, 01 Mei 2026")
    waktu_masuk  text DEFAULT '',   -- Jam tap masuk (format: "HH:MM")
    waktu_pulang text DEFAULT '',   -- Jam tap pulang (format: "HH:MM")
    status       text NOT NULL      -- Status awal yang disimpan ke DB
                 DEFAULT 'Hadir',  --   Hadir | Terlambat | Bolos | Hadir (Blm Pulang)
                                   --   Sakit | Izin | Dispensasi | Alfa
    alasan       text DEFAULT '-',  -- Keterangan izin/sakit
    created_at   timestamp with time zone DEFAULT now()
);

-- ============================================================
-- INDEX: mempercepat pencarian presensi berdasarkan NIPD & tanggal
-- ============================================================
CREATE INDEX idx_presensi_siswa_nipd_tanggal
    ON public.presensi_siswa (nipd, tanggal);

-- INDEX tambahan untuk filter per kelas
CREATE INDEX idx_presensi_siswa_kelas
    ON public.presensi_siswa (kelas);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.presensi_siswa ENABLE ROW LEVEL SECURITY;

-- Karena login menggunakan localStorage (bukan Supabase Auth),
-- policy dibuka untuk akses publik / anon agar JS bisa CRUD langsung.

-- 1. SELECT
CREATE POLICY "Izinkan baca semua presensi siswa"
ON public.presensi_siswa
FOR SELECT
USING (true);

-- 2. INSERT
CREATE POLICY "Izinkan tambah presensi siswa"
ON public.presensi_siswa
FOR INSERT
WITH CHECK (true);

-- 3. UPDATE
CREATE POLICY "Izinkan update presensi siswa"
ON public.presensi_siswa
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4. DELETE
CREATE POLICY "Izinkan hapus presensi siswa"
ON public.presensi_siswa
FOR DELETE
USING (true);
