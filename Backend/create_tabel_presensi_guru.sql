-- ============================================================
-- File  : create_tabel_presensi_guru.sql
-- Tabel : presensi_guru
-- Desc  : Menyimpan catatan presensi harian setiap guru.
--         Digunakan oleh halaman presensi-guru.html (Tab Guru).
-- ============================================================

CREATE TABLE public.presensi_guru (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nik         text NOT NULL,      -- NIK / NIY guru (dari localStorage user_guru)
    nama        text NOT NULL,      -- Nama lengkap guru
    jabatan     text,               -- Jabatan utama guru
    tanggal     text NOT NULL,      -- Tanggal presensi (format: "Senin, 01 Mei 2026")
    waktu       text,               -- Jam presensi dicatat (format: "HH:MM")
    status      text NOT NULL       -- Status: Hadir | Sakit | Izin | Dinas Luar
                DEFAULT 'Hadir',
    alasan      text DEFAULT '-',   -- Keterangan tambahan / alasan izin
    created_at  timestamp with time zone DEFAULT now()
);

-- ============================================================
-- INDEX: mempercepat pencarian presensi berdasarkan NIK & tanggal
-- ============================================================
CREATE INDEX idx_presensi_guru_nik_tanggal 
    ON public.presensi_guru (nik, tanggal);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.presensi_guru ENABLE ROW LEVEL SECURITY;

-- Karena login menggunakan localStorage (bukan Supabase Auth),
-- policy dibuka untuk akses publik / anon agar JS bisa CRUD langsung.

-- 1. SELECT
CREATE POLICY "Izinkan baca semua presensi guru"
ON public.presensi_guru
FOR SELECT
USING (true);

-- 2. INSERT
CREATE POLICY "Izinkan tambah presensi guru"
ON public.presensi_guru
FOR INSERT
WITH CHECK (true);

-- 3. UPDATE
CREATE POLICY "Izinkan update presensi guru"
ON public.presensi_guru
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4. DELETE
CREATE POLICY "Izinkan hapus presensi guru"
ON public.presensi_guru
FOR DELETE
USING (true);
